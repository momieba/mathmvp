import '@testing-library/jest-dom/vitest' // matcher types (and registration where the instances agree)
import * as matchers from '@testing-library/jest-dom/matchers'

// Also extend the global `expect` (vitest `globals: true`). With only the import above the matchers
// are missing in this setup (`Invalid Chai property: toBeInTheDocument`, reproducible: 35 failing
// tests); there `expect` imported from 'vitest' is not the same object as `globalThis.expect`.
expect.extend(matchers)
