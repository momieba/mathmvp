/**
 * Handwriting grading: calculation tasks (`numeric`, `handwritten`) are solved on the drawing
 * surface and graded step by step by the `grade-handwriting` Edge Function (no result field).
 * Off: `numeric` keeps its input field, `handwritten` tasks are hidden. Same pattern as `AUTH_ENABLED`.
 * Note: `submit_answer` still accepts `numeric` – the server-side block comes with the go-live.
 */
export const HANDWRITING_ENABLED = true
