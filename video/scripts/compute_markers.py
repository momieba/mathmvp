"""
Berechnet exakte Timestamps für Marker-Phrasen aus ElevenLabs-Alignment-JSONs.

Usage:
    python scripts/compute_markers.py --stem Klammer_mal_Klammer --dir output/temp/

Liest:
  {dir}/{stem}_marker_phrases.json
  {dir}/{stem}_{key}_alignment.json   (pro Segment)

Schreibt:
  {dir}/{stem}_markers.json           ({key: {marker_name: sekunden}})
"""
import argparse
import json
import re
import pathlib


def _clean(s: str) -> str:
    """Entfernt SSML-Tags, macht lowercase, kollabiert Leerzeichen."""
    s = re.sub(r"<[^>]+>", " ", s)
    s = s.lower()
    s = re.sub(r"\s+", " ", s)
    return s.strip()


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--stem", required=True)
    p.add_argument("--dir", required=True)
    a = p.parse_args()
    d = pathlib.Path(a.dir)

    phrases_path = d / f"{a.stem}_marker_phrases.json"
    if not phrases_path.exists():
        print(f"FEHLER: {phrases_path} nicht gefunden")
        raise SystemExit(1)

    phrases: dict[str, dict[str, str]] = json.loads(
        phrases_path.read_text(encoding="utf-8")
    )

    markers: dict[str, dict[str, float]] = {}
    missing: list[str] = []

    for key, mp in phrases.items():
        al_path = d / f"{a.stem}_{key}_alignment.json"
        if not al_path.exists():
            print(f"FEHLER: Alignment-Datei fehlt: {al_path}")
            missing.extend(f"{key}/{name}" for name in mp)
            continue

        al = json.loads(al_path.read_text(encoding="utf-8"))
        chars  = al["characters"]
        starts = al["character_start_times_seconds"]

        # Volltext aus Alignment-Zeichen (ElevenLabs gibt den Original-Text ohne SSML zurück)
        full_text = "".join(chars).lower()

        markers[key] = {}
        for name, phrase in mp.items():
            phrase_clean = _clean(phrase)
            pos = full_text.find(phrase_clean)
            if pos < 0:
                # Fallback: Leerzeichen kollabieren im Suchtext
                full_compact = re.sub(r"\s+", " ", full_text)
                pos = full_compact.find(phrase_clean)

            if pos < 0:
                missing.append(f"{key}/{name}: '{phrase}'")
                continue

            # pos ist direkt der Zeichen-Index in chars
            pos = min(pos, len(starts) - 1)
            t = round(starts[pos], 3)
            markers[key][name] = t
            print(f"  [{key}/{name}] '{phrase}' → {t:.3f}s")

    out_path = d / f"{a.stem}_markers.json"
    out_path.write_text(json.dumps(markers, indent=2, ensure_ascii=False), encoding="utf-8")

    if missing:
        print()
        for m in missing:
            print(f"MARKER NOT FOUND: {m}")
        print(f"\n{len(missing)} Marker fehlen!")
        raise SystemExit(1)
    else:
        print(f"\nOK — {sum(len(v) for v in markers.values())} Marker in {out_path}")


if __name__ == "__main__":
    main()
