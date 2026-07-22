# Child Guard API Documentation

> **Frontend Implementation Guide**
>
> **Version:** 1.0 (Section 7 — Auth, Consent, Multi-child, Explainable AI, Panel, Push)  
> **Production URL:** `https://child-health-platform.onrender.com`  
> **Local URL (Docker Compose):** `http://localhost:18000`  
> **API prefix:** `/api/v1/`  
> **Interactive docs:** `/docs` (Swagger), `/redoc`, `/openapi.json`  
> **Last Updated:** July 22, 2026

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
   - [Parent Panel](#parent-panel)
   - [Devices & Push](#devices--push)
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

Public (API-key only when configured): Health, Auth register/login/refresh, Consent/Disclaimer copy + accept, Environment Risk, notification dispatch (scheduler).

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

#### `GET /children/{child_id}`
#### `PATCH /children/{child_id}`
Partial update of profile fields.
#### `DELETE /children/{child_id}`
`204` No Content.
#### `POST /children/{child_id}/select`
Marks this child selected (others cleared).

---

### Recommendations (Explainable AI)

Rules-based, explainable engine (no LLM). Always includes disclaimer text.

#### `POST /recommendations/evaluate`

Requires personalised gate.

```json
{
  "lat": 24.8607,
  "lon": 67.0011,
  "child_id": "uuid-or-null",
  "age": 4,
  "conditions": { "asthma": true },
  "symptoms": { "cough": true },
  "exposures": {},
  "allergies": {}
}
```

If `child_id` is set, profile is loaded from DB (ownership checked). Otherwise inline age/profile fields are used.

#### `GET /children/{child_id}/recommendations?lat=&lon=`

Same result shape; persists a risk assessment for history/panel.

**Result shape (key fields):**

```json
{
  "overall_risk": "high",
  "primary_hazards": ["respiratory", "heat_stress"],
  "explanation": {
    "why": "...",
    "environmental_factors": ["..."],
    "child_factors": ["asthma", "cough"]
  },
  "priority_actions": ["..."],
  "secondary_actions": ["..."],
  "monitoring_advice": ["..."],
  "escalation_advice": ["..."],
  "disclaimer": "...",
  "model_version": "env-risk-heuristic-v2",
  "data_completeness": "full",
  "assessment_id": "uuid",
  "child_id": "uuid"
}
```

Guidance is **not diagnostic**. Never present actions as medical treatment.

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

Cooldownupe/cooldown via `notification_state` (`NOTIFICATION_COOLDOWN_MINUTES`, default **180**). Inactive Expo tokens (`DeviceNotRegistered`) are marked inactive.

Response: `{ "processed_children", "notifications_sent", "skipped" }`.

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
2. `GET /children/{id}/recommendations?lat=&lon=`  
3. Render `explanation`, `priority_actions`, always show `disclaimer`  
4. Refresh panel overview

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

### 1.0 — 2026-07-22

- JWT caregiver auth (register / login / refresh / logout / me)
- Versioned consent + medical disclaimer with gates (re-accept on version bump)
- Multi-child CRUD (max 10), select child, rich profile JSON maps
- Explainable rules-based recommendation engine + persistence
- Parent panel overview / history / recommendations
- Expo device registry + test push + scheduler dispatch (`high_risk`, `risk_improved`, `daily_briefing`)
- Docker Compose (Postgres 16 + Redis 7 + API with migrate-on-start)
- Existing environment-risk v1 + batch retained (503 / batch item errors when Open-Meteo fails)
