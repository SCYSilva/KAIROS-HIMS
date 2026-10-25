# Architecture Decision Record (ADR)

## 1. Incident Workflow State Machine
*   **Decision:** We implemented a strict State Machine for the incident lifecycle (OPEN -> ACCEPTED -> INVESTIGATING -> PENDING_ACTION -> UNDER_REVIEW -> CLOSED).
*   **Reason:** To ensure data integrity and prevent invalid state transitions. We validate the current state in the Service Layer before performing any action.

## 2. Separate Endpoints for Workflow Actions
*   **Decision:** Instead of a single `PATCH /incidents/:id` endpoint, we created explicit endpoints (e.g., `/accept`, `/reject`).
*   **Reason:** To clearly separate business logic, enforce specific validation rules (e.g., rejection reason is mandatory), and improve API readability.

## 3. AI Risk Prediction Is an Optional External Service
*   **Decision:** The Predictive Risk Score is calculated by a separate Python ML service (`ml-service/`). The backend calls it through `risk-prediction.service.ts`, and an ML-service failure never fails the request: the API returns `available: false` and the UI shows a retry option. In Docker the service sits behind the `ml` profile, so a plain `docker-compose up` is unchanged.
*   **Reason:** The ML service needs a different runtime (Python and PyTorch), is large, and may be offline. Managers must still be able to assign an investigator when it is. The browser never calls the ML service directly, so department access control stays in the backend.

## 4. Managers Can Override the AI Risk Level (Human in the Loop)
*   **Decision:** A manager can replace the AI risk level with their own (Low, Medium, High or Critical) and must give a reason of at least 10 characters. The override is stored on the incident, together with who set it, when, and what the AI predicted at that moment. Every change is written to `IncidentAuditLog` (`RISK_OVERRIDDEN`, `RISK_OVERRIDE_REVERTED`). The override wins over the AI everywhere, and it works even when the ML service is offline.
*   **Reason:** The score is a decision aid, not a decision. The manager is accountable for the final rating, so the system keeps a clear record of the AI view, the human decision and the reason. The AI score itself is not stored; only the human decision and a snapshot are.

## 5. Lessons Learned Search Is Organisation-Wide, but Hides the Source Incident
*   **Decision:** The "Lessons" menu searches lessons across all departments, and each result shows only the lesson text, its category and department, and a match percentage. The id and title of the source incident are removed in the backend (`lessons-library.service.ts`). The ML service returns each distinct lesson once.
*   **Reason:** A lesson is written to be shared (Stage 4 "Lessons Dissemination"), but the incident behind it belongs to one department and may be sensitive. Many incidents record the same lesson, so repeating it would hide the other useful results.