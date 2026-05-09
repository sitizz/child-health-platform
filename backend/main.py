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
    age_group: str = "under5",
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
    
    # Child vulnerability indicators
    vulnerability_score = 0
    vulnerability_reasons = []

    if asthma:
        vulnerability_score += 1
        vulnerability_reasons.append(
            "Asthma increases respiratory vulnerability"
        )

    if cough:
        vulnerability_score += 1
        vulnerability_reasons.append(
            "Existing respiratory symptoms detected"
        )

    if dehydration:
        vulnerability_score += 1
        vulnerability_reasons.append(
            "Dehydration symptoms increase heat vulnerability"
        )

    if fever and mosquito_exposure:
        vulnerability_score += 1
        vulnerability_reasons.append(
            "Fever combined with mosquito exposure increases dengue concern"
        )

    if flood_exposure:
        vulnerability_score += 1
        vulnerability_reasons.append(
            "Recent flood exposure increases environmental vulnerability"
        )

    # 🧾 Classify risks
    heat_risk = classify_risk(heat_score)
    respiratory_risk = classify_risk(respiratory_score)
    dengue_risk = classify_risk(dengue_score)
    flood_risk = classify_risk(flood_score)
    vulnerability_level = classify_risk(vulnerability_score)

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
    
    # Scenario-based recommendation engine
    immediate_action = []
    caregiver_action = []
    school_action = []
    community_action = []
    escalation_triggers = []

    # Heat + dehydration scenario
    if heat_risk in ["moderate", "high"] and dehydration:
        immediate_action.append(
            "Move the child to a shaded or cooler area and begin oral hydration immediately."
        )
        caregiver_action.append(
            "Monitor for reduced urination, unusual tiredness, dizziness, or worsening weakness over the next few hours."
        )
        school_action.append(
            "Avoid outdoor activity and allow supervised rest in a cooler indoor area."
        )
        escalation_triggers.append(
            "Seek urgent care if dehydration symptoms worsen, the child becomes unusually drowsy, confused, or unable to drink."
        )

    # Heat risk without dehydration
    elif heat_risk in ["moderate", "high"]:
        immediate_action.append(
            "Reduce outdoor heat exposure and encourage regular fluid intake."
        )
        caregiver_action.append(
            "Keep the child in shade or a cooler indoor space during peak heat periods."
        )
        school_action.append(
            "Reduce strenuous outdoor activity and increase hydration breaks."
        )

    # Respiratory + asthma/cough scenario
    if respiratory_risk in ["moderate", "high"] and (asthma or cough):
        immediate_action.append(
            "Reduce outdoor exposure and avoid strenuous activity until air quality improves."
        )
        caregiver_action.append(
            "Monitor breathing, coughing, wheezing, chest tightness, or unusual fatigue."
        )
        school_action.append(
            "Keep the child indoors where possible and reduce exposure to outdoor air pollution."
        )
        escalation_triggers.append(
            "Seek urgent care if breathing difficulty, persistent wheezing, bluish lips, or severe chest tightness occurs."
        )

    # Respiratory risk without symptoms
    elif respiratory_risk in ["moderate", "high"]:
        caregiver_action.append(
            "Reduce prolonged outdoor exposure and monitor for new respiratory symptoms."
        )
        school_action.append(
            "Limit outdoor group activities during poor air quality periods."
        )

    # Dengue concern scenario
    if dengue_risk in ["moderate", "high"] and fever and mosquito_exposure:
        immediate_action.append(
            "Increase mosquito protection immediately and monitor fever progression closely."
        )
        caregiver_action.append(
            "Watch for dengue warning signs such as persistent fever, vomiting, abdominal pain, bleeding, unusual tiredness, or worsening weakness."
        )
        community_action.append(
            "Check nearby standing water and reduce mosquito breeding sites around the home, school, or community area."
        )
        escalation_triggers.append(
            "Seek clinical advice urgently if fever persists, warning signs appear, or the child becomes increasingly weak."
        )

    # Dengue environmental risk only
    elif dengue_risk in ["moderate", "high"]:
        caregiver_action.append(
            "Use mosquito protection and reduce exposure to mosquito breeding areas."
        )
        community_action.append(
            "Remove standing water and monitor local mosquito exposure risk."
        )

    # Flood exposure scenario
    if flood_risk in ["moderate", "high"] or flood_exposure:
        caregiver_action.append(
            "Avoid contact with contaminated floodwater and ensure drinking water is safe."
        )
        community_action.append(
            "Monitor for water contamination, blocked drainage, and local flood-related health risks."
        )
        escalation_triggers.append(
            "Seek care if diarrhoea, persistent fever, skin infection, or dehydration symptoms develop after flood exposure."
        )

    # Default fallback
    if len(immediate_action) == 0:
        if priority_alert == "high":
            immediate_action.append(
                "Reduce exposure immediately and monitor the child closely."
            )
        elif priority_alert == "moderate":
            immediate_action.append(
                "Limit exposure and continue active symptom monitoring."
            )
        else:
            immediate_action.append(
                "Continue normal activities with routine environmental precautions."
            )

    if len(caregiver_action) == 0:
        caregiver_action.append(
            "Continue routine monitoring and respond early if symptoms develop."
        )

    if len(school_action) == 0:
        school_action.append(
            "Maintain routine supervision and ensure water access during school hours."
        )

    if len(community_action) == 0:
        community_action.append(
            "Continue monitoring local environmental conditions and share updates when risk changes."
        )

    if len(escalation_triggers) == 0:
        escalation_triggers.append(
            "Seek medical advice if symptoms worsen, persist, or the child appears unusually weak or unwell."
        )

    recommended_action = {
        "immediate": immediate_action,
        "caregiver": caregiver_action,
        "school": school_action,
        "community": community_action,
        "when_to_escalate": escalation_triggers,
    }

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

    # Personalised guidance

    guidance_parts = []

    if age_group == "under5":
        guidance_parts.append(
            "Children under 5 can deteriorate more quickly during heat, dehydration, respiratory stress, and infectious disease exposure."
        )

    if heat_risk in ["moderate", "high"]:
        guidance_parts.append(
            "Heat exposure may increase dehydration risk, fatigue, and heat-related illness in vulnerable children."
        )

    if respiratory_risk in ["moderate", "high"]:
        guidance_parts.append(
            "Poor air quality may worsen coughing, wheezing, breathing discomfort, or asthma-related symptoms."
        )

    if dengue_risk in ["moderate", "high"]:
        guidance_parts.append(
            "Warm and humid conditions may increase mosquito activity and dengue exposure risk."
        )

    if asthma:
        guidance_parts.append(
            "Children with asthma or respiratory vulnerability may require closer breathing monitoring during poor air quality conditions."
        )

    if dehydration:
        guidance_parts.append(
            "Existing dehydration symptoms may worsen more rapidly during sustained heat exposure."
        )

    if fever and mosquito_exposure:
        guidance_parts.append(
            "Fever together with mosquito exposure should be monitored carefully for worsening infectious symptoms."
        )

    if flood_exposure:
        guidance_parts.append(
            "Flood exposure may increase risk of contaminated water exposure, skin infection, and water-borne illness."
        )

    if len(guidance_parts) == 0:
        guidance_parts.append(
            "Continue monitoring environmental conditions and maintain routine precautions."
        )

    guidance_message = " ".join(guidance_parts)

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
        "child_vulnerability": {
            "level": vulnerability_level,
            "reasons": vulnerability_reasons,
        },
        "predictive_domains": {
            "heat_stress": predictive_heat_risk,
            "respiratory": predictive_respiratory_risk,
            "dengue": predictive_dengue_risk,
        },
        "priority_alert": priority_alert,
        "forecast": forecast_risks,
        "action": action,
        "recommended_action": recommended_action,
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