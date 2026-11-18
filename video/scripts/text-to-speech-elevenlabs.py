"""
ElevenLabs TTS-Skript für den create-math-video2 Skill.

Liest eine JSON-Datei {segment_key: text} und erzeugt pro Segment eine MP3-Datei
sowie eine _segment_durations.json mit den Audio-Längen in Sekunden.

Usage:
    python scripts/text-to-speech-elevenlabs.py \\
        --input output/temp/Bruchrechnung_narration.json \\
        --output-dir output/temp/ \\
        --stem Bruchrechnung

Keys aus der JSON werden in Reihenfolge verarbeitet (Python 3.7+ dict-order).
Ausgabe: {stem}_{key}.mp3 + {stem}_segment_durations.json im output-dir.
"""
import argparse
import base64
import json
import os
import pathlib
import re
import subprocess
import sys
import urllib.request
import urllib.error

SCRIPT_DIR = pathlib.Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent

EL_MODEL = "eleven_multilingual_v2"
EL_FORMAT = "mp3_44100_128"


def _load_env() -> None:
    env_file = PROJECT_ROOT / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, val = line.partition("=")
            os.environ.setdefault(key.strip(), val.strip())


def _probe_duration(path: pathlib.Path) -> float:
    result = subprocess.run(
        [
            "ffprobe", "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            str(path),
        ],
        capture_output=True,
        text=True,
    )
    try:
        return float(result.stdout.strip())
    except ValueError:
        return 0.0


def _audio_format(path: pathlib.Path) -> tuple[int, str]:
    """Sample-Rate und Kanal-Layout einer Audiodatei (für stille Einschübe)."""
    result = subprocess.run(
        [
            "ffprobe", "-v", "error", "-select_streams", "a:0",
            "-show_entries", "stream=sample_rate,channels,channel_layout",
            "-of", "json", str(path),
        ],
        capture_output=True,
        text=True,
    )
    stream = json.loads(result.stdout)["streams"][0]
    layout = stream.get("channel_layout") or ("mono" if stream.get("channels", 1) == 1 else "stereo")
    return int(stream["sample_rate"]), layout


def _insert_pauses(mp3_path: pathlib.Path, alignment_path: pathlib.Path, pause_s: float) -> int:
    """
    Verlängert jede '...'-Pause um pause_s Sekunden Stille.

    ElevenLabs setzt '...' nur als ~0,5s-Pause um. Hier wird in der Mitte jeder
    '...'-Lücke Stille eingefügt und das Alignment entsprechend verschoben, damit
    Marker und Untertitel exakt bleiben. Gibt die Anzahl eingefügter Pausen zurück.
    """
    al = json.loads(alignment_path.read_text(encoding="utf-8"))
    ch = al["characters"]
    st = al["character_start_times_seconds"]
    en = al["character_end_times_seconds"]

    text = "".join(ch)
    if len(text) != len(ch):   # Alignment mit Mehrzeichen-Einträgen: nicht unterstützt
        return 0

    # Schnittzeitpunkte: Mitte der Lücke zwischen letztem Buchstaben vor und erstem nach '...'
    cut_times = []
    for m in re.finditer("\\.\\.\\.|…", text):
        i0 = m.start() - 1
        while i0 >= 0 and not ch[i0].isalnum():
            i0 -= 1
        i1 = m.end()
        while i1 < len(ch) and not ch[i1].isalnum():
            i1 += 1
        if i0 < 0 or i1 >= len(ch):   # '...' am Anfang/Ende: keine Pause nötig
            continue
        cut_times.append((en[i0] + st[i1]) / 2)
    if not cut_times:
        return 0

    # Audio: Stücke zwischen den Schnitten + Stille dazwischen neu zusammensetzen
    sr, layout = _audio_format(mp3_path)
    n = len(cut_times) + 1
    bounds = [0.0] + cut_times + [None]
    filt = [f"[0:a]asplit={n}" + "".join(f"[i{k}]" for k in range(n))]
    labels = []
    for k in range(n):
        a, b = bounds[k], bounds[k + 1]
        trim = f"atrim=start={a:.4f}" + (f":end={b:.4f}" if b is not None else "")
        filt.append(f"[i{k}]{trim},asetpts=PTS-STARTPTS[p{k}]")
        labels.append(f"[p{k}]")
        if b is not None:
            filt.append(f"anullsrc=r={sr}:cl={layout},atrim=duration={pause_s:.3f}[s{k}]")
            labels.append(f"[s{k}]")
    filt.append("".join(labels) + f"concat=n={len(labels)}:v=0:a=1[out]")

    tmp_path = mp3_path.with_suffix(".tmp.mp3")
    result = subprocess.run(
        [
            "ffmpeg", "-v", "error", "-y", "-i", str(mp3_path),
            "-filter_complex", ";".join(filt), "-map", "[out]",
            "-c:a", "libmp3lame", "-b:a", "128k", str(tmp_path),
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"ffmpeg-Fehler beim Einfügen der Pausen: {result.stderr}", file=sys.stderr)
        sys.exit(1)
    tmp_path.replace(mp3_path)

    # Alignment: jeder Zeitpunkt wird um pause_s pro davor liegendem Schnitt verschoben
    def shift(t: float) -> float:
        return round(t + pause_s * sum(1 for c in cut_times if c <= t), 4)

    al["character_start_times_seconds"] = [shift(t) for t in st]
    al["character_end_times_seconds"] = [shift(t) for t in en]
    alignment_path.write_text(json.dumps(al, indent=2, ensure_ascii=False), encoding="utf-8")
    return len(cut_times)


def _synthesize(text: str, voice_id: str, api_key: str, output_path: pathlib.Path) -> None:
    try:
        from elevenlabs import ElevenLabs
    except ImportError:
        print("Fehler: 'elevenlabs' nicht installiert. Führe 'pip install elevenlabs' aus.")
        sys.exit(1)

    client = ElevenLabs(api_key=api_key)
    audio_iter = client.text_to_speech.convert(
        voice_id=voice_id,
        text=text,
        model_id=EL_MODEL,
        output_format=EL_FORMAT,
    )
    with open(output_path, "wb") as f:
        for chunk in audio_iter:
            if chunk:
                f.write(chunk)


def _synthesize_with_timestamps(
    text: str,
    voice_id: str,
    api_key: str,
    output_path: pathlib.Path,
    alignment_path: pathlib.Path,
    speed: float = 1.0,
) -> None:
    url = (
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        f"/with-timestamps?output_format={EL_FORMAT}"
    )
    payload = json.dumps({
        "text": text,
        "model_id": EL_MODEL,
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75, "speed": speed},
    }).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=payload,
        headers={"xi-api-key": api_key, "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"ElevenLabs API-Fehler {e.code}: {body}", file=sys.stderr)
        sys.exit(1)

    audio_bytes = base64.b64decode(data["audio_base64"])
    output_path.write_bytes(audio_bytes)
    alignment_path.write_text(
        json.dumps(data["alignment"], indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def main() -> None:
    _load_env()

    parser = argparse.ArgumentParser(
        description="ElevenLabs TTS: JSON → individuelle MP3-Dateien pro Segment"
    )
    parser.add_argument("--input", required=True, help="Pfad zur Narrations-JSON ({key: text})")
    parser.add_argument("--output-dir", required=True, help="Ausgabe-Verzeichnis für MP3s")
    parser.add_argument("--stem", required=True, help="Datei-Präfix (z.B. 'Bruchrechnung')")
    parser.add_argument("--with-timestamps", action="store_true",
                        help="ElevenLabs /with-timestamps Endpoint — erzeugt zusätzlich *_alignment.json")
    parser.add_argument("--speed", type=float, default=1.0,
                        help="Sprechtempo (ElevenLabs voice_settings.speed, 0.7–1.2, Standard 1.0). "
                             "Nur mit --with-timestamps wirksam.")
    parser.add_argument("--pause-ms", type=int, default=0,
                        help="Zusätzliche Stille (ms) an jeder '...'-Pause, Alignment wird mitverschoben. "
                             "ElevenLabs setzt '...' selbst nur als ~0,5s-Pause um. Nur mit --with-timestamps.")
    args = parser.parse_args()
    if not 0.7 <= args.speed <= 1.2:
        parser.error("--speed muss zwischen 0.7 und 1.2 liegen")

    api_key = os.environ.get("ELEVENLABS_API_KEY", "")
    voice_id = os.environ.get("ELEVENLABS_VOICE_ID", "H1RPikOCj3XUOKuTygkn")

    if not api_key or "your-" in api_key:
        print("Fehler: ELEVENLABS_API_KEY fehlt oder ist Platzhalter. Bitte .env prüfen.", file=sys.stderr)
        sys.exit(1)

    input_path = pathlib.Path(args.input)
    if not input_path.exists():
        print(f"Fehler: Eingabe-Datei nicht gefunden: {input_path}", file=sys.stderr)
        sys.exit(1)

    output_dir = pathlib.Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    segments: dict[str, str] = json.loads(input_path.read_text(encoding="utf-8"))
    print(f"{len(segments)} Segmente: {', '.join(segments.keys())}")
    print(f"Voice-ID: {voice_id} | Modell: {EL_MODEL} | Speed: {args.speed} | Pause+: {args.pause_ms} ms")
    print()

    durations: dict[str, float] = {}
    for key, text in segments.items():
        out_path = output_dir / f"{args.stem}_{key}.mp3"
        preview = text[:65].replace("\n", " ")
        print(f"  [{key}] {preview}…")
        if args.with_timestamps:
            al_path = output_dir / f"{args.stem}_{key}_alignment.json"
            _synthesize_with_timestamps(text, voice_id, api_key, out_path, al_path, speed=args.speed)
            if args.pause_ms > 0:
                n_pauses = _insert_pauses(out_path, al_path, args.pause_ms / 1000)
                print(f"    + {n_pauses} Pausen à {args.pause_ms} ms eingefügt")
            # Dauer aus letztem character_end_times_seconds (enthält Break-Zeiten)
            al = json.loads(al_path.read_text(encoding="utf-8"))
            end_times = al.get("character_end_times_seconds", [])
            dur = round(end_times[-1], 3) if end_times else _probe_duration(out_path)
            print(f"    → {out_path.name}  ({dur:.1f}s) + {al_path.name}")
        else:
            _synthesize(text, voice_id, api_key, out_path)
            dur = _probe_duration(out_path)
            print(f"    → {out_path.name}  ({dur:.1f}s)")
        durations[key] = round(dur, 3)

    durations_path = output_dir / f"{args.stem}_segment_durations.json"
    durations_path.write_text(
        json.dumps(durations, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print()
    print(f"Segment-Dauern gespeichert: {durations_path}")
    for key, dur in durations.items():
        print(f"  {key}: {dur}s")


if __name__ == "__main__":
    main()
