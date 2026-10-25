# API Reference

## Incidents (Manager Workflow)
- `GET /api/incidents/department/:departmentId` - Get all incidents for a department
- `PATCH /api/incidents/:id/accept` - Accept an OPEN incident
- `PATCH /api/incidents/:id/reject` - Reject an OPEN incident (Body: `{ reason: string }`)
- `PATCH /api/incidents/:id/assign-investigator` - Assign investigator (Body: `{ investigatorId: number }`)
- `PATCH /api/incidents/:id/assign-action-owner` - Assign action owner (Body: `{ actionOwnerId: number }`)
- `PATCH /api/incidents/:id/review` - Mark as UNDER_REVIEW
- `PATCH /api/incidents/:id/close` - Close the incident

## Risk Prediction (Manager Workflow)
All three endpoints are department-scoped like the other manager endpoints (an incident in another department returns 404) and return the same `data` shape:

`{ prediction, override, finalLevel }`
- `prediction`: `{ available: true, assessment: { totalScore, riskLevel, computedLevelBeforeFloor, insufficientHistory, breakdown } }`, or `{ available: false, reason, message }` when the ML service is down.
- `override`: the manager's human override `{ level, reason, overriddenBy, overriddenAt, aiLevelAtOverride, aiScoreAtOverride }`, or `null`.
- `finalLevel`: the override level if there is one, otherwise the AI level, otherwise `null`.

Endpoints:
- `GET /api/manager/incidents/:id/risk-assessment` - AI prediction plus any override. Always HTTP 200 (an ML-service outage is reported as `available: false`).
- `PUT /api/manager/incidents/:id/risk-override` - Body `{ "level": "Low|Medium|High|Critical", "reason": "min 10 characters" }`. Works even if the ML service is offline. Rejected with 409 on a CLOSED incident. Writes an audit entry (`RISK_OVERRIDDEN`).
- `DELETE /api/manager/incidents/:id/risk-override` - Removes the override (back to the AI level). 400 if there is none, 409 on a CLOSED incident. Writes an audit entry (`RISK_OVERRIDE_REVERTED`).

Settings: `AI_SERVICE_URL` (default `http://localhost:8001`) and `AI_SERVICE_TIMEOUT_MS` (default `8000`).

## Lessons Learned Library (Manager Workflow)
- `GET /api/manager/lessons/search?q=<text>` - Searches the lessons recorded when incidents were reviewed. `q` must be 2 to 200 characters.
  - Lessons are shared knowledge, so the search covers the whole organisation (it is not limited to the manager's department).
  - Always HTTP 200. Success: `{ success: true, data: { available: true, query, results: [{ lesson, category, department, matchPercent }] } }`. `results` can be empty.
  - If the ML service is down or returns something unexpected: `{ success: true, data: { available: false, reason, message } }`.
  - The id and title of the incident a lesson came from are deliberately not returned.