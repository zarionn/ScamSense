"""Compatibility façade for the Screenshot GenAI pipeline."""

from typing import Dict

from . import pipeline

__all__ = ["analyse", "respond"]


def analyse(classification: Dict, img_path: str) -> Dict:
    return pipeline.analyse(classification, img_path)


def respond(analysis_context: Dict, answers: Dict[str, str]) -> Dict:
    return pipeline.respond(analysis_context, answers)
