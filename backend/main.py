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

    # Heat
    if temperature >= 38:
        heat_score += 2
    elif temperature >= 35:
        heat_score += 1

    if humidity >= 70:
        heat_score += 1

    # Respiratory
    if pm25 >= 35 or pm10 >= 100:
        respiratory_score += 2
    elif pm25 >= 15 or pm10 >= 50:
        respiratory_score += 1

    # Dengue (simple proxy)
    if temperature >= 25 and humidity >= 70:
        dengue_score += 1
    if rainfall > 0:
        dengue_score += 1

    # Vulnerable group boost
    if age_group == "under5":
        heat_score += 1
        respiratory_score += 1
        dengue_score += 1

    # 🧾 Classify risks
    heat_risk = classify_risk(heat_score)
    respiratory_risk = classify_risk(respiratory_score)
    dengue_risk = classify_risk(dengue_score)

    risks = [heat_risk, respiratory_risk, dengue_risk]

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
        },
        "priority_alert": priority_alert,
        "forecast": forecast_risks,
        "action": action,
    }