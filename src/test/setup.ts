import '@testing-library/jest-dom/vitest' // matcher types (and registration where the instances agree)
import * as matchers from '@testing-library/jest-dom/matchers'

// Also extend the global `expect` (vitest `globals: true`): the `expect` imported inside jest-dom is a
// different instance than the one the tests use here, so the line above alone registered nothing.
expect.extend(matchers)
