from dataclasses import dataclass, field

from app.schemas.common import AgeGroup, RiskLevel


def classify_risk(score: int) -> RiskLevel:
    if score >= 3:
        return "high"
    if score >= 1:
        return "moderate"
    return "low"


@dataclass
class EnvironmentObservation:
    temperature: float
    humidity: float
    rainfall: float
    aqi: float | None
    pm2_5: float | None
    pm10: float | None
    daily_temp_max: list[float]
    daily_rain: list[float]


@dataclass
class ChildFactors:
    age_group: AgeGroup
    asthma: bool = False
    fever: bool = False
    cough: bool = False
    dehydration: bool = False
    mosquito_exposure: bool = False
    flood_exposure: bool = False


@dataclass
class ScoredDomain:
    level: RiskLevel
    score: int
    reasons: list[str] = field(default_factory=list)


@dataclass
class ForecastDayScore:
    day: int
    max_temperature: float
    rainfall: float
    predicted_risk: RiskLevel


@dataclass
class RiskAssessment:
    heat: ScoredDomain
    respiratory: ScoredDomain
    dengue: ScoredDomain
    flood: ScoredDomain
    vulnerability: ScoredDomain
    predictive_heat: ScoredDomain
    predictive_respiratory: ScoredDomain
    predictive_dengue: ScoredDomain
    forecast: list[ForecastDayScore]
    priority_alert: RiskLevel


def _score_heat(obs: EnvironmentObservation) -> ScoredDomain:
    score = 0
    reasons: list[str] = []
    if obs.temperature >= 38:
        score += 2
        reasons.append("Extreme temperature detected")
    elif obs.temperature >= 35:
        score += 1
        reasons.append("High temperature detected")
    if obs.humidity >= 70:
        score += 1
        reasons.append("Persistent high humidity")
    return ScoredDomain(level=classify_risk(score), score=score, reasons=reasons)


def _score_respiratory(obs: EnvironmentObservation) -> ScoredDomain:
    score = 0
    reasons: list[str] = []
    pm25 = obs.pm2_5 if obs.pm2_5 is not None else 0.0
    pm10 = obs.pm10 if obs.pm10 is not None else 0.0
    if pm25 >= 35 or pm10 >= 100:
        score += 2
        reasons.append("Poor air quality detected")
    elif pm25 >= 15 or pm10 >= 50:
        score += 1
        reasons.append("Moderate air pollution detected")
    return ScoredDomain(level=classify_risk(score), score=score, reasons=reasons)


def _score_dengue(obs: EnvironmentObservation) -> ScoredDomain:
    score = 0
    reasons: list[str] = []
    if obs.temperature >= 25 and obs.humidity >= 70:
        score += 1
        reasons.append("Warm humid conditions support mosquito activity")
    if obs.rainfall > 0:
        score += 1
        reasons.append("Rainfall may increase standing water exposure")
    if obs.rainfall >= 20:
        score += 1
        reasons.append("Heavy rainfall increases mosquito breeding risk")
    return ScoredDomain(level=classify_risk(score), score=score, reasons=reasons)


def _score_flood(obs: EnvironmentObservation) -> ScoredDomain:
    score = 0
    reasons: list[str] = []
    if obs.rainfall >= 30:
        score += 2
        reasons.append("Severe rainfall detected")
    elif obs.rainfall >= 15:
        score += 1
        reasons.append("Increased rainfall accumulation detected")
    return ScoredDomain(level=classify_risk(score), score=score, reasons=reasons)


def _score_vulnerability(factors: ChildFactors) -> ScoredDomain:
    score = 0
    reasons: list[str] = []
    if factors.asthma:
        score += 1
        reasons.append("Asthma increases respiratory vulnerability")
    if factors.cough:
        score += 1
        reasons.append("Existing respiratory symptoms detected")
    if factors.dehydration:
        score += 1
        reasons.append("Dehydration symptoms increase heat vulnerability")
    if factors.fever and factors.mosquito_exposure:
        score += 1
        reasons.append(
            "Fever combined with mosquito exposure increases dengue concern"
        )
    if factors.flood_exposure:
        score += 1
        reasons.append(
            "Recent flood exposure increases environmental vulnerability"
        )
    return ScoredDomain(level=classify_risk(score), score=score, reasons=reasons)


def _apply_age_boost(domain: ScoredDomain, age_group: AgeGroup) -> ScoredDomain:
    if age_group != "under5":
        return domain
    score = domain.score + 1
    return ScoredDomain(
        level=classify_risk(score),
        score=score,
        reasons=list(domain.reasons),
    )


def _build_forecast(
    obs: EnvironmentObservation, age_group: AgeGroup
) -> list[ForecastDayScore]:
    days: list[ForecastDayScore] = []
    count = min(7, len(obs.daily_temp_max), len(obs.daily_rain))
    for day in range(count):
        forecast_score = 0
        if obs.daily_temp_max[day] >= 35:
            forecast_score += 1
        if obs.daily_rain[day] > 0:
            forecast_score += 1
        if age_group == "under5":
            forecast_score += 1
        days.append(
            ForecastDayScore(
                day=day + 1,
                max_temperature=obs.daily_temp_max[day],
                rainfall=obs.daily_rain[day],
                predicted_risk=classify_risk(forecast_score),
            )
        )
    return days


def _score_predictive(
    obs: EnvironmentObservation,
    age_group: AgeGroup,
    base_respiratory_score: int,
) -> tuple[ScoredDomain, ScoredDomain, ScoredDomain]:
    """Score predictive domains from forecast inputs.

    Uses base (pre age-boost) respiratory score so under5 is not double-counted.
    """
    predictive_heat = 0
    predictive_dengue = 0
    predictive_respiratory = base_respiratory_score

    max_forecast_temp = max(obs.daily_temp_max) if obs.daily_temp_max else obs.temperature
    total_forecast_rain = sum(obs.daily_rain) if obs.daily_rain else 0.0

    if max_forecast_temp >= 38:
        predictive_heat += 2
    elif max_forecast_temp >= 35:
        predictive_heat += 1
    if obs.humidity >= 70:
        predictive_heat += 1

    if max_forecast_temp >= 25 and obs.humidity >= 70:
        predictive_dengue += 1
    if total_forecast_rain > 0:
        predictive_dengue += 1
    if total_forecast_rain >= 10:
        predictive_dengue += 1

    if age_group == "under5":
        predictive_heat += 1
        predictive_respiratory += 1
        predictive_dengue += 1

    return (
        ScoredDomain(level=classify_risk(predictive_heat), score=predictive_heat),
        ScoredDomain(
            level=classify_risk(predictive_respiratory),
            score=predictive_respiratory,
        ),
        ScoredDomain(level=classify_risk(predictive_dengue), score=predictive_dengue),
    )


def _priority(levels: list[RiskLevel]) -> RiskLevel:
    if "high" in levels:
        return "high"
    if "moderate" in levels:
        return "moderate"
    return "low"


def assess_risks(
    obs: EnvironmentObservation, factors: ChildFactors
) -> RiskAssessment:
    heat_base = _score_heat(obs)
    respiratory_base = _score_respiratory(obs)
    dengue_base = _score_dengue(obs)
    flood_base = _score_flood(obs)

    heat = _apply_age_boost(heat_base, factors.age_group)
    respiratory = _apply_age_boost(respiratory_base, factors.age_group)
    dengue = _apply_age_boost(dengue_base, factors.age_group)
    flood = flood_base
    vulnerability = _score_vulnerability(factors)

    forecast = _build_forecast(obs, factors.age_group)
    predictive_heat, predictive_respiratory, predictive_dengue = _score_predictive(
        obs,
        factors.age_group,
        base_respiratory_score=respiratory_base.score,
    )

    priority = _priority(
        [heat.level, respiratory.level, dengue.level, flood.level]
    )

    return RiskAssessment(
        heat=heat,
        respiratory=respiratory,
        dengue=dengue,
        flood=flood,
        vulnerability=vulnerability,
        predictive_heat=predictive_heat,
        predictive_respiratory=predictive_respiratory,
        predictive_dengue=predictive_dengue,
        forecast=forecast,
        priority_alert=priority,
    )
