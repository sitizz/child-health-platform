"""LLM communication layer (Google Gemini).

Takes approved engine recommendations and rewrites them into clearer
caregiver language, short summaries, and optional translations.

Safety contract:
- Deterministic risk engine remains the only decision-maker.
- Gemini may ONLY rewrite / summarize / translate approved text.
- Any ungrounded or medical-invention output is rejected → rule fallback.
"""

from __future__ import annotations

import hashlib
import json
import re
from typing import Any, Literal

import httpx

from app.core.config import Settings
from app.core.logging import get_logger
from app.ml.text_simplifier import flesch_kincaid_grade, simplify_recommendation_bundle

logger = get_logger(__name__)

LANGUAGE_NAMES: dict[str, str] = {
    "en": "English",
    "ms": "Bahasa Melayu",
    "ur": "Urdu",
    "id": "Bahasa Indonesia",
}

CommunicationSource = Literal["gemini", "rules"]

# Phrases that usually mean the model invented clinical content.
_FORBIDDEN_PATTERNS: tuple[re.Pattern[str], ...] = tuple(
    re.compile(pat, re.I)
    for pat in (
        r"\bdiagnos(e|is|ed|ing)\b",
        r"\bprescription\b",
        r"\bprescribe[ds]?\b",
        r"\bdosage\b",
        r"\bmg\b",
        r"\bml\b",
        r"\bantibiotic",
        r"\bparacetamol\b",
        r"\bacetaminophen\b",
        r"\bibuprofen\b",
        r"\baspirin\b",
        r"\bmedicine\b",
        r"\bmedication\b",
        r"\bdrug\b",
        r"\binjection\b",
        r"\bvaccine\b",
        r"\bsurgery\b",
        r"\byou (have|has|had)\b",
        r"\bthe child (has|have) (dengue|malaria|pneumonia|asthma attack)\b",
        r"\bthis (is|means) (dengue|malaria|pneumonia)\b",
        r"\bcure\b",
        r"\btreat(ment|s|ed|ing)? with\b",
        r"\bi recommend (taking|giving) (a |an )?(pill|tablet|syrup|dose)\b",
    )
)

_STOPWORDS = {
    "a",
    "an",
    "the",
    "and",
    "or",
    "to",
    "of",
    "in",
    "on",
    "for",
    "with",
    "if",
    "is",
    "are",
    "be",
    "by",
    "at",
    "as",
    "from",
    "that",
    "this",
    "it",
    "your",
    "you",
    "child",
}

# Common plain-language substitutions allowed even if absent from source wording.
_ALLOWED_REWRITE_TOKENS = {
    "water",
    "drink",
    "drinks",
    "drinking",
    "fluid",
    "fluids",
    "cooler",
    "cool",
    "shade",
    "hot",
    "heat",
    "clinic",
    "doctor",
    "nurse",
    "help",
    "now",
    "give",
    "keep",
    "stay",
    "indoor",
    "indoors",
    "outside",
    "outdoor",
    "breathing",
    "breathe",
    "tired",
    "weak",
    "home",
    "air",
    "clean",
    "mosquito",
    "mosquitoes",
    "puddle",
    "puddles",
    "rain",
    "weather",
    "watch",
    "closely",
    "safer",
    "safe",
    "rest",
    "limit",
    "reduce",
    "avoid",
    "go",
}

# High-risk clinical tokens that must already appear in the approved source.
_SOURCE_REQUIRED_IF_USED = {
    "dengue",
    "malaria",
    "pneumonia",
    "asthma",
    "wheezing",
    "dehydration",
    "fever",
    "flood",
    "antibiotic",
    "paracetamol",
    "ibuprofen",
    "aspirin",
    "vaccine",
    "injection",
    "surgery",
    "diagnose",
    "diagnosis",
    "prescription",
    "dosage",
}


class LLMCommunicator:
    def __init__(
        self,
        http_client: httpx.AsyncClient,
        settings: Settings,
        cache: Any | None = None,
    ) -> None:
        self._http = http_client
        self._settings = settings
        self._cache = cache

    @property
    def enabled(self) -> bool:
        return bool(self._settings.gemini_api_key)

    @property
    def model(self) -> str:
        return self._settings.gemini_model

    async def simplify_recommendation_bundle(
        self,
        *,
        why: str,
        priority_actions: list[str],
        secondary_actions: list[str],
        monitoring_advice: list[str],
        escalation_advice: list[str],
        language: str = "en",
    ) -> dict[str, Any]:
        """Rewrite approved recommendation text for caregivers."""
        fallback = simplify_recommendation_bundle(
            why=why,
            priority_actions=priority_actions,
            secondary_actions=secondary_actions,
            monitoring_advice=monitoring_advice,
            escalation_advice=escalation_advice,
        )
        fallback["source"] = "rules"
        fallback["llm_model"] = None

        if not self.enabled:
            return fallback

        payload = {
            "why": why,
            "priority_actions": priority_actions,
            "secondary_actions": secondary_actions,
            "monitoring_advice": monitoring_advice,
            "escalation_advice": escalation_advice,
            "language": language,
        }
        cache_key = _cache_key("rec", payload)
        cached = await self._cache_get(cache_key)
        if cached is not None:
            return cached

        try:
            result = await self._rewrite_with_gemini(payload, language)
            validate_grounded_rewrite(payload, result, language=language)
            result["source"] = "gemini"
            result["llm_model"] = self.model
            await self._cache_set(cache_key, result)
            return result
        except Exception:
            logger.exception("gemini_rewrite_rejected_or_failed_falling_back_to_rules")
            return fallback

    async def simplify_risk_actions(
        self,
        *,
        summary: str,
        immediate: list[str],
        when_to_escalate: list[str],
        language: str = "en",
    ) -> dict[str, Any]:
        """Rewrite environment-risk action lists for caregivers."""
        from app.ml.text_simplifier import simplify_list, simplify_text

        rule_summary = simplify_text(summary).simplified
        rule_immediate = simplify_list(immediate)
        rule_escalate = simplify_list(when_to_escalate)
        grades = [
            simplify_text(item).flesch_kincaid_grade
            for item in [summary, *immediate, *when_to_escalate]
        ]
        fallback = {
            "summary": rule_summary,
            "immediate": rule_immediate,
            "when_to_escalate": rule_escalate,
            "average_flesch_kincaid_grade": (
                round(sum(grades) / len(grades), 2) if grades else None
            ),
            "source": "rules",
            "llm_model": None,
        }
        if not self.enabled:
            return fallback

        payload = {
            "why": summary,
            "priority_actions": immediate,
            "secondary_actions": [],
            "monitoring_advice": [],
            "escalation_advice": when_to_escalate,
            "language": language,
        }
        cache_key = _cache_key("risk", payload)
        cached = await self._cache_get(cache_key)
        if cached is not None:
            return {
                "summary": cached.get("summary", rule_summary),
                "immediate": cached.get("priority_actions", rule_immediate),
                "when_to_escalate": cached.get("escalation_advice", rule_escalate),
                "average_flesch_kincaid_grade": cached.get("readability", {}).get(
                    "average_flesch_kincaid_grade"
                ),
                "source": cached.get("source", "gemini"),
                "llm_model": cached.get("llm_model"),
            }

        try:
            rewritten = await self._rewrite_with_gemini(payload, language)
            validate_grounded_rewrite(payload, rewritten, language=language)
            out = {
                "summary": rewritten["summary"],
                "immediate": rewritten["priority_actions"],
                "when_to_escalate": rewritten["escalation_advice"],
                "average_flesch_kincaid_grade": rewritten.get("readability", {}).get(
                    "average_flesch_kincaid_grade"
                ),
                "source": "gemini",
                "llm_model": self.model,
            }
            await self._cache_set(cache_key, rewritten)
            return out
        except Exception:
            logger.exception(
                "gemini_risk_rewrite_rejected_or_failed_falling_back_to_rules"
            )
            return fallback

    async def _rewrite_with_gemini(
        self, payload: dict[str, Any], language: str
    ) -> dict[str, Any]:
        lang_name = LANGUAGE_NAMES.get(language, "English")
        system = _build_system_prompt(lang_name)
        user = _build_user_prompt(payload, language)
        raw = await self._generate(system, user)
        data = _parse_json_object(raw)

        summary = str(data.get("summary") or "").strip()
        why = str(data.get("why") or "").strip()
        priority = _as_str_list(data.get("priority_actions"), [])
        secondary = _as_str_list(data.get("secondary_actions"), [])
        monitoring = _as_str_list(data.get("monitoring_advice"), [])
        escalation = _as_str_list(data.get("escalation_advice"), [])

        # Exact list cardinality: reject (don't truncate) so invented bullets fail closed.
        _require_list_length(priority, payload["priority_actions"], "priority_actions")
        _require_list_length(
            secondary, payload["secondary_actions"], "secondary_actions"
        )
        _require_list_length(
            monitoring, payload["monitoring_advice"], "monitoring_advice"
        )
        _require_list_length(
            escalation, payload["escalation_advice"], "escalation_advice"
        )

        if not why:
            why = str(payload.get("why") or "").strip()
        if not summary:
            summary = why or (priority[0] if priority else "")

        all_text = " ".join(
            [summary, why, *priority, *secondary, *monitoring, *escalation]
        )
        return {
            "summary": summary,
            "why": why,
            "priority_actions": priority,
            "secondary_actions": secondary,
            "monitoring_advice": monitoring,
            "escalation_advice": escalation,
            "readability": {
                "average_flesch_kincaid_grade": flesch_kincaid_grade(all_text),
                "why_reading_ease": None,
            },
        }

    async def _generate(self, system: str, user: str) -> str:
        key = self._settings.gemini_api_key
        if not key:
            raise RuntimeError("GEMINI_API_KEY not configured")
        model = self.model
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{model}:generateContent"
        )
        body = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": user}]}],
            "generationConfig": {
                # Near-deterministic rewrite; creativity increases hallucination risk.
                "temperature": 0.0,
                "topP": 0.1,
                "topK": 1,
                "maxOutputTokens": 1024,
                "responseMimeType": "application/json",
            },
            "safetySettings": [
                {
                    "category": "HARM_CATEGORY_HARASSMENT",
                    "threshold": "BLOCK_MEDIUM_AND_ABOVE",
                },
                {
                    "category": "HARM_CATEGORY_HATE_SPEECH",
                    "threshold": "BLOCK_MEDIUM_AND_ABOVE",
                },
                {
                    "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    "threshold": "BLOCK_MEDIUM_AND_ABOVE",
                },
                {
                    "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                    "threshold": "BLOCK_MEDIUM_AND_ABOVE",
                },
            ],
        }
        response = await self._http.post(
            url,
            params={"key": key},
            json=body,
            timeout=self._settings.gemini_timeout_seconds,
        )
        if response.status_code >= 400:
            raise RuntimeError(
                f"Gemini HTTP {response.status_code}: {response.text[:300]}"
            )
        data = response.json()
        candidates = data.get("candidates") or []
        if not candidates:
            raise RuntimeError(f"Gemini empty candidates: {data!r}"[:400])
        finish = candidates[0].get("finishReason")
        if finish and finish not in {"STOP", "MAX_TOKENS"}:
            raise RuntimeError(f"Gemini blocked or unfinished: {finish}")
        parts = candidates[0].get("content", {}).get("parts") or []
        text = "".join(str(part.get("text", "")) for part in parts).strip()
        if not text:
            raise RuntimeError("Gemini returned empty text")
        return text

    async def _cache_get(self, key: str) -> dict[str, Any] | None:
        if self._cache is None:
            return None
        try:
            value = await self._cache.get(key)
        except Exception:
            return None
        return value if isinstance(value, dict) else None

    async def _cache_set(self, key: str, value: dict[str, Any]) -> None:
        if self._cache is None:
            return
        try:
            await self._cache.set(key, value, self._settings.gemini_cache_ttl_seconds)
        except Exception:
            logger.warning("gemini_cache_set_failed", key=key)


def _build_system_prompt(lang_name: str) -> str:
    """Strict grounded rewriter prompt (Gemini prompt-design guidance)."""
    return f"""You are a strictly grounded communication rewriter for Child Guard.

ROLE
- You rewrite APPROVED environmental child-health guidance for caregivers.
- You are NOT a doctor and NOT a decision engine.

ABSOLUTE LIMIT OF TRUTH
- Rely ONLY on facts explicitly present in the provided APPROVED_JSON.
- Do NOT use outside knowledge, common sense medical knowledge, or assumptions.
- Any detail not written in APPROVED_JSON is unsupported and must NOT appear.
- If something is missing from APPROVED_JSON, omit it. Never invent it.

FORBIDDEN (never do these)
- Diagnose, name a disease as confirmed, prescribe, dose, or recommend medicines.
- Change risk levels, urgency, or meaning of the approved guidance.
- Add new actions, symptoms, conditions, treatments, or escalation criteria.
- Add statistics, causes, or clinical explanations not in the source.
- Soften or remove escalation advice that exists in the source.

ALLOWED
- Simplify wording for low health literacy.
- Shorten into a faithful 2-3 sentence summary using only source facts.
- Translate faithfully into {lang_name}.
- Keep one rewritten item per source list item, same order, same count.

OUTPUT
- Return ONLY valid JSON with exactly these keys:
  summary, why, priority_actions, secondary_actions, monitoring_advice, escalation_advice
- priority_actions / secondary_actions / monitoring_advice / escalation_advice must be
  arrays with EXACTLY the same lengths as the input arrays.
- Entire response language: {lang_name}.
- No markdown. No commentary outside JSON.
"""


def _build_user_prompt(payload: dict[str, Any], language: str) -> str:
    approved = {
        "why": payload.get("why", ""),
        "priority_actions": payload.get("priority_actions", []),
        "secondary_actions": payload.get("secondary_actions", []),
        "monitoring_advice": payload.get("monitoring_advice", []),
        "escalation_advice": payload.get("escalation_advice", []),
    }
    counts = {
        "priority_actions": len(approved["priority_actions"]),
        "secondary_actions": len(approved["secondary_actions"]),
        "monitoring_advice": len(approved["monitoring_advice"]),
        "escalation_advice": len(approved["escalation_advice"]),
    }
    return (
        "Task: rewrite/summarize/translate the APPROVED_JSON only.\n"
        f"Target language code: {language}\n"
        f"Required list lengths: {json.dumps(counts)}\n"
        "Rewrite each list item in place (index 0 rewrites source index 0, etc.).\n"
        "Do not add or remove list items.\n\n"
        f"APPROVED_JSON:\n{json.dumps(approved, ensure_ascii=False)}"
    )


def validate_grounded_rewrite(
    source: dict[str, Any],
    output: dict[str, Any],
    *,
    language: str,
) -> None:
    """Reject hallucinated / unsafe rewrites. Raises ValueError on failure."""
    for key in (
        "summary",
        "why",
        "priority_actions",
        "secondary_actions",
        "monitoring_advice",
        "escalation_advice",
    ):
        if key not in output:
            raise ValueError(f"missing output key: {key}")

    for key in (
        "priority_actions",
        "secondary_actions",
        "monitoring_advice",
        "escalation_advice",
    ):
        src_list = list(source.get(key) or [])
        out_list = list(output.get(key) or [])
        if len(out_list) != len(src_list):
            raise ValueError(
                f"list length mismatch for {key}: got {len(out_list)} want {len(src_list)}"
            )
        for src_item, out_item in zip(src_list, out_list, strict=True):
            if len(out_item) > max(180, int(len(src_item) * 2.5)):
                raise ValueError(f"rewrite too long vs source in {key}")

    texts = [
        str(output.get("summary") or ""),
        str(output.get("why") or ""),
        *list(output.get("priority_actions") or []),
        *list(output.get("secondary_actions") or []),
        *list(output.get("monitoring_advice") or []),
        *list(output.get("escalation_advice") or []),
    ]
    for text in texts:
        _assert_no_forbidden_content(text)

    source_text = " ".join(
        [
            str(source.get("why") or ""),
            *list(source.get("priority_actions") or []),
            *list(source.get("secondary_actions") or []),
            *list(source.get("monitoring_advice") or []),
            *list(source.get("escalation_advice") or []),
        ]
    )
    source_tokens = _tokens(source_text)
    for text in texts:
        _assert_no_novel_clinical_tokens(text, source_tokens)

    # English: each bullet should stay near its paired source item
    # (paraphrase OK; brand-new topics rejected).
    if language == "en":
        for key in (
            "priority_actions",
            "secondary_actions",
            "monitoring_advice",
            "escalation_advice",
        ):
            for src_item, out_item in zip(
                source.get(key) or [], output.get(key) or [], strict=True
            ):
                if not _is_faithful_paraphrase(out_item, src_item, source_text):
                    raise ValueError(f"unfaithful rewrite in {key}: {out_item!r}")


def _assert_no_forbidden_content(text: str) -> None:
    for pattern in _FORBIDDEN_PATTERNS:
        if pattern.search(text):
            raise ValueError(
                f"forbidden clinical invention detected: {pattern.pattern}"
            )


def _assert_no_novel_clinical_tokens(text: str, source_tokens: set[str]) -> None:
    for tok in _tokens(text):
        if tok in _SOURCE_REQUIRED_IF_USED and tok not in source_tokens:
            raise ValueError(f"novel clinical token not in source: {tok}")


def _tokens(text: str) -> set[str]:
    return {
        tok
        for tok in re.findall(r"[a-z0-9']+", text.lower())
        if len(tok) > 2 and tok not in _STOPWORDS
    }


def _is_faithful_paraphrase(
    candidate: str, paired_source: str, all_source: str
) -> bool:
    """Allow plain paraphrase; reject bullets that drift to unrelated topics."""
    cand = _tokens(candidate)
    if not cand:
        return False
    paired = _tokens(paired_source)
    pool = _tokens(all_source) | _ALLOWED_REWRITE_TOKENS
    if not paired:
        return True
    # Enough overlap with the paired item, or almost all content words are known.
    overlap = cand & (paired | _ALLOWED_REWRITE_TOKENS)
    known = cand & pool
    if len(overlap) >= 1:
        return True
    if len(known) / max(len(cand), 1) >= 0.7:
        return True
    return False


def _require_list_length(items: list[str], source: list[str], name: str) -> None:
    if len(items) != len(source):
        raise ValueError(
            f"list length mismatch for {name}: got {len(items)} want {len(source)}"
        )


def _cache_key(prefix: str, payload: dict[str, Any]) -> str:
    digest = hashlib.sha256(
        json.dumps(payload, sort_keys=True, ensure_ascii=False).encode("utf-8")
    ).hexdigest()[:24]
    return f"llm:{prefix}:{digest}"


def _parse_json_object(raw: str) -> dict[str, Any]:
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            raise
        data = json.loads(match.group(0))
    if not isinstance(data, dict):
        raise ValueError("Gemini JSON was not an object")
    return data


def _as_str_list(value: Any, fallback: list[str]) -> list[str]:
    if not isinstance(value, list):
        return list(fallback)
    items = [str(item).strip() for item in value if str(item).strip()]
    return items or list(fallback)
