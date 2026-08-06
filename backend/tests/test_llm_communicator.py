"""Tests for Gemini LLM communication layer + anti-hallucination guards."""

import json

import httpx
import pytest

from app.core.config import Settings
from app.ml.llm_communicator import (
    LLMCommunicator,
    validate_grounded_rewrite,
)
from app.services.cache import InMemoryCache


SOURCE = {
    "why": "Overall environmental health risk is high based on Heat Stress.",
    "priority_actions": ["Begin oral hydration immediately."],
    "secondary_actions": ["Limit strenuous outdoor activity."],
    "monitoring_advice": ["Monitor dehydration symptoms."],
    "escalation_advice": ["Seek urgent care if the child becomes drowsy."],
}


@pytest.mark.asyncio
async def test_falls_back_to_rules_without_api_key():
    settings = Settings(gemini_api_key=None)
    async with httpx.AsyncClient() as client:
        llm = LLMCommunicator(client, settings, cache=InMemoryCache())
        assert llm.enabled is False
        result = await llm.simplify_recommendation_bundle(
            why=SOURCE["why"],
            priority_actions=SOURCE["priority_actions"],
            secondary_actions=SOURCE["secondary_actions"],
            monitoring_advice=SOURCE["monitoring_advice"],
            escalation_advice=SOURCE["escalation_advice"],
            language="en",
        )
    assert result["source"] == "rules"
    assert "drinking fluids" in result["priority_actions"][0].lower()


@pytest.mark.asyncio
async def test_gemini_faithful_rewrite_accepted(monkeypatch: pytest.MonkeyPatch):
    settings = Settings(
        gemini_api_key="test-key",
        gemini_model="gemini-2.0-flash",
    )
    gemini_payload = {
        "summary": "Heat risk is high. Give your child water often.",
        "why": "Heat stress risk is high right now.",
        "priority_actions": ["Give the child water now."],
        "secondary_actions": ["Limit hard outdoor activity."],
        "monitoring_advice": ["Watch for dehydration signs."],
        "escalation_advice": ["Go to a clinic if the child becomes drowsy."],
    }

    async def fake_post(self, url, **kwargs):
        body = kwargs.get("json") or {}
        gen = body.get("generationConfig") or {}
        assert gen.get("temperature") == 0.0
        assert "safetySettings" in body
        request = httpx.Request("POST", str(url))
        return httpx.Response(
            200,
            request=request,
            json={
                "candidates": [
                    {
                        "finishReason": "STOP",
                        "content": {"parts": [{"text": json.dumps(gemini_payload)}]},
                    }
                ]
            },
        )

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)

    async with httpx.AsyncClient() as client:
        llm = LLMCommunicator(client, settings, cache=InMemoryCache())
        result = await llm.simplify_recommendation_bundle(
            why=SOURCE["why"],
            priority_actions=SOURCE["priority_actions"],
            secondary_actions=SOURCE["secondary_actions"],
            monitoring_advice=SOURCE["monitoring_advice"],
            escalation_advice=SOURCE["escalation_advice"],
            language="en",
        )

    assert result["source"] == "gemini"
    assert result["priority_actions"] == gemini_payload["priority_actions"]


@pytest.mark.asyncio
async def test_hallucinated_medicine_falls_back(monkeypatch: pytest.MonkeyPatch):
    settings = Settings(gemini_api_key="test-key")
    bad = {
        "summary": "Give paracetamol now.",
        "why": SOURCE["why"],
        "priority_actions": ["Give the child paracetamol 250mg."],
        "secondary_actions": SOURCE["secondary_actions"],
        "monitoring_advice": SOURCE["monitoring_advice"],
        "escalation_advice": SOURCE["escalation_advice"],
    }

    async def fake_post(self, url, **kwargs):
        request = httpx.Request("POST", str(url))
        return httpx.Response(
            200,
            request=request,
            json={
                "candidates": [
                    {
                        "finishReason": "STOP",
                        "content": {"parts": [{"text": json.dumps(bad)}]},
                    }
                ]
            },
        )

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)

    async with httpx.AsyncClient() as client:
        llm = LLMCommunicator(client, settings, cache=InMemoryCache())
        result = await llm.simplify_recommendation_bundle(
            why=SOURCE["why"],
            priority_actions=SOURCE["priority_actions"],
            secondary_actions=SOURCE["secondary_actions"],
            monitoring_advice=SOURCE["monitoring_advice"],
            escalation_advice=SOURCE["escalation_advice"],
        )
    assert result["source"] == "rules"


@pytest.mark.asyncio
async def test_extra_invented_bullet_falls_back(monkeypatch: pytest.MonkeyPatch):
    settings = Settings(gemini_api_key="test-key")
    bad = {
        "summary": "Heat risk is high.",
        "why": SOURCE["why"],
        "priority_actions": [
            "Give the child water now.",
            "Start antibiotics for infection.",
        ],
        "secondary_actions": SOURCE["secondary_actions"],
        "monitoring_advice": SOURCE["monitoring_advice"],
        "escalation_advice": SOURCE["escalation_advice"],
    }

    async def fake_post(self, url, **kwargs):
        request = httpx.Request("POST", str(url))
        return httpx.Response(
            200,
            request=request,
            json={
                "candidates": [
                    {
                        "finishReason": "STOP",
                        "content": {"parts": [{"text": json.dumps(bad)}]},
                    }
                ]
            },
        )

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)

    async with httpx.AsyncClient() as client:
        llm = LLMCommunicator(client, settings, cache=InMemoryCache())
        result = await llm.simplify_recommendation_bundle(
            why=SOURCE["why"],
            priority_actions=SOURCE["priority_actions"],
            secondary_actions=SOURCE["secondary_actions"],
            monitoring_advice=SOURCE["monitoring_advice"],
            escalation_advice=SOURCE["escalation_advice"],
        )
    # Extra bullet truncated then still fails clinical checks / falls back
    assert result["source"] == "rules"


def test_validate_rejects_diagnosis_language():
    output = {
        "summary": "This is dengue.",
        "why": "This means dengue.",
        "priority_actions": ["This is dengue fever."],
        "secondary_actions": ["Limit outdoor activity."],
        "monitoring_advice": ["Watch symptoms."],
        "escalation_advice": ["Seek care if worse."],
    }
    with pytest.raises(ValueError):
        validate_grounded_rewrite(SOURCE, output, language="en")


def test_validate_rejects_novel_disease_token():
    output = {
        "summary": "Heat risk is high.",
        "why": "Heat stress risk is high.",
        "priority_actions": ["Treat malaria immediately."],
        "secondary_actions": ["Limit outdoor activity."],
        "monitoring_advice": ["Watch dehydration."],
        "escalation_advice": ["Go to clinic if drowsy."],
    }
    with pytest.raises(ValueError):
        validate_grounded_rewrite(SOURCE, output, language="en")


def test_validate_accepts_faithful_paraphrase():
    output = {
        "summary": "Heat risk is high. Give water often.",
        "why": "Heat stress risk is high right now.",
        "priority_actions": ["Give the child water now."],
        "secondary_actions": ["Limit hard outdoor activity."],
        "monitoring_advice": ["Watch dehydration signs."],
        "escalation_advice": ["Go to a clinic if the child becomes drowsy."],
    }
    validate_grounded_rewrite(SOURCE, output, language="en")


@pytest.mark.asyncio
async def test_gemini_http_error_falls_back(monkeypatch: pytest.MonkeyPatch):
    settings = Settings(gemini_api_key="test-key")

    async def fake_post(self, url, **kwargs):
        request = httpx.Request("POST", str(url))
        return httpx.Response(500, request=request, text="boom")

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)

    async with httpx.AsyncClient() as client:
        llm = LLMCommunicator(client, settings, cache=InMemoryCache())
        result = await llm.simplify_recommendation_bundle(
            why="Risk is moderate.",
            priority_actions=["Reduce outdoor heat exposure."],
            secondary_actions=[],
            monitoring_advice=[],
            escalation_advice=["Seek medical advice if worse."],
        )
    assert result["source"] == "rules"
