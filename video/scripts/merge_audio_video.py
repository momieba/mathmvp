"""
Kombiniert Manim-Video (MP4) und TTS-Narration (MP3) zu einem finalen Video.

Wenn individuelle Segment-MP3s vorliegen (_intro.mp3, _segment_1.mp3, ...),
werden diese mit berechneten Video-Timestamps per ffmpeg-adelay synchron
eingebettet — kein Drift, exakte Sync.

Usage:
    python scripts/merge_audio_video.py --topic "Bruchrechnung" --grade 6
    python scripts/merge_audio_video.py --video path/to/video.mp4 --audio path/to/narration.mp3 --output out.mp4
"""
import argparse
import pathlib
import re
import subprocess
import sys

SCRIPT_DIR = pathlib.Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
TEMP_DIR = PROJECT_ROOT / "output" / "temp"
VIDEOS_DIR = PROJECT_ROOT / "output" / "videos"

# Geschätzte Animationsdauer pro Manim-Methode (Sekunden)
_ANIM_DURATIONS = {
    "show_title": 3.0,
    "show_heading": 0.8,
    "clear_title": 0.5,
    "show_merke": 1.4,
    "show_value_table": 1.0,
    "animate_equation_steps": 6.4,
    "show_number_line": 1.2,
    "show_function_graph": 2.0,
    "show_fraction_bar": 1.2,
    "show_geometry_shape": 1.5,
    "show_example_box": 1.0,
    "show_formula": 1.5,
    "show_summary": 6.8,
    "show_steps": 2.0,
    "show_matplotlib_chart": 2.0,
    "fade_all": 0.5,
    "highlight": 1.1,
}

def get_segment_keys_from_scene(scene_path: pathlib.Path) -> list[str]:
    """Liest Segment-Keys in der richtigen Reihenfolge aus add_sound()-Aufrufen."""
    source = scene_path.read_text(encoding="utf-8")
    marker_re = re.compile(r"self\.add_sound\(.*?_([a-zA-Z0-9_]+)\.mp3")
    return [m.group(1) for m in marker_re.finditer(source)]


def safe_name(text: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_äöüÄÖÜß]", "_", text).strip("_")


def find_manim_output(topic: str, grade) -> pathlib.Path:
    scene_stem = f"{safe_name(topic)}_klasse{grade}"
    search_dirs = [
        TEMP_DIR / "videos" / scene_stem,
        TEMP_DIR / "videos",
        TEMP_DIR,
    ]
    candidates = []
    for d in search_dirs:
        if d.exists():
            candidates.extend(d.rglob("MainScene*.mp4"))
    if not candidates:
        raise FileNotFoundError(
            f"Keine Manim-MP4 für '{topic}' (Klasse {grade}) gefunden.\n"
            f"Gesucht in: {[str(d) for d in search_dirs]}\n"
            "Manim-Render zuerst ausführen."
        )
    return max(candidates, key=lambda p: p.stat().st_mtime)


def compute_timestamps_ms(scene_path: pathlib.Path) -> dict[str, int]:
    """
    Liest exakte Timestamps aus dem Render-Log ({stem}_timing.json).
    MathTutorScene.add_sound() schreibt self.renderer.time beim Rendern.
    Fallback: Schätzung aus Quellcode (ungenau, nur wenn kein Log vorhanden).
    """
    import json

    timing_log = scene_path.parent / f"{scene_path.stem}_timing.json"
    if timing_log.exists():
        data = json.loads(timing_log.read_text(encoding="utf-8"))
        if data:
            print("Timestamps aus Manim-Render geladen (exakt).")
            return {key: int(seconds * 1000) for key, seconds in data.items()}

    print("Warnung: Kein Render-Log — schätze Timestamps aus Quellcode.")
    source = scene_path.read_text(encoding="utf-8")
    marker_re = re.compile(r"self\.add_sound\(.*?_([a-zA-Z0-9_]+)\.mp3")
    wait_re = re.compile(r"\bself\.wait\(([\d.]+)\)")
    method_re = re.compile(
        r"\bself\.(show_\w+|animate_\w+|clear_title|fade_all|highlight)\s*\("
    )

    markers = list(marker_re.finditer(source))
    if not markers:
        return {}

    sections = []
    for i, m in enumerate(markers):
        key = m.group(1)
        start = m.end()
        end = markers[i + 1].start() if i + 1 < len(markers) else len(source)
        sections.append((key, source[start:end]))

    timestamps: dict[str, int] = {}
    cumulative = 0.0
    for key, seg_src in sections:
        timestamps[key] = int(cumulative * 1000)
        section_time = 0.0
        for line in seg_src.splitlines():
            stripped = line.strip()
            if stripped.startswith("#") or not stripped:
                continue
            wm = wait_re.search(line)
            if wm:
                section_time += float(wm.group(1))
                continue
            for mm in method_re.finditer(line):
                section_time += _ANIM_DURATIONS.get(mm.group(1), 0.5)
        cumulative += section_time

    return timestamps


def build_timed_audio(
    segment_files: list[pathlib.Path],
    timestamps_ms: list[int],
    output_path: pathlib.Path,
) -> None:
    """Baut eine einzige MP3 aus Einzel-Segmenten mit adelay-Offsets."""
    cmd = ["ffmpeg", "-y"]
    for f in segment_files:
        cmd += ["-i", str(f)]

    filter_parts = []
    for i, delay in enumerate(timestamps_ms):
        filter_parts.append(f"[{i}:a]adelay={delay}|{delay}[a{i}]")

    mix_inputs = "".join(f"[a{i}]" for i in range(len(segment_files)))
    filter_parts.append(
        f"{mix_inputs}amix=inputs={len(segment_files)}:duration=longest:normalize=0[audio]"
    )
    cmd += ["-filter_complex", ";".join(filter_parts)]
    cmd += ["-map", "[audio]", "-c:a", "mp3", "-b:a", "192k", str(output_path)]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg adelay fehlgeschlagen:\n{result.stderr}")


def merge(video_path: pathlib.Path, audio_path: pathlib.Path, output_path: pathlib.Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg", "-y",
        "-i", str(video_path),
        "-i", str(audio_path),
        "-map", "0:v",
        "-map", "1:a",
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "192k",
        str(output_path),
    ]
    print(f"Merge: {video_path.name} + {audio_path.name} → {output_path.name}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print("ffmpeg Fehler:", file=sys.stderr)
        print(result.stderr, file=sys.stderr)
        sys.exit(1)


def get_duration(video_path: pathlib.Path) -> str:
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(video_path)],
        capture_output=True, text=True,
    )
    if result.returncode == 0:
        try:
            secs = float(result.stdout.strip())
            mins, s = divmod(int(secs), 60)
            return f"{mins}:{s:02d}"
        except ValueError:
            pass
    return "unbekannt"


def merge_with_topic(topic: str, grade, audio_path_arg=None, output_path_arg=None):
    video_path = find_manim_output(topic, grade)
    stem = f"{safe_name(topic)}_klasse{grade}"
    output_name = f"{topic.replace(' ', '_')}_Klasse{grade}.mp4"
    output_path = pathlib.Path(output_path_arg) if output_path_arg else VIDEOS_DIR / output_name

    # Segment-Keys aus Scene-Datei lesen (beliebige Struktur)
    scene_path = TEMP_DIR / f"{stem}.py"
    segment_keys = get_segment_keys_from_scene(scene_path) if scene_path.exists() else []

    segment_files = []
    for key in segment_keys:
        f = TEMP_DIR / f"{stem}_{key}.mp3"
        if f.exists():
            segment_files.append(f)

    if segment_keys and len(segment_files) == len(segment_keys):
        # Timestamps aus Render-Log oder Quellcode-Schätzung
        scene_path = TEMP_DIR / f"{stem}.py"
        if scene_path.exists():
            ts = compute_timestamps_ms(scene_path)
            timestamps_ms = [ts.get(key, 0) for key in segment_keys]
            print("Segment-Timestamps (ms):", dict(zip(segment_keys, timestamps_ms)))
        else:
            timestamps_ms = [0] * len(segment_keys)

        timed_audio = TEMP_DIR / f"{stem}_timed_audio.mp3"
        print(f"Baue synchronisierte Audio-Spur mit adelay...")
        build_timed_audio(segment_files, timestamps_ms, timed_audio)
        merge(video_path, timed_audio, output_path)
    else:
        # Fallback: kombinierte Narration
        audio_path = (
            pathlib.Path(audio_path_arg) if audio_path_arg
            else TEMP_DIR / f"{stem}_narration.mp3"
        )
        if not audio_path.exists():
            print(f"Audio nicht gefunden: {audio_path}", file=sys.stderr)
            sys.exit(1)
        print("Warnung: Einzelne Segment-MP3s fehlen — nutze kombinierte Narration (Sync evtl. ungenau)")
        merge(video_path, audio_path, output_path)

    return output_path


def main():
    parser = argparse.ArgumentParser(description="Manim-Video + TTS-Audio zusammenführen")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--topic", help="Mathe-Thema")
    group.add_argument("--stem", help="Datei-Stem direkt (für create-math-video2, kein --grade nötig)")
    group.add_argument("--video", help="Expliziter Pfad zur MP4-Datei")

    parser.add_argument("--grade", help="Klassenstufe (bei --topic erforderlich)")
    parser.add_argument("--audio", help="Pfad zur MP3-Narration")
    parser.add_argument("--output", help="Ausgabe-MP4-Pfad (optional)")
    args = parser.parse_args()

    if args.topic:
        if not args.grade:
            print("--grade ist erforderlich wenn --topic angegeben wird", file=sys.stderr)
            sys.exit(1)
        output_path = merge_with_topic(args.topic, args.grade, args.audio, args.output)
    elif args.stem:
        stem = args.stem
        scene_path = TEMP_DIR / f"{stem}.py"
        output_path = pathlib.Path(args.output) if args.output else VIDEOS_DIR / f"{stem}.mp4"

        # Manim-Output finden: zuerst im themen-spezifischen Unterordner, dann rekursiv
        candidates = list((TEMP_DIR / "videos" / stem).rglob("MainScene*.mp4"))
        if not candidates:
            candidates = list(TEMP_DIR.rglob("MainScene*.mp4"))
        if not candidates:
            print(f"Fehler: Kein Manim-MP4 für Stem '{stem}' gefunden.", file=sys.stderr)
            sys.exit(1)
        video_path = max(candidates, key=lambda p: p.stat().st_mtime)

        segment_keys = get_segment_keys_from_scene(scene_path) if scene_path.exists() else []
        segment_files = []
        for key in segment_keys:
            f = TEMP_DIR / f"{stem}_{key}.mp3"
            if f.exists():
                segment_files.append(f)

        if segment_keys and len(segment_files) == len(segment_keys):
            ts = compute_timestamps_ms(scene_path)
            timestamps_ms = [ts.get(key, 0) for key in segment_keys]
            print("Segment-Timestamps (ms):", dict(zip(segment_keys, timestamps_ms)))
            timed_audio = TEMP_DIR / f"{stem}_timed_audio.mp3"
            print("Baue synchronisierte Audio-Spur mit adelay...")
            build_timed_audio(segment_files, timestamps_ms, timed_audio)
            merge(video_path, timed_audio, output_path)
        else:
            print(f"Warnung: Nur {len(segment_files)}/{len(segment_keys)} MP3s gefunden.", file=sys.stderr)
            sys.exit(1)
    else:
        video_path = pathlib.Path(args.video)
        if not args.audio:
            print("--audio ist erforderlich wenn --video angegeben wird", file=sys.stderr)
            sys.exit(1)
        audio_path = pathlib.Path(args.audio)
        output_path = pathlib.Path(args.output) if args.output else VIDEOS_DIR / "output.mp4"
        if not video_path.exists():
            print(f"Video nicht gefunden: {video_path}", file=sys.stderr)
            sys.exit(1)
        if not audio_path.exists():
            print(f"Audio nicht gefunden: {audio_path}", file=sys.stderr)
            sys.exit(1)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        merge(video_path, audio_path, output_path)

    duration = get_duration(output_path)
    size_mb = output_path.stat().st_size / (1024 * 1024)
    print(f"Fertig: {output_path}")
    print(f"Länge: {duration} | Größe: {size_mb:.1f} MB")
    print(output_path)


if __name__ == "__main__":
    main()
