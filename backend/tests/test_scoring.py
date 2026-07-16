from app.domain.scoring import ChildFactors, EnvironmentObservation, assess_risks, classify_risk


def test_classify_risk_thresholds():
    assert classify_risk(0) == "low"
    assert classify_risk(1) == "moderate"
    assert classify_risk(3) == "high"


def test_under5_not_double_counted_in_predictive_respiratory():
    obs = EnvironmentObservation(
        temperature=20.0,
        humidity=40.0,
        rainfall=0.0,
        aqi=10.0,
        pm2_5=10.0,
        pm10=20.0,
        daily_temp_max=[20.0] * 7,
        daily_rain=[0.0] * 7,
    )
    under5 = assess_risks(obs, ChildFactors(age_group="under5"))
    child = assess_risks(obs, ChildFactors(age_group="child"))

    # Base respiratory is low (0). under5 gets +1 once for current and once for predictive.
    assert under5.respiratory.score == 1
    assert under5.predictive_respiratory.score == 1
    assert child.predictive_respiratory.score == 0
