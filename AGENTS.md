# Repository Guidelines

## Project Structure & Module Organization

This is a Next.js 15 calendar and hangout planning app with Firebase integration. App routes live in `src/app`, split into `(auth)` and `(main)`, with API handlers under `src/app/api`. Reusable UI and feature components are in `src/components`, hooks in `src/hooks`, contexts in `src/contexts`, shared services in `src/lib`, domain types in `src/types`, and pure helpers in `src/utils`. Static assets live in `public`. Firebase configuration, rules, and indexes are at the root; Cloud Functions are isolated in `functions/src`.

## Build, Test, and Development Commands

- `npm run dev`: start the Next.js development server.
- `npm run build`: create a production Next.js build.
- `npm run start`: serve the built app locally.
- `npm run lint`: lint `src/**/*.{ts,tsx}` with ESLint.
- `npm test`: run the Vitest suite once.
- `npm run test:watch`: run Vitest in watch mode.
- `npm run format` / `npm run format:check`: write or verify Prettier formatting.
- `cd functions && npm run build`: compile Firebase Functions TypeScript.
- `cd functions && npm run serve`: build functions and run the Firebase Functions emulator.

## Coding Style & Naming Conventions

Use TypeScript and React function components. Follow Prettier settings: 2-space indentation, semicolons, single quotes, trailing commas, and 100-character line width. Tailwind classes are sorted by `prettier-plugin-tailwindcss`; prefer formatting over manual class ordering. Name React components in `PascalCase` (`CalendarView.tsx`), hooks with `use` prefixes (`useCalendarStore.ts`), utilities in `camelCase`, and tests as `*.test.ts` or `*.test.tsx`.

## Testing Guidelines

Tests use Vitest with jsdom, Testing Library, jest-dom, and axe helpers. Keep unit tests near the code in `__tests__` directories, as in `src/utils/__tests__` and `src/components/calendar/__tests__`. Prefer focused tests for utilities, Firebase services, rendering states, and accessibility-sensitive UI. Run `npm test` before opening a PR; run `npm run lint` when changing app code.

## Commit & Pull Request Guidelines

Recent history uses short, imperative commit subjects such as `update tsudoi ui` and `Fix React Server Components CVE vulnerabilities`. Keep commits scoped and descriptive. PRs should include a concise summary, test results, linked issues when applicable, and screenshots or screen recordings for UI changes. Call out Firebase rule, index, environment, or deployment changes explicitly.

## Security & Configuration Tips

Do not commit secrets, service account keys, or local Firebase credentials. Keep environment-specific values in local env files or hosting configuration. Review `firestore.rules`, `firestore.indexes.json`, and `firebase.json` together when changing data access patterns.
