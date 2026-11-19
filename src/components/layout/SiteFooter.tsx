import { Link } from 'react-router'

// Evaluated once per page load (not during render) – keeps render pure and hydration stable.
const year = new Date().getFullYear()

const linkClass =
  'text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center underline underline-offset-4'

/** Footer with legal links – must be reachable from every page. */
export function SiteFooter() {
  return (
    <footer className="text-muted-foreground border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-fine">© {year} Mathe-Training</p>
        <nav aria-label="Rechtliches" className="text-fine flex gap-6">
          <Link to="/impressum" className={linkClass}>
            Impressum
          </Link>
          <Link to="/datenschutz" className={linkClass}>
            Datenschutz
          </Link>
        </nav>
      </div>
    </footer>
  )
}
