# ====================================================
# STEP 42G: REUSABLE EMBEDDING-BASED RAG FUNCTION
# ====================================================
# ScamSense embedding-based Retrieval-Augmented
# Generation (RAG) knowledge retrieval.
#
# Runtime Pipeline:
#
# Saved Knowledge Chunks
#           ↓
# Saved Knowledge Embedding Matrix
#
# User Message
#           ↓
# Query Embedding
#           ↓
# Cosine Similarity
#           ↓
# Category-Aware Ranking
#           ↓
# Top-K Knowledge Chunks
# ====================================================


# ====================================================
# IMPORT RAG LIBRARIES
# ====================================================

import json

import numpy as np

from pathlib import Path

from sentence_transformers import SentenceTransformer

from sklearn.metrics.pairwise import cosine_similarity


# ====================================================
# PROJECT PATH
# ====================================================

PROJECT_ROOT = (
    Path(__file__)
    .resolve()
    .parent
    .parent
)


# ====================================================
# RAG DATA PATH
# ====================================================

rag_data_folder = (
    PROJECT_ROOT / "rag_data"
)


knowledge_chunks_file = (
    rag_data_folder
    / "knowledge_chunks.json"
)


knowledge_embeddings_file = (
    rag_data_folder
    / "knowledge_embeddings.npy"
)


# ====================================================
# CHECK PRECOMPUTED RAG DATA
# ====================================================

if not knowledge_chunks_file.exists():

    raise FileNotFoundError(

        "RAG knowledge chunks were not found.\n"
        "Please run:\n\n"
        "python prepare_rag.py\n\n"
        "from the scamsense-server directory."

    )


if not knowledge_embeddings_file.exists():

    raise FileNotFoundError(

        "RAG knowledge embeddings were not found.\n"
        "Please run:\n\n"
        "python prepare_rag.py\n\n"
        "from the scamsense-server directory."

    )


# ====================================================
# LOAD EMBEDDING MODEL
# ====================================================

embedding_model_name = (
    "all-MiniLM-L6-v2"
)

embedding_model = SentenceTransformer(
    embedding_model_name
)


# ====================================================
# LOAD SAVED KNOWLEDGE CHUNKS
# ====================================================

with open(
    knowledge_chunks_file,
    "r",
    encoding="utf-8"
) as file:

    knowledge_chunks = (
        json.load(file)
    )


# ====================================================
# LOAD SAVED KNOWLEDGE EMBEDDINGS
# ====================================================

knowledge_embeddings = np.load(
    knowledge_embeddings_file
)


# ====================================================
# RUNTIME INFORMATION
# ====================================================

print(
    "✓ RAG knowledge base loaded."
)

print(
    f"✓ Knowledge chunks: "
    f"{len(knowledge_chunks)}"
)

print(
    f"✓ Embedding matrix shape: "
    f"{knowledge_embeddings.shape}"
)

print(
    f"✓ Embedding model: "
    f"{embedding_model_name}"
)


# ====================================================
# STEP 42G: EMBEDDING-BASED KNOWLEDGE RETRIEVAL
# ====================================================

def retrieve_knowledge(
    message,
    final_prediction,
    top_k=5,
    category_boost=0.08
):

    # ---------------------------------------------
    # Convert user message into embedding
    # ---------------------------------------------

    query_embedding = (
        embedding_model.encode(

            [message],

            convert_to_numpy=True,

            normalize_embeddings=True

        )
    )


    # ---------------------------------------------
    # Calculate cosine similarity
    # ---------------------------------------------

    similarities = cosine_similarity(

        query_embedding,

        knowledge_embeddings

    )[0]


    results = []


    # ---------------------------------------------
    # Score every knowledge chunk
    # ---------------------------------------------

    for index, similarity in enumerate(
        similarities
    ):

        chunk = (
            knowledge_chunks[index]
        )

        semantic_score = float(
            similarity
        )


        # -----------------------------------------
        # Category-aware ranking
        # -----------------------------------------

        if (
            chunk["category"].lower()
            ==
            final_prediction.lower()
        ):

            final_score = (
                semantic_score
                + category_boost
            )

        else:

            final_score = (
                semantic_score
            )


        results.append({

            "text":
                chunk["text"],

            "category":
                chunk["category"],

            "section":
                chunk["section"],

            "source":
                chunk["source"],

            "semantic_score":
                semantic_score,

            "final_score":
                final_score

        })


    # ---------------------------------------------
    # Sort by retrieval score
    # ---------------------------------------------

    results.sort(

        key=lambda x:
        x["final_score"],

        reverse=True

    )


    # ---------------------------------------------
    # Return Top-K chunks
    # ---------------------------------------------

    return results[:top_k]


# ====================================================
# FORMAT RETRIEVED KNOWLEDGE
# ====================================================

def format_retrieved_knowledge(
    retrieved_chunks
):

    formatted_chunks = []


    for i, chunk in enumerate(
        retrieved_chunks,
        start=1
    ):

        formatted_chunk = f"""
KNOWLEDGE RESULT {i}

Category:
{chunk["category"]}

Section:
{chunk["section"]}

Source:
{chunk["source"]}

Semantic Similarity:
{chunk["semantic_score"]:.4f}

Retrieval Score:
{chunk["final_score"]:.4f}

Relevant Information:
{chunk["text"]}
""".strip()


        formatted_chunks.append(
            formatted_chunk
        )


    return "\n\n".join(
        formatted_chunks
    )