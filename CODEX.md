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
- Completed first-class EPUB requests now mark `Request.status = 'available'` after BookOrbit organization so they hide from discovery and show complete in admin views.
- `bookorbit_library_scan` periodically scans the configured BookOrbit library path, registers found ebook files in `plex_library` with `bookorbit://...` IDs, and marks matching ebook requests available.

## UI Changes Added
- `src/components/audiobooks/AudiobookCard.tsx`
  - Request format selector removed from hover overlay for touch-first use.
  - Cards now open details; format selection/request actions live in `AudiobookDetailsModal`.
- `src/components/audiobooks/AudiobookDetailsModal.tsx`
  - Added format segmented control before the request action.
  - Shows EPUB vs Audiobook success messaging.
  - Only updates local audiobook status for audiobook requests.
- `src/components/layout/Header.tsx`
  - Added authenticated top search bar that navigates to `/search?q=...`.
- Search/author/series pages use broader audiobook/book language.

## Search Quality
- `src/lib/utils/search-title.ts`
  - Cleans known promotional Audible subtitle suffixes before automatic and interactive indexer search.
  - Example: `Yesteryear: A GMA Book Club Pick` searches as `Yesteryear`.
- Handles punctuation-stripped display titles like `Yesteryear A GMA Book Club Pick`.
- Audiobook and EPUB automatic/interactive search paths clean known marketing suffixes before querying indexers.
- `src/lib/hooks/useRequests.ts`
  - `createRequest()` accepts `mediaType`.
  - User-facing "already processing" message differentiates EPUB.

## Audible Discovery Quality
- User-configured genre/category home sections scrape Audible bestseller charts via `/charts/best/category-audiobooks/<categoryId>`.
- Avoid using generic `/search?node=<id>&sort=popularity-rank` for categories; that route can surface launch/promo-heavy oddities that do not match Audible's visible genre bestseller pages.
- Avoid `/adblbestsellers?node=<categoryId>` for categories; Audible redirects it to the global bestsellers chart, so every genre can end up with the same popular snapshot.

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
- New optional env var: `BOOKORBIT_LIBRARY_PATH`.
- New settings keys: `ebook_bookorbit_ingest_path`, `ebook_bookorbit_library_path`.
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
- `src/lib/processors/bookorbit-scan.processor.ts`
  - Scans the BookOrbit library path without moving/deleting files.
  - Scan fallback: DB `ebook_bookorbit_library_path` -> env `BOOKORBIT_LIBRARY_PATH` -> ingest path -> media path.
  - Parses BookOrbit default names like `Books/Author/Series/01. Title (Year)/01. Title (Year).epub` and file-as-book variants.
  - Ignores top-level collection folders (`Books`, `Ebooks`) and strips leading series indexes/trailing years from titles.
  - Uses ASIN from path/filename when present; otherwise tries title/author against `AudibleCache`.
  - Marks ebook requests available by ASIN, normalized title+author, or normalized title when BookOrbit author is unknown.
  - Adds scoped BookOrbit fallback matching only for `bookorbit://` library rows; unique title-only matches are allowed when author metadata is missing.

## Deployment And Docs Changes Added
- Added `.env.example`.
- Added `/bookorbit/ingest` and `/bookorbit/library` volume/env support to:
  - `docker-compose.yml`
  - `docker-compose.local.yml`
  - `docker-compose.debug.yml`
  - `unraid.xml`
- Updated:
  - `README.md`
  - `documentation/deployment/docker.md`
- Generalized some UI wording from audiobook-only to book/request language where appropriate.

## Workflow Automation Added
- `.github/workflows/pre-release-checks.yml`
  - Runs on PRs to `main`, pushes to `main`, pushes to `codex/**`, and manual dispatch.
  - Calls reusable `Backend Tests` workflow with Discord notifications disabled.
  - Builds the unified Docker image with `push: false`.
  - Stops before publishing/release.
- `.github/workflows/build-unified-image.yml`
  - Remains the manual/tag release workflow that publishes to GHCR.
  - Discord notifications are disabled/removed.
  - Manual dispatch defaults to `linux/amd64` for faster publish builds.
  - Use `linux/amd64,linux/arm64` only when a multi-arch image is actually needed; ARM64 builds are much slower under GitHub runner emulation.

## Tests Added Or Updated
- `tests/services/request-creator-ignore.test.ts`
  - Mocked `addSearchEbookJob`.
  - Added coverage for first-class EPUB requests.
  - Asserts EPUB request type, pending status, ebook search job dispatch, and no audiobook search job.
- Existing tests were updated for first-class EPUB defaults:
  - Notification tests expect `sourceUrl` plus request type args.
  - Audiobook card/modal tests expect `Request Audiobook` and `Audiobook request created!`.
  - Login/requests wording expects broader book language.
  - Setup path tests treat invalid templates as failed path validation.

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
