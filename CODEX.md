# CODEX.md - ReadMeABook Plus Working Notes

**Purpose:** Codex-specific project context. Read this file and `CLAUDE.md` before any substantial edit, then use `documentation/TABLEOFCONTENTS.md` to find feature docs.

## Required Workflow
- Before big edits: read `CODEX.md` and `CLAUDE.md`.
- Before feature/code changes: use `documentation/TABLEOFCONTENTS.md` to find relevant docs.
- Do not commit unless the user explicitly asks.
- Preserve existing audiobook behavior unless the user asks to change it.
- Keep docs concise and AI-readable.
- Verification target from `CLAUDE.md`: `docker compose build readmeabook` and full `npm run test` before saying work is ready to test.

## Current Fork Context
- Project fork name: ReadMeABook Plus.
- Goal of recent work: make EPUB requests first-class while keeping audiobook requests as the default path.
- Existing ebook infrastructure already existed as sidecar support:
  - `Request.type` supports `audiobook` and `ebook`.
  - Ebook jobs/processors exist: `search_ebook`, direct download, monitor direct download.
  - Ebook search uses Anna's Archive and/or Prowlarr ebook categories.
  - Previous ebook behavior was mainly sidecar: request an ebook after an audiobook is organized.

## EPUB Request Implementation Added
- API request creation accepts `mediaType?: 'audiobook' | 'epub'`.
- Default remains `audiobook`.
- `mediaType: 'epub'` creates `Request.type = 'ebook'`.
- EPUB requests skip audiobook-only checks:
  - Plex/library availability block.
  - Existing downloaded audiobook request block.
  - Ignored ASIN audiobook block.
  - Release-date delayed audiobook auto-search gate.
- Duplicate/active request checks now respect request type.
- EPUB requests enqueue `addSearchEbookJob(requestId, payload, 'epub')`.
- Audiobook requests still enqueue the normal audiobook search job.
- Notifications label EPUB requests as `(EPUB)`.

## UI Changes Added
- `src/components/audiobooks/AudiobookCard.tsx`
  - Added request format selector: Audiobook / EPUB.
  - Calls request API with selected `mediaType`.
  - Only updates local audiobook status for audiobook requests.
- `src/components/audiobooks/AudiobookDetailsModal.tsx`
  - Added format segmented control before the request action.
  - Shows EPUB vs Audiobook success messaging.
  - Only updates local audiobook status for audiobook requests.
- `src/lib/hooks/useRequests.ts`
  - `createRequest()` accepts `mediaType`.
  - User-facing "already processing" message differentiates EPUB.

## API And Service Changes Added
- `src/app/api/requests/route.ts`
  - POST schema accepts `mediaType`.
  - Passes media type to request creation service.
- `src/lib/services/request-creator.service.ts`
  - Central first-class EPUB request behavior.
- `src/app/api/requests/[id]/select-ebook/route.ts`
  - Allows first-class ebook requests without `parentRequestId`.
  - Keeps sidecar ebook selection behavior for parent audiobook requests.

## BookOrbit EPUB Destination Added
- New optional env var: `BOOKORBIT_INGEST_PATH`.
- New settings key: `ebook_bookorbit_ingest_path`.
- Fallback chain for ebook organization:
  1. DB config `ebook_bookorbit_ingest_path`
  2. Env `BOOKORBIT_INGEST_PATH`
  3. DB config `media_dir`
  4. Env `MEDIA_DIR`
  5. `/media/audiobooks`
- `src/lib/utils/file-organizer.ts`
  - Added `getEbookFileOrganizer()`.
- `src/lib/processors/organize-files.processor.ts`
  - Ebook organization uses `getEbookFileOrganizer()`.
  - Audiobook organization still uses `getFileOrganizer()`.
- Settings and setup path testing now include the EPUB destination path.

## Deployment And Docs Changes Added
- Added `.env.example`.
- Added `/bookorbit/ingest` volume/env support to:
  - `docker-compose.yml`
  - `docker-compose.local.yml`
  - `docker-compose.debug.yml`
  - `unraid.xml`
- Updated:
  - `README.md`
  - `documentation/deployment/docker.md`
- Generalized some UI wording from audiobook-only to book/request language where appropriate.

## Tests Added Or Updated
- `tests/services/request-creator-ignore.test.ts`
  - Mocked `addSearchEbookJob`.
  - Added coverage for first-class EPUB requests.
  - Asserts EPUB request type, pending status, ebook search job dispatch, and no audiobook search job.

## Verification State From Implementation Session
- `git diff --check` passed with only LF/CRLF warnings.
- Full verification could not run because dependencies were missing.
- `npm run test -- request-creator-ignore.test.ts` failed: `vitest` not installed.
- `npx tsc --noEmit` fetched old `tsc@2.0.4` because local TypeScript was missing.
- `npm install` failed with `ENOSPC: no space left on device`.
- Partial `node_modules` from the failed install was removed.
- `package-lock.json` was not modified during the failed install.

## Important Follow-Up
- Free disk space, then run:
  - `npm install`
  - `npm run test`
  - `docker compose build readmeabook`
- After tests/build pass, update this file if behavior or setup changes further.
