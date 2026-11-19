import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { App } from '@/app/App'
import { initTheme } from '@/lib/theme'
import './index.css'

initTheme()

const container = document.getElementById('root')!
const app = (
  <StrictMode>
    <App />
  </StrictMode>
)

// "/" is prerendered at build time (scripts/prerender.ts) → hydrate; all other routes start empty.
if (container.hasChildNodes()) hydrateRoot(container, app)
else createRoot(container).render(app)
