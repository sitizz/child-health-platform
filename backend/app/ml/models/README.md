# Persisted ML models

| File | Description |
|------|-------------|
| `symptom_triage_rf.joblib` | Random Forest symptom triage classifier (`symptom-triage-rf-v1`) |

Retrain:

```bash
cd backend
python scripts/train_classifier.py
```

The model is trained on synthetic labels derived from the deterministic
climate-health scoring rules in `app/domain/scoring.py`.
