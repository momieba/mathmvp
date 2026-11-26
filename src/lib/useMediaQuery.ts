import { useSyncExternalStore } from 'react'

/** Tailwind `lg` (correction margin beside the sheet). */
export const LG_QUERY = '(min-width: 64rem)'

/** Live `matchMedia` result; `false` on the server and where `matchMedia` is missing (tests). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {}
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => (typeof window !== 'undefined' && window.matchMedia?.(query).matches) || false,
    () => false,
  )
}
