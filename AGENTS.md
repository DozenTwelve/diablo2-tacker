# Repository Guidelines

## Project Structure & Module Organization
Source code lives in `src/`, with feature data under `src/data/` (JSON exports consume localStorage state) and reusable UI in `src/components/`. Global styles use Tailwind via `src/input.css` and `src/gothic-theme.css`, while generated output is written to `dist/` after building. Static assets, including background art and favicons, are in `public/` and are copied verbatim by Vite.

## Build, Test, and Development Commands
- `npm install` — install Node 18+ dependencies defined in `package.json`.
- `npm run dev` — launch the Vite dev server; useful for smoke testing localStorage flows.
- `npm run build` — emit the production bundle into `dist/` with Vite optimizations.
- `npm run preview` — serve the built assets and verify the production build locally.
- `npm run lint` — run ESLint with React and Hooks rules; required before opening a PR.

## Coding Style & Naming Conventions
React 19 function components are preferred, with hooks for state and side effects. Use ES modules, 2-space indentation, and double quotes to match the existing codebase. Keep JSX lean: extract shared UI into `src/components/` and colocate helper utilities next to their consumers. Run `npm run lint` to enforce the shared ESLint config (extends `@eslint/js` plus React Hooks and Refresh rules). Tailwind utility classes should be composed in JSX; add bespoke styles to `src/input.css`.

## Testing Guidelines
Automated tests are not configured yet; coordinate before introducing new frameworks. For now, verify features manually in the dev server: ensure tracked items persist via localStorage and that JSON imports/exports (`diablo2-tracker-save.json`) behave as expected. When adding tests, place them near the code under test (e.g., `src/components/__tests__/SetDisplay.test.jsx`) and run them via a documented npm script.

## Commit & Pull Request Guidelines
Follow the existing Git history style: short, present-tense summaries (`fix dropdown`, `add rune data`). Group related changes per commit and include context in the body if necessary. PRs should describe the user-facing impact, list manual verification steps, and link any tracked issues. Attach screenshots or GIFs whenever UI changes affect layout, colors, or interaction behavior.

## Configuration Notes
The app stores user progress in browser localStorage. When adjusting storage keys or JSON schemas, migrate existing data defensively and document the change in the PR. Any new environment-specific settings should be surfaced through `import.meta.env` variables and documented in `README.md`.
