import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  answerableTypes,
  EXERCISE_COLUMNS,
  gradingFallbackMessage,
  toPracticeExercise,
  type GradedStep,
  type HandwritingResult,
  type PracticeExercise,
  type SubmitResult,
  type UnreadableReason,
} from '../api'

export type ExamStart = {
  id: string
  exerciseIds: string[]
  deadlineAt: string
  serverNow: string
  answeredIds: string[]
}

export type ExamSessionSummary = {
  id: string
  startedAt: string
  deadlineAt: string
  submittedAt: string | null
  points: number | null
  maxPoints: number
}

export type ExamTaskResult = {
  exerciseId: string
  answered: boolean
  correct: boolean
  points: number
  answer: { value?: string; selected?: number[]; kind?: 'drawing' | 'photo' } | null
  feedback: {
    summary: string
    steps: GradedStep[]
    final: Extract<HandwritingResult, { status: 'graded' }>['final']
  } | null
  reference: SubmitResult['answer']
  solution: SubmitResult['solution']
}

export type ExamResult = {
  id: string
  topicId: string
  startedAt: string
  submittedAt: string
  points: number
  maxPoints: number
  tasks: ExamTaskResult[]
}

const keys = {
  history: (topicId: string) => ['exam-history', topicId] as const,
  result: (sessionId: string) => ['exam-result', sessionId] as const,
  exercises: (ids: readonly string[]) => ['exam-exercises', ...ids] as const,
}

/** Exams of a topic, newest first (open, expired and submitted). */
export function useExamHistory(topicId: string) {
  return useQuery({
    queryKey: keys.history(topicId),
    queryFn: async (): Promise<ExamSessionSummary[]> => {
      const { data, error } = await supabase
        .from('exam_sessions')
        .select('id, started_at, deadline_at, submitted_at, points, max_points')
        .eq('topic_id', topicId)
        .order('started_at', { ascending: false })
        .limit(10)
      if (error) throw error
      return data.map((s) => ({
        id: s.id,
        startedAt: s.started_at,
        deadlineAt: s.deadline_at,
        submittedAt: s.submitted_at,
        points: s.points,
        maxPoints: s.max_points,
      }))
    },
  })
}

/** Starts a new exam or resumes the open one of this topic. */
export function useStartExam() {
  return useMutation({
    mutationFn: async (topicId: string) => {
      const { data, error } = await supabase.rpc('start_exam', {
        p_topic_id: topicId,
        p_types: answerableTypes,
      })
      if (error) throw error
      return data as unknown as ExamStart
    },
  })
}

/** The exam's exercises in exam order. */
export function useExamExercises(ids: readonly string[] | undefined) {
  return useQuery({
    queryKey: keys.exercises(ids ?? []),
    enabled: !!ids && ids.length > 0,
    queryFn: async (): Promise<PracticeExercise[]> => {
      const { data, error } = await supabase
        .from('exercises')
        .select(EXERCISE_COLUMNS)
        .in('id', [...ids!])
      if (error) throw error
      const byId = new Map(data.map((e) => [e.id, toPracticeExercise(e)]))
      return ids!.flatMap((id) => byId.get(id) ?? [])
    },
  })
}

export async function submitExamAnswer(
  sessionId: string,
  exerciseId: string,
  answer: { value?: string; selected?: number[] },
) {
  const { error } = await supabase.rpc('submit_exam_answer', {
    p_session_id: sessionId,
    p_exercise_id: exerciseId,
    p_answer: answer,
  })
  if (error) throw error
}

export type ExamGradeResult =
  { status: 'saved' } | { status: 'unreadable'; reason: UnreadableReason }

/** Sends a handwritten exam answer; the server stores the grading but reveals nothing yet. */
export async function gradeExamHandwriting(args: {
  sessionId: string
  exerciseId: string
  image: string
  kind: 'drawing' | 'photo'
}): Promise<ExamGradeResult> {
  const { data, error } = await supabase.functions.invoke<ExamGradeResult>('grade-handwriting', {
    body: {
      exerciseId: args.exerciseId,
      image: args.image,
      kind: args.kind,
      examSessionId: args.sessionId,
    },
    timeout: 60_000,
  })
  if (error) {
    const ctx = (error as { context?: Response }).context
    const message = ctx
      ? ((await ctx.json().catch(() => null)) as { error?: string } | null)?.error
      : null
    throw new Error(message ?? gradingFallbackMessage)
  }
  return data!
}

/** Submits the exam (idempotent) and returns the result with solutions. */
export function useExamResult(sessionId: string, topicId?: string) {
  const qc = useQueryClient()
  return useQuery({
    queryKey: keys.result(sessionId),
    staleTime: Infinity,
    queryFn: async (): Promise<ExamResult> => {
      const { data, error } = await supabase.rpc('finish_exam', { p_session_id: sessionId })
      if (error) throw error
      if (topicId) void qc.invalidateQueries({ queryKey: keys.history(topicId) })
      return data as unknown as ExamResult
    },
  })
}
