"""
Similar Incident Detection Pipeline (core module)
----------------------------------------------------
This file contains the reusable pipeline functions only.
No demo code here -- use test_similarity_model.py to build the index
and run test searches.

Step-by-step pipeline:
  1. Load closed incidents from CSV (exported from DB)
  2. Combine title + description into one text field
  3. Encode all incidents into embeddings using a pretrained sentence-transformer
  4. Save the embeddings + incident IDs as an "index" (so we don't re-encode
     every incident every single time a new report comes in)
  5. When a NEW incident report comes in: encode it, compare against the
     saved index using cosine similarity, return top matches above a
     similarity threshold

Install (one time):
    pip install sentence-transformers pandas scikit-learn numpy
"""

import pandas as pd
import numpy as np
from datetime import datetime
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import os
import pickle

# ---------------------------------------------------------------------
# CONFIG
# ---------------------------------------------------------------------
# Paths can be changed with environment variables (the Docker container sets them)
DATA_DIR = os.environ.get("ML_DATA_DIR", ".")        # folder for the saved index files (a Docker volume in production)
os.makedirs(DATA_DIR, exist_ok=True)
CSV_PATH = os.environ.get("ML_CSV_PATH", "healthcare_incidents_synthetic.csv")   # replace with real DB export later
MODEL_NAME = "all-MiniLM-L6-v2"                    # small, fast, good general-purpose model
INDEX_PATH = os.path.join(DATA_DIR, "incident_index.pkl")   # where we save the built embeddings
TOP_K = 7
SIMILARITY_THRESHOLD = 0.55                        # starting guess -- tune after inspecting real scores

# Recency weights for the Recurrence factor: (max_age_days_inclusive, weight)
# A match's weight decays the older it is -- 6 incidents clustered in the
# last month is a much stronger signal than 6 spread across a year.
RECENCY_WEIGHTS = [
    (30, 1.0),
    (90, 0.7),
    (180, 0.4),
    (365, 0.2),
    (float("inf"), 0.1),
]


def _recency_weight(incident_date, reference_date):
    age_days = (reference_date - incident_date).total_seconds() / 86400
    for max_age, weight in RECENCY_WEIGHTS:
        if age_days <= max_age:
            return weight
    return RECENCY_WEIGHTS[-1][1]


# ---------------------------------------------------------------------
# STEP 1: Load model (pretrained -- NOT trained on our data, see earlier
# discussion. It already understands general English.)
# ---------------------------------------------------------------------
print("Loading model...")
import torch
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Using device: {DEVICE}")
model = SentenceTransformer(MODEL_NAME, device=DEVICE)


# ---------------------------------------------------------------------
# STEP 2: Load incidents and prepare text
# ---------------------------------------------------------------------
def load_incidents(csv_path=CSV_PATH, sample_size=None):
    df = pd.read_csv(csv_path)
    # only closed incidents get embedded, per our earlier decision
    df = df[df["status"] == "Closed"].reset_index(drop=True)
    if sample_size is not None:
        df = df.sample(n=min(sample_size, len(df)), random_state=42).reset_index(drop=True)
    # combine title + description into one field for embedding
    df["combined_text"] = df["title"].astype(str) + ". " + df["description"].astype(str)
    return df


# ---------------------------------------------------------------------
# STEP 3 + 4: Build the index (encode everything, save to disk)
# This is the "batch" step -- run it once to build the index, then again
# periodically (e.g. nightly, or whenever incidents get closed) to refresh it.
# ---------------------------------------------------------------------
def build_index(df, save_path=INDEX_PATH):
    print(f"Encoding {len(df)} incidents...")
    embeddings = model.encode(
        df["combined_text"].tolist(),
        show_progress_bar=True,
        batch_size=128,
        convert_to_numpy=True,
    )

    index = {
        "incident_ids": df["incident_id"].tolist(),
        "embeddings": embeddings,          # shape: (num_incidents, embedding_dim)
        "metadata": df.to_dict(orient="records"),  # full row data for display later
    }

    with open(save_path, "wb") as f:
        pickle.dump(index, f)

    print(f"Index built and saved to {save_path}")
    return index


def load_index(path=INDEX_PATH):
    with open(path, "rb") as f:
        return pickle.load(f)


# ---------------------------------------------------------------------
# Internal helper: search ALL stored incidents above threshold, uncapped.
# Used both by find_similar_incidents() (display, top_k) and by the
# Risk Scoring module (needs full counts/stats, not just top 7).
# ---------------------------------------------------------------------
def _search_all(new_title, new_description, index, threshold=SIMILARITY_THRESHOLD):
    new_text = f"{new_title}. {new_description}"
    new_embedding = model.encode([new_text], convert_to_numpy=True)

    scores = cosine_similarity(new_embedding, index["embeddings"])[0]
    scored = list(zip(index["incident_ids"], index["metadata"], scores))
    scored = [item for item in scored if item[2] >= threshold]
    scored.sort(key=lambda x: x[2], reverse=True)
    return scored  # list of (incident_id, metadata_dict, score) -- ALL matches, not capped


# ---------------------------------------------------------------------
# STEP 5: Search -- given a NEW incident's title + description, find
# similar past (closed) incidents (for DISPLAY -- capped at top_k)
# ---------------------------------------------------------------------
def find_similar_incidents(new_title, new_description, index,
                            top_k=TOP_K, threshold=SIMILARITY_THRESHOLD):
    scored = _search_all(new_title, new_description, index, threshold=threshold)
    top_matches = scored[:top_k]

    results = []
    for incident_id, meta, score in top_matches:
        results.append({
            "incident_id": incident_id,
            "similarity_score": round(float(score), 3),
            "title": meta["title"],
            "description": meta["description"],
            "category": meta["category"],
            "severity": meta["severity"],
            "department": meta["department"],
        })
    return results


# ---------------------------------------------------------------------
# STEP 6: Incremental update -- add ONE newly-closed incident to the
# existing index without re-encoding everything from scratch
# ---------------------------------------------------------------------
def add_incident_to_index(new_row_dict, index, save_path=INDEX_PATH):
    """new_row_dict must contain at least: incident_id, title, description,
    plus whatever metadata fields you want available for display."""
    text = f"{new_row_dict['title']}. {new_row_dict['description']}"
    new_embedding = model.encode([text], convert_to_numpy=True)

    index["incident_ids"].append(new_row_dict["incident_id"])
    index["embeddings"] = np.vstack([index["embeddings"], new_embedding])
    index["metadata"].append(new_row_dict)

    with open(save_path, "wb") as f:
        pickle.dump(index, f)

    return index


# ---------------------------------------------------------------------
# STEP 7: Match statistics -- used by the Risk Scoring module.
# Unlike find_similar_incidents() (capped at top_k, for display), this
# returns the FULL picture needed to score risk: total match count,
# how many were in the SAME department (recurrence signal), and the
# average resolution time across matches (duration signal).
# ---------------------------------------------------------------------
def get_match_statistics(new_title, new_description, new_department, index,
                          threshold=SIMILARITY_THRESHOLD, reference_date=None):
    """reference_date: the 'now' to measure recency against -- defaults to
    today, but can be passed explicitly (e.g. the new incident's reported
    date) for consistent testing against historical/synthetic data."""
    if reference_date is None:
        reference_date = datetime.now()
    else:
        reference_date = pd.to_datetime(reference_date)

    scored = _search_all(new_title, new_description, index, threshold=threshold)

    total_match_count = len(scored)
    same_dept_matches = [item for item in scored if item[1].get("department") == new_department]
    same_dept_count = len(same_dept_matches)

    # recency-weighted recurrence score: same-department matches, weighted
    # by how recently each one occurred (recent = weighted more heavily)
    weighted_recurrence = 0.0
    for _, meta, _ in same_dept_matches:
        try:
            incident_date = pd.to_datetime(meta["date_time_of_incident"])
            weighted_recurrence += _recency_weight(incident_date, reference_date)
        except (KeyError, ValueError, TypeError):
            continue  # skip records missing/malformed date fields

    # average resolution duration across ALL matches (in days)
    durations = []
    for _, meta, _ in scored:
        try:
            reported = pd.to_datetime(meta["date_time_reported"])
            closed = pd.to_datetime(meta["closure_date"])
            durations.append((closed - reported).total_seconds() / 86400)  # -> days
        except (KeyError, ValueError, TypeError):
            continue  # skip records missing/malformed date fields

    avg_resolution_days = float(np.mean(durations)) if durations else 0.0

    return {
        "total_match_count": total_match_count,
        "same_department_count": same_dept_count,
        "weighted_recurrence_score": round(weighted_recurrence, 2),
        "avg_resolution_days": round(avg_resolution_days, 2),
    }
