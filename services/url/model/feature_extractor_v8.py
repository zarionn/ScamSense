"""Append URL text plus four narrow URL-context features."""

from __future__ import annotations

import csv
from difflib import SequenceMatcher
import math
from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from feature_extractor import (  # noqa: E402
    FEATURE_NAMES as ORIGINAL_FEATURE_NAMES,
    _hostname_and_path,
    extract_features as extract_original_features,
)


URL_TEXT_FEATURE = "url_text"
FREE_HOST_FEATURE = "modern_free_host_subdomain"
BRAND_MISMATCH_FEATURE = "brand_mismatch_score"
CLOUD_HOST_FEATURE = "cloud_infrastructure_host"
TRANCO_FEATURE = "tranco_popularity_score"
MODERN_FREE_HOSTS = (
    "vercel.app",
    "pages.dev",
    "github.io",
    "weebly.com",
    "webflow.io",
    "netlify.app",
    "firebaseapp.com",
    "web.app",
)
SHARED_TENANT_HOSTS = (
    *MODERN_FREE_HOSTS,
    "blogspot.com",
    "workers.dev",
    "githubusercontent.com",
    "wixsite.com",
    "sites.google.com",
    "mystrikingly.com",
    "godaddysites.com",
    "duckdns.org",
    "replit.app",
    "b-cdn.net",
    "backblazeb2.com",
)
CLOUD_HOSTS = (
    "amazonaws.com",
    "awscfdns.com",
    "cloudfront.net",
    "edgeone.dev",
    "azurewebsites.net",
    "blob.core.windows.net",
    "storage.googleapis.com",
    "appspot.com",
)
BRAND_OFFICIAL_DOMAINS = {
    "adobe": ("adobe.com",),
    "amazon": ("amazon.com",),
    "apple": ("apple.com",),
    "binance": ("binance.com",),
    "carousell": ("carousell.com", "carousell.sg"),
    "coinbase": ("coinbase.com",),
    "docusign": ("docusign.com",),
    "dropbox": ("dropbox.com",),
    "facebook": ("facebook.com",),
    "google": ("google.com",),
    "instagram": ("instagram.com",),
    "microsoft": ("microsoft.com",),
    "netflix": ("netflix.com",),
    "paypal": ("paypal.com",),
    "roblox": ("roblox.com",),
    "spotify": ("spotify.com",),
    "telegram": ("telegram.org",),
    "tiktok": ("tiktok.com",),
    "whatsapp": ("whatsapp.com",),
}
FEATURE_NAMES = [
    *ORIGINAL_FEATURE_NAMES,
    URL_TEXT_FEATURE,
    FREE_HOST_FEATURE,
    BRAND_MISMATCH_FEATURE,
    CLOUD_HOST_FEATURE,
    TRANCO_FEATURE,
]
TOKEN_PATTERN = re.compile(r"[a-z0-9]+")


def _load_tranco_ranks() -> dict[str, int]:
    # Resolve the Tranco list from THIS file's own folder (backend/model), not
    # from a repo-root guess. That keeps the extractor self-contained so it
    # works no matter where the Flask process is started from or deployed.
    requested = ROOT / "tranco_top1m.csv"
    source = requested if requested.exists() else ROOT / "top-1m.csv"
    if not source.exists():
        # Fail loudly at import instead of silently scoring every URL 0.0,
        # which would quietly weaken the model without any obvious symptom.
        raise FileNotFoundError(
            f"Tranco popularity file not found. Expected 'top-1m.csv' (or "
            f"'tranco_top1m.csv') next to the extractor in: {ROOT}"
        )
    ranks: dict[str, int] = {}
    with source.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.reader(handle):
            if len(row) < 2:
                continue
            try:
                rank = int(row[0])
            except ValueError:
                continue
            domain = row[1].strip().lower().rstrip(".")
            if domain and domain not in ranks:
                ranks[domain] = rank
    return ranks


# Loaded ONCE at import (~1M entries). The print gives a clear startup signal
# that the popularity list actually loaded, and how big it is.
TRANCO_RANKS = _load_tranco_ranks()
print(f"[feature_extractor_v8] Tranco ranks loaded: {len(TRANCO_RANKS):,}")


def host_matches(hostname: str, suffixes: tuple[str, ...]) -> bool:
    return any(
        hostname == suffix or hostname.endswith("." + suffix)
        for suffix in suffixes
    )


def modern_free_host_subdomain(url: str) -> int:
    hostname = _hostname_and_path(url)[0]
    return int(
        any(hostname.endswith("." + suffix) for suffix in MODERN_FREE_HOSTS)
    )


def cloud_infrastructure_host(url: str) -> int:
    return int(host_matches(_hostname_and_path(url)[0], CLOUD_HOSTS))


def brand_mismatch_score(url: str) -> float:
    hostname = _hostname_and_path(url)[0]
    tokens = TOKEN_PATTERN.findall(hostname)
    best = 0.0
    for brand, official_domains in BRAND_OFFICIAL_DOMAINS.items():
        if host_matches(hostname, official_domains):
            continue
        for token in tokens:
            if brand in token:
                score = 1.0
            elif len(token) >= 4:
                score = SequenceMatcher(None, token, brand).ratio()
            else:
                score = 0.0
            best = max(best, score)
    return best if best >= 0.75 else 0.0


def tranco_popularity_score(url: str) -> float:
    """Return a log-scaled score for the best ranked hostname suffix."""

    hostname = _hostname_and_path(url)[0]
    # A platform's popularity belongs to the provider, not to arbitrary tenant
    # subdomains that users can create.
    if any(
        hostname.endswith("." + suffix) for suffix in SHARED_TENANT_HOSTS
    ):
        return 0.0
    labels = [label for label in hostname.split(".") if label]
    ranks = [
        TRANCO_RANKS[suffix]
        for index in range(max(0, len(labels) - 5), len(labels))
        if (suffix := ".".join(labels[index:])) in TRANCO_RANKS
    ]
    if not ranks:
        return 0.0
    return max(0.0, 1.0 - math.log10(min(ranks)) / 6.0)


def extract_features(url: str) -> dict[str, int | float | str]:
    """Call the locked extractor, then append the modeled context."""

    features = dict(extract_original_features(url))
    features[URL_TEXT_FEATURE] = url
    features[FREE_HOST_FEATURE] = modern_free_host_subdomain(url)
    features[BRAND_MISMATCH_FEATURE] = brand_mismatch_score(url)
    features[CLOUD_HOST_FEATURE] = cloud_infrastructure_host(url)
    features[TRANCO_FEATURE] = tranco_popularity_score(url)
    assert list(features) == FEATURE_NAMES
    return features
