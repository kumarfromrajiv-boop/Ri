 main content

Search Netlify…

R
Rajiv Kumarrrajiv00000@gmail.com

Projects
task-automation-f0890f
Switch projects
Agent runs
Runner details

Website for task automation based on user-provided URLs and instructions



Showing 19 changed files with 2651 additions and 0 deletions.
Unified
Split

.gitignore
added
+5

AGENTS.md
added
+11

README.md
added
+29
# Kaarya

A Hindi web task assistant with a welcome page, browser selection and task form, and a persistent task status page. Built with accessible vanilla HTML/CSS/JavaScript, an Express Netlify Server, Netlify Database with Drizzle schema/migrations, and a Netlify background function.

## Local development

Use Node 24 or newer, install dependencies with `npm install`, link the Netlify project, and run `netlify dev --port 8889`. Database migrations are applied by the deployment platform. Generate future schema migrations with `npx drizzle-kit generate --name describe_change`. Never apply migrations manually.

## Current availability

Neither an Android runtime nor a Playwright Firefox worker is bundled. Netlify Server does not run Android APKs. Uploading or storing an APK would not install it. The UI reports these missing runtimes honestly and saves requests as blocked, rather than pretending to execute them. No APK was supplied. There is no APK upload endpoint or public binary installation endpoint.

The AI integration uses AICredits' documented OpenAI-compatible endpoint. `AICREDITS_API_KEY` has been supplied through secure project configuration for production and deploy previews. The UI reports only whether it is configured; this does not assert successful authentication or model availability. The requested model defaults to `anthropic/claude-haiku-5.5`; its availability is unverified. Each execution checks the provider's model catalog first and blocks with an explanation if the ID is absent. `AICREDITS_MODEL` can override the identifier when the provider confirms an exact supported ID. No fallback model is silently selected.

## Browser worker contract

A separately hosted browser execution service is necessary for real automation. Set `BROWSER_WORKER_URL` to its trusted HTTPS base URL and, if required, `BROWSER_WORKER_TOKEN` through environment configuration. Do not point this at an arbitrary user-provided host.

- `GET /capabilities` returns `{ "apk": false, "firefox": true }` only for actually installed and operational runtimes. For APK support, the worker must have an Android environment, the supplied APK installed, and browser control implemented.
- `POST /execute` accepts `jobId`, `url`, `instruction`, `runtime`, `attempt`, and an AI-generated `plan`. It must use `jobId` and `attempt` as idempotency keys and resume the same task session without replaying completed actions, reject private network access (including redirects, subresources, and DNS rebinding), and enforce scoped authorization for consequential actions. Return `{ "status": "completed", "result": "Actual result text" }` only upon confirmed completion. To request AI guidance, return `{ "status": "needs_help", "observation": "Browser issue, with no credentials" }`. The background function passes this observation to AI and resumes with the revised plan, at most twice. Transport failures are never retried automatically.
- Both requests carry the configured bearer credential when one is set. Redirects to different services are rejected.

The adapter is a contract, not an included browser service. It passes the AI plan to the worker and supports two observation/guidance recovery cycles when the worker explicitly requests help. Each worker request has a three-minute time limit. A generic public arbitrary-action browser executor must not be connected without abuse controls and authorization enforcement.

## Persistence and execution

Anonymous requests are associated with an HTTP-only, secure, same-site browser cookie. IDs alone do not grant access; clearing cookies loses browser access to prior tasks. Records survive closing the tab. A database partial unique index allows only one globally queued/running job. Blocked requests do not occupy that slot. A background function atomically consumes a one-use dispatch nonce and runs independently of the browser, up to the platform's 15-minute maximum. Jobs older than 16 minutes are marked unconfirmed/failed when status is read or a new task is submitted. This is bounded background execution, not an indefinitely running automation engine. The system does not automatically replay uncertain side effects after failure.

No build or local execution validation w
