# Child Guard API

Production-oriented FastAPI backend for environmental child-health risk guidance.

## Quick start

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
uvicorn main:app --reload --port 8000
```

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- OpenAPI JSON: http://localhost:8000/openapi.json

## Main endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | No | Service status |
| GET | `/healthz` | No | Liveness |
| GET | `/readyz` | No | Readiness |
| GET | `/api/v1/environment-risk` | API key when configured | Risk evaluation |
| POST | `/api/v1/environment-risk/batch` | API key when configured | Batch risk evaluation |
| GET | `/environment-risk` | API key when configured | Deprecated legacy alias |

## Auth

Set `API_KEY` in the environment. Clients send `X-API-Key: <key>`.
Leave empty in development to disable auth.

## Tests

```bash
pytest
```

## Docker

```bash
docker build -t child-guard-api .
docker run --rm -p 8000:8000 -e APP_ENV=development child-guard-api
```
