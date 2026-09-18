#!/usr/bin/env python3
"""Apply scripts/translation_overrides.json onto static/vocabulary.json without a full rebuild."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).parent))

from build_vocabulary_v2 import (  # noqa: E402
    OVERRIDES_FILE,
    OUTPUT_FILE,
    apply_translation_overrides,
    load_translation_overrides,
)


def main() -> None:
    vocab_path = OUTPUT_FILE
    if not vocab_path.exists():
        raise SystemExit(f"Missing {vocab_path}")

    overrides = load_translation_overrides(OVERRIDES_FILE)
    if not overrides:
        print(f"No overrides in {OVERRIDES_FILE}")
        return

    with open(vocab_path, encoding="utf-8") as f:
        leveled = json.load(f)

    updated = apply_translation_overrides(leveled, overrides)
    with open(vocab_path, "w", encoding="utf-8") as f:
        json.dump(leveled, f, ensure_ascii=False, indent=1)
        f.write("\n")

    print(f"Updated {updated} entr(y/ies) in {vocab_path}")
    print("Next: bun run search-index-build")


if __name__ == "__main__":
    main()
