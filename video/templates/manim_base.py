"""
Basisklasse für alle Mathe-Nachhilfe-Videos.
Definiert Farben, Schriftgrößen und Helfer-Methoden.
"""
import json as _json
import pathlib as _pathlib
import textwrap

from manim import *

# Farbpalette (Dark Theme)
BACKGROUND = "#1E1E2E"   # Dunkler Hintergrund
PRIMARY = "#6CB4EE"      # Hellblau (Titel, Hauptelemente)
SECONDARY = "#FFB74D"    # Amber (Hervorhebungen, Beispiele)
SUCCESS = "#81C784"      # Hellgrün (korrekte Antworten, Lösungen)
NEUTRAL = "#E8E8E8"      # Helles Grau (Textkörper, gut lesbar auf dunklem Hintergrund)
LIGHT_BG = "#34344A"     # Hintergrundakzent (z.B. leere Diagramm-Segmente)

# Schriftgrößen nach Klasse
FONT_SIZES = {
    "title": 44,
    "subtitle": 32,
    "heading": 28,
    "body": 24,
    "small": 20,
    "math_large": 48,
    "math_medium": 36,
    "math_small": 28,
}

TRANSITION_TIME = 0.5
WAIT_SHORT = 1.0
WAIT_MEDIUM = 2.0
WAIT_LONG = 3.0


class MathTutorScene(Scene):
    """
    Basisklasse für alle Mathe-Erklärvideo-Szenen.
    Subklassen müssen `construct` überschreiben und `narration_script` definieren.
    """

    # Jede Subklasse definiert das Narrations-Dict:
    # narration_script = {
    #     "intro": "Hallo! Heute lernen wir...",
    #     "segment_1": "Zuerst schauen wir uns an...",
    # }
    narration_script: dict = {}

    def setup(self):
        self.camera.background_color = BACKGROUND

    def add_sound(self, sound_file: str, time_offset: float = 0, gain=None, **kwargs):
        """Überschreibt add_sound, um exakte Render-Timestamps in JSON zu loggen."""
        try:
            p = _pathlib.Path(sound_file)
            # Finde passende .py-Datei anhand des längsten Präfix-Matches
            scene_stem = None
            scene_files = sorted(p.parent.glob("*.py"), key=lambda x: len(x.stem), reverse=True)
            for sf in scene_files:
                if p.stem.startswith(sf.stem + "_"):
                    scene_stem = sf.stem
                    break
            if scene_stem:
                key = p.stem[len(scene_stem) + 1:]
                log_path = p.parent / f"{scene_stem}_timing.json"
                data = _json.loads(log_path.read_text(encoding="utf-8")) if log_path.exists() else {}
                data[key] = round(self.renderer.time, 4)
                log_path.write_text(_json.dumps(data, indent=2), encoding="utf-8")
        except Exception:
            pass
        super().add_sound(sound_file, time_offset=time_offset, gain=gain, **kwargs)

    # ── Titel ──────────────────────────────────────────────────────────────

    def show_title(self, title: str, subtitle: str = "", color=PRIMARY) -> VGroup:
        t = Text(title, font_size=FONT_SIZES["title"], color=color, weight=BOLD)
        group = VGroup(t)
        if subtitle:
            s = Text(subtitle, font_size=FONT_SIZES["subtitle"], color=NEUTRAL)
            s.next_to(t, DOWN, buff=0.3)
            group.add(s)
        group.move_to(ORIGIN)
        self.play(Write(t), run_time=1.2)
        if subtitle:
            self.play(FadeIn(group[1], shift=UP * 0.2), run_time=0.8)
        self.wait(WAIT_SHORT)
        return group

    def clear_title(self, title_group: VGroup):
        self.play(FadeOut(title_group), run_time=TRANSITION_TIME)

    # ── Abschnitts-Überschrift ─────────────────────────────────────────────

    def show_heading(self, text: str, position=UP * 3.2) -> Text:
        h = Text(text, font_size=FONT_SIZES["heading"], color=PRIMARY, weight=BOLD)
        h.move_to(position)
        underline = Line(
            h.get_left(), h.get_right(),
            color=SECONDARY, stroke_width=3
        ).next_to(h, DOWN, buff=0.1)
        self.play(Write(h), Create(underline), run_time=0.8)
        return VGroup(h, underline)

    # ── Untertitel ────────────────────────────────────────────────────────

    def show_caption(self, text: str, max_chars_per_line: int = 46) -> VGroup:
        """
        Zeigt den gesprochenen Text als Untertitel am unteren Bildrand, damit
        Schüler mitlesen können — wichtig, wenn die Narration schnell vorliest.
        Reservierter Bereich: y <= -2.2. Andere Elemente in derselben Szene
        sollten oberhalb davon bleiben, um Überlappung zu vermeiden.
        """
        wrapped = "\n".join(textwrap.wrap(text, max_chars_per_line))
        caption = Text(
            wrapped, font_size=FONT_SIZES["small"], color=NEUTRAL, line_spacing=1.3
        )
        if caption.width > 11.5:
            caption.scale_to_fit_width(11.5)
        bg = RoundedRectangle(
            corner_radius=0.15,
            width=caption.width + 0.7, height=caption.height + 0.5,
            color=LIGHT_BG, fill_color="#000000", fill_opacity=0.55, stroke_width=1,
        )
        bg.move_to(caption.get_center())
        group = VGroup(bg, caption)
        group.move_to(DOWN * 3.3)
        self.play(FadeIn(group), run_time=0.4)
        return group

    # ── Mathematische Formel ───────────────────────────────────────────────

    def show_formula(self, tex_str: str, label: str = "", scale: float = 1.0, position=ORIGIN) -> VGroup:
        formula = MathTex(tex_str, font_size=FONT_SIZES["math_large"] * scale, color=NEUTRAL)
        group = VGroup(formula)
        if label:
            lbl = Text(label, font_size=FONT_SIZES["small"], color=NEUTRAL)
            lbl.next_to(formula, UP, buff=0.3)
            group.add(lbl)
        group.move_to(position)
        self.play(Write(formula), run_time=1.5)
        if label:
            self.play(FadeIn(lbl), run_time=0.5)
        return group

    # ── Bruch-Diagramm (Balken) ──────────────────────────────────────────────

    def show_fraction_bar(
        self, numerator: int, denominator: int, label: str = "",
        position=ORIGIN, bar_width: float = 6.0, bar_height: float = 1.3,
    ) -> VGroup:
        """
        Zeichnet einen Balken mit `denominator` gleich großen Feldern,
        von denen `numerator` Felder gefüllt sind — visualisiert einen Bruch.
        """
        seg_width = bar_width / denominator
        segments = VGroup()
        for i in range(denominator):
            filled = i < numerator
            seg = Rectangle(
                width=seg_width, height=bar_height,
                stroke_color=PRIMARY, stroke_width=2,
                fill_color=SECONDARY if filled else LIGHT_BG,
                fill_opacity=0.9 if filled else 0.4,
            )
            seg.move_to(LEFT * (bar_width / 2) + RIGHT * seg_width * (i + 0.5))
            segments.add(seg)
        segments.move_to(position)

        self.play(*[Create(seg) for seg in segments], run_time=1.2)

        group = VGroup(segments)
        if label:
            lbl = Text(label, font_size=FONT_SIZES["small"], color=NEUTRAL)
            lbl.next_to(segments, DOWN, buff=0.3)
            self.play(FadeIn(lbl), run_time=0.5)
            group.add(lbl)
        return group

    # ── Beispiel-Box ──────────────────────────────────────────────────────

    def show_example_box(self, title: str, content: str, position=ORIGIN) -> VGroup:
        box = RoundedRectangle(
            corner_radius=0.2,
            width=9, height=2.5,
            color=SECONDARY, fill_color=SECONDARY,
            fill_opacity=0.08, stroke_width=2
        ).move_to(position)
        label = Text(f"Beispiel: {title}", font_size=FONT_SIZES["small"],
                     color=SECONDARY, weight=BOLD)
        label.move_to(box.get_top() + DOWN * 0.4)
        body = Text(content, font_size=FONT_SIZES["body"], color=NEUTRAL)
        body.move_to(box.get_center() + DOWN * 0.2)
        group = VGroup(box, label, body)
        self.play(
            Create(box, run_time=0.6),
            Write(label, run_time=0.6),
            Write(body, run_time=0.8),
        )
        return group

    # ── Schritt-für-Schritt ────────────────────────────────────────────────

    def show_steps(self, steps: list[tuple[str, str]], start_pos=LEFT * 3 + UP * 1.5) -> VGroup:
        """
        steps: Liste von (Label, Formel-String)
        Zeigt Schritte animiert untereinander.
        """
        group = VGroup()
        current_pos = start_pos
        for i, (label, formula) in enumerate(steps):
            num = Text(f"{i+1}.", font_size=FONT_SIZES["body"], color=SECONDARY, weight=BOLD)
            num.move_to(current_pos)
            lbl = Text(label, font_size=FONT_SIZES["body"], color=NEUTRAL)
            lbl.next_to(num, RIGHT, buff=0.2)
            row = VGroup(num, lbl)
            if formula:
                f = MathTex(formula, font_size=FONT_SIZES["math_small"], color=PRIMARY)
                f.next_to(row, RIGHT, buff=0.4)
                row.add(f)
            self.play(FadeIn(row, shift=RIGHT * 0.3), run_time=0.6)
            self.wait(WAIT_SHORT)
            group.add(row)
            current_pos += DOWN * 0.9
        return group

    # ── Highlight ─────────────────────────────────────────────────────────

    def highlight(self, mobject: Mobject, color=SECONDARY):
        self.play(
            mobject.animate.set_color(color).scale(1.15),
            run_time=0.4
        )
        self.wait(0.3)
        self.play(
            mobject.animate.set_color(NEUTRAL).scale(1 / 1.15),
            run_time=0.4
        )

    def highlight_pulse(self, *mobjects: Mobject, color=SECONDARY, scale_factor: float = 1.35) -> None:
        """Lässt ein oder mehrere Elemente kurz aufleuchten (Indicate).
        Overhead: 0.8s. Einsatz: wenn die Narration ein konkretes Element benennt."""
        self.play(
            *[Indicate(m, color=color, scale_factor=scale_factor) for m in mobjects],
            run_time=0.8,
        )

    # ── Abschluss ─────────────────────────────────────────────────────────

    def show_summary(self, points: list[str]):
        heading = self.show_heading("Zusammenfassung", position=UP * 3.0)
        self.wait(WAIT_SHORT)
        dots = VGroup()
        for i, point in enumerate(points):
            checkmark = Text("✓", font_size=FONT_SIZES["body"], color=SUCCESS)
            text = Text(point, font_size=FONT_SIZES["body"], color=NEUTRAL)
            checkmark.move_to(LEFT * 5 + UP * (1.2 - i * 0.9))
            text.next_to(checkmark, RIGHT, buff=0.3)
            row = VGroup(checkmark, text)
            self.play(FadeIn(row, shift=RIGHT * 0.2), run_time=0.5)
            dots.add(row)
        # Kein FadeOut hier — wait() im construct() hält die Zusammenfassung
        # sichtbar bis die Narration endet. Overhead: 0.8 + 1.0 + N×0.5s

    def fade_all(self):
        self.play(*[FadeOut(mob) for mob in self.mobjects], run_time=TRANSITION_TIME)

    # ── Gleichungsschritte animiert (TransformMatchingTex) ─────────────────

    def animate_equation_steps(
        self, steps: list[tuple[str, str]], position=ORIGIN
    ) -> MathTex:
        """
        Morpht eine Gleichung animiert Schritt für Schritt in die nächste.

        steps: [(latex_str, beschreibung), ...]
          - latex_str: LaTeX-String der Gleichung
          - beschreibung: Text der kurz unter der Gleichung erscheint (leer = kein Text)

        Wichtig: Damit TransformMatchingTex korrekt matched, müssen gemeinsame
        Terme in allen Schritten IDENTISCH geschrieben sein (gleiche Zeichen,
        gleiche Klammern, kein Whitespace-Unterschied).
        """
        current = MathTex(steps[0][0], font_size=FONT_SIZES["math_large"], color=NEUTRAL)
        current.move_to(position)
        self.play(Write(current), run_time=1.0)

        for eq_str, desc in steps[1:]:
            next_eq = MathTex(eq_str, font_size=FONT_SIZES["math_large"], color=NEUTRAL)
            next_eq.move_to(position)
            if desc:
                desc_mob = Text(desc, font_size=FONT_SIZES["small"], color=SECONDARY)
                desc_mob.next_to(current, DOWN, buff=0.5)
                self.play(FadeIn(desc_mob, shift=UP * 0.2), run_time=0.4)
                self.wait(0.8)
                self.play(
                    TransformMatchingTex(current, next_eq),
                    FadeOut(desc_mob),
                    run_time=1.0,
                )
            else:
                self.play(TransformMatchingTex(current, next_eq), run_time=1.0)
            current = next_eq
            self.wait(0.5)
        return current

    # ── Zahlenstrahl ───────────────────────────────────────────────────────

    def show_number_line(
        self,
        x_range: tuple,
        labels: list[tuple] = None,
        highlight: list = None,
        position=ORIGIN,
    ) -> VGroup:
        """
        Zeichnet einen beschrifteten Zahlenstrahl.

        x_range: (start, end, step) — z.B. (-5, 5, 1)
        labels:  [(wert, tex_string), ...] — zusätzliche Beschriftungen
        highlight: [wert, ...] — Punkte die als Dot hervorgehoben werden
        """
        nl = NumberLine(
            x_range=x_range,
            length=10,
            color=NEUTRAL,
            include_numbers=True,
            include_tip=True,
            tip_width=0.2,
            tip_height=0.2,
            numbers_with_elongated_ticks=list(range(int(x_range[0]), int(x_range[1]) + 1)),
        )
        nl.move_to(position)
        self.play(Create(nl), run_time=1.2)
        group = VGroup(nl)

        if labels:
            for val, tex in labels:
                lbl = MathTex(tex, font_size=FONT_SIZES["small"], color=SECONDARY)
                lbl.next_to(nl.number_to_point(val), UP, buff=0.3)
                self.play(FadeIn(lbl), run_time=0.3)
                group.add(lbl)

        if highlight:
            for val in highlight:
                dot = Dot(nl.number_to_point(val), color=SECONDARY, radius=0.13)
                self.play(GrowFromCenter(dot), run_time=0.4)
                group.add(dot)

        return group

    # ── Funktionsgraph ─────────────────────────────────────────────────────

    def show_function_graph(
        self,
        func,
        x_range: tuple,
        y_range: tuple,
        label: str = "",
        color=PRIMARY,
        position=ORIGIN,
    ) -> VGroup:
        """
        Zeichnet ein Koordinatensystem mit einem Funktionsgraph.

        func: Python-Funktion (lambda x: ...)
        x_range / y_range: (min, max, step)
        label: LaTeX-String für die Funktionsbezeichnung (z.B. r"f(x) = 2x + 1")
        """
        axes = Axes(
            x_range=x_range,
            y_range=y_range,
            x_length=8,
            y_length=5,
            axis_config={
                "color": NEUTRAL,
                "include_tip": True,
                "tip_width": 0.2,
                "tip_height": 0.2,
                "stroke_width": 2,
            },
            x_axis_config={"numbers_to_include": range(int(x_range[0]), int(x_range[1]) + 1, max(1, int(x_range[2])))},
            y_axis_config={"numbers_to_include": range(int(y_range[0]), int(y_range[1]) + 1, max(1, int(y_range[2])))},
        )
        axes.move_to(position)
        self.play(Create(axes), run_time=1.0)

        graph = axes.plot(func, color=color, stroke_width=3)
        self.play(Create(graph), run_time=1.5)

        group = VGroup(axes, graph)
        if label:
            lbl = MathTex(label, font_size=FONT_SIZES["small"], color=color)
            lbl.next_to(graph.get_end(), RIGHT, buff=0.25)
            if lbl.get_right()[0] > 6.5:
                lbl.next_to(graph.get_end(), LEFT, buff=0.25)
            self.play(Write(lbl), run_time=0.5)
            group.add(lbl)
        return group

    # ── Merke-Box ─────────────────────────────────────────────────────────

    def show_merke(self, text: str, position=None) -> VGroup:
        """
        Zeigt eine deutlich abgesetzte 'Merke:'-Box für Kernregeln.
        Grüner Rahmen, dunkel-grüner Hintergrund.
        """
        MERKE_BG = "#1A3A2A"

        header = Text("Merke:", font_size=FONT_SIZES["body"], color=SUCCESS, weight=BOLD)
        content = Text(text, font_size=FONT_SIZES["body"], color=NEUTRAL, line_spacing=1.3)
        if content.width > 9.0:
            content.scale_to_fit_width(9.0)

        inner = VGroup(header, content)
        inner.arrange(DOWN, buff=0.25, aligned_edge=LEFT)

        box = RoundedRectangle(
            corner_radius=0.2,
            width=inner.width + 0.9,
            height=inner.height + 0.7,
            color=SUCCESS,
            fill_color=MERKE_BG,
            fill_opacity=1.0,
            stroke_width=3,
        )
        box.move_to(inner.get_center())
        group = VGroup(box, inner)

        if position is not None:
            group.move_to(position)

        self.play(FadeIn(box, scale=0.95), Write(header), run_time=0.6)
        self.play(FadeIn(content, shift=UP * 0.1), run_time=0.8)
        return group

    # ── Geometrie-Figuren ──────────────────────────────────────────────────

    def show_geometry_shape(
        self,
        shape: str,
        labels: dict = None,
        color=PRIMARY,
        position=ORIGIN,
        **kwargs,
    ) -> VGroup:
        """
        Erzeugt eine beschriftete Geometriefigur.

        shape:  "right_triangle" | "triangle" | "rectangle" | "circle" | "square"
        labels: Seitenbezeichnungen als Dict, z.B.:
                right_triangle: {"a": "5", "b": "3", "c": "?", "angle": "90°"}
                rectangle:      {"w": "6 cm", "h": "4 cm"}
                circle:         {"r": "3 cm"}
        kwargs: width, height (für Dreiecke/Rechtecke), radius (für Kreis),
                side_length (für Quadrat)
        """
        group = VGroup()
        labels = labels or {}

        if shape == "right_triangle":
            w = kwargs.get("width", 4.0)
            h = kwargs.get("height", 3.0)
            A = LEFT * w / 2 + DOWN * h / 2  # rechter Winkel
            B = RIGHT * w / 2 + DOWN * h / 2
            C = LEFT * w / 2 + UP * h / 2
            mob = Polygon(A, B, C, color=color, stroke_width=3, fill_opacity=0)
            mob.move_to(position - mob.get_center())
            self.play(Create(mob), run_time=1.0)
            group.add(mob)

            # 90°-Marker
            corner_sq = Square(side_length=0.25, color=color, fill_opacity=0, stroke_width=2)
            corner_sq.move_to(mob.get_vertices()[0] + RIGHT * 0.125 + UP * 0.125)
            self.play(Create(corner_sq), run_time=0.3)
            group.add(corner_sq)

            # Labels
            verts = mob.get_vertices()
            if "a" in labels:  # untere Kathete
                lbl = MathTex(labels["a"], font_size=FONT_SIZES["small"], color=NEUTRAL)
                lbl.move_to((verts[0] + verts[1]) / 2 + DOWN * 0.35)
                self.play(FadeIn(lbl), run_time=0.3)
                group.add(lbl)
            if "b" in labels:  # linke Kathete
                lbl = MathTex(labels["b"], font_size=FONT_SIZES["small"], color=NEUTRAL)
                lbl.move_to((verts[0] + verts[2]) / 2 + LEFT * 0.45)
                self.play(FadeIn(lbl), run_time=0.3)
                group.add(lbl)
            if "c" in labels:  # Hypotenuse
                lbl = MathTex(labels["c"], font_size=FONT_SIZES["small"], color=SECONDARY)
                lbl.move_to((verts[1] + verts[2]) / 2 + RIGHT * 0.45)
                self.play(FadeIn(lbl), run_time=0.3)
                group.add(lbl)

        elif shape == "rectangle":
            w = kwargs.get("width", 5.0)
            h = kwargs.get("height", 2.5)
            mob = Rectangle(width=w, height=h, color=color, stroke_width=3, fill_opacity=0)
            mob.move_to(position)
            self.play(Create(mob), run_time=1.0)
            group.add(mob)
            if "w" in labels:
                lbl = MathTex(labels["w"], font_size=FONT_SIZES["small"], color=NEUTRAL)
                lbl.next_to(mob, DOWN, buff=0.3)
                self.play(FadeIn(lbl), run_time=0.3)
                group.add(lbl)
            if "h" in labels:
                lbl = MathTex(labels["h"], font_size=FONT_SIZES["small"], color=NEUTRAL)
                lbl.next_to(mob, RIGHT, buff=0.3)
                self.play(FadeIn(lbl), run_time=0.3)
                group.add(lbl)

        elif shape == "square":
            s = kwargs.get("side_length", 3.0)
            mob = Square(side_length=s, color=color, stroke_width=3, fill_opacity=0)
            mob.move_to(position)
            self.play(Create(mob), run_time=1.0)
            group.add(mob)
            if "a" in labels:
                lbl = MathTex(labels["a"], font_size=FONT_SIZES["small"], color=NEUTRAL)
                lbl.next_to(mob, DOWN, buff=0.3)
                self.play(FadeIn(lbl), run_time=0.3)
                group.add(lbl)

        elif shape == "circle":
            r = kwargs.get("radius", 2.0)
            mob = Circle(radius=r, color=color, stroke_width=3, fill_opacity=0)
            mob.move_to(position)
            self.play(Create(mob), run_time=1.0)
            group.add(mob)
            if "r" in labels:
                center = mob.get_center()
                right_pt = center + RIGHT * r
                radius_line = Line(center, right_pt, color=SECONDARY, stroke_width=2)
                self.play(Create(radius_line), run_time=0.4)
                group.add(radius_line)
                lbl = MathTex("r = " + labels["r"], font_size=FONT_SIZES["small"], color=NEUTRAL)
                lbl.next_to(radius_line, UP, buff=0.15)
                self.play(FadeIn(lbl), run_time=0.3)
                group.add(lbl)

        elif shape == "triangle":
            s = kwargs.get("side_length", 3.5)
            mob = RegularPolygon(n=3, color=color, stroke_width=3, fill_opacity=0)
            mob.scale(s / 2)
            mob.move_to(position)
            self.play(Create(mob), run_time=1.0)
            group.add(mob)

        return group

    # ── Wertetabelle ───────────────────────────────────────────────────────

    def show_value_table(
        self,
        headers: list[str],
        rows: list[list],
        position=ORIGIN,
    ) -> VGroup:
        """
        Baut eine Wertetabelle animiert auf (Kopfzeile + Zeilen einzeln).

        headers: ["x", "y"] oder ["x", "f(x)", "g(x)"]
        rows:    [["1", "3"], ["2", "5"], ...]  (alle Werte als Strings oder LaTeX)
        """
        col_width = max(1.6, 8.0 / max(len(headers), 1))
        row_height = 0.65
        n_cols = len(headers)
        n_rows = len(rows)

        def make_cell(text, is_header=False, col=0, row=0):
            bg_color = PRIMARY if is_header else LIGHT_BG
            opacity = 0.2 if is_header else 0.5
            border_color = PRIMARY if is_header else NEUTRAL
            cell_bg = Rectangle(
                width=col_width, height=row_height,
                fill_color=bg_color, fill_opacity=opacity,
                stroke_color=border_color, stroke_width=2 if is_header else 1,
            )
            try:
                lbl = MathTex(str(text), font_size=FONT_SIZES["small"],
                               color=PRIMARY if is_header else NEUTRAL,
                               substrings_to_isolate=[])
                if is_header:
                    lbl.set_weight(BOLD)
            except Exception:
                lbl = Text(str(text), font_size=FONT_SIZES["small"],
                            color=PRIMARY if is_header else NEUTRAL)
            lbl.move_to(cell_bg.get_center())
            return VGroup(cell_bg, lbl)

        all_cells = VGroup()
        total_w = col_width * n_cols
        total_h = row_height * (n_rows + 1)
        origin = position + UP * total_h / 2 - UP * row_height / 2

        # Kopfzeile
        header_row = VGroup()
        for j, h in enumerate(headers):
            cell = make_cell(h, is_header=True)
            cell.move_to(origin + RIGHT * (j - n_cols / 2 + 0.5) * col_width)
            header_row.add(cell)
        self.play(Create(header_row), run_time=0.6)
        all_cells.add(header_row)

        # Datenzeilen
        for i, row in enumerate(rows):
            row_group = VGroup()
            y_pos = origin + DOWN * (i + 1) * row_height
            for j, val in enumerate(row):
                cell = make_cell(val, is_header=False)
                cell.move_to(RIGHT * (j - n_cols / 2 + 0.5) * col_width + y_pos)
                row_group.add(cell)
            self.play(FadeIn(row_group, shift=RIGHT * 0.15), run_time=0.35)
            all_cells.add(row_group)

        return all_cells

    # ── matplotlib-Chart als ImageMobject ──────────────────────────────────

    def show_matplotlib_chart(
        self, fig, position=ORIGIN, scale: float = 1.0
    ) -> "ImageMobject":
        """
        Rendert eine matplotlib-Figure zu PNG (Dark-Theme, dpi=150) und zeigt
        sie als ImageMobject in der Szene.

        Beispiel im generierten Scene-Code:
            import matplotlib.pyplot as plt
            fig, ax = plt.subplots(figsize=(6, 4))
            fig.patch.set_facecolor('#1E1E2E')
            ax.set_facecolor('#1E1E2E')
            ax.bar(['A', 'B', 'C'], [3, 7, 5], color='#FFB74D')
            ax.tick_params(colors='#E8E8E8')
            ax.spines['bottom'].set_color('#E8E8E8')
            ax.spines['left'].set_color('#E8E8E8')
            chart = self.show_matplotlib_chart(fig, position=UP*0.5)
            plt.close(fig)
        """
        import io
        import numpy as np
        from PIL import Image as PILImage

        buf = io.BytesIO()
        fig.savefig(buf, format="png", dpi=150, bbox_inches="tight",
                    facecolor="#1E1E2E", transparent=False)
        buf.seek(0)
        img_array = np.array(PILImage.open(buf))
        img_mob = ImageMobject(img_array).scale(scale).move_to(position)
        self.play(FadeIn(img_mob), run_time=0.6)
        return img_mob
