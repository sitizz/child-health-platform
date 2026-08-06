"""Caregiver-friendly text simplification with readability scoring.

Rule-based NLP (no external model download). Converts technical recommendation
phrasing into clearer language and reports approximate Flesch-Kincaid grade.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# Clinical / technical phrases → simpler caregiver language
_REPLACEMENTS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\boral hydration\b", re.I), "drinking fluids"),
    (re.compile(r"\bdehydration\b", re.I), "not drinking enough water"),
    (re.compile(r"\brespiratory\b", re.I), "breathing"),
    (re.compile(r"\bair quality\b", re.I), "air cleanliness"),
    (
        re.compile(r"\bprolonged outdoor exposure\b", re.I),
        "staying outside for too long",
    ),
    (re.compile(r"\boutdoor exposure\b", re.I), "time spent outside"),
    (re.compile(r"\bstrenuous (outdoor )?activity\b", re.I), "hard exercise"),
    (re.compile(r"\bmosquito breeding sites\b", re.I), "places where mosquitoes grow"),
    (re.compile(r"\bstanding water\b", re.I), "still water (like puddles)"),
    (re.compile(r"\bcontaminated floodwater\b", re.I), "dirty flood water"),
    (re.compile(r"\benvironmental risk\b", re.I), "health risk from weather and air"),
    (re.compile(r"\benvironmental conditions\b", re.I), "weather and air conditions"),
    (re.compile(r"\bseek (urgent )?care\b", re.I), "go to a clinic or doctor"),
    (re.compile(r"\bseek clinical advice urgently\b", re.I), "see a doctor right away"),
    (re.compile(r"\bseek medical advice\b", re.I), "ask a doctor or nurse"),
    (re.compile(r"\bdengue warning signs\b", re.I), "danger signs of dengue fever"),
    (re.compile(r"\bchest tightness\b", re.I), "tight feeling in the chest"),
    (re.compile(r"\bunusual fatigue\b", re.I), "feeling very tired"),
    (re.compile(r"\bunusual tiredness\b", re.I), "feeling very tired"),
    (re.compile(r"\breduce exposure\b", re.I), "stay away from the risk"),
    (re.compile(r"\bmonitor (the child|symptoms)\b", re.I), r"watch \1 closely"),
    (re.compile(r"\bpersist(s|ent)?\b", re.I), "keeps going"),
]


@dataclass
class SimplifiedText:
    original: str
    simplified: str
    flesch_kincaid_grade: float
    reading_ease: float


def _count_syllables(word: str) -> int:
    word = re.sub(r"[^a-z]", "", word.lower())
    if not word:
        return 0
    vowels = "aeiouy"
    count = 0
    prev_vowel = False
    for char in word:
        is_vowel = char in vowels
        if is_vowel and not prev_vowel:
            count += 1
        prev_vowel = is_vowel
    if word.endswith("e") and count > 1:
        count -= 1
    return max(count, 1)


def flesch_reading_ease(text: str) -> float:
    sentences = [s for s in re.split(r"[.!?]+", text) if s.strip()]
    words = re.findall(r"[A-Za-z']+", text)
    if not words or not sentences:
        return 100.0
    syllable_count = sum(_count_syllables(w) for w in words)
    asl = len(words) / len(sentences)
    asw = syllable_count / len(words)
    return round(206.835 - (1.015 * asl) - (84.6 * asw), 2)


def flesch_kincaid_grade(text: str) -> float:
    sentences = [s for s in re.split(r"[.!?]+", text) if s.strip()]
    words = re.findall(r"[A-Za-z']+", text)
    if not words or not sentences:
        return 0.0
    syllable_count = sum(_count_syllables(w) for w in words)
    asl = len(words) / len(sentences)
    asw = syllable_count / len(words)
    return round((0.39 * asl) + (11.8 * asw) - 15.59, 2)


def simplify_text(text: str) -> SimplifiedText:
    simplified = text.strip()
    for pattern, replacement in _REPLACEMENTS:
        simplified = pattern.sub(replacement, simplified)
    # Soften dense punctuation / long clauses for caregivers
    simplified = re.sub(r"\s+", " ", simplified).strip()
    if simplified and not simplified.endswith((".", "!", "?")):
        simplified += "."
    return SimplifiedText(
        original=text,
        simplified=simplified,
        flesch_kincaid_grade=flesch_kincaid_grade(simplified),
        reading_ease=flesch_reading_ease(simplified),
    )


def simplify_list(items: list[str]) -> list[str]:
    return [simplify_text(item).simplified for item in items]


def simplify_recommendation_bundle(
    *,
    why: str,
    priority_actions: list[str],
    secondary_actions: list[str],
    monitoring_advice: list[str],
    escalation_advice: list[str],
) -> dict[str, object]:
    why_result = simplify_text(why)
    priority = [simplify_text(item) for item in priority_actions]
    secondary = [simplify_text(item) for item in secondary_actions]
    monitoring = [simplify_text(item) for item in monitoring_advice]
    escalation = [simplify_text(item) for item in escalation_advice]

    all_grades = [
        why_result.flesch_kincaid_grade,
        *[item.flesch_kincaid_grade for item in priority],
        *[item.flesch_kincaid_grade for item in secondary],
        *[item.flesch_kincaid_grade for item in monitoring],
        *[item.flesch_kincaid_grade for item in escalation],
    ]
    avg_grade = round(sum(all_grades) / len(all_grades), 2) if all_grades else 0.0

    summary_parts = [why_result.simplified]
    if priority:
        summary_parts.append(f"Do this now: {priority[0].simplified}")
    if escalation:
        summary_parts.append(f"Get help if: {escalation[0].simplified}")

    return {
        "summary": " ".join(summary_parts),
        "why": why_result.simplified,
        "priority_actions": [item.simplified for item in priority],
        "secondary_actions": [item.simplified for item in secondary],
        "monitoring_advice": [item.simplified for item in monitoring],
        "escalation_advice": [item.simplified for item in escalation],
        "readability": {
            "average_flesch_kincaid_grade": avg_grade,
            "why_reading_ease": why_result.reading_ease,
        },
    }
