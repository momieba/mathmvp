import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Options = Parameters<typeof buttonVariants>[0]

/** Button look for links (`<Link>`/`<a>`): same variants as `<Button>`, touch target ≥ 44 px. */
export function buttonClass(options?: Options, className?: string) {
  return cn(buttonVariants(options), 'min-h-11 min-w-11 px-4 text-base', className)
}
