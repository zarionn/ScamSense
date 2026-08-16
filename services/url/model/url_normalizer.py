"""URL normalization used by the phishing-dataset v2 pipeline.

The function deliberately makes only the changes requested for version 2:
outer whitespace is stripped, one leading scheme and one leading ``www.`` are
removed, and only the domain part is lowercased.  Path, query, and fragment
text keep their original letter casing.
"""

import re


# A scheme begins with a letter and may then contain letters, digits, +, -, or .
# Examples matched here include http://, https://, ftp://, and custom+app://.
SCHEME_PATTERN = re.compile(r"^[A-Za-z][A-Za-z0-9+.-]*://")


def normalize_url(url):
    """Return the normalized form of one URL string.

    Definitions, in order:
    1. ``strip`` removes whitespace only from the two ends of the string.
    2. One scheme at the start (anything matching ``scheme://``) is removed.
    3. One leading ``www.`` is removed, without regard to its letter casing.
    4. The authority is everything before the first ``/``, ``?``, or ``#``.
       Only its hostname is lowercased; user information and a port are kept.
       The remaining path/query/fragment is appended unchanged, so its casing
       is preserved.

    The input must be a string.  Missing values are handled by the rebuild
    script instead of being silently converted to the literal text ``"nan"``.
    """

    if not isinstance(url, str):
        raise TypeError("url must be a string")

    cleaned = url.strip()
    cleaned = SCHEME_PATTERN.sub("", cleaned, count=1)

    if cleaned[:4].lower() == "www.":
        cleaned = cleaned[4:]

    # Find where the path, query, or fragment begins.  A plain loop is used so
    # the rule is easy to explain without advanced Python syntax.
    domain_end = len(cleaned)
    for separator in "/?#":
        position = cleaned.find(separator)
        if position != -1 and position < domain_end:
            domain_end = position

    domain_part = cleaned[:domain_end]
    remainder = cleaned[domain_end:]

    # Lowercase only the host.  If the authority contains user information or
    # a port, their casing/text is preserved.  Brackets around IPv6 hosts are
    # also preserved.
    user_information = ""
    host_and_port = domain_part
    if "@" in domain_part:
        user_information, host_and_port = domain_part.rsplit("@", 1)
        user_information += "@"

    if host_and_port.startswith("[") and "]" in host_and_port:
        closing_bracket = host_and_port.find("]")
        host = host_and_port[1:closing_bracket].lower()
        host_and_port = "[" + host + "]" + host_and_port[closing_bracket + 1 :]
    elif host_and_port.count(":") == 1:
        host, port = host_and_port.split(":", 1)
        host_and_port = host.lower() + ":" + port
    else:
        host_and_port = host_and_port.lower()

    return user_information + host_and_port + remainder


if __name__ == "__main__":
    # Small examples make the intended casing rule easy to check by eye.
    examples = [
        "  HTTPS://WWW.Example.COM/Account/Login?User=Alice  ",
        "custom+app://WWW.Example.COM?Next=/KeepCase",
    ]
    for example in examples:
        print(normalize_url(example))
