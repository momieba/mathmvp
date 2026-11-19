import { Check, CircleQuestionMark, EyeOff, X } from 'lucide-react'

export type Status = 'correct' | 'wrong' | 'unclear' | 'unreadable'

export const statusConfig = {
  correct: { icon: Check, label: 'Stimmt', color: 'text-correct border-correct' },
  wrong: { icon: X, label: 'Nicht richtig', color: 'text-wrong border-wrong' },
  unclear: {
    icon: CircleQuestionMark,
    label: 'Nicht eindeutig',
    color: 'text-unclear border-unclear',
  },
  unreadable: { icon: EyeOff, label: 'Nicht lesbar', color: 'text-unreadable border-unreadable' },
} as const satisfies Record<Status, { icon: unknown; label: string; color: string }>
