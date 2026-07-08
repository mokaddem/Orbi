# Geography Quiz

Bilingual (EN / FR), offline-first web game for learning world geography via **map** and
**flag** quizzes, with spaced-repetition training on the countries you get wrong. It's a
fully client-side SPA — **no backend**; gameplay data is bundled statically and progress
lives in the browser (IndexedDB).

## Start here (every new session, even with cleared context)

> **⚠️ NEVER start implementing a phase without the owner's (Sami's) explicit approval first.**
> Reading a phase and answering its clarifying questions is planning — **not** a green light to
> code. Resolve open questions, present the plan, and wait for an explicit "go" before writing any
> implementation. (Phase 12 was built twice without a clear go-ahead and reverted both times.)

The project is built **phase by phase** against a PRD. Before doing any work:

1. **Read [`docs/main_PRD.md`](docs/main_PRD.md)** — the source of truth. Its
   *"How to work on this project"* section and the **Status Table** define the process.
2. From the Status Table, pick the **next open phase**: the top-most row not ✅ Done whose
   dependencies are already ✅ Done.
3. **Read that phase's PRD** in [`docs/phases/`](docs/phases/) in full (goal, deliverables
   checklist, technical notes, acceptance criteria), resolve its open questions with the owner,
   and **get explicit approval before implementing** (see the callout above).
4. **Update status** when you finish or pause — in both places:
   - the phase PRD (header Status/Progress, deliverable checkboxes, dated Progress-log entry), and
   - the Status Table in `docs/main_PRD.md`.

Original feature spec (seed): [`docs/specs.md`](docs/specs.md).

## Tech stack
Svelte + Vite + TypeScript · D3-geo + TopoJSON maps · bundled SVG flags · IndexedDB · PWA.
Rationale, architecture, and the shared data model are in `docs/main_PRD.md`.

## Conventions
- **Dev server** is pinned to port **5180** (`vite --port 5180 --strictPort`) — start it
  **once in the background** and reuse it, don't open/close per change. **Preview** (prod
  build / PWA checks) is pinned to **5181**.
- **Testing cadence** (see main_PRD → *Testing & Verification Strategy*):
  - *Fast loop, every change:* Vitest unit + component tests, plus a manual browser check.
  - *Heavy loop, only when warranted:* Playwright E2E — run at phase boundaries (before
    marking a phase ✅ Done) and for cross-cutting changes; it reuses the running 5180 server.
- Keep dependencies minimal; keep domain logic pure and framework-agnostic (so it's unit-testable).

## Commands
- `npm run dev` — Vite dev server on **5180** (`--strictPort`). Start once in the background, reuse.
- `npm run build` — production build to `dist/`.
- `npm run preview` — serve the prod build on **5181** (`--strictPort`) for PWA/offline checks.
- `npm run test` — run the Vitest suite once (`test:watch` for watch mode).
- `npm run check` — type-check with `svelte-check` (`tsconfig.app.json`).
- `npm run lint` — ESLint (flat config) + `prettier --check`.
- `npm run format` — format the codebase with Prettier.
