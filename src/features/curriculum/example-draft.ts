import type { z } from 'zod'
import type { curriculumDraftSchema } from './schema'

/**
 * Reference example of a curriculum draft (input shape). Used in tests and referenced by
 * .claude/agents/curriculum-researcher.md as the target structure.
 */
export const exampleCurriculumDraft = {
  topics: [
    {
      slug: 'satz-des-pythagoras',
      title: 'Satz des Pythagoras',
      description: 'Seitenlängen in rechtwinkligen Dreiecken berechnen und anwenden.',
      subtopics: [
        {
          slug: 'pythagoras-begriffe',
          title: 'Katheten und Hypotenuse',
          description: 'Die Seiten im rechtwinkligen Dreieck benennen und den Satz formulieren.',
          stage: 'einstieg',
          learningGoals: [
            'Ich kann in einem rechtwinkligen Dreieck Katheten und Hypotenuse erkennen.',
            'Ich kann den Satz des Pythagoras in Worten und als Formel angeben.',
          ],
          prerequisites: ['rechtwinklige-dreiecke-erkennen'],
          placements: [
            {
              state: 'NW',
              schoolType: 'gymnasium',
              grade: 8,
              source: 'KLP Mathematik Gymnasium NRW (G9), Inhaltsfeld Geometrie, Kl. 7/8',
            },
          ],
          videos: [
            {
              format: 'explainer',
              title: 'Was sagt der Satz des Pythagoras?',
              keyPoints: [
                'Rechter Winkel, Katheten, Hypotenuse',
                'Quadrate über den Seiten',
                'a² + b² = c²',
              ],
            },
          ],
          exercisePlan: {
            targetCount: 20,
            types: ['multiple_choice', 'matching', 'true_false'],
            difficultyMix: { leicht: 60, mittel: 40 },
            variationIdeas: ['Dreiecke gedreht/gespiegelt', 'verschiedene Seitenbezeichnungen'],
          },
        },
        {
          slug: 'pythagoras-hypotenuse-berechnen',
          title: 'Hypotenuse berechnen',
          description: 'Die längste Seite aus den beiden Katheten berechnen.',
          stage: 'grundlagen',
          learningGoals: ['Ich kann die Hypotenuse aus zwei gegebenen Katheten berechnen.'],
          prerequisites: ['pythagoras-begriffe', 'quadratwurzel-ziehen'],
          placements: [
            {
              state: 'NW',
              schoolType: 'gymnasium',
              grade: 8,
              source: 'KLP Mathematik Gymnasium NRW (G9), Inhaltsfeld Geometrie, Kl. 7/8',
            },
          ],
          videos: [
            {
              format: 'explainer',
              title: 'Hypotenuse berechnen – Schritt für Schritt',
              keyPoints: ['Formel aufstellen', 'Einsetzen', 'Wurzel ziehen', 'Einheit angeben'],
            },
            {
              format: 'short',
              title: 'Hypotenuse in 30 Sekunden',
              keyPoints: ['Eine Aufgabe mit 6 und 8 cm'],
            },
          ],
          exercisePlan: {
            targetCount: 20,
            types: ['numeric'],
            difficultyMix: { leicht: 50, mittel: 35, schwer: 15 },
            variationIdeas: ['pythagoreische Tripel', 'Dezimalzahlen', 'verschiedene Einheiten'],
          },
        },
        {
          slug: 'pythagoras-textaufgaben',
          title: 'Textaufgaben zum Satz des Pythagoras',
          description: 'Rechtwinklige Dreiecke in Alltagssituationen finden und berechnen.',
          stage: 'anwendung',
          learningGoals: [
            'Ich kann in einer Sachsituation ein rechtwinkliges Dreieck erkennen und skizzieren.',
          ],
          prerequisites: ['pythagoras-hypotenuse-berechnen'],
          placements: [
            {
              state: 'NW',
              schoolType: 'gymnasium',
              grade: 8,
              source: 'KLP Mathematik Gymnasium NRW (G9), Inhaltsfeld Geometrie, Kl. 7/8',
            },
          ],
          videos: [
            {
              format: 'explainer',
              title: 'Textaufgaben mit Pythagoras lösen',
              keyPoints: ['Skizze', 'rechten Winkel finden', 'gesuchte Seite', 'Antwortsatz'],
            },
          ],
          exercisePlan: {
            targetCount: 20,
            types: ['numeric', 'handwritten'],
            difficultyMix: { mittel: 40, schwer: 40, sehr_schwer: 20 },
            variationIdeas: ['Leiter an Wand', 'Bildschirmdiagonale', 'Abkürzung über Wiese'],
          },
        },
      ],
    },
  ],
} satisfies z.input<typeof curriculumDraftSchema>
