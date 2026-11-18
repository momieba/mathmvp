"""
Analysiert den deutschen Mathematik-Lehrplan und verwaltet curriculum_data.yaml.

Usage:
    python scripts/curriculum_analyzer.py --list
    python scripts/curriculum_analyzer.py --update --bundesland Bayern --schulform Gymnasium
    python scripts/curriculum_analyzer.py --list --bundesland alle
    python scripts/curriculum_analyzer.py --list --export-csv
    python scripts/curriculum_analyzer.py --list --export-excel
    python scripts/curriculum_analyzer.py --list --export-csv --export-excel
"""
import argparse
import csv
import datetime
import json
import os
import pathlib
import sys

import anthropic
import yaml
from dotenv import load_dotenv

load_dotenv()

SCRIPT_DIR = pathlib.Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
CURRICULUM_FILE = PROJECT_ROOT / "curriculum" / "curriculum_data.yaml"
BUNDESLAENDER_DIR = PROJECT_ROOT / "curriculum" / "bundeslaender"
EXPORTS_DIR = PROJECT_ROOT / "curriculum" / "exports"

ALL_BUNDESLAENDER = [
    "Baden-Württemberg", "Bayern", "Berlin", "Brandenburg", "Bremen",
    "Hamburg", "Hessen", "Mecklenburg-Vorpommern", "Niedersachsen",
    "Nordrhein-Westfalen", "Rheinland-Pfalz", "Saarland", "Sachsen",
    "Sachsen-Anhalt", "Schleswig-Holstein", "Thüringen",
]

ALL_SCHULFORMEN = ["Gymnasium", "Realschule", "Gesamtschule", "Mittelschule"]

PRIORITY_ORDER = [
    "Bayern", "Nordrhein-Westfalen", "Baden-Württemberg", "Niedersachsen",
    "Hessen", "Berlin", "Brandenburg", "Hamburg", "Bremen",
    "Rheinland-Pfalz", "Sachsen", "Thüringen", "Sachsen-Anhalt",
    "Mecklenburg-Vorpommern", "Saarland", "Schleswig-Holstein",
]

CSV_COLUMNS = [
    "Bundesland", "Schulform", "Klasse", "Thema",
    "Unterthemen", "Video-Titel", "Status", "Stunden/Jahr",
]


def load_curriculum() -> dict:
    if CURRICULUM_FILE.exists():
        with CURRICULUM_FILE.open(encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    return {}


def save_curriculum(data: dict) -> None:
    CURRICULUM_FILE.parent.mkdir(parents=True, exist_ok=True)
    with CURRICULUM_FILE.open("w", encoding="utf-8") as f:
        yaml.dump(data, f, allow_unicode=True, sort_keys=False, default_flow_style=False)


def save_bundesland_file(bundesland: str, schulform: str, data: list) -> None:
    BUNDESLAENDER_DIR.mkdir(parents=True, exist_ok=True)
    slug = f"{bundesland.lower().replace(' ', '_').replace('-', '_')}_{schulform.lower()}.yaml"
    path = BUNDESLAENDER_DIR / slug
    with path.open("w", encoding="utf-8") as f:
        yaml.dump(
            {"bundesland": bundesland, "schulform": schulform, "klassen": data},
            f, allow_unicode=True, sort_keys=False, default_flow_style=False,
        )


def is_data_fresh(entry: dict, max_age_days: int = 30) -> bool:
    updated = entry.get("updated_at")
    if not updated:
        return False
    try:
        age = (datetime.date.today() - datetime.date.fromisoformat(str(updated))).days
        return age < max_age_days
    except (ValueError, TypeError):
        return False


def _format_unterthemen(unterthemen: list) -> str:
    parts = []
    for u in unterthemen:
        if isinstance(u, dict):
            parts.append(u.get("displayname", ""))
        else:
            parts.append(str(u))
    return "; ".join(parts)


def iter_rows(data: dict, filter_bundesland: str = None, filter_schulform: str = None):
    """Liefert alle Themen als flache Dicts — gemeinsame Basis für Tabelle, CSV und Excel."""
    for entry in data.values():
        bl = entry.get("bundesland", "")
        sf = entry.get("schulform", "")
        if filter_bundesland and filter_bundesland.lower() not in bl.lower():
            continue
        if filter_schulform and filter_schulform.lower() not in sf.lower():
            continue
        for klasse_entry in entry.get("klassen", []):
            klasse = klasse_entry.get("klasse", "")
            for thema in klasse_entry.get("themen", []):
                yield {
                    "Bundesland": bl,
                    "Schulform": sf,
                    "Klasse": klasse,
                    "Thema": thema.get("name", ""),
                    "Unterthemen": _format_unterthemen(thema.get("unterthemen", [])),
                    "Video-Titel": thema.get("video_titel", ""),
                    "Status": thema.get("status", "ausstehend"),
                    "Stunden/Jahr": thema.get("stunden_pro_jahr", ""),
                }


# ── Ausgabe-Formate ────────────────────────────────────────────────────────────

def print_table(data: dict, filter_bundesland: str = None, filter_schulform: str = None):
    print()
    print("| Bundesland | Schulform | Klasse | Thema | Unterthemen | Video-Titel | Status | Std/Jahr |")
    print("|---|---|---|---|---|---|---|---|")
    for row in iter_rows(data, filter_bundesland, filter_schulform):
        icon = "✅" if row["Status"] == "fertig" else "⏳"
        ut = row["Unterthemen"].replace(";", ",")
        print(
            f"| {row['Bundesland']} | {row['Schulform']} | {row['Klasse']} "
            f"| {row['Thema']} | {ut} | {row['Video-Titel']} "
            f"| {icon} {row['Status']} | {row['Stunden/Jahr']} |"
        )
    print()
    total, done = count_videos(data)
    print(f"**Gesamt:** {total} Videos | **Fertig:** {done} | **Ausstehend:** {total - done}")


def export_csv(
    data: dict,
    filter_bundesland: str = None,
    filter_schulform: str = None,
    output_path: pathlib.Path = None,
) -> pathlib.Path:
    EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.date.today().isoformat()
    suffix = f"_{filter_bundesland}" if filter_bundesland else "_alle"
    if output_path is None:
        output_path = EXPORTS_DIR / f"lehrplan{suffix}_{stamp}.csv"

    rows = list(iter_rows(data, filter_bundesland, filter_schulform))
    with output_path.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)

    print(f"CSV gespeichert: {output_path} ({len(rows)} Zeilen)")
    return output_path


def export_excel(
    data: dict,
    filter_bundesland: str = None,
    filter_schulform: str = None,
    output_path: pathlib.Path = None,
) -> pathlib.Path:
    try:
        import openpyxl
        from openpyxl.styles import Alignment, Font, PatternFill
        from openpyxl.utils import get_column_letter
    except ImportError:
        print(
            "openpyxl nicht installiert. Bitte ausführen:\n"
            "  conda run -n mathtutor pip install openpyxl",
            file=sys.stderr,
        )
        sys.exit(1)

    EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.date.today().isoformat()
    suffix = f"_{filter_bundesland}" if filter_bundesland else "_alle"
    if output_path is None:
        output_path = EXPORTS_DIR / f"lehrplan{suffix}_{stamp}.xlsx"

    rows = list(iter_rows(data, filter_bundesland, filter_schulform))

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Lehrplan"

    # Header-Zeile
    header_fill = PatternFill(fill_type="solid", fgColor="2D6A9F")
    header_font = Font(bold=True, color="FFFFFF", size=11)
    for col_idx, col_name in enumerate(CSV_COLUMNS, start=1):
        cell = ws.cell(row=1, column=col_idx, value=col_name)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

    # Datenzeilen
    fertig_fill = PatternFill(fill_type="solid", fgColor="E8F5E9")
    offen_fill = PatternFill(fill_type="solid", fgColor="FFF8E1")

    for row_idx, row in enumerate(rows, start=2):
        fill = fertig_fill if row["Status"] == "fertig" else offen_fill
        for col_idx, col_name in enumerate(CSV_COLUMNS, start=1):
            cell = ws.cell(row=row_idx, column=col_idx, value=row[col_name])
            cell.fill = fill
            cell.alignment = Alignment(vertical="top", wrap_text=True)
        # Klasse als Zahl formatieren
        ws.cell(row=row_idx, column=3).number_format = "0"

    # Spaltenbreiten anpassen
    col_widths = [22, 14, 8, 28, 55, 38, 14, 12]
    for col_idx, width in enumerate(col_widths, start=1):
        ws.column_dimensions[get_column_letter(col_idx)].width = width

    # Zeilenfilter aktivieren
    ws.auto_filter.ref = ws.dimensions

    # Kopfzeile fixieren
    ws.freeze_panes = "A2"

    # Übersichts-Tab
    ws_summary = wb.create_sheet("Übersicht")
    total, done = count_videos(data)
    summary_rows = [
        ["Kennzahl", "Wert"],
        ["Gesamt Videos", total],
        ["Fertig", done],
        ["Ausstehend", total - done],
        ["Fortschritt", f"{done/total*100:.1f} %" if total else "0 %"],
        ["Stand", stamp],
    ]
    for r in summary_rows:
        ws_summary.append(r)
    ws_summary.column_dimensions["A"].width = 20
    ws_summary.column_dimensions["B"].width = 15
    header_row = ws_summary[1]
    for cell in header_row:
        cell.font = Font(bold=True)

    wb.save(output_path)
    print(f"Excel gespeichert: {output_path} ({len(rows)} Zeilen)")
    return output_path


def export_json(
    data: dict,
    bundesland: str = None,
    schulform: str = None,
    output_path: pathlib.Path = None,
) -> pathlib.Path:
    """Exportiert Lehrplandaten als hierarchisches JSON: Bundesland → Schulform → Klasse → Thema."""
    EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.date.today().isoformat()
    suffix = f"_{bundesland}" if bundesland else "_alle"
    if output_path is None:
        output_path = EXPORTS_DIR / f"lehrplan{suffix}_{stamp}.json"

    result: dict = {}
    for entry in data.values():
        bl = entry.get("bundesland", "")
        sf = entry.get("schulform", "")
        if bundesland and bl.lower() != bundesland.lower():
            continue
        if schulform and sf.lower() != schulform.lower():
            continue
        if bl not in result:
            result[bl] = {}
        klassen_dict: dict = {}
        for kl in entry.get("klassen", []):
            klasse_nr = str(kl["klasse"])
            themen_dict: dict = {}
            for thema in kl.get("themen", []):
                themen_dict[thema["name"]] = {
                    "unterthemen": thema.get("unterthemen", []),
                    "stunden_pro_jahr": thema.get("stunden_pro_jahr", 0),
                    "video_titel": thema.get("video_titel", ""),
                    "status": thema.get("status", "ausstehend"),
                }
            klassen_dict[klasse_nr] = themen_dict
        result[bl][sf] = {
            "generated_at": entry.get("updated_at", stamp),
            "quellen": entry.get("quellen", []),
            "klassen": klassen_dict,
        }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    total_themen = sum(
        len(themen_dict)
        for bl_data in result.values()
        for sf_data in bl_data.values()
        for themen_dict in sf_data["klassen"].values()
    )
    print(f"JSON gespeichert: {output_path} ({total_themen} Themen)")
    return output_path


OBERSTUFE_ORDER = {"EF": 11, "Q1": 12, "Q2": 13}


def _klasse_sort_key(item: tuple) -> int:
    key = str(item[0])
    if key in OBERSTUFE_ORDER:
        return OBERSTUFE_ORDER[key]
    try:
        return int(key)
    except (ValueError, TypeError):
        return 99


def _merge_into_data(
    data: dict, bundesland: str, schulform: str,
    klassen_raw: dict, quellen: list, today: str,
) -> None:
    """Konvertiert JSON-Klassen-Dict → YAML-Klassen-Liste und schreibt in data."""
    klassen_list = []
    for klasse_nr, themen_dict in sorted(klassen_raw.items(), key=_klasse_sort_key):
        themen_list = []
        for thema_name, thema_data in themen_dict.items():
            themen_list.append({
                "name": thema_name,
                "unterthemen": thema_data.get("unterthemen", []),
                "video_titel": thema_data.get(
                    "video_titel", f"{thema_name} – Klasse {klasse_nr}"
                ),
                "stunden_pro_jahr": thema_data.get("stunden_pro_jahr", 0),
                "status": thema_data.get("status", "ausstehend"),
            })
        try:
            klasse_val = int(klasse_nr)
        except (ValueError, TypeError):
            klasse_val = klasse_nr  # "EF", "Q1", "Q2" bleiben als String
        klassen_list.append({"klasse": klasse_val, "themen": themen_list})

    key = f"{bundesland}_{schulform}"
    data[key] = {
        "bundesland": bundesland,
        "schulform": schulform,
        "updated_at": today,
        "quellen": quellen,
        "klassen": klassen_list,
    }


def import_json_to_yaml(json_path: pathlib.Path, data: dict) -> dict:
    """
    Liest ein vom Skill generiertes JSON und merged es in curriculum_data.yaml.

    Unterstützt zwei Formate:
    - Per-Bundesland: {"bundesland": "NRW", "schulform": "Gymnasium", "klassen": {...}, ...}
    - Multi-Bundesland: {"NRW": {"Gymnasium": {"klassen": {...}, ...}}, ...}
    """
    with json_path.open(encoding="utf-8") as f:
        json_data = json.load(f)

    today = datetime.date.today().isoformat()

    if "bundesland" in json_data and "klassen" in json_data:
        _merge_into_data(
            data,
            json_data["bundesland"],
            json_data["schulform"],
            json_data["klassen"],
            json_data.get("quellen", []),
            today,
        )
        print(
            f"Importiert: {json_data['bundesland']} {json_data['schulform']} "
            f"aus {json_path.name}"
        )
    else:
        count = 0
        for bl, bl_data in json_data.items():
            for sf, sf_data in bl_data.items():
                _merge_into_data(
                    data, bl, sf,
                    sf_data.get("klassen", {}),
                    sf_data.get("quellen", []),
                    today,
                )
                count += 1
        print(f"Importiert: {count} Bundesland/Schulform-Kombinationen aus {json_path.name}")

    return data


# ── Hilfsfunktionen ────────────────────────────────────────────────────────────

def count_videos(data: dict) -> tuple[int, int]:
    """Zählt Videos auf Unterthema-Ebene (jedes Unterthema = ein Video)."""
    total = done = 0
    for entry in data.values():
        for klasse in entry.get("klassen", []):
            for thema in klasse.get("themen", []):
                for ut in thema.get("unterthemen", []):
                    if isinstance(ut, dict):
                        total += 1
                        if ut.get("status") == "fertig":
                            done += 1
    return total, done


def find_video_info(
    data: dict,
    displayname: str,
    klasse: str = None,
    bundesland: str = None,
    schulform: str = None,
) -> dict | None:
    """
    Sucht ein Unterthema anhand des displaynames (case-insensitiv).
    Gibt ein Info-Dict zurück oder None wenn nicht gefunden.
    """
    needle = displayname.strip().lower()
    for entry in data.values():
        if bundesland and entry.get("bundesland", "").lower() != bundesland.lower():
            continue
        if schulform and entry.get("schulform", "").lower() != schulform.lower():
            continue
        for kl_entry in entry.get("klassen", []):
            if klasse and str(kl_entry.get("klasse", "")) != str(klasse):
                continue
            for thema in kl_entry.get("themen", []):
                for ut in thema.get("unterthemen", []):
                    if isinstance(ut, dict) and ut.get("displayname", "").lower() == needle:
                        return {
                            "displayname": ut["displayname"],
                            "beschreibung": ut.get("beschreibung", ""),
                            "status": ut.get("status", "ausstehend"),
                            "thema": thema["name"],
                            "klasse": str(kl_entry["klasse"]),
                            "bundesland": entry["bundesland"],
                            "schulform": entry["schulform"],
                        }
    return None


def mark_video_done(
    data: dict,
    displayname: str,
    klasse: str = None,
    bundesland: str = None,
    schulform: str = None,
) -> bool:
    """Setzt den Status eines Unterthemas auf 'fertig'. Gibt True zurück bei Erfolg."""
    needle = displayname.strip().lower()
    for entry in data.values():
        if bundesland and entry.get("bundesland", "").lower() != bundesland.lower():
            continue
        if schulform and entry.get("schulform", "").lower() != schulform.lower():
            continue
        for kl_entry in entry.get("klassen", []):
            if klasse and str(kl_entry.get("klasse", "")) != str(klasse):
                continue
            for thema in kl_entry.get("themen", []):
                for ut in thema.get("unterthemen", []):
                    if isinstance(ut, dict) and ut.get("displayname", "").lower() == needle:
                        ut["status"] = "fertig"
                        return True
    return False


def get_next_video(
    data: dict,
    bundesland: str = None,
    schulform: str = None,
) -> dict | None:
    """
    Gibt das nächste ausstehende Unterthema zurück (Klasse 5 → Q2, in Lehrplan-Reihenfolge).
    Gibt None zurück wenn alle Videos fertig sind.
    """
    def entry_priority(entry):
        bl = entry.get("bundesland", "")
        return PRIORITY_ORDER.index(bl) if bl in PRIORITY_ORDER else len(PRIORITY_ORDER)

    for entry in sorted(data.values(), key=entry_priority):
        if bundesland and entry.get("bundesland", "").lower() != bundesland.lower():
            continue
        if schulform and entry.get("schulform", "").lower() != schulform.lower():
            continue
        for kl_entry in entry.get("klassen", []):
            for thema in kl_entry.get("themen", []):
                for ut in thema.get("unterthemen", []):
                    if isinstance(ut, dict) and ut.get("status", "ausstehend") == "ausstehend":
                        return {
                            "displayname": ut["displayname"],
                            "beschreibung": ut.get("beschreibung", ""),
                            "thema": thema["name"],
                            "klasse": str(kl_entry["klasse"]),
                            "bundesland": entry["bundesland"],
                            "schulform": entry["schulform"],
                        }
    return None


# ── Claude-basierter Lehrplan-Abruf ───────────────────────────────────────────

SYSTEM_PROMPT = """Du bist ein Experte für das deutsche Bildungssystem und Mathematik-Lehrpläne.
Du kennst die aktuellen Lehrpläne aller 16 deutschen Bundesländer.
Du gibst strukturierte, vollständige Antworten im angegebenen YAML-Format."""


def fetch_curriculum_via_claude(bundesland: str, schulform: str) -> list:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("Fehler: ANTHROPIC_API_KEY nicht gesetzt.", file=sys.stderr)
        sys.exit(1)

    klassen_range = "5-12" if schulform == "Gymnasium" else "5-10"

    prompt = f"""Erstelle eine vollständige Liste der Mathematik-Themen für den Lehrplan:

**Bundesland:** {bundesland}
**Schulform:** {schulform}
**Klassenstufen:** {klassen_range}

Gib die Antwort ALS YAML zurück (kein Markdown, nur reines YAML):

- klasse: 5
  themen:
    - name: Natürliche Zahlen
      unterthemen:
        - Zahldarstellung und Stellenwerte
        - Grundrechenarten
        - Division mit Rest
      video_titel: "Natürliche Zahlen – Klasse 5"
      stunden_pro_jahr: 20
      status: ausstehend

Regeln:
- Alle Klassenstufen {klassen_range.split('-')[0]}–{klassen_range.split('-')[1]} vollständig
- Pro Klasse 4–8 Hauptthemen, pro Thema 3–5 Unterthemen
- Status immer "ausstehend"
- Orientiere dich am tatsächlichen {bundesland} {schulform}-Lehrplan

Gib NUR das YAML zurück."""

    client = anthropic.Anthropic(api_key=api_key)
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=8192,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        lines = raw.splitlines()
        raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

    return yaml.safe_load(raw)


def update_bundesland(data: dict, bundesland: str, schulform: str, force: bool = False) -> dict:
    key = f"{bundesland}_{schulform}"
    existing = data.get(key, {})

    if not force and is_data_fresh(existing):
        print(f"Daten für {bundesland} {schulform} sind aktuell. Nutze --force zum Überschreiben.")
        return data

    print(f"Hole Lehrplandaten: {bundesland} {schulform}...")
    klassen = fetch_curriculum_via_claude(bundesland, schulform)

    entry = {
        "bundesland": bundesland,
        "schulform": schulform,
        "updated_at": datetime.date.today().isoformat(),
        "klassen": klassen,
    }
    data[key] = entry
    save_bundesland_file(bundesland, schulform, klassen)
    print(f"  → {sum(len(k.get('themen', [])) for k in klassen)} Themen in {len(klassen)} Klassen.")
    return data


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Mathe-Lehrplan verwalten")
    parser.add_argument("--list", action="store_true", help="Lehrplan-Tabelle ausgeben")
    parser.add_argument("--update", action="store_true", help="Lehrplandaten via Claude aktualisieren")
    parser.add_argument("--bundesland", default="Bayern", help="Bundesland oder 'alle'")
    parser.add_argument("--schulform", default="Gymnasium", help="Schulform")
    parser.add_argument("--klasse", default=None, help="Klasse (Filter für Video-Befehle)")
    parser.add_argument("--force", action="store_true", help="Auch frische Daten neu laden")
    parser.add_argument("--format", choices=["table", "yaml"], default="table")
    parser.add_argument("--export-csv", action="store_true", help="CSV-Datei speichern")
    parser.add_argument("--export-excel", action="store_true", help="Excel-Datei (.xlsx) speichern")
    parser.add_argument("--export-json", action="store_true", help="JSON-Datei speichern (hierarchisch)")
    parser.add_argument("--import-json", metavar="PATH", help="JSON-Datei importieren und in YAML mergen")
    parser.add_argument("--output", help="Ausgabepfad für CSV/Excel/JSON (optional)")
    # Video-Tracking auf Unterthema-Ebene
    parser.add_argument("--find-video", metavar="DISPLAYNAME",
                        help="Unterthema-Info aus dem Lehrplan abrufen (gibt JSON aus)")
    parser.add_argument("--mark-done-video", metavar="DISPLAYNAME",
                        help="Unterthema-Video als fertig markieren")
    parser.add_argument("--next-video", action="store_true",
                        help="Nächstes ausstehendes Video anzeigen (gibt JSON aus)")
    args = parser.parse_args()

    data = load_curriculum()

    if args.find_video:
        filter_bl = None if args.bundesland.lower() == "alle" else args.bundesland
        filter_sf = None if args.schulform.lower() == "alle" else args.schulform
        info = find_video_info(data, args.find_video, args.klasse, filter_bl, filter_sf)
        if info:
            print(json.dumps(info, ensure_ascii=False, indent=2))
        else:
            print(json.dumps({"error": f"Nicht gefunden: {args.find_video}"}, ensure_ascii=False))
            sys.exit(1)
        return

    if args.next_video:
        filter_bl = None if args.bundesland.lower() == "alle" else args.bundesland
        filter_sf = None if args.schulform.lower() == "alle" else args.schulform
        info = get_next_video(data, filter_bl, filter_sf)
        if info:
            print(json.dumps(info, ensure_ascii=False, indent=2))
        else:
            print(json.dumps({"done": True, "message": "Alle Videos fertig!"}, ensure_ascii=False))
        return

    if args.mark_done_video:
        filter_bl = None if args.bundesland.lower() == "alle" else args.bundesland
        filter_sf = None if args.schulform.lower() == "alle" else args.schulform
        ok = mark_video_done(data, args.mark_done_video, args.klasse, filter_bl, filter_sf)
        if ok:
            save_curriculum(data)
            total, done = count_videos(data)
            print(f"✅ '{args.mark_done_video}' als fertig markiert. Fortschritt: {done}/{total} Videos")
        else:
            print(f"Fehler: Unterthema '{args.mark_done_video}' nicht gefunden.", file=sys.stderr)
            sys.exit(1)
        return

    if args.import_json:
        json_path = pathlib.Path(args.import_json)
        if not json_path.exists():
            print(f"Fehler: JSON-Datei nicht gefunden: {json_path}", file=sys.stderr)
            sys.exit(1)
        data = import_json_to_yaml(json_path, data)
        save_curriculum(data)
        print(f"curriculum_data.yaml aktualisiert: {CURRICULUM_FILE}")

    if args.update:
        bl_list = ALL_BUNDESLAENDER if args.bundesland.lower() == "alle" else [args.bundesland]
        sf_list = ALL_SCHULFORMEN if args.schulform.lower() == "alle" else [args.schulform]
        for bl in bl_list:
            for sf in sf_list:
                data = update_bundesland(data, bl, sf, force=args.force)
        save_curriculum(data)
        print(f"\nLehrplandaten gespeichert: {CURRICULUM_FILE}")

    filter_bl = None if args.bundesland.lower() == "alle" else args.bundesland
    filter_sf = None if args.schulform.lower() == "alle" else args.schulform

    if args.list or not args.update:
        if args.format == "yaml":
            print(yaml.dump(data, allow_unicode=True, default_flow_style=False))
        else:
            print_table(data, filter_bl, filter_sf)

    if args.export_csv:
        out = pathlib.Path(args.output) if args.output and args.output.endswith(".csv") else None
        export_csv(data, filter_bl, filter_sf, out)

    if args.export_excel:
        out = pathlib.Path(args.output) if args.output and args.output.endswith(".xlsx") else None
        export_excel(data, filter_bl, filter_sf, out)

    if args.export_json:
        out = pathlib.Path(args.output) if args.output and args.output.endswith(".json") else None
        export_json(data, filter_bl, filter_sf, out)


if __name__ == "__main__":
    main()
