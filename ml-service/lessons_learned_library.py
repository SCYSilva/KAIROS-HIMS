"""
Lessons Learned Library (core module)
----------------------------------------------------
A STANDALONE search tool -- different from Similar Incidents in what
gets searched and how it's queried:

  - Similar Incidents: query is a NEW incident's title+description,
    searched against past incidents' title+description (factual "what
    happened" text)
  - Lessons Learned Library: query is ANY free-text search someone
    types (not tied to a specific incident), searched against the
    `lessons_learned` field -- reflective/prescriptive "what we should
    do differently" text, only present on ~35% of closed incidents
    (the ones a reviewer flagged as worth recording)

Same underlying technique (embeddings + cosine similarity) as every
other module here, just pointed at different data with a different
entry point (a search box, not "investigate this incident").

No demo code here -- use test_lessons_learned_library.py to try it out.
"""

import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity
import os
import pickle

from similar_incident_pipeline import model, CSV_PATH, DATA_DIR  # reuse the already-loaded model

LESSONS_INDEX_PATH = os.path.join(DATA_DIR, "lessons_index.pkl")
DEMO_LESSONS_PATH = os.path.join(os.path.dirname(__file__), "seed", "demo_lessons.csv")
LESSONS_THRESHOLD = 0.45  # starting guess -- tune after inspecting real scores
LESSONS_TOP_K = 7


# ---------------------------------------------------------------------
# STEP 1: Load only incidents that actually HAVE a recorded lesson
# ---------------------------------------------------------------------
def load_lessons(csv_path=CSV_PATH, sample_size=None):
    df = pd.read_csv(csv_path)
    include_demo_lessons = os.getenv("ML_INCLUDE_DEMO_LESSONS", "").strip().lower() in {
        "1",
        "true",
        "yes",
    }
    if include_demo_lessons:
        demo_lessons = pd.read_csv(DEMO_LESSONS_PATH)
        df = pd.concat([df, demo_lessons], ignore_index=True)

    # only rows with a real (non-empty, non-NaN) lesson recorded
    df = df[df["lessons_learned"].notna() & (df["lessons_learned"].str.strip() != "")].reset_index(drop=True)
    if sample_size is not None:
        df = df.sample(n=min(sample_size, len(df)), random_state=42).reset_index(drop=True)
    return df


# ---------------------------------------------------------------------
# STEP 2: Build the index -- embeds the LESSON TEXT itself, not the
# incident description (that's the key difference from every other
# module here)
# ---------------------------------------------------------------------
def build_lessons_index(df, save_path=LESSONS_INDEX_PATH):
    print(f"Encoding {len(df)} lessons...")
    embeddings = model.encode(
        df["lessons_learned"].tolist(),
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
    print(f"Lessons index built and saved to {save_path}")
    return index


def load_lessons_index(path=LESSONS_INDEX_PATH):
    with open(path, "rb") as f:
        return pickle.load(f)


# ---------------------------------------------------------------------
# STEP 3: Search -- query is ANY free text someone types into a search
# box, e.g. "elevator failures" or "billing errors" -- not tied to a
# specific incident.
# ---------------------------------------------------------------------
def search_lessons(query_text, index, top_k=LESSONS_TOP_K, threshold=LESSONS_THRESHOLD):
    query_embedding = model.encode([query_text], convert_to_numpy=True)
    scores = cosine_similarity(query_embedding, index["embeddings"])[0]

    scored = list(zip(index["incident_ids"], index["metadata"], scores))
    scored = [item for item in scored if item[2] >= threshold]
    scored.sort(key=lambda x: x[2], reverse=True)

    # Many incidents record the very same lesson. Show each distinct lesson once (its best match),
    # so the top results are different lessons instead of one sentence repeated.
    results = []
    seen_lessons = set()
    for incident_id, meta, score in scored:
        lesson_key = " ".join(str(meta["lessons_learned"]).split()).lower()
        if lesson_key in seen_lessons:
            continue
        seen_lessons.add(lesson_key)
        results.append({
            "incident_id": incident_id,
            "relevance_score": round(float(score), 3),
            "lesson": meta["lessons_learned"],
            "source_incident_title": meta["title"],
            "category": meta["category"],
            "department": meta["department"],
        })
        if len(results) >= top_k:
            break
    return results
