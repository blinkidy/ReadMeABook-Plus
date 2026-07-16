# Hardcover Book Search Fallback

**Status:** ✅ Implemented | Admin-level API key, always-on catalog fallback for books with no audiobook edition

## Overview
Some books have no audiobook edition and never surface via Audible search. When an admin-level Hardcover API key is configured, book search always runs an Hardcover catalog search in parallel with Audible, so those books can still be found and requested as EPUB.

## Key Details
- **One shared key, not per-user:** unlike `hardcover-sync.md`'s per-user shelf tokens, this key lives in `Configuration` (`hardcover_search_api_key`, encrypted) and powers search for every user.
- **Admin UI:** Settings → E-book Sidecar → "Book Search (Hardcover)" section (`src/app/admin/settings/tabs/EbookTab/EbookTab.tsx`). Includes a "Test" button that calls `POST /api/admin/settings/ebook/test-hardcover` to verify the key works before saving.
- **Always-on, not a toggle:** search always queries Hardcover in parallel with Audible whenever a key is configured — originally gated on "zero Audible results," but that missed books where Audible returned unrelated results instead of zero.
- **Uses Hardcover's Typesense-backed `search` GraphQL query** (not the list/shelf queries used for sync).
- **Requests created from Hardcover results have no ASIN** — `request-creator.service.ts` handles `asin` as optional, matching/creating by title+author instead.
- **Details enrichment:** `/api/audiobooks/[asin]` uses the shared key to find a conservative title/author match and adds optional page count, ISBN, aggregate rating, a Hardcover link, and up to five top public reviews. Reviews are ordered by likes and then recency. Failure or a missing key never blocks Audible details.

## API/Interfaces
- `GET /api/books/search?q=<query>` — Hardcover catalog search (`src/app/api/books/search/route.ts`), reads the admin key via `configService.get('hardcover_search_api_key')`
- `POST /api/admin/settings/ebook/test-hardcover` → `{ apiKey }` → `{ success, message }` — validates a key without saving it
- `searchHardcoverBooks(apiToken, query, page)` (`src/lib/services/hardcover-api.service.ts`) — returns optional ISBN, page count, rating counts, and slug; shared by search, connection testing, and audiobook-details enrichment
- `fetchHardcoverBookCommunityDetails(apiToken, bookId, limit)` — loads the aggregate rating and top public written reviews for the matched book; review text is returned as plain text and spoiler flags are preserved for the in-app reveal control

## Related
- [Hardcover shelf sync (personal tokens)](../backend/services/hardcover-sync.md)
- [E-book sidecar](./ebook-sidecar.md)
- [Settings UI](../settings-pages.md#e-book-sidecar)
