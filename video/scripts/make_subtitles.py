"""
Erzeugt SRT-Untertitel aus ElevenLabs-Alignment-JSONs + Segment-Offsets.

Usage:
    python scripts/make_subtitles.py \
        --stem Klammer_mal_Klammer \
        --dir output/temp/ \
        --output output/Klammer_mal_Klammer/Klammer_mal_Klammer.srt

Liest:
  {dir}/{stem}_segment_offsets.json   (von finish_sync() im Manim-Render geschrieben)
  {dir}/{stem}_{key}_alignment.json   (pro Segment, von TTS --with-timestamps)

Schreibt:
  {output}   (SRT-Datei)
"""
import argparse
import json
import re
import pathlib


def srt_time(seconds: float) -> str:
    ms = int(round(seconds * 1000))
    h = ms // 3_600_000; ms %= 3_600_000
    m = ms // 60_000;    ms %= 60_000
    s = ms // 1_000;     ms %= 1_000
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def split_sentences(chars: list[str], starts: list[float], ends: list[float]):
    """Teilt Zeichenkette an Satz-Grenzen in (text, start_s, end_s)-Tuple."""
    text = "".join(chars)
    sentences = []
    # Satzgrenzen: ". ", "! ", "? ", "... "
    # Wir suchen nach Stellen wo ein Satz endet
    i = 0
    seg_start_idx = 0
    while i < len(text):
        # Dreipunkte erkennen
        if text[i:i+3] == "...":
            end_idx = i + 2
            sentences.append((text[seg_start_idx:end_idx+1].strip(),
                               starts[seg_start_idx] if seg_start_idx < len(starts) else 0,
                               ends[end_idx] if end_idx < len(ends) else ends[-1] if ends else 0))
            i += 3
            while i < len(text) and text[i] == " ":
                i += 1
            seg_start_idx = i
        elif text[i] in ".!?" and (i + 1 >= len(text) or text[i+1] == " "):
            end_idx = i
            sentences.append((text[seg_start_idx:end_idx+1].strip(),
                               starts[seg_start_idx] if seg_start_idx < len(starts) else 0,
                               ends[end_idx] if end_idx < len(ends) else ends[-1] if ends else 0))
            i += 1
            while i < len(text) and text[i] == " ":
                i += 1
            seg_start_idx = i
        else:
            i += 1
    # Rest
    if seg_start_idx < len(text):
        rest = text[seg_start_idx:].strip()
        if rest:
            sentences.append((rest,
                               starts[seg_start_idx] if seg_start_idx < len(starts) else 0,
                               ends[-1] if ends else 0))
    return sentences


def split_long(text: str, limit: int = 84) -> list[str]:
    """Teilt Texte > limit Zeichen an Kommas."""
    if len(text) <= limit:
        return [text]
    # Splitte an Komma in der Mitte
    mid = len(text) // 2
    best = -1
    for i in range(mid, -1, -1):
        if text[i] == ",":
            best = i; break
    if best < 0:
        for i in range(mid, len(text)):
            if text[i] == ",":
                best = i; break
    if best >= 0:
        return [text[:best+1].strip(), text[best+1:].strip()]
    return [text]


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--stem", required=True)
    p.add_argument("--dir", required=True)
    p.add_argument("--output", required=True)
    a = p.parse_args()
    d = pathlib.Path(a.dir)

    offsets_path = d / f"{a.stem}_segment_offsets.json"
    if not offsets_path.exists():
        print(f"FEHLER: {offsets_path} fehlt — finish_sync() im Manim-Render vergessen?")
        raise SystemExit(1)

    offsets: dict[str, float] = json.loads(offsets_path.read_text(encoding="utf-8"))

    srt_blocks: list[str] = []
    idx = 1

    for key in sorted(offsets.keys(), key=lambda k: offsets[k]):
        offset = offsets[key]
        al_path = d / f"{a.stem}_{key}_alignment.json"
        if not al_path.exists():
            print(f"WARNUNG: {al_path} fehlt — Segment '{key}' wird übersprungen")
            continue

        al = json.loads(al_path.read_text(encoding="utf-8"))
        chars  = al.get("characters", [])
        starts = al.get("character_start_times_seconds", [])
        ends   = al.get("character_end_times_seconds", [])

        if not chars:
            continue

        for text, t_start, t_end in split_sentences(chars, starts, ends):
            if not text.strip():
                continue
            for line in split_long(text):
                if not line.strip():
                    continue
                abs_start = offset + t_start
                abs_end   = offset + t_end + 0.05
                srt_blocks.append(
                    f"{idx}\n{srt_time(abs_start)} --> {srt_time(abs_end)}\n{line}\n"
                )
                idx += 1

    out = pathlib.Path(a.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(srt_blocks), encoding="utf-8")
    print(f"OK — {idx-1} Untertitel-Blöcke in {out}")


if __name__ == "__main__":
    main()
