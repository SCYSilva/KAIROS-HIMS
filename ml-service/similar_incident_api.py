"""
Incident Intelligence API Service
------------------------------------
Wraps ALL FIVE ML modules in a single web API so the main Incident
Management System (Phase 1 backend) can call them over HTTP:
  - Similar Incident Detection  (POST /similar-incidents)
  - Predictive Risk Scoring     (POST /risk-score)
  - Recurring Incidents Report  (GET  /recurring-incidents/{department})
  - Incident Clustering Map     (GET  /incident-clusters)  -- ADMIN ONLY,
      access control enforced by the main backend, not here
  - Lessons Learned Library     (GET  /lessons-search?q=...)

This is the "AI/analytics service" referenced in the project briefing --
a separate service, not part of the main app's codebase.

Install:
    pip install fastapi uvicorn sentence-transformers pandas scikit-learn numpy

Run:
    uvicorn similar_incident_api:app --host 0.0.0.0 --port 8000

Once running, the main backend calls it like:
    POST http://<this-service-host>:8000/similar-incidents
    { "title": "...", "description": "..." }

    POST http://<this-service-host>:8000/risk-score
    { "title": "...", "description": "...", "severity": "...", "department": "..." }

    GET  http://<this-service-host>:8000/recurring-incidents/Operations

    GET  http://<this-service-host>:8000/incident-clusters

    GET  http://<this-service-host>:8000/lessons-search?q=elevator%20failures
"""

from fastapi import FastAPI
from pydantic import BaseModel
import os

from similar_incident_pipeline import (
    load_incidents,
    build_index,
    load_index,
    find_similar_incidents,
    add_incident_to_index,
    INDEX_PATH,
)
from risk_scoring import calculate_risk_score
from recurring_incidents import (
    load_incidents_for_recurring,
    build_recurring_index,
    load_recurring_index,
    generate_recurring_report,
    RECURRING_INDEX_PATH,
)
from incident_clustering import generate_cluster_report
from lessons_learned_library import (
    load_lessons,
    build_lessons_index,
    load_lessons_index,
    search_lessons,
    LESSONS_INDEX_PATH,
)

app = FastAPI(title="Incident Intelligence Service (Similar Incidents + Risk Scoring)")

# Load (or build) the index ONCE when the service starts up,
# not on every single request -- that would be far too slow.
if os.path.exists(INDEX_PATH):
    print("Loading existing index...")
    index = load_index(INDEX_PATH)
else:
    print("Building index for the first time...")
    df = load_incidents()
    index = build_index(df)

# Load (or build) the RECURRING index separately -- different text
# representation (includes location), different threshold, different
# purpose. Then precompute each department's report ONCE at startup and
# cache it in memory, since clustering a whole department's incidents on
# every single request would be slow and wasteful.
if os.path.exists(RECURRING_INDEX_PATH):
    print("Loading existing recurring index...")
    recurring_index = load_recurring_index(RECURRING_INDEX_PATH)
else:
    print("Building recurring index for the first time...")
    recurring_df = load_incidents_for_recurring()
    recurring_index = build_recurring_index(recurring_df)

DEPARTMENTS = ["Finance", "Human Resources", "Operations", "Clinical Services", "Information Technology"]
recurring_reports_cache = {
    dept: generate_recurring_report(dept, recurring_index) for dept in DEPARTMENTS
}

# Incident Clustering Map (ADMIN ONLY, whole-hospital) -- reuses the
# SAME index as Similar Incidents (title+description, no location), no
# separate index needed. Precomputed once at startup, same caching
# pattern as the recurring reports above.
cluster_report_cache = generate_cluster_report(index)

# Load (or build) the LESSONS index -- separate from everything else,
# since it embeds the lessons_learned TEXT itself, not incident
# descriptions. Search happens per-request (like Similar Incidents),
# since queries are arbitrary free text, not something to precompute.
lessons_df = load_lessons()
if os.path.exists(LESSONS_INDEX_PATH):
    existing_lessons_index = load_lessons_index(LESSONS_INDEX_PATH)
    if existing_lessons_index["incident_ids"] == lessons_df["incident_id"].tolist():
        print("Loading existing lessons index...")
        lessons_index = existing_lessons_index
    else:
        print("Lesson source changed; rebuilding lessons index...")
        lessons_index = build_lessons_index(lessons_df)
else:
    print("Building lessons index for the first time...")
    lessons_index = build_lessons_index(lessons_df)


# ---------------------------------------------------------------------
# Request / response schemas
# ---------------------------------------------------------------------
class IncidentQuery(BaseModel):
    title: str
    description: str


class RiskQuery(BaseModel):
    title: str
    description: str
    severity: str        # Critical / High / Medium / Low, from the incident form
    department: str      # from the incident form


class ClosedIncident(BaseModel):
    incident_id: str
    title: str
    description: str
    category: str
    sub_category: str
    severity: str
    department: str
    location: str
    date_time_of_incident: str    # required for Recurrence recency weighting
    date_time_reported: str       # required for Duration calculation
    closure_date: str             # required for Duration calculation
    status: str = "Closed"


# ---------------------------------------------------------------------
# Endpoint 1: search for similar incidents
# Called by the main backend when an investigator opens an incident.
# ---------------------------------------------------------------------
@app.post("/similar-incidents")
def similar_incidents(query: IncidentQuery):
    matches = find_similar_incidents(query.title, query.description, index)
    return {"matches": matches}


# ---------------------------------------------------------------------
# Endpoint: Predictive Risk Score
# Called by the main backend right when a new incident is submitted, so
# the score can be shown immediately alongside the incident (e.g. flagged
# in the register for managers/reviewers).
# ---------------------------------------------------------------------
@app.post("/risk-score")
def risk_score(query: RiskQuery):
    result = calculate_risk_score(query.title, query.description, query.severity, query.department, index)
    return result


# ---------------------------------------------------------------------
# Endpoint 2: add a newly-closed incident to the index
# Called by the main backend right after an incident's status changes
# to "Closed", so the search index stays up to date without needing a
# full rebuild.
# ---------------------------------------------------------------------
@app.post("/index/add-incident")
def add_incident(incident: ClosedIncident):
    global index
    index = add_incident_to_index(incident.dict(), index)
    return {"status": "added", "incident_id": incident.incident_id, "total_indexed": len(index["incident_ids"])}


# ---------------------------------------------------------------------
# Endpoint 3: full rebuild (e.g. run nightly, or manually if the index
# ever gets out of sync with the DB)
# ---------------------------------------------------------------------
@app.post("/index/rebuild")
def rebuild_index():
    global index
    df = load_incidents()
    index = build_index(df)
    return {"status": "rebuilt", "total_indexed": len(index["incident_ids"])}


# ---------------------------------------------------------------------
# Endpoint 4: Recurring Incidents report for a department
# Called by the department manager dashboard. Serves a PRECOMPUTED,
# cached report -- not recalculated per request.
# ---------------------------------------------------------------------
@app.get("/recurring-incidents/{department}")
def recurring_incidents(department: str):
    if department not in recurring_reports_cache:
        return {"error": f"Unknown department '{department}'. Valid options: {DEPARTMENTS}"}
    return recurring_reports_cache[department]


# ---------------------------------------------------------------------
# Endpoint 5: Rebuild the recurring incidents index + reports.
# Run this periodically (e.g. nightly job) or manually, so the "recurring"
# report stays current as new incidents get closed.
# ---------------------------------------------------------------------
@app.post("/recurring-incidents/rebuild")
def rebuild_recurring():
    global recurring_index, recurring_reports_cache
    recurring_df = load_incidents_for_recurring()
    recurring_index = build_recurring_index(recurring_df)
    recurring_reports_cache = {
        dept: generate_recurring_report(dept, recurring_index) for dept in DEPARTMENTS
    }
    return {"status": "rebuilt", "departments": DEPARTMENTS}


# ---------------------------------------------------------------------
# Endpoint 6: Incident Clustering Map -- ADMIN ONLY, whole-hospital.
# Serves a PRECOMPUTED, cached report. Access control (making sure only
# admin accounts can call this) is enforced by the main backend, NOT
# here -- this service has no concept of user roles/permissions.
# ---------------------------------------------------------------------
@app.get("/incident-clusters")
def incident_clusters():
    return cluster_report_cache


# ---------------------------------------------------------------------
# Endpoint 7: Rebuild the clustering report.
# Cheap to call -- reuses the already-loaded similar-incident index,
# just re-runs the clustering step on it. Run periodically (e.g. weekly,
# since this is a strategic/trend view, not something needing minute-to-
# minute freshness) or manually.
# ---------------------------------------------------------------------
@app.post("/incident-clusters/rebuild")
def rebuild_clusters():
    global cluster_report_cache
    cluster_report_cache = generate_cluster_report(index)
    return {"status": "rebuilt", "themes_found": cluster_report_cache["themes_found"]}


# ---------------------------------------------------------------------
# Endpoint 8: Lessons Learned Library search.
# Called from a search box -- query is arbitrary free text, NOT tied to
# any specific incident. Computed per-request (like /similar-incidents),
# since we can't precompute results for every possible search phrase.
# ---------------------------------------------------------------------
@app.get("/lessons-search")
def lessons_search(q: str):
    results = search_lessons(q, lessons_index)
    return {"query": q, "results": results}


# ---------------------------------------------------------------------
# Endpoint 9: Rebuild the lessons index (e.g. after new incidents with
# recorded lessons get closed and reviewed).
# ---------------------------------------------------------------------
@app.post("/lessons-search/rebuild")
def rebuild_lessons():
    global lessons_index
    lessons_df = load_lessons()
    lessons_index = build_lessons_index(lessons_df)
    return {"status": "rebuilt", "total_lessons": len(lessons_index["incident_ids"])}


# ---------------------------------------------------------------------
# Health check -- useful for the main system to confirm this service is up
# ---------------------------------------------------------------------
@app.get("/health")
def health():
    return {"status": "ok", "incidents_indexed": len(index["incident_ids"]),
             "recurring_incidents_indexed": len(recurring_index["incident_ids"]),
             "lessons_indexed": len(lessons_index["incident_ids"])}
