# Project architecture

Kaarya is a Hindi web task assistant. `public/` contains the static landing page and two hash-routed task screens. `netlify/server/index.mjs` is the sole Netlify Server entrypoint, with all request-driven APIs. `netlify/server/runtime.mjs` checks a trusted optional browser worker. `netlify/functions/execute-background.mts` is exclusively for long task execution. `db/schema.ts` is the database schema source of truth; migrations belong in `netlify/database/migrations/`.

Use Node 24+, ESM, parameterized SQL, snake_case database names, and Hindi interface copy. Keep scripts/styles external to maintain the CSP. Insert user content with textContent, never HTML. Maintain the sage green/ivory visual system, responsive layout, reduced motion, accessible fields, dialogs and error states.

Never claim a runtime is installed based on a file existing. No APK/Android or Playwright browser is installed here. Only report worker-provided runtime availability; distinguish blocked requests from running work. Model names from the user are not verified API IDs; the worker validates the requested model against AICredits before use. Never embed API credentials or return provider exception bodies.

Netlify Database stores all jobs; memory and files are not durable storage. Use Drizzle beta packages for schema authoring, and generate a migration for every schema change. Never apply migrations manually. The global partial unique index is essential for one job at a time. Background dispatch uses an atomic nonce check; do not weaken it. Job ownership is enforced with an HTTP-only anonymous session cookie.

External worker setup and its security/idempotency contract are documented in README.md. The worker is not included. Never expose endpoints that install arbitrary uploaded binaries. Do not spawn browser processes inside Netlify Server. Preserve truthful failure/timeout states; an uncertain job must not be automatically retried
