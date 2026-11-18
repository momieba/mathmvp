"""
Tempo-Check für Erklärvideos: gesprochene Wörter pro Sekunde je Segment.

Liest {stem}_narration.json + {stem}_segment_durations.json und markiert
Segmente, die schneller als --max Wörter/Sekunde sind.

Usage:
    python scripts/check_tempo.py --stem Erste_binomische_Formel --dir output/temp/
"""
import argparse
import json
import pathlib
import re
import sys


def count_words(text: str) -> int:
    # Nur Tokens mit Buchstaben/Ziffern zählen ("—" und "..." sind keine Wörter)
    return sum(1 for tok in text.split() if re.search(r"\w", tok))


def main() -> None:
    p = argparse.ArgumentParser(description="Wörter pro Sekunde je Segment prüfen")
    p.add_argument("--stem", required=True)
    p.add_argument("--dir", required=True)
    p.add_argument("--max", type=float, default=1.8, help="Obergrenze Wörter/Sekunde (Standard 1.8)")
    p.add_argument("--min-dur", type=float, default=6.0,
                   help="Segmente kürzer als diese Dauer (s) nicht bewerten — ein einzelner Satz "
                        "hat keine Pausen und wirkt rechnerisch immer schnell (Standard 6.0)")
    a = p.parse_args()

    d = pathlib.Path(a.dir)
    narration = json.loads((d / f"{a.stem}_narration.json").read_text(encoding="utf-8"))
    durations = json.loads((d / f"{a.stem}_segment_durations.json").read_text(encoding="utf-8"))

    too_fast = []
    for key, text in narration.items():
        dur = durations.get(key)
        if not dur:
            print(f"  {key:18s} — keine Dauer gefunden")
            continue
        words = count_words(text)
        wps = words / dur
        if dur < a.min_dur:
            flag = ""
            note = "  (kurz, nicht bewertet)"
        else:
            flag = "  ZU SCHNELL" if wps > a.max else ""
            note = flag
        print(f"  {key:18s} {words:4d} Wörter / {dur:6.1f}s = {wps:.2f} W/s{note}")
        if flag:
            too_fast.append(key)

    print()
    if too_fast:
        print(f"{len(too_fast)} Segment(e) über {a.max} W/s: {', '.join(too_fast)}")
        print("→ Sätze teilen, '...' zwischen Rechenschritte setzen, TTS für diese Segmente neu erzeugen.")
    else:
        print(f"OK — alle Segmente ≤ {a.max} W/s")
    sys.exit(0)


if __name__ == "__main__":
    main()
