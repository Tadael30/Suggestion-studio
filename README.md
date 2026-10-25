# Suggestion Studio

React + TypeScript (Vite). Pick brand colors, font and size, describe the problem, solution and process,
upload pictures, then generate slides (.pptx), a doc (.docx) and a sheet (.xlsx).

    npm install
    npm run dev

## Plugging in real AI
Set `VITE_AI_ENDPOINT` (see `.env.example`) to your own backend. It receives
`{ title, problem, solution, steps[] }` and must return the `Generated` JSON from `src/types.ts`.
Call the AI model from that backend so the API key never reaches the browser.
Without it, the app uses a simple local draft (`localDraft` in `src/ai.ts`).
