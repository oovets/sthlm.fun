#!/usr/bin/env python3
"""Snapshot SL's stop registry into data/sl-sites.json for the site to load locally.

The keyless SL Transport API intermittently answers 429 (shared quota), so the
1.3 MB registry is fetched here with retries instead of in every visitor's browser.
"""
import json
import os
import sys
import tempfile
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

URL = "https://transport.integration.sl.se/v1/sites"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "sl-sites.json")


def fetch(attempts=6):
    delay = 5
    for i in range(attempts):
        try:
            req = urllib.request.Request(URL, headers={"User-Agent": "sthlm.fun registry sync"})
            with urllib.request.urlopen(req, timeout=60) as res:
                return json.load(res)
        except urllib.error.HTTPError as err:
            if err.code != 429 or i == attempts - 1:
                raise
        time.sleep(delay)
        delay *= 2
    raise RuntimeError("unreachable")


def main():
    raw = fetch()
    sites = [
        {
            "id": s["id"],
            "name": s["name"],
            "note": s.get("note"),
            "abbr": s.get("abbreviation"),
            "lat": round(s["lat"], 6),
            "lon": round(s["lon"], 6),
        }
        for s in raw
        if isinstance(s.get("lat"), (int, float)) and isinstance(s.get("lon"), (int, float))
    ]
    if len(sites) < 1000:
        sys.exit(f"refusing to write suspiciously small registry ({len(sites)} sites)")

    payload = {
        "source": URL,
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "sites": sites,
    }
    out = os.path.normpath(OUT)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(out), suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
    os.chmod(tmp, 0o664)
    os.replace(tmp, out)
    print(f"wrote {len(sites)} sites to {out}")


if __name__ == "__main__":
    main()
