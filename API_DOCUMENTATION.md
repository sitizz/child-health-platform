# Child Guard API Documentation

> **Frontend Implementation Guide**
>
> **Version:** 1.3 (ML triage, Gemini LLM communication layer, vision/audio stubs, i18n skeleton)  
> **Production URL:** `https://child-health-platform.onrender.com`  
> **Local URL (Docker Compose):** `http://localhost:18000`  
> **API prefix:** `/api/v1/`  
> **Interactive docs:** `/docs` (Swagger), `/redoc`, `/openapi.json`  
> **Last Updated:** August 6, 2026

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Authentication](#authentication)
3. [Response Format](#response-format)
4. [Error Handling](#error-handling)
5. [Onboarding Gate](#onboarding-gate)
6. [API Endpoints](#api-endpoints)
   - [Health](#health)
   - [Auth](#auth)
   - [Consent](#consent)
   - [Disclaimer](#disclaimer)
   - [Children](#children)
   - [Recommendations (Explainable AI)](#recommendations-explainable-ai)
   - [Machine Learning](#machine-learning)
   - [Parent Panel](#parent-panel)
   - [Devices & Push](#devices--push)
   - [Engagement Tracking](#engagement-tracking)
   - [Environment Risk](#environment-risk)
7. [React Native Flows](#react-native-flows)
8. [Changelog](#changelog)

---

## Getting Started

### Prerequisites

- HTTP client (`fetch`, axios, etc.)
- Secure token storage (Expo SecureStore / AsyncStorage)
- Device location permission for risk / recommendation calls
- Expo push token for notifications

### Headers

| Header | When |
|--------|------|
| `Content-Type: application/json` | All JSON bodies |
| `X-API-Key: <key>` | When server has `API_KEY` set (required in production) |
| `Authorization: Bearer <access>` | Caregiver-authenticated routes |
| `Accept-Language: ms-MY,en;q=0.8` | Optional. Negotiates response language (`en`, `ms`, `ur`, `id`). Echoed as `Content-Language`. |

### Quick Start (React Native)

```javascript
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const api = axios.create({
  baseURL: 'https://child-health-platform.onrender.com/api/v1',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': process.env.EXPO_PUBLIC_API_KEY,
  },
});

api.interceptors.request.use(async (config) => {
  const access = await SecureStore.getItemAsync('accessToken');
  if (access) {
    config.headers.Authorization = `Bearer ${access}`;
  }
  return config;
});

// Register
const { data } = await api.post('/auth/register', {
  email: 'parent@example.com',
  password: 'Password1!',
  name: 'Ada Parent',
});
await SecureStore.setItemAsync('accessToken', data.access);
await SecureStore.setItemAsync('refreshToken', data.refresh);
```

---

## Authentication

### Dual auth model

1. **API key** (`X-API-Key`) — protects the API surface when configured.
2. **JWT** (`Authorization: Bearer`) — identifies the caregiver after register/login.

### Token lifetimes

| Token | Default | Config |
|-------|---------|--------|
| Access | 60 minutes | `JWT_ACCESS_TTL_MIN` |
| Refresh | 7 days | `JWT_REFRESH_TTL_DAYS` |

### Refresh

```javascript
const refresh = await SecureStore.getItemAsync('refreshToken');
const { data } = await api.post('/auth/refresh', { refresh });
await SecureStore.setItemAsync('accessToken', data.access);
await SecureStore.setItemAsync('refreshToken', data.refresh);
```

On `401` from access token expiry, refresh once, then retry. On refresh failure, force logout.

---

## Response Format

Success responses return the resource **directly** (no `{ success, data }` envelope).

Auth success example:

```json
{
  "caregiver": {
    "id": "uuid",
    "email": "parent@example.com",
    "name": "Ada Parent",
    "created_at": "2026-07-22T12:00:00Z"
  },
  "access": "eyJ...",
  "refresh": "eyJ...",
  "token_type": "bearer"
}
```

Error envelope:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Request validation failed",
    "request_id": "uuid",
    "details": { "errors": [] }
  }
}
```

---

## Error Handling

| Status | Meaning |
|--------|---------|
| `400` | Business rule (e.g. max 10 children) |
| `401` | Missing/invalid API key or JWT |
| `403` | Consent or disclaimer not accepted (`consent_required` / `disclaimer_required`) |
| `404` | Resource not found / not owned |
| `409` | Email already registered |
| `422` | Validation failed |
| `429` | Rate limited (environment-risk) |
| `503` | Upstream (Open-Meteo) unavailable |

Handle `403` by routing to Consent / Disclaimer screens, then retry.

---

## Onboarding Gate

Personalised routes require **both**:

1. Current consent version accepted (`POST /consent/accept`)
2. Current disclaimer acknowledged (`POST /disclaimer/acknowledge`)

Gated groups: **Children**, **Recommendations**, **Panel**, **Devices**, personalised notification test.

Public (API-key only when configured): Health, Auth register/login/refresh, Consent/Disclaimer copy + accept, Environment Risk, Machine Learning (`/api/v1/ml/*`), notification dispatch (scheduler).

---

## API Endpoints

### Health

#### `GET /`
Service status (no auth).

#### `GET /healthz`
Liveness.

#### `GET /readyz`
Readiness (DB/cache/upstream probes). May return `degraded`.

Also available under `/api/v1/system/` with the same semantics.

---

### Auth

Base: `/api/v1/auth` — API key dependency when configured.

#### `POST /auth/register`

```json
{ "email": "parent@example.com", "password": "Password1!", "name": "Ada Parent" }
```

Returns `AuthResponse` (`caregiver`, `access`, `refresh`).

#### `POST /auth/login`

```json
{ "email": "parent@example.com", "password": "Password1!" }
```

#### `POST /auth/refresh`

```json
{ "refresh": "<refresh-token>" }
```

#### `POST /auth/logout`

```json
{ "refresh": "<refresh-token>" }
```

Revokes the refresh token. Returns `{ "status": "ok" }`.

#### `GET /auth/me`

Requires Bearer. Returns caregiver profile.

---

### Consent

Base: `/api/v1/consent`

#### `GET /consent/current`

Returns versioned copy + required/optional checkbox keys for the UI:

- Required: `caregiver_authority`, `read_understood`, `not_diagnostic`, `data_processing`, `location`
- Optional: `notifications_opt_in`

#### `GET /consent/status`

Requires Bearer. Whether current version is accepted.

#### `POST /consent/accept`

Requires Bearer.

```json
{
  "checkboxes": {
    "caregiver_authority": true,
    "read_understood": true,
    "not_diagnostic": true,
    "data_processing": true,
    "location": true,
    "notifications_opt_in": true
  }
}
```

All required boxes must be `true` or the API returns `422`.

#### `POST /consent/withdraw`

Requires Bearer. Withdraws current consent; personalised routes become `403` until re-accepted.

**Version bumps:** if server `CONSENT_VERSION` changes, `status.accepted` becomes `false` until the caregiver accepts the new version again.

---

### Disclaimer

Base: `/api/v1/disclaimer`

#### `GET /disclaimer/current`
Version + medical disclaimer text.

#### `GET /disclaimer/status`
Requires Bearer. `acknowledged` is true only for the **current** `disclaimer_version`.

#### `POST /disclaimer/acknowledge`
Requires Bearer. Empty body. Records ack for current `disclaimer_version`. After a version bump, acknowledge again or personalised routes return `403` / `disclaimer_required`.

---

### Children

Base: `/api/v1/children` — requires personalised gate. **Max 10 per caregiver.**

#### Profile fields

| Field | Type | Notes |
|-------|------|-------|
| `name` | string \| null | Display name |
| `age` | int 0–18 | Required on create |
| `sex` | string \| null | Optional |
| `conditions` | object | e.g. `{ "asthma": true }` |
| `allergies` | object | Free-form map |
| `symptoms` | object | e.g. `{ "cough": true, "fever": true }` |
| `exposures` | object | e.g. `{ "mosquito_exposure": true }` |
| `is_selected` | bool | Active child for panel |

#### `GET /children`
List children.

#### `POST /children`

```json
{
  "name": "Sam",
  "age": 4,
  "conditions": { "asthma": true },
  "symptoms": { "cough": false },
  "exposures": {}
}
```

`201` on success. `400` if already at max 10.

On success, the server also records an `add_child` engagement event (see [Engagement Tracking](#engagement-tracking)).

#### `GET /children/{child_id}`
#### `PATCH /children/{child_id}`
Partial update of profile fields.
#### `DELETE /children/{child_id}`
`204` No Content.
#### `POST /children/{child_id}/select`
Marks this child selected (others cleared).

---

### Recommendations (Explainable AI)

Rules-based, explainable engine. Risk decisions come from the deterministic scorer;
ML only adds triage confidence and simplified caregiver text. Always includes disclaimer text.

#### `POST /recommendations/evaluate`

Requires personalised gate.

Query param (optional): `language` — `en` \| `ms` \| `ur` \| `id` (overrides `Accept-Language`).

```json
{
  "lat": 24.8607,
  "lon": 67.0011,
  "child_id": "uuid-or-null",
  "age": 4,
  "conditions": { "asthma": true },
  "symptoms": { "cough": true },
  "exposures": {},
  "allergies": {},
  "language": "en"
}
```

If `child_id` is set, profile is loaded from DB (ownership checked). Otherwise inline age/profile fields are used.

#### `GET /children/{child_id}/recommendations?lat=&lon=&language=`

Same result shape; persists a risk assessment for history/panel.

**Result shape (key fields):**

```json
{
  "overall_risk": "high",
  "primary_hazards": ["Respiratory", "Heat Stress"],
  "explanation": {
    "why": "Overall environmental health risk is high based on Respiratory, Heat Stress.",
    "environmental_factors": ["Poor air quality detected", "High temperature detected"],
    "child_factors": ["Asthma or respiratory vulnerability is present", "Current cough or wheezing symptoms are present"]
  },
  "priority_actions": ["..."],
  "secondary_actions": ["..."],
  "monitoring_advice": ["..."],
  "escalation_advice": ["..."],
  "disclaimer": "...",
  "model_version": "env-risk-heuristic-v2",
  "data_completeness": "full",
  "assessment_id": "uuid",
  "child_id": "uuid",
  "language": "en",
  "ml_prediction": {
    "predicted_domain": "respiratory",
    "confidence": 0.92,
    "agrees_with_engine": true,
    "engine_primary_domain": "respiratory",
    "probabilities": {
      "heat_stress": 0.04,
      "respiratory": 0.92,
      "dengue": 0.02,
      "flood": 0.01,
      "low_risk": 0.01
    },
    "model_version": "symptom-triage-rf-v1",
    "note": "ML triage agrees with the deterministic engine."
  },
  "simplified": {
    "summary": "Overall environmental health risk is high based on breathing, Heat Stress. Do this now: ...",
    "why": "...",
    "priority_actions": ["..."],
    "secondary_actions": ["..."],
    "monitoring_advice": ["..."],
    "escalation_advice": ["..."],
    "readability": {
      "average_flesch_kincaid_grade": 8.5,
      "why_reading_ease": 65.2
    },
    "source": "gemini",
    "llm_model": "gemini-2.0-flash"
  }
}
```

| Field | Notes |
|-------|--------|
| `ml_prediction` | Offline scikit-learn triage. **Does not change** `overall_risk` or actions. |
| `simplified` | Caregiver-friendly rewrite of the same guidance + readability scores. Prefer this for lower-literacy UI copy. |
| `simplified.source` | `"gemini"` when the LLM rewrite passed validation, else `"rules"` (offline fallback). |
| `simplified.llm_model` | Model name when `source` is `"gemini"`, otherwise `null`. |
| `language` | Negotiated locale used for ML note / disclaimer strings where translated. |

Guidance is **not diagnostic**. Never present actions as medical treatment. When `agrees_with_engine` is `false`, keep showing the engine’s `overall_risk` / actions and optionally surface the ML note as “for review”.

---

### Machine Learning

Base: `/api/v1/ml` — API key when configured. **No JWT required.**

Design principle: the deterministic climate-health engine remains the single source of truth for risk. ML predicts a primary domain + confidence and can flag disagreement for review.

#### `GET /ml/status`

```json
{
  "classifier_loaded": true,
  "classifier_version": "symptom-triage-rf-v1",
  "feature_names": [
    "age_under5", "age_child", "age_adolescent",
    "asthma", "fever", "cough", "dehydration",
    "mosquito_exposure", "flood_exposure",
    "temperature", "humidity", "rainfall", "aqi", "pm2_5", "pm10"
  ],
  "risk_domains": ["heat_stress", "respiratory", "dengue", "flood", "low_risk"],
  "vision_status": "not_implemented",
  "audio_status": "not_implemented",
  "supported_languages": ["en", "ms", "ur", "id"],
  "llm_enabled": true,
  "llm_provider": "gemini",
  "llm_model": "gemini-2.0-flash"
}
```

#### LLM communication layer (Gemini)

`simplified` on recommendations / environment-risk is produced by **Google Gemini** when `GEMINI_API_KEY` is configured:

- Rewrites approved engine text into simpler caregiver language
- Builds a short 2–3 sentence summary
- Translates into `en` / `ms` / `ur` / `id` when `language` / `Accept-Language` is set
- **Never** invents medical advice or changes risk scores
- On missing key, Gemini error, or failed grounding validation → offline rule-based fallback (`source: "rules"`)

**Anti-hallucination controls (server-side):**
- Strict grounded system prompt (approved JSON is the only allowed truth)
- `temperature=0`, low `topP` / `topK`
- Exact list-length match (no extra/missing bullets)
- Blocks diagnosis / medicine / dosage language
- Rejects novel clinical tokens not present in the approved source
- English faithfulness check per bullet; unsafe output is discarded

`simplified.source` is `"gemini"` or `"rules"`. Optional `simplified.llm_model` names the model used.

#### `POST /ml/predict`

Direct triage without fetching weather. Useful for offline demos or unit tests.

```json
{
  "age_group": "under5",
  "asthma": false,
  "fever": false,
  "cough": false,
  "dehydration": true,
  "mosquito_exposure": false,
  "flood_exposure": false,
  "temperature": 39.0,
  "humidity": 50.0,
  "rainfall": 0.0,
  "aqi": 20.0,
  "pm2_5": 8.0,
  "pm10": 15.0
}
```

`200` response:

```json
{
  "prediction": {
    "predicted_domain": "heat_stress",
    "confidence": 1.0,
    "agrees_with_engine": true,
    "engine_primary_domain": "heat_stress",
    "probabilities": {
      "dengue": 0.0,
      "flood": 0.0,
      "heat_stress": 1.0,
      "low_risk": 0.0,
      "respiratory": 0.0
    },
    "model_version": "symptom-triage-rf-v1",
    "note": "ML triage agrees with the deterministic engine."
  },
  "disclaimer": "ML predictions augment guidance and do not replace the deterministic risk engine or professional medical advice."
}
```

Optional: `Accept-Language` or `?language=ms` localizes `note` / `disclaimer` when translations exist.

#### `GET /ml/languages`

```json
{
  "supported": ["en", "ms", "ur", "id"],
  "default": "en",
  "negotiated": "ms"
}
```

#### `POST /ml/vision/analyze` → **501**

Roadmap stub for camera-based wound / rash / nutrition analysis.

```json
{
  "image_base64": "<base64>",
  "analysis_type": "rash",
  "child_age": 4
}
```

Response (`501`):

```json
{
  "status": "not_implemented",
  "message": "Vision analysis is planned but not yet available. Camera-based wound/rash/nutrition guidance is on the roadmap.",
  "analysis_type": "rash",
  "planned_capabilities": [
    "wound classification",
    "rash classification",
    "nutrition photo guidance"
  ]
}
```

#### `POST /ml/audio/analyze` → **501**

Roadmap stub for cough-sound classification.

```json
{
  "audio_base64": "<base64>",
  "duration_seconds": 3.5,
  "child_age": 4
}
```

#### Frontend tips

```javascript
// Show ML confidence on the risk card (engine priority still drives colour / actions)
const ml = data.ml_prediction;
if (ml) {
  const pct = Math.round(ml.confidence * 100);
  // e.g. "ML Confidence 92% · RESPIRATORY · Agrees"
}

// Prefer simplified actions for caregiver-facing copy
const actions = data.simplified?.immediate ?? data.recommended_action?.immediate;
```

---

### Parent Panel

Base: `/api/v1/panel` — personalised gate.

#### `GET /panel/overview`

Household summary: selected child, per-child latest priority/hazards, open alerts count, consent/disclaimer flags, household priority.

#### `GET /panel/history`

Mixed timeline of assessments + notification log items (`kind`: `assessment` | `notification`).

#### `GET /panel/recommendations`

Aggregated latest recommendation-style items for the household.

---

### Devices & Push

#### `POST /devices`

Personalised gate. Register Expo push token.

```json
{
  "expo_push_token": "ExponentPushToken[xxxxxx]",
  "platform": "ios"
}
```

#### `DELETE /devices/{token}`

Deactivates token. `204` (idempotent if already inactive). `404` if token was never registered for this caregiver.

#### `POST /notifications/test`

Personalised gate.

```json
{ "title": "Child Guard test", "body": "Push notifications are working." }
```

#### `POST /notifications/dispatch`

API key only (scheduler/cron). For each child with a recent assessment and `notifications_opt_in`, may send:

| `type` | When |
|--------|------|
| `high_risk` | Latest assessment priority is `high` |
| `risk_improved` | Previous notified priority was `high`, now `moderate` or `low` |
| `daily_briefing` | No alert applies; at most once per calendar day for `moderate`/`low` |

Cooldown via `notification_state` (`NOTIFICATION_COOLDOWN_MINUTES`, default **180**). Inactive Expo tokens (`DeviceNotRegistered`) are marked inactive.

Response: `{ "processed_children", "notifications_sent", "skipped" }`.

#### Push notification prerequisites

For push notifications to reach devices, **all** of the following must be in place:

1. **Frontend registers push token** — on app launch, call `Notifications.getExpoPushTokenAsync()` and send the token to `POST /devices` with a valid JWT.
2. **`expo-notifications` plugin** in `app.json` — required for native push infrastructure in production builds.
3. **Consent opt-in** — the caregiver must accept consent with `notifications_opt_in: true`.
4. **Risk assessments exist** — at least one assessment must be persisted for each child (via `GET /children/{id}/recommendations`).
5. **Scheduler calls dispatch** — an external cron job must call `POST /notifications/dispatch` periodically (e.g. every 30 minutes). The backend does not self-schedule.
6. **`EXPO_ACCESS_TOKEN`** environment variable should be set on the server for authenticated Expo push delivery.

---

### Engagement Tracking

Base: `/api/v1/engagement`

Tracks caregiver actions that indicate platform engagement. Events are stored in PostgreSQL (`engagement_events`) and can be queried as aggregates.

#### Event types

| `event_type` | When to record | Logged by |
|--------------|----------------|-----------|
| `add_child` | A new child profile is created | Server auto-logs on `POST /children` |
| `share_summary` | User shares an alert / risk summary | Client calls `POST /engagement/track` |
| `risk_check` | User successfully checks current risk | Client calls `POST /engagement/track` |

#### `POST /engagement/track`

Log an engagement event. JWT is **optional**: when a valid bearer token is present, the event is attributed to that caregiver; otherwise `caregiver_id` is stored as `null` (anonymous).

```json
{
  "event_type": "risk_check",
  "metadata": {
    "priority": "high",
    "child_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

| Field | Type | Notes |
|-------|------|-------|
| `event_type` | string | Required. One of `add_child`, `share_summary`, `risk_check` |
| `metadata` | object \| null | Optional context (e.g. priority, child_id) |

`201` response:

```json
{
  "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "caregiver_id": "550e8400-e29b-41d4-a716-446655440000",
  "event_type": "risk_check",
  "metadata": { "priority": "high", "child_id": "..." },
  "created_at": "2026-08-03T11:42:00Z"
}
```

`422` if `event_type` is not one of the allowed values.

#### `GET /engagement/metrics`

Requires JWT. Returns aggregated engagement counts for the authenticated caregiver.

Query params:

| Param | Type | Notes |
|-------|------|-------|
| `from_date` | date (`YYYY-MM-DD`) | Optional inclusive start (UTC) |
| `to_date` | date (`YYYY-MM-DD`) | Optional inclusive end (UTC) |

Example: `GET /api/v1/engagement/metrics?from_date=2026-08-01&to_date=2026-08-03`

`200` response:

```json
{
  "total_events": 52,
  "by_type": {
    "add_child": 3,
    "share_summary": 7,
    "risk_check": 42
  },
  "daily": [
    {
      "date": "2026-08-03",
      "add_child": 1,
      "share_summary": 2,
      "risk_check": 10
    }
  ]
}
```

`401` if missing or invalid bearer token.

#### Frontend instrumentation (React Native)

After a successful risk check:

```javascript
await api.post('/engagement/track', {
  event_type: 'risk_check',
  metadata: { priority: data.priority_alert, child_id: selectedChild?.id ?? null },
});
```

After the user completes a share action (`Share.sharedAction`):

```javascript
await api.post('/engagement/track', {
  event_type: 'share_summary',
  metadata: { priority: result.priority_alert, child_id: selectedChild?.id ?? null },
});
```

Do **not** call track for `add_child` from the client when using `POST /children` — the backend already logs it.

---

### Environment Risk

No caregiver JWT required. API key when configured. Rate limited (`RATE_LIMIT`, default `60/minute`).

**Upstream (Open-Meteo):** if weather/air APIs fail, single-location calls return **HTTP 503** with message like `Weather upstream returned an error`. Batch returns **HTTP 200** with per-item `result: null` and `error` string — retry later.

#### `GET /api/v1/environment-risk`

Query params:

| Param | Default | Notes |
|-------|---------|-------|
| `lat`, `lon` | required | WGS84 |
| `age_group` | `under5` | `under5` \| `child` \| `adolescent` |
| `asthma`, `fever`, `cough`, `dehydration`, `mosquito_exposure`, `flood_exposure` | `false` | Profile flags |

#### `POST /api/v1/environment-risk/batch`

```json
{
  "locations": [
    { "lat": 24.86, "lon": 67.00, "id": "home" },
    { "lat": 24.90, "lon": 67.10, "id": "school" }
  ],
  "age_group": "child"
}
```

#### Response fields

| Field | Type | Notes |
|-------|------|-------|
| `location` | `{ lat, lon }` | Echo of request coordinates |
| `age_group` | string | `under5` \| `child` \| `adolescent` |
| `environment` | object | `temperature`, `humidity`, `rainfall`, `aqi`, `pm2_5`, `pm10` |
| `risks` | object | Current risk levels: `heat_stress`, `respiratory`, `dengue`, `flood` (each `low` \| `moderate` \| `high`) |
| `risk_reasons` | object | Per-domain reason arrays: `heat_stress`, `respiratory`, `dengue`, `flood` |
| `child_vulnerability` | object | `level` + `reasons` array |
| `predictive_domains` | object | Forecast-based risk levels: `heat_stress`, `respiratory`, `dengue`, `flood` |
| `priority_alert` | string | Highest current risk: `low` \| `moderate` \| `high` |
| `forecast` | array | 7-day forecast: `day`, `max_temperature`, `rainfall`, `predicted_risk` |
| `action` | string | Priority action message |
| `recommended_action` | object | `immediate`, `caregiver`, `school`, `community`, `when_to_escalate` arrays |
| `trend` | object | `direction` (`increasing` \| `stable` \| `decreasing`) + `message` |
| `escalation` | object | `level` (`normal` \| `watch` \| `urgent`) + `reason` |
| `guidance` | object | Age-specific: `group`, `summary`, `key_points` |
| `stakeholder_guidance` | object | `caregiver`, `school`, `community` arrays |
| `domain_labels` | object | Display-ready names: `{ "heat_stress": "Heat Stress", "respiratory": "Respiratory", "dengue": "Dengue", "flood": "Flood" }` |
| `model_version` | string | Scoring model version |
| `disclaimer` | string | Medical disclaimer text |
| `ml_prediction` | object \| null | Offline triage: `predicted_domain`, `confidence`, `agrees_with_engine`, `engine_primary_domain`, `model_version`, `note` |
| `simplified` | object \| null | Caregiver-friendly: `summary`, `immediate`, `when_to_escalate`, `average_flesch_kincaid_grade`, `source` (`gemini` \| `rules`), `llm_model` |
| `language` | string | Negotiated locale (default `en`) |

**Notes:**
- `risks` contains **current** (real-time) risk levels based on live weather data.
- `predictive_domains` contains **forecast-based** risk levels that account for upcoming weather conditions over the next 7 days. Values may differ from `risks` for the same domain.
- `domain_labels` maps JSON field keys (e.g. `heat_stress`) to display-ready labels (e.g. `"Heat Stress"`). Use these labels in the UI instead of formatting keys manually.
- `priority_alert` and `recommended_action` always come from the **deterministic engine**. Use `ml_prediction` as a confidence / review signal only.
- Prefer `simplified.immediate` / `simplified.summary` for caregiver-facing copy when present.

#### Legacy

`GET /environment-risk` — same query as v1 GET; prefer `/api/v1/environment-risk`.

---

## React Native Flows

### First-run onboarding

1. `POST /auth/register` → store tokens  
2. `GET /consent/current` → render checkboxes from `required_checkboxes`  
3. `POST /consent/accept`  
4. `GET /disclaimer/current` → show text  
5. `POST /disclaimer/acknowledge`  
6. `POST /children` → create first child  
7. `POST /devices` → register Expo token  
8. Navigate to panel / recommendations

### Daily risk check

1. Get location  
2. `GET /children/{id}/recommendations?lat=&lon=` *(or `GET /api/v1/environment-risk`)*  
3. Render engine fields: `priority_alert` / `explanation` / `priority_actions` — always show `disclaimer`  
4. Optionally show `ml_prediction.confidence` + domain badge; if `agrees_with_engine` is false, keep engine actions and show the ML note as secondary  
5. Prefer `simplified` text for caregiver-facing lists when available  
6. `POST /engagement/track` with `event_type: "risk_check"` and priority in `metadata`  
7. Refresh panel overview

### Share alert summary

1. Build share message from the latest risk result  
2. Call native `Share.share(...)`  
3. If the user completed the share (`Share.sharedAction`), `POST /engagement/track` with `event_type: "share_summary"`

### Session recovery

1. On app launch, `GET /auth/me`  
2. If `401`, try refresh  
3. `GET /consent/status` + `GET /disclaimer/status` — if false, re-show gates  
4. `GET /panel/overview`

### Axios 403 helper

```javascript
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const msg = error.response?.data?.error?.message;
    if (error.response?.status === 403 && msg === 'consent_required') {
      // navigate('Consent')
    }
    if (error.response?.status === 403 && msg === 'disclaimer_required') {
      // navigate('Disclaimer')
    }
    return Promise.reject(error);
  }
);
```

---

## Local development (Docker Compose)

```bash
cd backend
cp .env.example .env
docker compose up -d --build
# API: http://localhost:18000
# Postgres: localhost:5432
# Redis: localhost:6380

docker compose run --rm --entrypoint "" \
  -e API_KEY= \
  -e JWT_SECRET=test-secret-key-for-pytest-32chars! \
  -e APP_ENV=development \
  api pytest -q
```

See [`backend/README.md`](../backend/README.md) for details.

---

## Changelog

### 1.3 — 2026-08-06

- **Symptom triage ML:** scikit-learn Random Forest (`symptom-triage-rf-v1`) predicts primary risk domain + confidence from child factors and environment. Trained on synthetic labels derived from the existing scoring rules.
- **ML API:** `GET /api/v1/ml/status`, `POST /api/v1/ml/predict`, `GET /api/v1/ml/languages`.
- **Vision / audio stubs:** `POST /api/v1/ml/vision/analyze` and `POST /api/v1/ml/audio/analyze` return `501` with planned capability contracts.
- **Text simplifier:** caregiver-friendly rewrite + Flesch-Kincaid readability on recommendations and environment-risk responses (`simplified` field).
- **Gemini LLM communication layer:** rewrites / summarizes / translates approved engine text only (`source: gemini`); falls back to rules when unset/error.
- **Anti-hallucination guards:** strictly grounded prompt, `temperature=0`, exact list-length match, blocked diagnosis/medicine/dosage language, novel clinical token rejection, and per-bullet faithfulness checks. Any violation discards the LLM output and serves the rule-based fallback.
- **Response enrichment:** `ml_prediction`, `simplified`, and `language` on recommendation and environment-risk payloads. Deterministic engine remains decision-maker.
- **i18n skeleton:** `Accept-Language` middleware (`Content-Language` response header), `language` query/body on recommendations; supported codes `en`, `ms`, `ur`, `id`.
- **Frontend:** home risk card can display ML confidence and simplified actions.

### 1.2 — 2026-08-03

- **Engagement tracking:** new `POST /api/v1/engagement/track` and `GET /api/v1/engagement/metrics` endpoints.
- **Event types:** `add_child`, `share_summary`, `risk_check` stored in PostgreSQL (`engagement_events`).
- **Auto-log on child create:** `POST /children` records an `add_child` event server-side.
- **Metrics API:** per-caregiver totals by event type plus daily breakdown; optional `from_date` / `to_date` filters.
- **Frontend guide:** document when the mobile app should call track for risk checks and share actions.

### 1.1 — 2026-08-03

- **Domain display names:** `primary_hazards` now returns human-readable names (`"Heat Stress"` instead of `"heat_stress"`). The `why` explanation text also uses display names.
- **`domain_labels` field:** new object in environment-risk response mapping JSON keys to display-ready labels (e.g. `heat_stress` → `"Heat Stress"`).
- **Predictive flood scoring:** `predictive_domains` now includes `flood` (previously only heat_stress, respiratory, dengue). Scored from forecast rainfall data.
- **Push notification docs:** added prerequisites checklist documenting all required steps for push notifications to work end-to-end.

### 1.0 — 2026-07-22

- JWT caregiver auth (register / login / refresh / logout / me)
- Versioned consent + medical disclaimer with gates (re-accept on version bump)
- Multi-child CRUD (max 10), select child, rich profile JSON maps
- Explainable rules-based recommendation engine + persistence
- Parent panel overview / history / recommendations
- Expo device registry + test push + scheduler dispatch (`high_risk`, `risk_improved`, `daily_briefing`)
- Docker Compose (Postgres 16 + Redis 7 + API with migrate-on-start)
- Existing environment-risk v1 + batch retained (503 / batch item errors when Open-Meteo fails)
