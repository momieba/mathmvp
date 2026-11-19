import type { ReactNode } from 'react'
import { PageShell } from './PageShell'
import { PublicHeader } from './PublicHeader'

/** Full-page loading or error state (route guards): says what is happening or what to do next. */
export function StateScreen({
  kind,
  title,
  children,
}: {
  kind: 'loading' | 'error'
  title: string
  children?: ReactNode
}) {
  return (
    <PageShell header={<PublicHeader />} width="narrow">
      <div role={kind === 'error' ? 'alert' : 'status'}>
        <h1 className="text-h2">{title}</h1>
        {children && <p className="text-prose text-muted-foreground mt-2">{children}</p>}
      </div>
    </PageShell>
  )
}
