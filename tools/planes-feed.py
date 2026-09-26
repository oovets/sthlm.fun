#!/usr/bin/env python3
"""Poll adsb.lol for aircraft around Stockholm and write data/planes.json.

The ADS-B APIs send no CORS headers, so browsers cannot call them directly.
Cron starts this once a minute; each run polls every POLL_S seconds for RUN_S
seconds. A lock file keeps runs from overlapping.
"""
import fcntl
import json
import os
import sys
import tempfile
import time
import urllib.request

URL = "https://api.adsb.lol/v2/point/59.33/18.07/60"  # radius in nautical miles
POLL_S = 10
RUN_S = 55
BASE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(BASE, "..", "data", "planes.json"))
LOCK = "/tmp/sthlm-fun-planes.lock"
FIELDS = ("hex", "flight", "r", "t", "lat", "lon", "alt_baro", "alt_geom", "gs", "track", "baro_rate", "geom_rate", "seen_pos", "category", "squawk")


def fetch():
    req = urllib.request.Request(URL, headers={"User-Agent": "sthlm.fun planes feed (https://sthlm.fun)"})
    with urllib.request.urlopen(req, timeout=8) as res:
        return json.load(res)


def write(payload):
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(OUT), suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
    os.chmod(tmp, 0o664)
    os.replace(tmp, OUT)


def poll_once():
    data = fetch()
    aircraft = []
    for a in data.get("ac", []):
        if not isinstance(a.get("lat"), (int, float)) or not isinstance(a.get("lon"), (int, float)):
            continue
        if a.get("seen_pos", 0) > 60:
            continue
        item = {k: a[k] for k in FIELDS if k in a}
        if "flight" in item:
            item["flight"] = item["flight"].strip()
        aircraft.append(item)
    write({"source": "adsb.lol", "now": data.get("now", time.time() * 1000) / 1000, "generatedAt": time.time(), "aircraft": aircraft})


def main():
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    lock = open(LOCK, "w")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        return
    start = time.monotonic()
    while time.monotonic() - start < RUN_S:
        tick = time.monotonic()
        try:
            poll_once()
        except Exception as err:  # keep polling; one bad response must not end the minute
            print(f"{time.strftime('%Y-%m-%dT%H:%M:%S')} poll failed: {err}", file=sys.stderr)
        time.sleep(max(0.0, POLL_S - (time.monotonic() - tick)))


if __name__ == "__main__":
    main()
