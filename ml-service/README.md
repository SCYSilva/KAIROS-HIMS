# KAIROS ML Service

A small FastAPI service that adds machine-learning features to KAIROS HIMS. The backend calls it;
the browser never does.

| Endpoint | Used for |
|---|---|
| `POST /risk-score` | **Risk Prediction card** (Manager, Investigation step) |
| `POST /similar-incidents` | Similar past incidents (not yet shown in the UI) |
| `GET /recurring-incidents/{department}` | Recurring issues per department (not yet shown in the UI) |
| `GET /incident-clusters` | Whole-hospital themes, admin only (not yet shown in the UI) |
| `GET /lessons-search?q=...` | Lessons library search (not yet shown in the UI) |
| `GET /health` | Status |

## Run with Docker (recommended)

From the repository root:

```bash
docker-compose --profile ml up --build
```

The first build is slow (PyTorch and the language model are downloaded once). The first start builds
the search indexes (a few minutes) and saves them in the `ml_data` volume, so later starts are fast.
Open http://localhost:8001/docs to try the endpoints.

## Run without Docker

```bash
cd ml-service
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
ML_CSV_PATH=seed/healthcare_incidents_synthetic.csv uvicorn similar_incident_api:app --host 0.0.0.0 --port 8001
```

When the backend runs outside Docker, its default `AI_SERVICE_URL` (`http://localhost:8001`) already matches.

## Settings

| Variable | Default | Meaning |
|---|---|---|
| `ML_DATA_DIR` | `.` | Folder where the search indexes are saved |
| `ML_CSV_PATH` | `healthcare_incidents_synthetic.csv` | Past incidents the service learns from |

## Important: the data

`seed/healthcare_incidents_synthetic.csv` is **synthetic** (made-up facility incidents). Until it is replaced
with an export of real closed incidents, the repeat-incident and time-to-close parts of the prediction
reflect that made-up history. The reported-severity part is always real.
