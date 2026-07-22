# Child Guard API

Production-oriented FastAPI backend for environmental child-health risk guidance,
caregiver accounts, multi-child profiles, explainable recommendations, parent panel,
and Expo push notifications.

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
| Parent panel | `/api/v1/panel/*` | same gate |
| Devices / push | `/api/v1/devices`, `/api/v1/notifications/*` | personalised / API key for dispatch |

## Auth model

1. **`X-API-Key`** — required when `API_KEY` is set (always in production).
2. **`Authorization: Bearer <access>`** — JWT after register/login for caregiver routes.
3. Personalised routes also require accepted consent + disclaimer ack (`403` with `consent_required` / `disclaimer_required`).

## Render note

Compose is for local/dev. Render still runs the API as a native Python service until Postgres/Redis are provisioned there separately.
