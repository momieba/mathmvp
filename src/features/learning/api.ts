import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Difficulty, ExerciseType, LearningStage } from '@/features/content/enums'
import type { Diagram } from '@/features/exercises/schema'
import { supabase } from '@/lib/supabase'
import { computeScore } from './score'

export type SubtopicSummary = {
  id: string
  slug: string
  title: string
  stage: LearningStage
  sortOrder: number
}

export type MyTopic = {
  id: string
  slug: string
  title: string
  description: string
  addedAt: string
  subtopics: SubtopicSummary[]
}

export type SubtopicProgress = { score: number; attemptCount: number; recentExerciseIds: string[] }

/** Exercise as the student sees it (no answer/solution – those stay on the server). */
export type PracticeExercise = {
  id: string
  type: ExerciseType
  prompt: string
  diagram: Diagram | null
  presentation: { unit?: string; options?: string[]; multi?: boolean }
  difficulty: Difficulty
}

export type SubmitResult = {
  correct: boolean
  answer: {
    value?: number
    unit?: string
    tolerance?: number
    options?: string[]
    correct?: number[]
  }
  solution: { steps: { text: string; diagram?: Diagram }[]; result: string }
}

const keys = {
  myTopics: ['my-topics'] as const,
  progress: ['progress'] as const,
  search: (q: string) => ['topic-search', q] as const,
  subtopic: (slug: string) => ['subtopic', slug] as const,
  exercises: (subtopicId: string) => ['exercises', subtopicId] as const,
}

export function useMyTopics() {
  return useQuery({
    queryKey: keys.myTopics,
    queryFn: async (): Promise<MyTopic[]> => {
      const { data, error } = await supabase
        .from('student_topics')
        .select(
          'added_at, topics(id, slug, title, description, subtopics(id, slug, title, stage, sort_order))',
        )
        .order('added_at')
      if (error) throw error
      return data.flatMap((row) =>
        row.topics
          ? [
              {
                id: row.topics.id,
                slug: row.topics.slug,
                title: row.topics.title,
                description: row.topics.description,
                addedAt: row.added_at,
                subtopics: row.topics.subtopics
                  .map((s) => ({
                    id: s.id,
                    slug: s.slug,
                    title: s.title,
                    stage: s.stage,
                    sortOrder: s.sort_order,
                  }))
                  .sort((a, b) => a.sortOrder - b.sortOrder),
              },
            ]
          : [],
      )
    },
  })
}

/** Score per subtopic, computed from the last 15 attempts (view my_recent_attempts). */
export function useProgress() {
  return useQuery({
    queryKey: keys.progress,
    queryFn: async (): Promise<Map<string, SubtopicProgress>> => {
      const { data, error } = await supabase
        .from('my_recent_attempts')
        .select('subtopic_id, exercise_id, correct, created_at')
        .order('created_at', { ascending: true })
      if (error) throw error
      const bySubtopic = new Map<string, { correct: boolean; exerciseId: string }[]>()
      for (const a of data) {
        if (!a.subtopic_id || !a.exercise_id || a.correct === null) continue
        const list = bySubtopic.get(a.subtopic_id) ?? []
        list.push({ correct: a.correct, exerciseId: a.exercise_id })
        bySubtopic.set(a.subtopic_id, list)
      }
      return new Map(
        [...bySubtopic].map(([id, list]) => [
          id,
          {
            score: computeScore(list),
            attemptCount: list.length,
            recentExerciseIds: list.map((a) => a.exerciseId).reverse(),
          },
        ]),
      )
    },
  })
}

export function useTopicSearch(query: string) {
  const q = query.trim()
  return useQuery({
    queryKey: keys.search(q),
    enabled: q.length >= 2,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('search_topics', { p_query: q })
      if (error) throw error
      return data
    },
  })
}

export function useAddTopic() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (topicId: string) => {
      const { error } = await supabase.from('student_topics').insert({ topic_id: topicId })
      if (error && error.code !== '23505') throw error // already added → fine
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.myTopics }),
  })
}

export function useRemoveTopic() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (topicId: string) => {
      const { error } = await supabase.from('student_topics').delete().eq('topic_id', topicId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.myTopics }),
  })
}

export function useSubtopic(slug: string) {
  return useQuery({
    queryKey: keys.subtopic(slug),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subtopics')
        .select('id, slug, title, description, stage, learning_goals, topics(slug, title)')
        .eq('slug', slug)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

/** Published exercises of a subtopic that the practice page can show. */
export function usePracticeExercises(subtopicId: string | undefined) {
  return useQuery({
    queryKey: keys.exercises(subtopicId ?? ''),
    enabled: !!subtopicId,
    queryFn: async (): Promise<PracticeExercise[]> => {
      const { data, error } = await supabase
        .from('exercises')
        .select('id, type, prompt, diagram, presentation, exercise_placements(difficulty)')
        .eq('subtopic_id', subtopicId!)
        .eq('status', 'published')
        .in('type', ['numeric', 'multiple_choice', 'handwritten'])
      if (error) throw error
      return data.map((e) => ({
        id: e.id,
        type: e.type,
        prompt: e.prompt,
        diagram: (e.diagram as Diagram | null) ?? null,
        presentation: (e.presentation ?? {}) as PracticeExercise['presentation'],
        difficulty: e.exercise_placements[0]?.difficulty ?? 'mittel',
      }))
    },
  })
}

export function useSubmitAnswer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: {
      exerciseId: string
      answer: { value?: string; selected?: number[] }
    }) => {
      const { data, error } = await supabase.rpc('submit_answer', {
        p_exercise_id: args.exerciseId,
        p_answer: args.answer,
      })
      if (error) throw error
      return data as unknown as SubmitResult
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.progress }),
  })
}

export type HandwritingResult = SubmitResult & {
  readable: boolean
  summary: string
  errors: { step: string; explanation: string }[]
}

/** Sends the drawn solution to the grade-handwriting Edge Function (Gemini). */
export function useGradeHandwriting() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: { exerciseId: string; image: string }) => {
      const { data, error } = await supabase.functions.invoke<HandwritingResult>(
        'grade-handwriting',
        { body: { exerciseId: args.exerciseId, image: args.image } },
      )
      if (error) {
        // Edge Function errors carry a JSON body with a user-facing message.
        const ctx = (error as { context?: Response }).context
        const message = ctx ? ((await ctx.json().catch(() => null)) as { error?: string } | null)?.error : null
        throw new Error(message ?? error.message)
      }
      return data!
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.progress }),
  })
}

export async function fetchHint(exerciseId: string, index: number): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_hint', {
    p_exercise_id: exerciseId,
    p_index: index,
  })
  if (error) throw error
  return data
}
