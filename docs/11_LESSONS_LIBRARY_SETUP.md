# Lessons Learned Library: Setup Guide

A **Lessons** item in the manager menu (between *Incidents* and *My Team*) opens a simple search page. The manager types a topic,
for example "billing errors", and sees the lessons that were recorded when past incidents were reviewed, each with a match percentage.

This builds on the Risk Prediction package: it uses the same ML service, the same `AI_SERVICE_URL` setting and the same Docker setup.
Apply the Risk Prediction files first (see `docs/10_ML_SERVICE_SETUP.md`).

## 1. Where every file goes

Paths are from the repository root. Copy each file to the same path in your repo (the zip already has this layout).

| File | New or changed | What it does |
|---|---|---|
| `backend/src/shared/services/lessons-library.service.ts` | **New** | The API gateway. The only code that talks to the ML service's lessons search. Validates the answer, times out after 8 s, removes the source incident's id and title, lists each lesson once, never crashes the page |
| `backend/src/modules/manager/manager.validator.ts` | Changed | Adds `lessonsSearchSchema` (search text must be 2 to 200 characters) |
| `backend/src/modules/manager/manager.service.ts` | Changed | Adds `searchLessons()` |
| `backend/src/modules/manager/manager.controller.ts` | Changed | Adds the `searchLessons` handler |
| `backend/src/modules/manager/manager.routes.ts` | Changed | Adds `GET /api/manager/lessons/search` |
| `ml-service/lessons_learned_library.py` | Changed | The search now returns each distinct lesson once (before, the same sentence could appear 7 times) |
| `ml-service/README.md` | Changed | Documents that the Lessons menu uses `/lessons-search` |
| `frontend/src/features/manager/api/manager.api.ts` | Changed | Adds the lesson types and the `searchLessons` call |
| `frontend/src/features/manager/hooks/useManager.ts` | Changed | Adds `useLessonsSearch` (runs only when the manager presses Search) |
| `frontend/src/features/manager/pages/LessonsLibrary.tsx` | **New** | The page: one search card and plain result boxes |
| `frontend/src/shared/components/Sidebar.tsx` | Changed | Adds the **Lessons** menu item before *My Team* (Manager menu) |
| `frontend/src/App.tsx` | Changed | Imports the page and adds the `/lessons` route |
| `docs/04_API_REFERENCE.md`, `docs/09_DECISION_LOG.md`, `docs/10_ML_SERVICE_SETUP.md`, `docs/11_LESSONS_LIBRARY_SETUP.md` | Changed / new | Documentation |

There is no database change and no new container. The lessons use the `ml_service` container you already added.

```
KAIROS-HIMS/
├── backend/src/
│   ├── modules/manager/            (manager.validator / .service / .controller / .routes: changed)
│   └── shared/services/
│       └── lessons-library.service.ts      (new)
├── frontend/src/
│   ├── App.tsx                             (changed)
│   ├── features/manager/
│   │   ├── api/manager.api.ts              (changed)
│   │   ├── hooks/useManager.ts             (changed)
│   │   └── pages/LessonsLibrary.tsx        (new)
│   └── shared/components/Sidebar.tsx       (changed)
├── ml-service/
│   └── lessons_learned_library.py          (changed)
└── docs/                                   (documentation)
```

## 2. How one search flows

```
Manager clicks Lessons, types "billing errors", presses Search
   Browser  --GET /api/manager/lessons/search?q=billing errors-->  Backend (manager or admin login required, checks q is 2 to 200 characters)
   Backend  --GET /lessons-search?q=billing errors-->  ML service (kairos_ml_service:8001)
   ML service: turns the text into numbers, finds the closest recorded lessons, keeps each distinct lesson once
   ML service --{ results: [{ lesson, relevance_score, category, department, incident_id, source_incident_title }] }-->  Backend
   Backend: drops incident_id and source_incident_title, turns the score into matchPercent, lists each lesson once
   Backend  --{ available, results: [{ lesson, category, department, matchPercent }] }-->  Browser  -> the result boxes
```

The browser never talks to the ML service. Only the backend does (the gateway).

## 3. Install it (Docker)

Do these from the repository root. If your Docker only has the newer command, write `docker compose` instead of `docker-compose`.

1. **Copy the files** into your repo, keeping their paths.
2. **Build the frontend** (your README requires this before the Docker build):
   `cd frontend && npm run build && cd ..`
3. **Rebuild and start everything, including the ML service** (it changed, so it must be rebuilt):
   `docker-compose --profile ml up -d --build`
   To rebuild only the ML service: `docker-compose --profile ml up -d --build ml_service`
4. **No migration is needed** for this feature.
5. **Check the ML side:** open http://localhost:8001/docs, open `GET /lessons-search`, click *Try it out*, enter `q` = `billing errors`, and execute. You should see lessons.
6. **Check the app:** log in as a manager, click **Lessons**, search `billing errors`.

### Without Docker (development)

Run the ML service as described in `ml-service/README.md` (port 8001), then run the backend with `npm run dev` and the frontend with `npm run dev`.
The default `AI_SERVICE_URL` (`http://localhost:8001`) already matches.

## 4. Settings

| Variable | Where | Default | Meaning |
|---|---|---|---|
| `AI_SERVICE_URL` | backend | `http://localhost:8001` (compose sets `http://ml_service:8001`) | Address of the ML service (shared with Risk Prediction) |
| `AI_SERVICE_TIMEOUT_MS` | backend | `8000` | How long to wait before saying the service could not be reached |
| `LESSONS_THRESHOLD` | `ml-service/lessons_learned_library.py` | `0.45` | Minimum match for a lesson to be shown. Lower it to see more results, raise it to see fewer |
| `LESSONS_TOP_K` | `ml-service/lessons_learned_library.py` | `7` | Most lessons shown per search |

## 5. What the page does

- The manager needs at least 2 characters. The search runs when they press **Search** or Enter, not on every key.
- Results are the lessons recorded when incidents were reviewed. Each distinct lesson is shown once, best match first.
- Each result shows the lesson, its category and department, and a match percentage.
- The search covers the **whole organisation**, not just the manager's department, because lessons are meant to be shared.
- The id and title of the incident behind a lesson are **never** sent to the browser. A lesson is shared knowledge, but the incident belongs to one department.
- If nothing matches, the page says so. If the ML service is off, it says the lessons service could not be reached and offers **Try again**.

## 6. If something is wrong

| What you see | Cause and fix |
|---|---|
| No **Lessons** item in the menu | The frontend was not rebuilt. Run `cd frontend && npm run build`, then `docker-compose up -d --build`. Also check you are logged in as a manager |
| "The lessons service could not be reached" | The ML service is not running or is still starting. Run `docker-compose ps` and `docker logs kairos_ml_service`. Start it with `--profile ml` |
| "No lessons found" for a topic you expect | Try different or fewer words. The cut-off may also be too strict (see `LESSONS_THRESHOLD`). Only about a third of incidents have a recorded lesson |
| The same lesson shows more than once | The ML service was not rebuilt with the new file. Run step 3. (The backend also hides repeats as a safety net) |
| Error "Search text must be at least 2 characters" | The search box has fewer than 2 characters |
| The page opens but the menu item is not highlighted | `Sidebar.tsx` was not updated. Copy it again |
| Build fails while downloading | The ML build needs internet once (PyTorch and the model). Retry on a working connection |

## 7. Important: the lessons are made-up for now

`ml-service/seed/healthcare_incidents_synthetic.csv` contains **made-up** incidents, and about a third of them carry a made-up lesson.
`ml-service/seed/demo_lessons.csv` adds clearly labeled lessons for common test searches such as billing errors, medication safety,
and patient falls. Docker Compose includes these examples by default so the library is easy to test. They are not real records;
set `ML_INCLUDE_DEMO_LESSONS=false` when using real lesson data.

Real lessons are recorded at the **Review & Closure Gate (Stage 4)** of your incident workflow. The next step is a small export that
writes those lessons, with their category and department, from PostgreSQL into the CSV format the ML service reads. After that,
the Lessons page shows real knowledge from your own incidents.

## 8. Security and resources

- The ML service has no login. Compose publishes its port only on your own machine (`127.0.0.1:8001`). Never expose it to the internet.
- The backend requires a manager or admin login for this endpoint.
- The ML service needs roughly 1 to 1.5 GB of memory. That is why it is optional (`--profile ml`). Without it, the Lessons page opens but says the service could not be reached.
