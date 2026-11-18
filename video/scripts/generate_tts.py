"""
Generiert MP3-Narration aus dem narration_script einer Manim-Scene-Datei.

Unterstützte TTS-Backends:
  • ElevenLabs  (Standard wenn ELEVENLABS_API_KEY in .env gesetzt ist)
      Modell: eleven_multilingual_v2 — exzellente Qualität auf Deutsch
      Voice-ID: ELEVENLABS_VOICE_ID in .env oder --voice-id Flag
  • edge-tts    (kostenlos, Fallback)
      Stimme: de-DE-FlorianMultilingualNeural

Usage:
    python scripts/generate_tts.py --script output/temp/Primzahlen_klasse6.py
    python scripts/generate_tts.py --script ... --tts edge
    python scripts/generate_tts.py --script ... --voice-id <id>
"""
import argparse
import asyncio
import importlib.util
import json
import os
import pathlib
import shutil
import sys
import tempfile

SCRIPT_DIR = pathlib.Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
OUTPUT_DIR = PROJECT_ROOT / "output" / "temp"

# edge-tts Defaults (Fallback)
DEFAULT_EDGE_VOICE = "de-DE-FlorianMultilingualNeural"
DEFAULT_RATE = "-5%"
DEFAULT_PITCH = "+6Hz"

# ElevenLabs Defaults
EL_MODEL = "eleven_multilingual_v2"
EL_FORMAT = "mp3_44100_128"
EL_DEFAULT_VOICE_ID = "pNInz6obpgDQGcFmaJgB"  # Adam — klar, neutral, multilingual


def _load_env() -> None:
    """Lädt Schlüssel-Wert-Paare aus .env in os.environ (überschreibt nicht)."""
    env_file = PROJECT_ROOT / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        os.environ.setdefault(key.strip(), val.strip())


def load_narration_script(scene_path: pathlib.Path) -> dict:
    """Importiert die Scene-Datei und liest narration_script."""
    spec = importlib.util.spec_from_file_location("scene_module", scene_path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Kann {scene_path} nicht laden")
    module = importlib.util.module_from_spec(spec)
    sys.modules.setdefault("manim", _create_manim_stub())
    try:
        spec.loader.exec_module(module)  # type: ignore
    except Exception:
        return _parse_narration_from_source(scene_path)
    for name in dir(module):
        cls = getattr(module, name)
        if isinstance(cls, type) and hasattr(cls, "narration_script"):
            return cls.narration_script
    raise ValueError("Kein narration_script in der Scene-Datei gefunden")


def _parse_narration_from_source(scene_path: pathlib.Path) -> dict:
    import ast
    source = scene_path.read_text(encoding="utf-8")
    tree = ast.parse(source)
    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef):
            for item in node.body:
                if (
                    isinstance(item, ast.Assign)
                    and any(
                        isinstance(t, ast.Name) and t.id == "narration_script"
                        for t in item.targets
                    )
                ):
                    return ast.literal_eval(item.value)
    raise ValueError("narration_script nicht im Quelltext gefunden")


def _create_manim_stub():
    import types
    stub = types.ModuleType("manim")
    for name in ["Scene", "Text", "MathTex", "VGroup", "WHITE", "ORIGIN"]:
        setattr(stub, name, object)
    return stub


async def _probe_duration(path: pathlib.Path) -> float:
    proc = await asyncio.create_subprocess_exec(
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        str(path),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, _ = await proc.communicate()
    return float(stdout.decode().strip())


# ── ElevenLabs Backend ─────────────────────────────────────────────────────────

def _synthesize_elevenlabs_sync(text: str, voice_id: str, api_key: str, output_path: pathlib.Path) -> None:
    from elevenlabs import ElevenLabs
    client = ElevenLabs(api_key=api_key)
    audio_iter = client.text_to_speech.convert(
        voice_id=voice_id,
        text=text,
        model_id=EL_MODEL,
        output_format=EL_FORMAT,
    )
    with open(output_path, "wb") as f:
        for chunk in audio_iter:
            f.write(chunk)


async def synthesize_elevenlabs(
    segments: dict, voice_id: str, api_key: str, output_path: pathlib.Path
) -> dict[str, float]:
    tmp_files: list[pathlib.Path] = []
    durations: dict[str, float] = {}
    base_stem = output_path.stem.replace("_narration", "")

    try:
        for key, text in segments.items():
            if not text.strip():
                continue
            tmp = tempfile.NamedTemporaryFile(suffix=".mp3", delete=False)
            tmp.close()
            tmp_path = pathlib.Path(tmp.name)

            print(f"  ElevenLabs '{key}': {text[:60]}...")
            await asyncio.get_event_loop().run_in_executor(
                None, _synthesize_elevenlabs_sync, text, voice_id, api_key, tmp_path
            )
            tmp_files.append(tmp_path)
            durations[key] = await _probe_duration(tmp_path)

            individual_path = output_path.parent / f"{base_stem}_{key}.mp3"
            shutil.copy(tmp_path, individual_path)

        await _concat_mp3_files(tmp_files, output_path)

    finally:
        for f in tmp_files:
            f.unlink(missing_ok=True)

    return durations


# ── Edge TTS Backend ───────────────────────────────────────────────────────────

async def synthesize_edge(
    segments: dict, voice: str, rate: str, pitch: str, output_path: pathlib.Path
) -> dict[str, float]:
    import edge_tts
    tmp_files: list[pathlib.Path] = []
    durations: dict[str, float] = {}
    base_stem = output_path.stem.replace("_narration", "")

    try:
        for key, text in segments.items():
            if not text.strip():
                continue
            tmp = tempfile.NamedTemporaryFile(suffix=".mp3", delete=False)
            tmp.close()
            tmp_path = pathlib.Path(tmp.name)

            print(f"  edge-tts '{key}': {text[:60]}...")
            communicate = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
            await communicate.save(str(tmp_path))
            tmp_files.append(tmp_path)
            durations[key] = await _probe_duration(tmp_path)

            individual_path = output_path.parent / f"{base_stem}_{key}.mp3"
            shutil.copy(tmp_path, individual_path)

        await _concat_mp3_files(tmp_files, output_path)

    finally:
        for f in tmp_files:
            f.unlink(missing_ok=True)

    return durations


# ── Concat ─────────────────────────────────────────────────────────────────────

async def _concat_mp3_files(files: list[pathlib.Path], output: pathlib.Path) -> None:
    if not files:
        raise ValueError("Keine TTS-Segmente erzeugt")
    if len(files) == 1:
        shutil.copy(files[0], output)
        return
    list_file = output.parent / "_concat_list.txt"
    list_file.write_text(
        "\n".join(f"file '{f.as_posix()}'" for f in files),
        encoding="utf-8"
    )
    proc = await asyncio.create_subprocess_exec(
        "ffmpeg", "-y", "-f", "concat", "-safe", "0",
        "-i", str(list_file), "-c", "copy", str(output),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()
    list_file.unlink(missing_ok=True)
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg concat fehlgeschlagen:\n{stderr.decode()}")


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    _load_env()

    parser = argparse.ArgumentParser(description="TTS-Narration für Manim-Scene generieren")
    parser.add_argument("--script", required=True, help="Pfad zur Manim-Scene .py Datei")
    parser.add_argument("--tts", choices=["elevenlabs", "edge"], default=None,
                        help="TTS-Backend (Standard: elevenlabs falls API-Key vorhanden)")
    parser.add_argument("--voice-id", help="ElevenLabs Voice-ID (überschreibt ELEVENLABS_VOICE_ID)")
    parser.add_argument("--voice", default=DEFAULT_EDGE_VOICE, help="edge-tts Stimme")
    parser.add_argument("--rate", default=DEFAULT_RATE, help="edge-tts Tempo")
    parser.add_argument("--pitch", default=DEFAULT_PITCH, help="edge-tts Tonhöhe")
    parser.add_argument("--output", help="Ausgabe-MP3-Pfad (optional)")
    args = parser.parse_args()

    scene_path = pathlib.Path(args.script).resolve()
    if not scene_path.exists():
        print(f"Fehler: Datei nicht gefunden: {scene_path}", file=sys.stderr)
        sys.exit(1)

    output_path = (
        pathlib.Path(args.output) if args.output
        else OUTPUT_DIR / f"{scene_path.stem}_narration.mp3"
    )
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Backend bestimmen
    el_key = os.environ.get("ELEVENLABS_API_KEY", "")
    use_elevenlabs = (
        args.tts == "elevenlabs"
        or (args.tts is None and el_key and el_key != "your-elevenlabs-key-here")
    )

    print(f"Lade narration_script aus {scene_path.name}...")
    narration = load_narration_script(scene_path)
    print(f"{len(narration)} Segmente gefunden: {', '.join(narration.keys())}")

    if use_elevenlabs:
        voice_id = (
            args.voice_id
            or os.environ.get("ELEVENLABS_VOICE_ID", EL_DEFAULT_VOICE_ID)
        )
        print(f"Backend: ElevenLabs | Modell: {EL_MODEL} | Voice-ID: {voice_id}")
        durations = asyncio.run(
            synthesize_elevenlabs(narration, voice_id, el_key, output_path)
        )
    else:
        print(f"Backend: edge-tts | Stimme: {args.voice} | Rate: {args.rate} | Pitch: {args.pitch}")
        durations = asyncio.run(
            synthesize_edge(narration, args.voice, args.rate, args.pitch, output_path)
        )

    durations_path = output_path.parent / f"{scene_path.stem}_segment_durations.json"
    durations_path.write_text(
        json.dumps(durations, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    size_kb = output_path.stat().st_size // 1024
    print(f"\nNarration gespeichert: {output_path} ({size_kb} KB)")
    print("Segment-Dauern (Sekunden):")
    for key, dur in durations.items():
        print(f"  {key}: {dur:.1f}s")
    print(f"Segment-Dauern gespeichert: {durations_path}")
    print(output_path)


if __name__ == "__main__":
    main()
