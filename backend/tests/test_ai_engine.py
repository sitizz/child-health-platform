from app.domain.ai_engine import build_explainable_recommendation
from app.domain.scoring import EnvironmentObservation


def _obs(**overrides):
    base = dict(
        temperature=36.0,
        humidity=75.0,
        rainfall=5.0,
        aqi=120.0,
        pm2_5=45.0,
        pm10=80.0,
        daily_temp_max=[36.0] * 7,
        daily_rain=[5.0] * 7,
    )
    base.update(overrides)
    return EnvironmentObservation(**base)


def test_asthma_high_aqi_explainable():
    result = build_explainable_recommendation(
        _obs(),
        age=6,
        conditions={"asthma": True},
        symptoms={"cough": True},
        exposures={},
    )
    assert result.overall_risk in {"moderate", "high"}
    assert "Respiratory" in result.primary_hazards
    assert any("asthma" in f.lower() or "respiratory" in f.lower() for f in result.child_factors)
    assert result.priority_actions
    assert result.data_completeness == "full"
    assert "diagnose" not in " ".join(result.priority_actions).lower()


def test_under5_heat_dehydration():
    result = build_explainable_recommendation(
        _obs(temperature=39.0, pm2_5=10.0, pm10=20.0, aqi=20.0, rainfall=0.0),
        age=3,
        conditions={},
        symptoms={"dehydration": True},
        exposures={},
    )
    assert "Heat Stress" in result.primary_hazards
    assert any("hydration" in a.lower() or "cooler" in a.lower() for a in result.priority_actions)
    assert result.escalation_advice


def test_dengue_fever_mosquito():
    result = build_explainable_recommendation(
        _obs(temperature=28.0, humidity=80.0, rainfall=12.0, pm2_5=10.0, aqi=30.0),
        age=8,
        conditions={},
        symptoms={"fever": True},
        exposures={"mosquito_exposure": True},
    )
    assert "Dengue" in result.primary_hazards
    assert any("mosquito" in a.lower() for a in result.priority_actions)


def test_limited_profile_marked():
    result = build_explainable_recommendation(_obs(), age=10)
    assert result.data_completeness == "limited"
    assert "limited" in result.why.lower()
