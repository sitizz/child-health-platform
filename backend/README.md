# Child Guard API

Production-oriented FastAPI backend for environmental child-health risk guidance,
caregiver accounts, multi-child profiles, explainable recommendations, ML triage
augmentation, parent panel, and Expo push notifications.

## Preferred local stack (Docker Compose)

Uses **Python 3.12** inside the image (host Python 3.14 breaks `pydantic-core` / `greenlet` wheels).

```bash
cd backend
cp .env.example .env   # set JWT_SECRET, API_KEY as needed
docker compose up -d --build
```

Services:

| Service | Host port | Notes |
|---------|-----------|--------|
| API | `18000` | Alembic migrates on start |
| Postgres 16 | `5432` | volume `pgdata` |
| Redis 7 | `6380` | volume `redisdata` (avoids host 6379 clash) |

- Swagger: http://localhost:18000/docs
- ReDoc: http://localhost:18000/redoc
- OpenAPI: http://localhost:18000/openapi.json
- App docs for mobile: [`API_DOCUMENTATION.md`](../API_DOCUMENTATION.md)

### Run tests (Compose)

```bash
cd backend
docker compose up -d db redis
docker compose run --rm --entrypoint "" \
  -e API_KEY= \
  -e JWT_SECRET=test-secret-key-for-pytest-32chars! \
  -e APP_ENV=development \
  api pytest -q
```

### Migrate only

```bash
docker compose run --rm --entrypoint "" api alembic upgrade head
```

## Host venv (optional)

Requires **Python 3.12** (see `.python-version`). Do not use system 3.14.

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
# start db/redis via compose, then:
uvicorn main:app --reload --port 8000
```

## Main endpoint groups

| Group | Base path | Auth |
|-------|-----------|------|
| Health | `/`, `/healthz`, `/readyz` | None |
| Environment risk | `/api/v1/environment-risk` | `X-API-Key` when configured |
| Auth | `/api/v1/auth/*` | API key + JWT after login |
| Consent / disclaimer | `/api/v1/consent/*`, `/api/v1/disclaimer/*` | API key + JWT |
| Children | `/api/v1/children` | API key + JWT + consent + disclaimer |
| Recommendations | `/api/v1/recommendations/*`, `/api/v1/children/{id}/recommendations` | same gate |
| Machine Learning | `/api/v1/ml/*` | API key when configured |
| Parent panel | `/api/v1/panel/*` | same gate |
| Devices / push | `/api/v1/devices`, `/api/v1/notifications/*` | personalised / API key for dispatch |

### AI/ML layer

The **deterministic scoring engine remains the decision-maker**. ML augments it
with triage confidence and caregiver-friendly text — it never overrides risk scores
or medical guidance.

| Component | Location | Notes |
|-----------|----------|--------|
| Symptom triage classifier | `app/ml/symptom_classifier.py` | scikit-learn Random Forest (`symptom-triage-rf-v1`) |
| Training data generator | `app/ml/training_data.py` | Synthetic labels from `domain/scoring.py` thresholds |
| Persisted model | `app/ml/models/symptom_triage_rf.joblib` | Committed artifact for reviewers / deploy |
| LLM communication layer | `app/ml/llm_communicator.py` | Google Gemini rewrite / summary / translate |
| Offline text simplifier | `app/ml/text_simplifier.py` | Fallback when `GEMINI_API_KEY` is unset |
| Vision / audio stubs | `app/ml/vision/`, `app/ml/audio/` | API contracts; return HTTP `501` |
| i18n skeleton | `app/ml/i18n/` | `en`, `ms`, `ur`, `id` |

**ML routes** (`X-API-Key` when configured):

| Method | Path | Status |
|--------|------|--------|
| `GET` | `/api/v1/ml/status` | Classifier metadata |
| `POST` | `/api/v1/ml/predict` | Direct triage prediction |
| `GET` | `/api/v1/ml/languages` | Supported + negotiated language |
| `POST` | `/api/v1/ml/vision/analyze` | `501` roadmap stub |
| `POST` | `/api/v1/ml/audio/analyze` | `501` roadmap stub |

Risk and recommendation responses also include:

- `ml_prediction` — predicted domain, confidence, engine agreement, note
- `simplified` — caregiver-friendly summary / actions + readability (`source`: `gemini` or `rules`)
- `language` — negotiated locale (`Accept-Language` or `?language=`)

**Gemini env vars** (set in `.env` / Render; never commit the key):

```env
GEMINI_API_KEY=your-key
GEMINI_MODEL=gemini-2.0-flash
```

The LLM may only rewrite / summarize / translate **approved** engine text. Every response is
validated server-side (grounded prompt, `temperature=0`, exact list lengths, no diagnosis /
medicine / dosage language, no novel clinical terms, per-bullet faithfulness). If the key is
missing, Gemini errors, or validation fails, the API falls back to the offline rule-based
simplifier and reports `simplified.source = "rules"`.

**Retrain the classifier** (Docker, preferred so sklearn matches the image):

```bash
cd backend
docker compose run --rm --entrypoint "" api python scripts/train_classifier.py
# model writes to app/ml/models/symptom_triage_rf.joblib (bind-mounted)
docker compose restart api
```

See [`API_DOCUMENTATION.md`](../API_DOCUMENTATION.md#machine-learning) for request/response shapes.

## Auth model

1. **`X-API-Key`** — required when `API_KEY` is set (always in production).
2. **`Authorization: Bearer <access>`** — JWT after register/login for caregiver routes.
3. Personalised routes also require accepted consent + disclaimer ack (`403` with `consent_required` / `disclaimer_required`).

## Deploy on Render

Compose is for **local/dev only**. On Render, run a **native Python** web service plus a **Postgres** database.

### Service settings

| Setting | Value |
|---------|--------|
| Root Directory | `backend` |
| Runtime | Python 3 |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port $PORT` |
| Health check path | `/healthz` |

Also create a **Render Postgres** instance and link it to the web service.

### Environment variables (paste into Render)

Generate a JWT secret locally:

```bash
openssl rand -hex 32
```

```env
APP_ENV=production
APP_NAME=Child Guard API
APP_VERSION=1.0.0
PYTHON_VERSION=3.12.11
LOG_LEVEL=INFO

# Render Postgres URL with scheme swapped:
# postgresql://…  →  postgresql+asyncpg://…
DATABASE_URL=postgresql+asyncpg://USER:PASSWORD@HOST:5432/DBNAME

JWT_SECRET=<openssl-rand-hex-32>
JWT_ACCESS_TTL_MIN=60
JWT_REFRESH_TTL_DAYS=7

API_KEY=<same-key-as-mobile-app>
CORS_ORIGINS=*
RATE_LIMIT=60/minute
CACHE_TTL_SECONDS=300
OPEN_METEO_TIMEOUT_SECONDS=8.0
OPEN_METEO_API_KEY=your-open-meteo-customer-key
# Optional overrides; customer hosts are used automatically when the key is set.
OPEN_METEO_FORECAST_URL=https://customer-api.open-meteo.com/v1/forecast
OPEN_METEO_AIR_URL=https://customer-air-quality-api.open-meteo.com/v1/air-quality

ENABLE_DOCS=false
MODEL_VERSION=env-risk-heuristic-v2
CONSENT_VERSION=consent-v1
DISCLAIMER_VERSION=disclaimer-v1
PRIVACY_POLICY_URL=https://child-health-platform.onrender.com/privacy
TERMS_URL=https://child-health-platform.onrender.com/terms

NOTIFICATION_COOLDOWN_MINUTES=180
MAX_CHILDREN_PER_CAREGIVER=10

# Gemini LLM communication layer (rewrite/summarize/translate only)
GEMINI_API_KEY=<your-gemini-api-key>
GEMINI_MODEL=gemini-2.0-flash
```

Optional:

```env
# REDIS_URL=redis://…          # omit → in-memory cache
# EXPO_ACCESS_TOKEN=…          # Expo push from server
# GEMINI_TIMEOUT_SECONDS=12
# GEMINI_CACHE_TTL_SECONDS=3600
```

### `DATABASE_URL` tip

Render shows:

```text
postgresql://user:pass@dpg-xxx/dbname
```

Set on the service:

```text
postgresql+asyncpg://user:pass@dpg-xxx/dbname
```

Do **not** use the local Compose URL (`localhost` / `childguard:childguard`).

### After deploy checklist

1. `GET /healthz` → `200`
2. `GET /readyz` → `database: ok` (may be `degraded` if Open-Meteo blips)
3. Risk call with `X-API-Key` still works and returns `ml_prediction` + `simplified`
4. `GET /api/v1/ml/status` → `classifier_loaded: true`, `llm_enabled: true` (when `GEMINI_API_KEY` is set)
5. Risk/recommendations `simplified.source` is `gemini` when LLM succeeds (else `rules` fallback)
6. `POST /api/v1/auth/register` works (needs Postgres + migrate)
7. Mobile app: keep sending `X-API-Key`; new flows also need JWT after login
