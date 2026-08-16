"""Feature extraction for normalized phishing-dataset v2 URLs.

``extract_features`` returns exactly the 19 requested numeric features.  Every
count is taken from the normalized URL passed to the function; the function
does not normalize a second time.
"""

import ipaddress


FEATURE_NAMES = [
    "url_length",
    "domain_length",
    "num_subdomains",
    "tld_length",
    "is_domain_ip",
    "num_digits",
    "digit_ratio",
    "num_letters",
    "letter_ratio",
    "num_special_chars",
    "special_char_ratio",
    "num_qmark",
    "num_equals",
    "num_ampersand",
    "num_dots",
    "num_hyphens",
    "has_at_symbol",
    "path_depth",
    "contains_sg_brand",
]


SG_BRANDS = (
    "singpass",
    "cpf",
    "dbs",
    "posb",
    "ocbc",
    "uob",
    "iras",
    "gov.sg",
    "singtel",
)


def _hostname_and_path(url):
    """Return the hostname and path from a normalized, scheme-free URL.

    The authority is the text before the first ``/``, ``?``, or ``#``.  User
    information, a port, and IPv6 brackets are excluded from the hostname.  A
    path is present only when that first separator is ``/``; slashes appearing
    later inside a query or fragment are not mistaken for path separators.
    """

    authority_end = len(url)
    for separator in "/?#":
        position = url.find(separator)
        if position != -1 and position < authority_end:
            authority_end = position

    authority = url[:authority_end]
    host_and_port = authority.rsplit("@", 1)[-1]

    if host_and_port.startswith("["):
        closing_bracket = host_and_port.find("]")
        if closing_bracket == -1:
            hostname = host_and_port[1:]
        else:
            hostname = host_and_port[1:closing_bracket]
    elif host_and_port.count(":") == 1:
        hostname = host_and_port.split(":", 1)[0]
    else:
        hostname = host_and_port

    path = ""
    if authority_end < len(url) and url[authority_end] == "/":
        path_end = len(url)
        for separator in "?#":
            position = url.find(separator, authority_end)
            if position != -1 and position < path_end:
                path_end = position
        path = url[authority_end:path_end]

    return hostname.lower().rstrip("."), path


def extract_features(url):
    """Extract exactly 19 features from one normalized URL.

    Feature definitions:

    * ``url_length``: number of characters in the full normalized URL.
    * ``domain_length``: characters in the parsed hostname, excluding a port,
      user information, IPv6 brackets, and a final root dot.
    * ``num_subdomains``: ``max(hostname dot-separated labels - 2, 0)``.
      Empty labels are not counted.
    * ``tld_length``: characters in the hostname's last dot-separated label;
      zero when the hostname is empty.
    * ``is_domain_ip``: 1 when the hostname is a valid IPv4 or IPv6 address,
      otherwise 0.
    * ``num_digits`` / ``num_letters``: Unicode digit/letter characters in the
      full URL, using Python's ``str.isdigit`` and ``str.isalpha``.
    * ``num_special_chars``: full-URL characters that are neither letters nor
      digits.  Dots, slashes, punctuation, percent signs, and hyphens count.
    * Each ``*_ratio`` is its corresponding count divided by ``url_length``;
      an empty URL has ratio 0.0.
    * ``num_qmark``, ``num_equals``, ``num_ampersand``, ``num_dots``, and
      ``num_hyphens``: literal full-URL character counts.
    * ``has_at_symbol``: 1 when ``@`` occurs anywhere in the URL, else 0.
    * ``path_depth``: number of non-empty slash-separated parsed path parts.
      Therefore an empty path or ``/`` has depth 0 and ``/a/b/`` has depth 2.
    * ``contains_sg_brand``: 1 when any requested Singapore brand substring
      occurs anywhere in the URL, case-insensitively, else 0.
    """

    if not isinstance(url, str):
        raise TypeError("url must be a string")

    url_length = len(url)
    hostname, path = _hostname_and_path(url)

    labels = [label for label in hostname.split(".") if label]
    num_subdomains = max(len(labels) - 2, 0)
    tld_length = len(labels[-1]) if labels else 0

    try:
        ipaddress.ip_address(hostname)
        is_domain_ip = 1
    except ValueError:
        is_domain_ip = 0

    num_digits = sum(character.isdigit() for character in url)
    num_letters = sum(character.isalpha() for character in url)
    num_special_chars = sum(not character.isalnum() for character in url)

    denominator = url_length if url_length else 1
    lower_url = url.lower()

    features = {
        "url_length": url_length,
        "domain_length": len(hostname),
        "num_subdomains": num_subdomains,
        "tld_length": tld_length,
        "is_domain_ip": is_domain_ip,
        "num_digits": num_digits,
        "digit_ratio": num_digits / denominator,
        "num_letters": num_letters,
        "letter_ratio": num_letters / denominator,
        "num_special_chars": num_special_chars,
        "special_char_ratio": num_special_chars / denominator,
        "num_qmark": url.count("?"),
        "num_equals": url.count("="),
        "num_ampersand": url.count("&"),
        "num_dots": url.count("."),
        "num_hyphens": url.count("-"),
        "has_at_symbol": int("@" in url),
        "path_depth": sum(bool(part) for part in path.split("/")),
        "contains_sg_brand": int(any(brand in lower_url for brand in SG_BRANDS)),
    }

    # This assertion guards the promised feature list and order during edits.
    assert list(features) == FEATURE_NAMES
    return features
