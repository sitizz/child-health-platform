from fastapi import FastAPI
import requests
import concurrent.futures

app = FastAPI()

@app.get("/")
def home():
    return {"status": "Child Health Platform backend is running"}

def classify_risk(score):
    if score >= 3:
        return "high"
    elif score >= 1:
        return "moderate"
    else:
        return "low"


@app.get("/environment-risk")
def environment_risk(
    lat: float,
    lon: float,
    age_group: str = "under5"
    asthma: bool = False,
    fever: bool = False,
    cough: bool = False,
    dehydration: bool = False,
    mosquito_exposure: bool = False,
    flood_exposure: bool = False
):
    # 🌍 Fetch weather data
    weather_url = (
    f"https://api.open-meteo.com/v1/forecast"
    f"?latitude={lat}&longitude={lon}"
    f"&current=temperature_2m,relative_humidity_2m,precipitation"
    f"&daily=temperature_2m_max,precipitation_sum"
    f"&forecast_days=3"
)

    air_url = (
        f"https://air-quality-api.open-meteo.com/v1/air-quality"
        f"?latitude={lat}&longitude={lon}"
        f"&current=pm2_5,pm10"
    )


    with concurrent.futures.ThreadPoolExecutor() as executor:
        weather_future = executor.submit(requests.get, weather_url)
        air_future = executor.submit(requests.get, air_url)

        weather = weather_future.result().json()
        air = air_future.result().json()

    # 📊 Extract values
    temperature = weather["current"]["temperature_2m"]
    humidity = weather["current"]["relative_humidity_2m"]
    rainfall = weather["current"]["precipitation"]

    pm25 = air["current"]["pm2_5"]
    pm10 = air["current"]["pm10"]

    # 🧠 Risk scoring
    heat_score = 0
    respiratory_score = 0
    dengue_score = 0
    flood_score = 0

    heat_reasons = []
    respiratory_reasons = []
    dengue_reasons = []
    flood_reasons = []

    # Heat
    if temperature >= 38:
        heat_score += 2
        heat_reasons.append("Extreme temperature detected")
    elif temperature >= 35:
        heat_score += 1
        heat_reasons.append("High temperature detected")

    if humidity >= 70:
        heat_score += 1
        heat_reasons.append("Persistent high humidity")

    # Respiratory
    if pm25 >= 35 or pm10 >= 100:
        respiratory_score += 2
        respiratory_reasons.append("Poor air quality detected")
    elif pm25 >= 15 or pm10 >= 50:
        respiratory_score += 1
        respiratory_reasons.append("Moderate air pollution detected")

    # Dengue (simple proxy)
    if temperature >= 25 and humidity >= 70:
        dengue_score += 1
        dengue_reasons.append("Warm humid conditions support mosquito activity")
    if rainfall > 0:
        dengue_score += 1
        dengue_reasons.append("Rainfall may increase standing water exposure")
    if rainfall >= 20:
        dengue_score += 1
        dengue_reasons.append("Heavy rainfall increases mosquito breeding risk")
    
     # Flood risk
    if rainfall >= 30:
        flood_score += 2
        flood_reasons.append("Severe rainfall detected")
    elif rainfall >= 15:
        flood_score += 1
        flood_reasons.append("Increased rainfall accumulation detected")

    # Vulnerable group boost
    if age_group == "under5":
        heat_score += 1
        respiratory_score += 1
        dengue_score += 1
    
    # Symptom and vulnerability adjustments
    if asthma:
        respiratory_score += 1
        respiratory_reasons.append(
            "Asthma increases respiratory vulnerability"
        )

    if cough:
        respiratory_score += 1
        respiratory_reasons.append(
            "Existing respiratory symptoms detected"
        )

    if dehydration:
        heat_score += 1
        heat_reasons.append(
            "Dehydration symptoms increase heat vulnerability"
        )

    if fever and mosquito_exposure:
        dengue_score += 1
        dengue_reasons.append(
            "Fever combined with mosquito exposure increases dengue concern"
        )

    if flood_exposure:
        flood_score += 1
        flood_reasons.append(
            "Recent flood exposure increases environmental health risk"
        )

    # 🧾 Classify risks
    heat_risk = classify_risk(heat_score)
    respiratory_risk = classify_risk(respiratory_score)
    dengue_risk = classify_risk(dengue_score)
    flood_risk = classify_risk(flood_score)

    risks = [heat_risk, respiratory_risk, dengue_risk, flood_risk]

    daily_temp = weather["daily"]["temperature_2m_max"]
    daily_rain = weather["daily"]["precipitation_sum"]

    forecast_risks = []

    for day in range(3):
        forecast_score = 0

        if daily_temp[day] >= 35:
            forecast_score += 1

        if daily_rain[day] > 0:
            forecast_score += 1

        if age_group == "under5":
            forecast_score += 1

        forecast_risks.append({
            "day": day + 1,
            "max_temperature": daily_temp[day],
            "rainfall": daily_rain[day],
            "predicted_risk": classify_risk(forecast_score)
        })
    # Predictive domain scoring
    predictive_heat_score = 0
    predictive_dengue_score = 0
    predictive_respiratory_score = respiratory_score

    # Heat prediction using highest forecast temperature
    max_forecast_temp = max(daily_temp)

    if max_forecast_temp >= 38:
        predictive_heat_score += 2
    elif max_forecast_temp >= 35:
        predictive_heat_score += 1

    if humidity >= 70:
        predictive_heat_score += 1

    # Dengue prediction using rainfall and warm humid conditions
    total_forecast_rain = sum(daily_rain)

    if max_forecast_temp >= 25 and humidity >= 70:
        predictive_dengue_score += 1

    if total_forecast_rain > 0:
        predictive_dengue_score += 1

    if total_forecast_rain >= 10:
        predictive_dengue_score += 1

    # Vulnerable group adjustment
    if age_group == "under5":
        predictive_heat_score += 1
        predictive_respiratory_score += 1
        predictive_dengue_score += 1

    predictive_heat_risk = classify_risk(predictive_heat_score)
    predictive_respiratory_risk = classify_risk(predictive_respiratory_score)
    predictive_dengue_risk = classify_risk(predictive_dengue_score)

    # 🚨 Priority alert
    if "high" in risks:
        priority_alert = "high"
    elif "moderate" in risks:
        priority_alert = "moderate"
    else:
        priority_alert = "low"

    # 🎯 Action message
    if priority_alert == "high":
        action = "🚨 HIGH RISK: Immediately reduce outdoor exposure. Notify school staff, caregivers, or clinic. Monitor symptoms closely."
    elif priority_alert == "moderate":
        action = "⚠️ MODERATE RISK: Limit outdoor activity, encourage hydration, monitor symptoms."
    else:
        action = "✅ LOW RISK: Safe to continue normal activities with basic precautions."

        # 📈 Trend direction logic
    high_days = sum(
        1 for day in forecast_risks
        if day["predicted_risk"] == "high"
    )

    moderate_days = sum(
        1 for day in forecast_risks
        if day["predicted_risk"] == "moderate"
    )

    # Trend message
    if high_days >= 2:
        trend_direction = "increasing"
        trend_message = "Environmental risk is increasing over the next 72 hours."
    elif moderate_days >= 2:
        trend_direction = "stable"
        trend_message = "Moderate environmental risk is expected to persist."
    else:
        trend_direction = "decreasing"
        trend_message = "Environmental risk is expected to remain low or improve."

    # Escalation logic
    if high_days >= 2:
        escalation_level = "urgent"
        escalation_reason = "High-risk conditions are expected for multiple days."
    elif moderate_days >= 2:
        escalation_level = "watch"
        escalation_reason = "Moderate risk may worsen if conditions continue."
    else:
        escalation_level = "normal"
        escalation_reason = "No major escalation risk detected."

    # Age-specific guidance
    guidance_map = {
        "under5": "Young children are highly vulnerable to heat stress and poor air quality.",
        "infant": "Infants are especially sensitive to heat and respiratory changes.",
        "asthma": "Children with asthma should reduce outdoor exposure during poor air quality.",
        "pregnant": "Pregnant individuals should remain hydrated and avoid prolonged heat exposure.",
        "elderly": "Older adults are more vulnerable to respiratory complications.",
        "general": "Maintain hydration and monitor environmental conditions regularly."
    }

    guidance_message = guidance_map.get(
        age_group,
        guidance_map["general"]
    )

    # Stakeholder guidance
    caregiver_guidance = []
    school_guidance = []
    community_guidance = []

    # Heat-related guidance
    if heat_risk in ["moderate", "high"]:
        caregiver_guidance.append(
            "Increase hydration and reduce prolonged outdoor heat exposure."
        )

        school_guidance.append(
            "Limit prolonged outdoor activities during peak afternoon temperatures."
        )

    # Respiratory guidance
    if respiratory_risk in ["moderate", "high"]:
        caregiver_guidance.append(
            "Monitor coughing, wheezing, or breathing difficulty in vulnerable children."
        )

        school_guidance.append(
            "Reduce outdoor group activities during periods of poor air quality."
        )

    # Dengue guidance
    if dengue_risk in ["moderate", "high"]:
        community_guidance.append(
            "Monitor standing water accumulation and mosquito exposure risk."
        )

    # Flood guidance
    if flood_risk in ["moderate", "high"]:
        community_guidance.append(
            "Prepare for possible local flooding and water contamination exposure."
        )

    stakeholder_guidance = {
        "caregiver": caregiver_guidance,
        "school": school_guidance,
        "community": community_guidance,
    }

    # 📦 Final response
    return {
        "location": {"lat": lat, "lon": lon},
        "age_group": age_group,
        "environment": {
            "temperature": temperature,
            "humidity": humidity,
            "rainfall": rainfall,
            "pm2_5": pm25,
            "pm10": pm10,
        },
        "risks": {
            "heat_stress": heat_risk,
            "respiratory": respiratory_risk,
            "dengue": dengue_risk,
             "flood": flood_risk,
        },
        "risk_reasons": {
            "heat_stress": heat_reasons,
            "respiratory": respiratory_reasons,
            "dengue": dengue_reasons,
            "flood": flood_reasons,
        },
        "predictive_domains": {
            "heat_stress": predictive_heat_risk,
            "respiratory": predictive_respiratory_risk,
            "dengue": predictive_dengue_risk,
        },
        "priority_alert": priority_alert,
        "forecast": forecast_risks,
        "action": action,
        "trend": {
            "direction": trend_direction,
            "message": trend_message,
        },
        "escalation": {
            "level": escalation_level,
            "reason": escalation_reason,
        },
        "guidance": {
            "group": age_group,
            "message": guidance_message,
        },
        "stakeholder_guidance": stakeholder_guidance,
    }