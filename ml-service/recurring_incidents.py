"""
Recurring Incident Detection (core module)
----------------------------------------------------
Different goal from the Similar Incident model: instead of loosely-related
matches for an investigator, this finds TRUE REPEATS -- the same problem,
at the same place, worded differently by different staff -- and reports
them per department for managers.

Key differences from similar_incident_pipeline.py:
  - Embeds title + description + LOCATION together (location matters here,
    since "same place, same problem" is the signal we want)
  - Uses a much higher similarity threshold (0.85 default) -- we want near-
    duplicates, not just related incidents
  - Groups (clusters) matching incidents together and reports counts/
    percentages per department, rather than answering a single search query

Uses free-text location, not a fixed dropdown -- similarity matching
handles minor wording differences ("ICU Room 3" vs "near ICU") naturally,
which exact-string filtering would miss.

No demo code here -- use test_recurring_incidents.py to try it out.
"""

import pandas as pd
import numpy as np
import os
import pickle
from sklearn.metrics.pairwise import cosine_similarity

from similar_incident_pipeline import model, CSV_PATH, DATA_DIR  # reuse the already-loaded model

RECURRING_THRESHOLD = 0.85  # high bar -- true repeats, not just related incidents
RECURRING_INDEX_PATH = os.path.join(DATA_DIR, "recurring_index.pkl")


# ---------------------------------------------------------------------
# STEP 1: Load data and build combined text INCLUDING location
# ---------------------------------------------------------------------
def load_incidents_for_recurring(csv_path=CSV_PATH, sample_size=None):
    df = pd.read_csv(csv_path)
    df = df[df["status"] == "Closed"].reset_index(drop=True)
    if sample_size is not None:
        df = df.sample(n=min(sample_size, len(df)), random_state=42).reset_index(drop=True)
    df["combined_text"] = (
        df["title"].astype(str) + ". " +
        df["description"].astype(str) + ". Location: " +
        df["location"].astype(str)
    )
    return df


# ---------------------------------------------------------------------
# STEP 2: Build the embedding index for this module (separate from the
# Similar Incident index, since the text being embedded is different)
# ---------------------------------------------------------------------
def build_recurring_index(df, save_path=RECURRING_INDEX_PATH):
    print(f"Encoding {len(df)} incidents (title + description + location)...")
    embeddings = model.encode(
        df["combined_text"].tolist(),
        show_progress_bar=True,
        batch_size=128,
        convert_to_numpy=True,
    )
    index = {
        "incident_ids": df["incident_id"].tolist(),
        "embeddings": embeddings,
        "metadata": df.to_dict(orient="records"),
    }
    with open(save_path, "wb") as f:
        pickle.dump(index, f)
    print(f"Recurring index built and saved to {save_path}")
    return index


def load_recurring_index(path=RECURRING_INDEX_PATH):
    with open(path, "rb") as f:
        return pickle.load(f)


# ---------------------------------------------------------------------
# STEP 3: Greedy clustering -- group near-duplicate incidents together.
# For each incident (in order), check if it matches an existing cluster's
# representative closely enough; if so, join that cluster, otherwise start
# a new one. Simple and fast enough for this dataset size.
# ---------------------------------------------------------------------
def cluster_incidents(embeddings, metadata, threshold=RECURRING_THRESHOLD):
    clusters = []  # each: {"rep_embedding": vec, "rep_meta": dict, "members": [meta, ...]}

    for i in range(len(embeddings)):
        emb = embeddings[i].reshape(1, -1)
        meta = metadata[i]

        if clusters:
            rep_embeddings = np.vstack([c["rep_embedding"] for c in clusters])
            sims = cosine_similarity(emb, rep_embeddings)[0]
            best_idx = int(np.argmax(sims))
            best_score = sims[best_idx]
        else:
            best_score = -1
            best_idx = -1

        if best_score >= threshold:
            clusters[best_idx]["members"].append(meta)
        else:
            clusters.append({
                "rep_embedding": embeddings[i],
                "rep_meta": meta,
                "members": [meta],
            })

    return clusters


# ---------------------------------------------------------------------
# STEP 4: Generate the report for one department -- top recurring issues,
# with counts and percentage of that department's total incident volume.
# ---------------------------------------------------------------------
def generate_recurring_report(department, index, threshold=RECURRING_THRESHOLD, top_n=10):
    # filter down to this department only
    dept_indices = [i for i, meta in enumerate(index["metadata"]) if meta["department"] == department]

    if not dept_indices:
        return {"department": department, "total_incidents": 0, "recurring_issues": []}

    dept_embeddings = index["embeddings"][dept_indices]
    dept_metadata = [index["metadata"][i] for i in dept_indices]

    clusters = cluster_incidents(dept_embeddings, dept_metadata, threshold=threshold)

    total = len(dept_metadata)
    recurring_issues = []
    for c in clusters:
        count = len(c["members"])
        if count < 2:
            continue  # not "recurring" if it only happened once
        recurring_issues.append({
            "representative_title": c["rep_meta"]["title"],
            "representative_description": c["rep_meta"]["description"],
            "example_location": c["rep_meta"]["location"],
            "count": count,
            "percentage_of_department": round(count / total * 100, 1),
            "example_incident_ids": [m["incident_id"] for m in c["members"][:5]],
        })

    recurring_issues.sort(key=lambda x: x["count"], reverse=True)

    return {
        "department": department,
        "total_incidents": total,
        "recurring_issues": recurring_issues[:top_n],
    }
