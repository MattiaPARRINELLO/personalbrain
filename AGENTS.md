<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# PersonalBrain — Agent instructions

## Stack

- **Runtime**: Bun (bun.lock, not npm/yarn)
- **Framework**: Next.js 16.2.10 (App Router, `output: "standalone"`)
- **CSS**: Tailwind v4 via `@tailwindcss/postcss`
- **Auth**: Passkey (WebAuthn) via `@simplewebauthn/*` + custom JWT sessions
- **AI**: OpenAI-compatible + Anthropic unified via `lib/ai-providers.ts`
- **Data**: JSON files in `data/` (gitignored), atomic writes via tmp+rename
- **Test**: Vitest 4 (`bun run test` / `bun run test:watch`)

## Commands

| Usage | Command |
|---|---|
| Dev server | `bun dev` |
| Build | `bun build` |
| Lint | `bun run lint` (ESLint 9 flat config) |
| Typecheck | `bunx tsc --noEmit` |
| Test (single run) | `bun run test` |
| Test (watch) | `bun run test:watch` |

## Architecture

- **App Router** — pages: `/chat`, `/brain`, `/calendar`, `/gmail`, `/accreditations`, `/watch-later`, `/reminders`, `/search`, `/settings`, `/activity`, `/login`
- **Server Actions** — `app/actions/` (one file per domain)
- **API routes** — `app/api/{chat,auth,calendar,gmail}/`
- **No middleware** — `proxy.ts` exists but is NOT auto-loaded by Next.js (must be named `middleware.ts`)
- **Session** — two implementations: `lib/session-core.ts` (Node fs, for server code) and `lib/session-edge.ts` (env var `AUTH_SECRET`, for edge). `lib/session.ts` re-exports with `next/headers` cookie helpers.
- **Google OAuth** — `lib/google-client.ts`, tokens stored in `data/{gmail,calendar}-token.json`, auto-refresh on expiry
- **PWA** — `public/sw.js`, `public/manifest.json`, `lib/offline.ts`
- **Design** — documented in `DESIGN.md` (warm brutalist, dark, Geist Sans / Space Mono, 1px borders, no shadows)

## Data layer

- All domain data stored as JSON files in `data/` (gitignored except `.gitkeep`)
- `lib/storage.ts` exports typed CRUD functions — atomic writes (`.tmp` + rename), 30min backups to `data/backups/`
- `lib/config.ts` reads `data/config.json` (model selection, per-user settings)
- Tests mock `process.cwd()` to a temp dir (see `lib/__tests__/storage.test.ts`)

## Testing quirks

- `vitest.config.ts` sets `environment: "node"` (no jsdom)
- FS-dependent tests must dynamic-import storage modules after mocking `process.cwd()`
- Test helpers in `lib/__tests__/__fs-mock-helper.ts`

## Env vars

Required: `NEXT_PUBLIC_API_URL`, `IA_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `AUTH_SECRET`.

`.env.local` contains real credentials — do not commit or expose in logs.

## Notes

- `tsconfig.json` uses `@/*` path alias → project root
- No CI workflows or pre-commit hooks found
- Monorepo: no — single Next.js app
