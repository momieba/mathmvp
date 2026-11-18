#!/usr/bin/env python3
"""
batch_short_creator.py — Erstellt Mathe-Kurzvideos (9:16 Hochformat) aus dem Lehrplan-YAML.

Für jedes Unterthema der angegebenen Klasse(n) und Thema(en) wird der Skill
create-math-short über die Claude Code CLI aufgerufen.

Ausgabe-Ordnerstruktur:
  shorts/<Curriculum_name>/Klasse_<n>/<Thema>/<Unterthema>/
    <Unterthema>.mp4
    <Unterthema>.srt
    skript.txt

Beispiele:
  python scripts/batch_short_creator.py --klasse 5 --thema "Natürliche Zahlen"
  python scripts/batch_short_creator.py --klasse 5,6 --thema "Bruchrechnung,Geometrie"
  python scripts/batch_short_creator.py --klasse 5  # alle Themen der Klasse 5
  python scripts/batch_short_creator.py --klasse 5 --dry-run
"""

import argparse
import re
import shutil
import subprocess
import sys
import pathlib


def _find_claude() -> str:
    """Sucht das claude-Binary im PATH und üblichen Installationsorten."""
    import shutil as _shutil, os, glob as _glob
    found = _shutil.which("claude") or _shutil.which("claude.cmd")
    if found:
        return found
    for base in [os.environ.get("APPDATA", ""), os.environ.get("LOCALAPPDATA", "")]:
        for candidate in [
            pathlib.Path(base) / "npm" / "claude.cmd",
            pathlib.Path(base) / "npm" / "claude",
        ]:
            if candidate.exists():
                return str(candidate)
    local = os.environ.get("LOCALAPPDATA", "")
    patterns = [
        str(pathlib.Path(local) / "Packages" / "Claude_*" / "LocalCache" / "Roaming" / "Claude" / "claude-code" / "*" / "claude.exe"),
        str(pathlib.Path(local) / "AnthropicClaude" / "claude-code" / "*" / "claude.exe"),
        str(pathlib.Path(local) / "Programs" / "claude" / "claude.exe"),
    ]
    for pattern in patterns:
        matches = sorted(_glob.glob(pattern))
        if matches:
            return matches[-1]
    return "claude"


try:
    import yaml
except ImportError:
    print("[FEHLER] PyYAML nicht installiert. Bitte: conda run -n mathtutor pip install pyyaml")
    sys.exit(1)

BASE_DIR = pathlib.Path(__file__).parent.parent
DEFAULT_YAML = BASE_DIR / "curriculum" / "curriculum_data.yaml"


def safe_name(text: str) -> str:
    t = (text
         .replace("ä", "ae").replace("ö", "oe").replace("ü", "ue")
         .replace("Ä", "Ae").replace("Ö", "Oe").replace("Ü", "Ue")
         .replace("ß", "ss"))
    t = re.sub(r"[^\w]", "_", t)
    return re.sub(r"_+", "_", t).strip("_")


def load_yaml(path: pathlib.Path) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def parse_args():
    p = argparse.ArgumentParser(
        description="Batch-Erstellung von Mathe-Kurzvideos (9:16) aus dem Lehrplan-YAML",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    p.add_argument("--yaml", default=str(DEFAULT_YAML),
                   help=f"Pfad zur Lehrplan-YAML (Standard: {DEFAULT_YAML.name})")
    p.add_argument("--klasse", required=True,
                   help="Klasse(n), kommasepariert — z.B. '5' oder '5,6,7'")
    p.add_argument("--thema", default=None,
                   help="Thema(en), kommasepariert — fehlt: alle Themen der Klasse")
    p.add_argument("--skip-fertig", action="store_true", default=True,
                   help="Unterthemen mit status='fertig-short' überspringen (Standard: an)")
    p.add_argument("--no-skip-fertig", action="store_false", dest="skip_fertig",
                   help="Auch fertige Shorts neu rendern")
    p.add_argument("--dry-run", action="store_true",
                   help="Nur anzeigen, was gemacht würde — keinen Skill ausführen")
    return p.parse_args()


def collect_entries(data: dict, klassen: list, themen_filter: list | None) -> list:
    entries = []
    for curriculum_key, curriculum in data.items():
        if not isinstance(curriculum, dict) or "klassen" not in curriculum:
            continue
        for klasse_entry in curriculum.get("klassen", []):
            if klasse_entry.get("klasse") not in klassen:
                continue
            for thema_entry in klasse_entry.get("themen", []):
                thema_name = thema_entry.get("name", "")
                if themen_filter is not None and thema_name not in themen_filter:
                    continue
                for ut in thema_entry.get("unterthemen", []):
                    entries.append({
                        "curriculum":   curriculum_key,
                        "klasse":       klasse_entry.get("klasse"),
                        "thema":        thema_name,
                        "displayname":  ut.get("displayname", ""),
                        "beschreibung": ut.get("beschreibung", ""),
                        "status":       ut.get("status", ""),
                    })
    return entries


def validate_inputs(data: dict, klassen: list, themen_filter: list | None) -> bool:
    all_klassen, all_themen = set(), set()
    for curriculum in data.values():
        if not isinstance(curriculum, dict):
            continue
        for ke in curriculum.get("klassen", []):
            all_klassen.add(ke.get("klasse"))
            for te in ke.get("themen", []):
                all_themen.add(te.get("name", ""))
    ok = True
    for k in klassen:
        if k not in all_klassen:
            print(f"[FEHLER] Klasse {k} nicht im Lehrplan. Verfügbar: {sorted(all_klassen, key=str)}")
            ok = False
    if themen_filter:
        for t in themen_filter:
            if t not in all_themen:
                print(f"[FEHLER] Thema '{t}' nicht im Lehrplan gefunden.")
                suggestions = [x for x in all_themen if t.lower() in x.lower()]
                if suggestions:
                    print(f"         Meintest du: {suggestions[:3]}")
                ok = False
    return ok


def output_exists(entry: dict) -> bool:
    """Gibt True zurück wenn im Zielordner bereits eine .mp4 liegt."""
    safe_dn = safe_name(entry["displayname"])
    dst = (BASE_DIR
           / "shorts"
           / entry["curriculum"]
           / f"Klasse_{entry['klasse']}"
           / safe_name(entry["thema"])
           / safe_dn)
    return any(dst.glob("*.mp4"))


def run_skill(displayname: str, beschreibung: str) -> bool:
    claude = _find_claude()
    prompt = f"/create-math-short {displayname} beschreibung: {beschreibung}"
    print(f"  {claude} -p \"{prompt}\"")
    result = subprocess.run(
        [claude, "-p", prompt],
        cwd=str(BASE_DIR),
        shell=(sys.platform == "win32"),
    )
    return result.returncode == 0


def move_output(entry: dict) -> pathlib.Path | None:
    safe_dn = safe_name(entry["displayname"])
    src = BASE_DIR / "output" / safe_dn

    # Shorts landen in einem eigenen Unterordner damit sie nicht mit den langen Videos kollidieren
    dst = (BASE_DIR
           / "shorts"
           / entry["curriculum"]
           / f"Klasse_{entry['klasse']}"
           / safe_name(entry["thema"])
           / safe_dn)

    if not src.exists():
        candidates = list((BASE_DIR / "output").glob(f"*{safe_dn[:10]}*"))
        if candidates:
            src = candidates[0]
            print(f"  [INFO] Ausgabe-Ordner gefunden: {src.name}")
        else:
            print(f"  [WARN] Ausgabe-Ordner nicht gefunden: {src}")
            return None

    dst.mkdir(parents=True, exist_ok=True)
    moved = []
    for f in src.iterdir():
        if f.is_file():
            shutil.copy2(f, dst / f.name)
            moved.append(f.name)

    if moved:
        print(f"  → {dst.relative_to(BASE_DIR)}  ({', '.join(moved)})")
    else:
        print(f"  [WARN] Keine Dateien in {src}")
    return dst


def main():
    args = parse_args()

    try:
        klassen = [int(k.strip()) for k in args.klasse.split(",") if k.strip()]
    except ValueError:
        print("[FEHLER] --klasse muss Zahlen enthalten, z.B. '5' oder '5,6'")
        sys.exit(1)

    themen_filter = (
        [t.strip() for t in args.thema.split(",") if t.strip()]
        if args.thema else None
    )

    yaml_path = pathlib.Path(args.yaml)
    if not yaml_path.exists():
        print(f"[FEHLER] YAML nicht gefunden: {yaml_path}")
        sys.exit(1)

    data = load_yaml(yaml_path)

    if not validate_inputs(data, klassen, themen_filter):
        sys.exit(1)

    entries = collect_entries(data, klassen, themen_filter)
    if not entries:
        print("[FEHLER] Keine passenden Unterthemen gefunden.")
        sys.exit(1)

    total = len(entries)
    skip_count = sum(1 for e in entries if args.skip_fertig and output_exists(e))
    run_count = total - skip_count

    print(f"\n{'─'*60}")
    print(f"  Lehrplan:  {yaml_path.name}")
    print(f"  Klassen:   {klassen}")
    print(f"  Themen:    {themen_filter or 'alle'}")
    print(f"  Format:    9:16 Hochformat (Shorts)")
    print(f"  Gesamt:    {total} Unterthemen  ({skip_count} übersprungen, {run_count} zu erstellen)")
    if args.dry_run:
        print("  Modus:     DRY RUN — kein Skill wird ausgeführt")
    print(f"{'─'*60}\n")

    if args.dry_run:
        for i, e in enumerate(entries, 1):
            skip = " [SKIP — Short vorhanden]" if args.skip_fertig and output_exists(e) else ""
            print(f"  [{i:>2}/{total}] {e['thema']} → {e['displayname']}{skip}")
        return

    succeeded, failed, skipped = [], [], []

    for i, entry in enumerate(entries, 1):
        dn = entry["displayname"]
        print(f"\n[{i:>2}/{total}] {entry['thema']} → {dn}")

        if args.skip_fertig and output_exists(entry):
            print("  [SKIP] Short bereits vorhanden — übersprungen")
            skipped.append(dn)
            continue

        ok = run_skill(dn, entry["beschreibung"])

        if ok:
            dst = move_output(entry)
            if dst:
                succeeded.append(dn)
            else:
                print(f"  [WARN] Short erstellt, aber Ausgabe nicht verschoben.")
                succeeded.append(dn)
        else:
            print(f"  [FEHLER] Skill fehlgeschlagen für: {dn}")
            failed.append(dn)

    print(f"\n{'═'*60}")
    print(f"  Ergebnis: {len(succeeded)} erfolgreich | {len(failed)} Fehler | {len(skipped)} übersprungen")
    if failed:
        print(f"  Fehlgeschlagen:")
        for f in failed:
            print(f"    • {f}")
    print(f"{'═'*60}\n")


if __name__ == "__main__":
    main()
