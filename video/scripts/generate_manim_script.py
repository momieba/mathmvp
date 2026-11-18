"""
Generiert eine Manim-Scene-Datei für ein gegebenes Mathe-Thema via Claude API.
Ausgabe: output/temp/<safe_topic>_klasse<grade>.py

Usage:
    python scripts/generate_manim_script.py --topic "Bruchrechnung" --grade 6
    python scripts/generate_manim_script.py --topic "Pythagoras" --grade 9 --bundesland "NRW"
"""
import argparse
import os
import pathlib
import py_compile
import re
import sys

import anthropic
from dotenv import load_dotenv

load_dotenv()

SCRIPT_DIR = pathlib.Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
TEMPLATE_PATH = PROJECT_ROOT / "templates" / "manim_base.py"
OUTPUT_DIR = PROJECT_ROOT / "output" / "temp"


def safe_name(text: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_äöüÄÖÜß]", "_", text).strip("_")


def load_template() -> str:
    return TEMPLATE_PATH.read_text(encoding="utf-8")


SYSTEM_PROMPT = """Du bist ein erfahrener Mathe-Lehrer und Manim-Entwickler.
Du erstellst hochwertige, animierte Mathe-Erklärvideos für deutsche Schüler.
Deine Manim-Szenen sind visuell ansprechend, didaktisch klar gegliedert und altersggerecht.
Du schreibst vollständigen, lauffähigen Python-Code ohne Platzhalter."""


def build_user_prompt(topic: str, grade: int, bundesland: str, template_code: str) -> str:
    words_per_minute = 130
    target_duration_seconds = 240  # ca. 4 Minuten

    return f"""Erstelle eine vollständige Manim-Scene-Datei für folgendes Erklärvideo:

**Thema:** {topic}
**Klassenstufe:** Klasse {grade}
**Bundesland:** {bundesland}
**Zieldauer:** ca. {target_duration_seconds // 60} Minuten

## Anforderungen

Die Datei muss exakt diesen Aufbau haben:

```python
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent.parent.parent / "templates"))
from manim_base import *

class MainScene(MathTutorScene):
    narration_script = {{
        "intro": "...",        # Begrüßung + Themenankündigung
        "segment_1": "...",    # Erster Inhaltspunkt
        "segment_2": "...",    # Zweiter Inhaltspunkt
        ...
        "outro": "...",        # Zusammenfassung + Verabschiedung
    }}

    def construct(self):
        # Vollständige Implementierung
        ...
```

## Narrations-Skript-Regeln
- Jeder Narrations-Text soll bei {words_per_minute} Wörtern/Minute die Animations-Dauer abdecken
- Schreibe natürliches, schülergerechtes Deutsch für Klasse {grade}
- Beginne mit "Hallo! Heute in Mathe..." oder ähnlich
- Erkläre jeden Schritt so, als würdest du direkt mit dem Schüler sprechen

## Animations-Regeln
- Verwende NUR Methoden und Klassen aus `manim_base.py` und Standard-Manim
- `self.wait(N)` nach jedem Animations-Segment — N schätze aus Narrations-Textlänge (Wörter / {words_per_minute // 60} ≈ Sekunden)
- Mindestens 3 konkrete Beispiele mit Zahlen zeigen
- Für algebraische Themen: Schritt-für-Schritt-Rechnung mit `self.show_steps()`
- Für geometrische Themen: geometrische Figuren mit Manim-Shapes zeichnen
- Für Statistik/Zahlenthemen: Zahlenstrahlen oder Diagramme
- Am Ende: `self.show_summary([...])` mit 3–4 Merkpunkten

## Verwendbare manim_base.py Methoden
```
{template_code}
```

## Qualitätskriterien
- Der Code muss `py_compile.compile()` ohne Fehler bestehen
- Die Klasse heißt exakt `MainScene`
- `narration_script` ist ein Dict auf Klassenebene
- Keine TODO-Kommentare, kein Pseudo-Code
- Alle `MathTex`-Strings sind gültiges LaTeX

Gib NUR den vollständigen Python-Code zurück, ohne Markdown-Codeblöcke, ohne Erklärungen davor oder danach."""


def generate_scene(topic: str, grade: int, bundesland: str) -> pathlib.Path:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("Fehler: ANTHROPIC_API_KEY nicht gesetzt. .env Datei prüfen.", file=sys.stderr)
        sys.exit(1)

    template_code = load_template()
    user_prompt = build_user_prompt(topic, grade, bundesland, template_code)

    client = anthropic.Anthropic(api_key=api_key)

    print(f"Generiere Manim-Skript für '{topic}' (Klasse {grade}, {bundesland})...")
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=8192,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
    )

    code = message.content[0].text.strip()

    # Markdown-Codeblöcke entfernen falls vorhanden
    if code.startswith("```"):
        lines = code.splitlines()
        code = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"{safe_name(topic)}_klasse{grade}.py"
    output_path = OUTPUT_DIR / filename
    output_path.write_text(code, encoding="utf-8")
    print(f"Skript gespeichert: {output_path}")

    # Syntax prüfen
    try:
        py_compile.compile(str(output_path), doraise=True)
        print("Syntax-Check: OK")
    except py_compile.PyCompileError as e:
        print(f"Syntax-Fehler im generierten Code: {e}", file=sys.stderr)
        print("Die Datei wurde trotzdem gespeichert. Bitte manuell prüfen.")

    return output_path


def main():
    parser = argparse.ArgumentParser(description="Manim-Skript via Claude generieren")
    parser.add_argument("--topic", required=True, help="Mathematik-Thema")
    parser.add_argument("--grade", required=True, type=int, help="Klassenstufe (5-12)")
    parser.add_argument("--bundesland", default="Bayern", help="Bundesland")
    args = parser.parse_args()

    path = generate_scene(args.topic, args.grade, args.bundesland)
    print(path)  # Letzter Output: Pfad für Shell-Weiterverarbeitung


if __name__ == "__main__":
    main()
