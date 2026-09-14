"""Restore the last deployed, validated public snapshot after an API refresh fails.

The download is staged and validated in memory before any tracked public file is
replaced. If the live snapshot is unavailable or incomplete, this script fails so
GitHub Pages keeps serving the existing deployment.
"""
import argparse
import gzip
import json
import pathlib
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public" / "data"
DEFAULT_BASE = "https://khhjyc.github.io/smart-petrol-gyeonggi/data/"


def expected_files():
    return sorted(path.relative_to(PUBLIC) for path in PUBLIC.rglob("*.json"))


def download(base_url, relative):
    path = "/".join(urllib.parse.quote(part) for part in relative.parts) + ".gz"
    request = urllib.request.Request(
        urllib.parse.urljoin(base_url.rstrip("/") + "/", path),
        headers={"Accept": "application/gzip", "User-Agent": "SmartPetrolFallback/1.0"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        payload = response.read()
    return gzip.decompress(payload)


def validate(payloads, baseline):
    decoded = {}
    for relative, payload in payloads.items():
        decoded[relative.as_posix()] = json.loads(payload)
    manifest = decoded["manifest.json"]
    inspection = decoded["inspection.json"]
    if manifest.get("checkedAt") != inspection.get("checkedAt"):
        raise RuntimeError("published snapshot timestamps do not match")
    for kind in ("cctv", "lights"):
        mapped = manifest["sources"][kind]["mapped"]
        previous = baseline["sources"][kind]["mapped"]
        if mapped < previous * 0.9:
            raise RuntimeError(f"published {kind} coordinate count is below the repository baseline")
    region_names = {path for path in decoded if path.startswith("regions/")}
    if len(region_names) < 32:
        raise RuntimeError("published regional snapshot is incomplete")
    return manifest


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default=DEFAULT_BASE)
    parser.add_argument("--check-only", action="store_true")
    args = parser.parse_args()
    files = expected_files()
    baseline = json.loads((PUBLIC / "manifest.json").read_text(encoding="utf-8"))
    payloads = {relative: download(args.base_url, relative) for relative in files}
    manifest = validate(payloads, baseline)
    if not args.check_only:
        for relative, payload in payloads.items():
            target = PUBLIC / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(payload)
    print(
        ("Verified" if args.check_only else "Restored")
        + " last deployed validated snapshot: "
        f"{manifest['checkedAt']} ({len(files)} files).",
        flush=True,
    )


if __name__ == "__main__":
    main()
