#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"

python3 - "$ROOT" <<'PY'
from pathlib import Path
import sys

root = Path(sys.argv[1]).resolve()

skip_dirs = {
    ".git",
    "node_modules",
    "out",
    "dist",
    ".next",
    ".turbo",
}

forbidden = [
    "\u4e2d\u6587",
    "\u7b80\u4f53\u4e2d\u6587",
    "\u6de1\u5165",
    "\u7f51\u683c",
    "\u80f6\u7247",
    "\u6548\u679c",
    "\u84dd\u8272\u8c03",
    "\u9897\u7c92\u611f",
]

hits = []

for path in root.rglob("*"):
    try:
        rel = path.relative_to(root)
    except ValueError:
        continue

    if set(rel.parts) & skip_dirs:
        continue
    if not path.is_file() or path.is_symlink():
        continue

    try:
        text = path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        continue

    for token in forbidden:
        if token in text:
            hits.append(str(rel))
            break

if hits:
    print("Forbidden text found:")
    for hit in hits:
        print(f"- {hit}")
    sys.exit(1)

print("No forbidden text found in authored project files.")
PY
