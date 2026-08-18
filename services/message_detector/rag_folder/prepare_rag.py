# ====================================================
# ScamSense RAG Knowledge Base Preparation
# ====================================================
#
# This script should be run:
#
# 1. When setting up the project for the first time
# 2. Whenever the knowledge base Markdown files change
#
# It:
#
# Markdown Files
#       ↓
# Markdown Chunking
#       ↓
# Sentence Transformer Embeddings
#       ↓
# Save Knowledge Chunks
#       ↓
# Save Knowledge Embeddings
#
# Flask does NOT need to regenerate these embeddings
# every time the server starts.
# ====================================================


import json
import re

import numpy as np

from pathlib import Path

from sentence_transformers import SentenceTransformer


# ====================================================
# PROJECT PATHS
# ====================================================

PROJECT_ROOT = (
    Path(__file__)
    .resolve()
    .parent
    .parent
)

knowledge_base_folder = (
    PROJECT_ROOT / "knowledge_base"
)

rag_data_folder = (
    PROJECT_ROOT / "rag_data"
)


rag_data_folder.mkdir(
    exist_ok=True
)


# ====================================================
# EMBEDDING MODEL
# ====================================================

embedding_model_name = (
    "all-MiniLM-L6-v2"
)

embedding_model = SentenceTransformer(
    embedding_model_name
)


# ====================================================
# FIND KNOWLEDGE FILES
# ====================================================

knowledge_files = sorted(
    knowledge_base_folder.glob("*.md")
)


print("=" * 60)
print("ScamSense RAG Knowledge Base Preparation")
print("=" * 60)

print(
    f"Knowledge documents found: "
    f"{len(knowledge_files)}"
)


for file_path in knowledge_files:

    print(
        f"- {file_path.name}"
    )


# ====================================================
# MARKDOWN CHUNKING
# ====================================================

def chunk_markdown_document(
    file_path
):

    text = file_path.read_text(
        encoding="utf-8"
    )

    # ---------------------------------------------
    # Extract category from filename
    #
    # Example:
    #
    # Job_Scam.md
    #     ↓
    # Job Scam
    #
    # E-Commerce_Scam.md
    #     ↓
    # E-Commerce Scam
    # ---------------------------------------------

    category = (
        file_path.stem
        .replace("_", " ")
    )

    # ---------------------------------------------
    # Split using Markdown headings
    # ---------------------------------------------

    sections = re.split(
        r"\n(?=##?\s+)",
        text
    )

    chunks = []

    for section in sections:

        section = section.strip()

        if not section:
            continue

        # -----------------------------------------
        # Identify heading
        # -----------------------------------------

        heading_match = re.match(
            r"^##?\s+(.+)",
            section
        )

        if heading_match:

            section_name = (
                heading_match
                .group(1)
                .strip()
            )

            content = re.sub(
                r"^##?\s+.+\n?",
                "",
                section
            ).strip()

        else:

            section_name = "General"

            content = section

        # -----------------------------------------
        # Ignore very small chunks
        # -----------------------------------------

        if len(content) < 40:
            continue

        chunks.append({

            "text":
                content,

            "category":
                category,

            "section":
                section_name,

            "source":
                file_path.name

        })

    return chunks


# ====================================================
# BUILD KNOWLEDGE CHUNKS
# ====================================================

knowledge_chunks = []

for file_path in knowledge_files:

    document_chunks = (
        chunk_markdown_document(
            file_path
        )
    )

    knowledge_chunks.extend(
        document_chunks
    )


print()
print(
    f"Total knowledge chunks: "
    f"{len(knowledge_chunks)}"
)


# ====================================================
# GENERATE KNOWLEDGE EMBEDDINGS
# ====================================================

knowledge_texts = [

    chunk["text"]

    for chunk in knowledge_chunks

]


print()
print(
    "Generating knowledge embeddings..."
)


knowledge_embeddings = (
    embedding_model.encode(

        knowledge_texts,

        convert_to_numpy=True,

        normalize_embeddings=True,

        show_progress_bar=True

    )
)


print(
    "Embedding matrix shape:",
    knowledge_embeddings.shape
)


# ====================================================
# SAVE KNOWLEDGE CHUNKS
# ====================================================

chunks_file = (
    rag_data_folder
    / "knowledge_chunks.json"
)


with open(
    chunks_file,
    "w",
    encoding="utf-8"
) as file:

    json.dump(
        knowledge_chunks,
        file,
        ensure_ascii=False,
        indent=2
    )


# ====================================================
# SAVE KNOWLEDGE EMBEDDINGS
# ====================================================

embeddings_file = (
    rag_data_folder
    / "knowledge_embeddings.npy"
)


np.save(
    embeddings_file,
    knowledge_embeddings
)


# ====================================================
# COMPLETED
# ====================================================

print()
print("=" * 60)
print("RAG PREPARATION COMPLETED")
print("=" * 60)

print(
    f"Saved chunks: "
    f"{chunks_file}"
)

print(
    f"Saved embeddings: "
    f"{embeddings_file}"
)

print()
print(
    "You can now start the Flask server."
)

print(
    "Run this script again only when "
    "the knowledge base Markdown files change."
)