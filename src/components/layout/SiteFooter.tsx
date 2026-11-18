import { Link } from 'react-router'

// Evaluated once per page load (not during render) – keeps render pure and hydration stable.
const year = new Date().getFullYear()

/** Footer with legal links – must be reachable from every page. */
export function SiteFooter() {
  return (
    <footer className="text-muted-foreground border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>© {year} Mathe-Training</p>
        <nav aria-label="Rechtliches" className="flex gap-6">
          <Link
            to="/impressum"
            className="hover:text-foreground underline-offset-4 hover:underline"
          >
            Impressum
          </Link>
          <Link
            to="/datenschutz"
            className="hover:text-foreground underline-offset-4 hover:underline"
          >
            Datenschutz
          </Link>
        </nav>
      </div>
    </footer>
  )
}
