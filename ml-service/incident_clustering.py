"""
Incident Clustering Map (core module) -- ADMIN ONLY
----------------------------------------------------
Different goal from Recurring Incidents: instead of finding the SAME
problem repeating at the SAME place within one department (strict,
department-scoped), this finds broad THEMES across the ENTIRE hospital's
incidents, regardless of department, category, or location -- patterns
that get hidden by how incidents happen to get filed.

Reuses the SAME embeddings as the Similar Incident model (title +
description only, no location) -- on purpose. Clustering by content only
(not location) is what lets this catch a theme spanning multiple
departments, e.g. "slip/fall incidents" showing up in ICU, cafeteria, and
Lab A all filed under different categories.

Reuses the same greedy clustering function as recurring_incidents.py,
just with a much LOWER threshold -- we want broad shared themes here,
not near-duplicates.

Output is a plain-language table (theme name + count + percentage),
NOT a scatter plot or technical visualization -- the intended audience
(admin, not a data scientist) needs to read this like a report.

No demo code here -- use test_incident_clustering.py to try it out.
"""

from recurring_incidents import cluster_incidents  # reuse the same grouping logic

# Starting guess -- much lower than Recurring Incidents' 0.85, since we
# want broad topical themes, not near-duplicate repeats. Tune after
# reviewing real results, same as every other threshold in this project.
THEME_THRESHOLD = 0.50

MIN_THEME_SIZE = 3  # a "theme" should be more than 1-2 coincidental matches


# ---------------------------------------------------------------------
# Generate the whole-hospital theme report.
# `index` here is the SIMILAR INCIDENT index (title+description only,
# NOT the recurring_incidents index) -- passed in by the caller.
# ---------------------------------------------------------------------
def generate_cluster_report(index, threshold=THEME_THRESHOLD, min_size=MIN_THEME_SIZE, top_n=25):
    embeddings = index["embeddings"]
    metadata = index["metadata"]
    total = len(metadata)

    clusters = cluster_incidents(embeddings, metadata, threshold=threshold)

    themes = []
    for c in clusters:
        count = len(c["members"])
        if count < min_size:
            continue  # too small to call a "theme" -- likely coincidental

        # gather a few example titles from the cluster, not just the
        # representative, so the admin sees the theme isn't a fluke
        example_titles = list(dict.fromkeys(m["title"] for m in c["members"]))[:3]
        departments_involved = sorted(set(m["department"] for m in c["members"]))

        themes.append({
            "theme_name": c["rep_meta"]["title"],  # plain-language name, no cluster ID/jargon shown
            "example_description": c["rep_meta"]["description"],
            "count": count,
            "percentage_of_total": round(count / total * 100, 1),
            "departments_involved": departments_involved,
            "example_titles": example_titles,
            "example_incident_ids": [m["incident_id"] for m in c["members"][:5]],
        })

    themes.sort(key=lambda x: x["count"], reverse=True)

    return {
        "total_incidents": total,
        "themes_found": len(themes),
        "themes": themes[:top_n],
    }
