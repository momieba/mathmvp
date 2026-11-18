#!/usr/bin/env python3
"""
batch_video_creator.py — Erstellt Mathe-Erklärvideos iterativ aus dem Lehrplan-YAML.

Für jedes Unterthema der angegebenen Klasse(n) und Thema(en) wird der Skill
create-math-video5 über die Claude Code CLI aufgerufen.

Ausgabe-Ordnerstruktur:
  <Curriculum_name>/Klasse_<n>/<Unterthema>/
    <Unterthema>.mp4
    <Unterthema>.srt
    skript.txt

Beispiele:
  python scripts/batch_video_creator.py --klasse 5 --thema "Natürliche Zahlen"
  python scripts/batch_video_creator.py --klasse 5,6 --thema "Bruchrechnung,Geometrie"
  python scripts/batch_video_creator.py --klasse 5  # alle Themen der Klasse 5
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
    # 1. Direkt im PATH
    found = _shutil.which("claude") or _shutil.which("claude.cmd")
    if found:
        return found
    # 2. npm global
    for base in [os.environ.get("APPDATA", ""), os.environ.get("LOCALAPPDATA", "")]:
        for candidate in [
            pathlib.Path(base) / "npm" / "claude.cmd",
            pathlib.Path(base) / "npm" / "claude",
        ]:
            if candidate.exists():
                return str(candidate)
    # 3. Claude Desktop App (Windows Store / Squirrel Installer)
    local = os.environ.get("LOCALAPPDATA", "")
    patterns = [
        str(pathlib.Path(local) / "Packages" / "Claude_*" / "LocalCache" / "Roaming" / "Claude" / "claude-code" / "*" / "claude.exe"),
        str(pathlib.Path(local) / "AnthropicClaude" / "claude-code" / "*" / "claude.exe"),
        str(pathlib.Path(local) / "Programs" / "claude" / "claude.exe"),
    ]
    for pattern in patterns:
        matches = sorted(_glob.glob(pattern))
        if matches:
            return matches[-1]  # neueste Version
    # 4. Fallback
    return "claude"

try:
    import yaml
except ImportError:
    print("[FEHLER] PyYAML nicht installiert. Bitte: conda run -n mathtutor pip install pyyaml")
    sys.exit(1)

BASE_DIR = pathlib.Path(__file__).parent.parent
DEFAULT_YAML = BASE_DIR / "curriculum" / "curriculum_data.yaml"


# ── Hilfsfunktionen ──────────────────────────────────────────────────────────

def safe_name(text: str) -> str:
    """Umlaute transliterieren + Sonderzeichen → Unterstriche."""
    t = (text
         .replace("ä", "ae").replace("ö", "oe").replace("ü", "ue")
         .replace("Ä", "Ae").replace("Ö", "Oe").replace("Ü", "Ue")
         .replace("ß", "ss"))
    t = re.sub(r"[^\w]", "_", t)
    t = re.sub(r"_+", "_", t).strip("_")
    return t


def load_yaml(path: pathlib.Path) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


# ── Argumente parsen ─────────────────────────────────────────────────────────

def parse_args():
    p = argparse.ArgumentParser(
        description="Batch-Erstellung von Mathe-Erklärvideos aus dem Lehrplan-YAML",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    p.add_argument(
        "--yaml",
        default=str(DEFAULT_YAML),
        help=f"Pfad zur Lehrplan-YAML (Standard: {DEFAULT_YAML.name})",
    )
    p.add_argument(
        "--klasse",
        required=True,
        help="Klasse(n), kommasepariert — z.B. '5' oder '5,6,7'",
    )
    p.add_argument(
        "--thema",
        default=None,
        help="Thema(en) (name-Feld), kommasepariert — fehlt: alle Themen der Klasse",
    )
    p.add_argument(
        "--skip-fertig",
        action="store_true",
        default=True,
        help="Unterthemen mit status='fertig' überspringen (Standard: an)",
    )
    p.add_argument(
        "--no-skip-fertig",
        action="store_false",
        dest="skip_fertig",
        help="Auch Unterthemen mit status='fertig' neu rendern",
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Nur anzeigen, was gemacht würde — keinen Skill ausführen",
    )
    return p.parse_args()


# ── YAML-Einträge finden ─────────────────────────────────────────────────────

def collect_entries(data: dict, klassen: list[int], themen_filter: list[str] | None) -> list[dict]:
    """Gibt alle passenden Unterthema-Einträge zurück."""
    entries = []

    for curriculum_key, curriculum in data.items():
        if not isinstance(curriculum, dict) or "klassen" not in curriculum:
            continue

        for klasse_entry in curriculum.get("klassen", []):
            klasse_nr = klasse_entry.get("klasse")
            if klasse_nr not in klassen:
                continue

            for thema_entry in klasse_entry.get("themen", []):
                thema_name = thema_entry.get("name", "")

                if themen_filter is not None and thema_name not in themen_filter:
                    continue

                for ut in thema_entry.get("unterthemen", []):
                    entries.append({
                        "curriculum": curriculum_key,
                        "klasse":     klasse_nr,
                        "thema":      thema_name,
                        "displayname": ut.get("displayname", ""),
                        "beschreibung": ut.get("beschreibung", ""),
                        "status":     ut.get("status", ""),
                    })

    return entries


def validate_inputs(data: dict, klassen: list[int], themen_filter: list[str] | None) -> bool:
    """Prüft ob alle angegebenen Klassen und Themen existieren. Gibt False zurück bei Fehlern."""
    all_klassen: set[int] = set()
    all_themen: set[str] = set()

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
            print(f"[FEHLER] Klasse {k} nicht im Lehrplan gefunden. "
                  f"Verfügbar: {sorted(all_klassen, key=str)}")
            ok = False

    if themen_filter:
        for t in themen_filter:
            if t not in all_themen:
                print(f"[FEHLER] Thema '{t}' nicht im Lehrplan gefunden.")
                # Ähnliche Treffer vorschlagen
                suggestions = [x for x in all_themen if t.lower() in x.lower()]
                if suggestions:
                    print(f"         Meintest du: {suggestions[:3]}")
                ok = False

    return ok


# ── Ausgabe-Existenz prüfen ───────────────────────────────────────────────────

def output_exists(entry: dict) -> bool:
    """Gibt True zurück wenn im Zielordner bereits eine .mp4 liegt."""
    safe_dn = safe_name(entry["displayname"])
    dst = (BASE_DIR
           / entry["curriculum"]
           / f"Klasse_{entry['klasse']}"
           / safe_name(entry["thema"])
           / safe_dn)
    return any(dst.glob("*.mp4"))


# ── Skill-Aufruf ─────────────────────────────────────────────────────────────

def run_skill(displayname: str, beschreibung: str) -> bool:
    """Ruft den Claude Code Skill create-math-video5 auf."""
    claude = _find_claude()
    prompt = f"/create-math-video5 {displayname} beschreibung: {beschreibung}"
    print(f"  {claude} -p \"{prompt}\"")
    result = subprocess.run(
        [claude, "-p", prompt],
        cwd=str(BASE_DIR),
        shell=(sys.platform == "win32"),
    )
    return result.returncode == 0


# ── Ausgabe verschieben ───────────────────────────────────────────────────────

def move_output(entry: dict) -> pathlib.Path | None:
    """
    Verschiebt die fertigen Videodateien aus output/<safe_displayname>/
    in <curriculum>/Klasse_<n>/<safe_displayname>/.
    Gibt den Zielpfad zurück, oder None bei Fehler.
    """
    safe_dn = safe_name(entry["displayname"])
    src = BASE_DIR / "output" / safe_dn

    dst = (BASE_DIR
           / entry["curriculum"]
           / f"Klasse_{entry['klasse']}"
           / safe_name(entry["thema"])
           / safe_dn)

    if not src.exists():
        # Skill könnte einen anderen safe_name erzeugt haben — kurze Suche
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


# ── Hauptprogramm ─────────────────────────────────────────────────────────────

def main():
    args = parse_args()

    # Klassen und Themen parsen
    try:
        klassen = [int(k.strip()) for k in args.klasse.split(",") if k.strip()]
    except ValueError:
        print("[FEHLER] --klasse muss Zahlen enthalten, z.B. '5' oder '5,6'")
        sys.exit(1)

    themen_filter = (
        [t.strip() for t in args.thema.split(",") if t.strip()]
        if args.thema
        else None
    )

    # YAML laden
    yaml_path = pathlib.Path(args.yaml)
    if not yaml_path.exists():
        print(f"[FEHLER] YAML nicht gefunden: {yaml_path}")
        sys.exit(1)

    data = load_yaml(yaml_path)

    # Eingaben validieren
    if not validate_inputs(data, klassen, themen_filter):
        sys.exit(1)

    # Einträge sammeln
    entries = collect_entries(data, klassen, themen_filter)

    if not entries:
        print("[FEHLER] Keine passenden Unterthemen gefunden.")
        sys.exit(1)

    # Übersicht
    total = len(entries)
    skip_count = sum(1 for e in entries if args.skip_fertig and output_exists(e))
    run_count = total - skip_count

    print(f"\n{'─'*60}")
    print(f"  Lehrplan:  {yaml_path.name}")
    print(f"  Klassen:   {klassen}")
    print(f"  Themen:    {themen_filter or 'alle'}")
    print(f"  Gesamt:    {total} Unterthemen  ({skip_count} übersprungen, {run_count} zu erstellen)")
    if args.dry_run:
        print("  Modus:     DRY RUN — kein Skill wird ausgeführt")
    print(f"{'─'*60}\n")

    if args.dry_run:
        for i, e in enumerate(entries, 1):
            skip = " [SKIP — Video vorhanden]" if args.skip_fertig and output_exists(e) else ""
            print(f"  [{i:>2}/{total}] {e['thema']} → {e['displayname']}{skip}")
        return

    # Verarbeitung
    succeeded, failed, skipped = [], [], []

    for i, entry in enumerate(entries, 1):
        dn = entry["displayname"]
        print(f"\n[{i:>2}/{total}] {entry['thema']} → {dn}")

        if args.skip_fertig and output_exists(entry):
            print("  [SKIP] Video bereits vorhanden — übersprungen")
            skipped.append(dn)
            continue

        ok = run_skill(dn, entry["beschreibung"])

        if ok:
            dst = move_output(entry)
            if dst:
                succeeded.append(dn)
            else:
                print(f"  [WARN] Video erstellt, aber Ausgabe nicht verschoben.")
                succeeded.append(dn)
        else:
            print(f"  [FEHLER] Skill fehlgeschlagen für: {dn}")
            failed.append(dn)

    # Zusammenfassung
    print(f"\n{'═'*60}")
    print(f"  Ergebnis: {len(succeeded)} erfolgreich | {len(failed)} Fehler | {len(skipped)} übersprungen")
    if failed:
        print(f"  Fehlgeschlagen:")
        for f in failed:
            print(f"    • {f}")
    print(f"{'═'*60}\n")


if __name__ == "__main__":
    main()
