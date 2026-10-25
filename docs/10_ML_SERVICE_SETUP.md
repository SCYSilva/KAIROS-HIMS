# Risk Prediction: Setup Guide

The manager's incident page (**2. Investigation & Findings**) has one **Risk Prediction** card, placed
above *Lead Investigator Assignment*. It shows the AI's predicted risk as a percentage and a level
(Low, Medium, High, Critical) for that incident. The manager can change the level, and the change is saved.

## 1. Where each piece lives

| Piece | Location | What it does |
|---|---|---|
| **The ML model** | `ml-service/` (new folder, its own container `kairos_ml_service`) | Python service that calculates the risk percentage and level. The `POST /risk-score` endpoint is the risk prediction module |
| **API gateway** | `backend/src/shared/services/risk-prediction.service.ts` | The *only* code that talks to the ML service. Sends the incident, checks the answer, times out after 8 s, caches results for 10 min, never crashes the page if the ML service is down |
| **Endpoints and rules** | `backend/src/modules/manager/` (`risk-panel.ts`, `manager.service.ts`, `manager.controller.ts`, `manager.routes.ts`, `manager.validator.ts`) | Department check, saving and reverting the manager's change, audit log |
| **Database** | `backend/prisma/schema.prisma` and `backend/prisma/migrations/20261023000000_add_incident_risk_override/` | New columns on `Incident` for the manager's change |
| **The card** | `frontend/src/features/manager/components/RiskAssessmentCard.tsx` (+ `hooks/useManager.ts`, `api/manager.api.ts`) | The UI |
| **Where the card appears** | `frontend/src/features/manager/pages/ManagerIncidentDetails.tsx` (one line) | Puts the card above the Lead Investigator card |
| **Docker** | `docker-compose.yml` | New `ml_service` service, `ml_data` volume, and `AI_SERVICE_URL` for the backend |

## 2. How one request flows

```
Manager opens an incident -> tab 2
   Browser  --GET /api/manager/incidents/:id/risk-assessment-->  Backend (checks the manager's department)
   Backend  --POST /risk-score {title, description, severity, department}-->  ML service (kairos_ml_service:8001)
   ML service --{ total_score, risk_level, breakdown }-->  Backend  (adds the manager's saved change, if any)
   Backend  --{ prediction, override, finalLevel }-->  Browser  -> the card
```

The browser never talks to the ML service. Only the backend does, so department access control stays in one place.

## 3. Run it (Docker)

Do these from the repository root. If your Docker only has the newer command, write `docker compose` instead of `docker-compose`.

1. **Copy the changed files** into the repo, keeping their paths (the new `ml-service/` folder included).
2. **Build the frontend** (your README requires this before the Docker build):
   `cd frontend && npm run build && cd ..`
3. **Start everything, including the ML service:**
   `docker-compose --profile ml up -d --build`
   The first build is slow: it downloads PyTorch and the language model (a few GB). This only happens once.
4. **Apply the database migration:**
   `docker exec kairos_backend npx prisma migrate deploy`
5. **Wait for the ML service.** On its first start it builds its search indexes (a few minutes):
   `docker logs kairos_ml_service -f`
   It is ready when you see `Uvicorn running on http://0.0.0.0:8001`.
6. **Check it:** `docker-compose ps` should list `kairos_ml_service` as healthy, and http://localhost:8001/docs opens its API page.
7. **Use it:** log in as a manager, open an incident, go to **2. Investigation & Findings**.

A plain `docker-compose up -d --build` (no `--profile ml`) still works exactly as before. The card then says the prediction is
unavailable, and the manager can still set the risk level by hand.

### Without Docker (development)

- ML service: see `ml-service/README.md` (it runs on port 8001).
- Backend: `npx prisma migrate dev`, then `npm run dev`. The default `AI_SERVICE_URL` (`http://localhost:8001`) already matches.

## 4. Settings

| Variable | Where | Default | Meaning |
|---|---|---|---|
| `AI_SERVICE_URL` | backend | `http://localhost:8001` (compose sets `http://ml_service:8001`) | Address of the ML service |
| `AI_SERVICE_TIMEOUT_MS` | backend | `8000` | How long to wait before showing "unavailable" |
| `ML_DATA_DIR` | ml-service | `.` (compose: `/app/data`, a volume) | Where the search indexes are saved |
| `ML_CSV_PATH` | ml-service | `healthcare_incidents_synthetic.csv` | Past incidents the service learns from |

## 5. How the manager's change works

- The manager picks a level in **Edit Risk Level**, writes a reason (at least 10 characters), and clicks **Save Risk Level**.
- The manager's level always wins over the AI. It is shown in the card heading as "(manager override)".
- **Revert to AI prediction** removes it.
- It works even if the ML service is offline.
- It cannot be changed once the incident is CLOSED.
- Each change is saved in `IncidentAuditLog` with who, when, why, the old level and what the AI predicted at that moment. To see them:
  `SELECT "incidentId","userId","action","reason","changes","createdAt" FROM "IncidentAuditLog" WHERE "action" LIKE 'RISK_%' ORDER BY "id" DESC;`

## 6. If something is wrong

| What you see | Cause and fix |
|---|---|
| Card says "could not be reached" | The ML service is not running or still starting. Run `docker-compose ps` and `docker logs kairos_ml_service`. Start it with `--profile ml` |
| Build fails while downloading | The build needs internet once (PyTorch and the model). Retry on a working connection |
| ML service never becomes healthy | First start can take several minutes. Check the logs. Give Docker at least 2 GB of memory |
| Error mentioning a missing column (`riskOverrideLevel`) | The migration was not applied. Run step 4 |
| `docker-compose: unknown flag --profile` | Old Docker Compose. Use `docker compose` or upgrade |
| Save says "closed incident" | The incident is CLOSED, so its risk level is locked |

## 6b. The Lessons menu uses the same ML service

The **Lessons** menu item (before *My Team*) searches lessons through the same ML service, so there is nothing extra to start.
It calls `GET /api/manager/lessons/search`, and the backend asks the ML service (`/lessons-search`). If you change the files in
`ml-service/`, rebuild it: `docker-compose --profile ml up -d --build ml_service`. Docker Compose includes clearly labeled demo
lessons for testing; set `ML_INCLUDE_DEMO_LESSONS=false` when using real lesson data. When the ML service is off, the page says
the lessons service could not be reached.
Full guide: `docs/11_LESSONS_LIBRARY_SETUP.md`.

## 7. Important: the data the AI learns from

`ml-service/seed/healthcare_incidents_synthetic.csv` is **made-up** facility incidents. Until it is replaced with a real
export of closed incidents from this system's database:
- the **reported severity** part of the prediction is always real, and it sets the minimum level;
- the **repeat incidents** and **time to close** parts compare against the made-up history, so treat the percentage as a demo value.
- the **Lessons** page shows made-up lessons. Real lessons are recorded in Stage 4 (review sign-off), so they can be exported the same way.

The next step is a small export that writes closed incidents from PostgreSQL into the CSV format the ML service reads.

## 8. Security and resources

- The ML service has no login. Compose publishes its port only on your own machine (`127.0.0.1:8001`). Never expose it to the internet. The backend is the only thing that should reach it.
- The ML image is several GB and the service needs roughly 1 to 1.5 GB of memory. That is why it is optional (`--profile ml`). Leave it off on a very small server; the manager can still set the level by hand.
