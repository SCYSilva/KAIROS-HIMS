"""
Predictive Risk Scoring (core module)
----------------------------------------------------
Rule-based weighted scorecard -- NOT a trained model. Scores a new
incident once, at intake, using:
  - Severity (max 40 points): directly from the incident form
  - Recurrence (max 40 points): RECENCY-WEIGHTED count of similar past
    incidents in the SAME department -- recent matches count more than
    old ones (e.g. 6 incidents this month scores much higher than 6
    spread across the past year), using the Similar Incident model's
    match statistics
  - Duration (max 20 points): average historical resolution time of
    those similar past incidents

Total score (0-100) maps to a risk level: Critical / High / Medium / Low.

No demo code here -- use test_risk_scoring.py to try it out.
"""

from similar_incident_pipeline import get_match_statistics

# ---------------------------------------------------------------------
# CONFIG -- scoring tables (see predictive_risk_scoring_design.md)
# ---------------------------------------------------------------------
SEVERITY_POINTS = {
    "Critical": 40,
    "High": 28,
    "Medium": 16,
    "Low": 4,
}

# Used when there is NO prior history at all (zero similar past incidents
# found, any department) -- Recurrence and Duration get excluded entirely
# rather than defaulting to misleading "0 = safest" values, and the score
# is based on Severity alone, rescaled from its 40-point max up to 100.
SEVERITY_ONLY_SCALE = 100 / 40

# Recurrence tiers: (max_weighted_score_inclusive, points) -- based on the
# RECENCY-WEIGHTED same-department match score (see get_match_statistics),
# not a raw count. Recent incidents count more heavily than old ones, so
# e.g. 6 incidents this month scores much higher than 6 spread over a year.
RECURRENCE_TIERS = [
    (2.0, 4),         # low weighted score  -> 4 points
    (5.0, 12),        # moderate            -> 12 points
    (float("inf"), 28),  # high (recent cluster) -> 28 points
]

# Duration tiers: (max_days_inclusive, points) -- based on average
# resolution time (in days) of similar past incidents
DURATION_TIERS = [
    (1, 2),
    (2, 4),
    (3, 6),
    (7, 8),
    (14, 12),
    (21, 16),
    (float("inf"), 20),
]

RISK_LEVEL_BANDS = [
    (85, "Critical"),
    (70, "High"),
    (50, "Medium"),
    (0, "Low"),
]

# Ordering used to compare risk levels (higher index = more severe)
RISK_LEVEL_ORDER = ["Low", "Medium", "High", "Critical"]

# Severity acts as a FLOOR on the final risk level: Recurrence and Duration
# can only escalate risk upward from here, never dilute it below what the
# reporter already flagged. E.g. a "High" severity incident with no prior
# history should never show as "Low" overall risk just because it hasn't
# happened before -- rarity isn't the same as safety. The floor equals the
# incident's own reported severity level.
SEVERITY_FLOOR = {
    "Critical": "Critical",
    "High": "High",
    "Medium": "Medium",
    "Low": "Low",
}


# ---------------------------------------------------------------------
# Individual factor scoring functions
# ---------------------------------------------------------------------
def score_severity(severity):
    return SEVERITY_POINTS.get(severity, 0)  # unrecognized severity -> 0, doesn't crash


def score_recurrence(weighted_recurrence_score):
    for max_score, points in RECURRENCE_TIERS:
        if weighted_recurrence_score <= max_score:
            return points
    return RECURRENCE_TIERS[-1][1]  # fallback, shouldn't normally hit this


def score_duration(avg_resolution_days):
    for max_days, points in DURATION_TIERS:
        if avg_resolution_days <= max_days:
            return points
    return DURATION_TIERS[-1][1]


def risk_level_from_score(total_score):
    for threshold, level in RISK_LEVEL_BANDS:
        if total_score >= threshold:
            return level
    return "Low"  # fallback


def apply_severity_floor(computed_level, severity):
    """Returns whichever is more severe: the level computed from the total
    score, or the floor set by the incident's own reported severity."""
    floor_level = SEVERITY_FLOOR.get(severity, "Low")
    computed_rank = RISK_LEVEL_ORDER.index(computed_level)
    floor_rank = RISK_LEVEL_ORDER.index(floor_level)
    return RISK_LEVEL_ORDER[max(computed_rank, floor_rank)]


# ---------------------------------------------------------------------
# Main entry point: calculate full risk score for a new incident
# ---------------------------------------------------------------------
def calculate_risk_score(title, description, severity, department, index):
    stats = get_match_statistics(title, description, department, index)
    severity_pts = score_severity(severity)

    if stats["total_match_count"] == 0:
        # No similar past incidents at all -- Recurrence and Duration have
        # no real data to draw on. Don't default them to 0 (which would
        # falsely read as "safest possible"); exclude them and score on
        # Severity alone, rescaled to the full 100.
        total = round(severity_pts * SEVERITY_ONLY_SCALE)
        computed_level = risk_level_from_score(total)
        final_level = apply_severity_floor(computed_level, severity)

        return {
            "total_score": total,
            "risk_level": final_level,
            "computed_level_before_floor": computed_level,
            "insufficient_history": True,  # flag for the UI: recurrence/duration were skipped
            "breakdown": {
                "severity": {"value": severity, "points": severity_pts, "max": 40},
                "recurrence": {"note": "No similar past incidents found -- excluded from score"},
                "duration": {"note": "No similar past incidents found -- excluded from score"},
            },
        }

    recurrence_pts = score_recurrence(stats["weighted_recurrence_score"])
    duration_pts = score_duration(stats["avg_resolution_days"])

    total = severity_pts + recurrence_pts + duration_pts
    computed_level = risk_level_from_score(total)
    final_level = apply_severity_floor(computed_level, severity)

    return {
        "total_score": total,
        "risk_level": final_level,
        "computed_level_before_floor": computed_level,  # for transparency/debugging
        "insufficient_history": False,
        "breakdown": {
            "severity": {"value": severity, "points": severity_pts, "max": 40},
            "recurrence": {
                "weighted_score": stats["weighted_recurrence_score"],
                "same_department_matches_raw_count": stats["same_department_count"],
                "total_matches_all_departments": stats["total_match_count"],
                "points": recurrence_pts,
                "max": 40,
            },
            "duration": {
                "avg_resolution_days": stats["avg_resolution_days"],
                "points": duration_pts,
                "max": 20,
            },
        },
    }
