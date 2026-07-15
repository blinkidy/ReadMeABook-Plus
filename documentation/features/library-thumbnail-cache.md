# Library Thumbnail Caching

**Status:** ✅ Implemented | Cache library covers during scans, serve in BookDate

## Overview
Caches book covers from Plex/Audiobookshelf during library scans and extracts embedded cover art from BookOrbit EPUB files. Stores cached files in `/app/cache/library/` with SHA-256 hashed filenames. Dramatically improves BookDate user experience by showing real covers instead of placeholders.

## Key Details

### Caching Strategy
- **When:** During full/recent audiobook scans and BookOrbit scans. BookOrbit extracts the EPUB package cover; other ebook formats retain the Audible/placeholder fallback.
- **Where:** `/app/cache/library/` directory
- **Filename:** SHA-256 hash (first 16 chars) of plexGuid + extension (e.g., `a3f5e9d2c1b4.jpg`)
- **Smart caching:** Checks if file exists before downloading (subsequent scans are fast)

### Database Schema
- **Field:** `PlexLibrary.cachedLibraryCoverPath` (nullable TEXT)
- **Stores:** Full path like `/app/cache/library/{hash}.jpg`
- **Migration:** `20260120000000_add_cached_library_cover_path`

### URL Construction (Backend-Specific)
- **Plex:** `{serverUrl}{thumbUrl}?X-Plex-Token={token}`
- **Audiobookshelf:** `{serverUrl}{coverPath}` with `Authorization: Bearer {token}` header

### Cover Priority (BookDate Library Picker)
1. **Library cached cover** (`cachedLibraryCoverPath`) → `/api/cache/library/{filename}`
2. **Audible cache** (if book has ASIN) → from `AudibleCache.coverArtUrl`
3. **Null** (show placeholder 📚)

## API Endpoints

### GET /api/cache/library/[filename]
Serves cached library covers (24-hour browser cache).

**Path validation:** Prevents directory traversal (rejects `..` and `/`).

**Content types:** jpg, jpeg, png, gif, webp → image/*, else application/octet-stream

### GET /api/bookdate/library
Returns library books with cover URLs.

**Response:**
```json
{
  "books": [
    {
      "id": "uuid",
      "title": "Book Title",
      "author": "Author Name",
      "coverUrl": "/api/cache/library/a3f5e9d2c1b4.jpg" // or Audible URL, or null
    }
  ]
}
```

## Service Layer

### ThumbnailCacheService
Located: `src/lib/services/thumbnail-cache.service.ts`

**Methods:**
- `cacheLibraryThumbnail(plexGuid, coverUrl, backendBaseUrl, authToken, backendMode)` → Returns cached path or null
- `cacheEmbeddedLibraryThumbnail(plexGuid, data, extension)` → Stores a validated embedded EPUB image and returns its cached path
- `cleanupLibraryThumbnails(plexGuidToHashMap)` → Returns deleted count

**Safeguards:**
- 10s timeout per download
- Embedded and downloaded images are limited to 5 MB and supported image extensions
- 5MB max file size
- Content-type validation (must be image/*)
- Graceful degradation (logs warning, returns null on failure)

### Library Services
Located: `src/lib/services/library/`

**Both PlexLibraryService and AudiobookshelfLibraryService provide:**
- `getCoverCachingParams()` → Returns `{ backendBaseUrl, authToken, backendMode }`

## Performance

### First Full Scan (1000 books)
- Database: ~30 seconds
- Downloads: ~1-5 minutes (network-dependent)
- **Total: ~1.5-5.5 minutes** (one-time cost)

### Subsequent Scans (1000 books)
- Database: ~30 seconds
- Downloads: **~0 seconds** (skipped, files exist)
- **Total: ~30 seconds** (same as before caching)

### BookDate Library Load
- **Before:** Mostly placeholder covers
- **After:** Real covers for all books with valid thumbUrl
- **Performance:** No change (local file serving is fast)

## Error Handling
- Download fails → log warning, store null, continue scan
- Invalid content-type → reject, store null
- File system errors → log, store null
- Missing backend config → throw (scan fails early with clear error)

## Cleanup (Future Enhancement)
**Manual or Scheduled:**
- Builds hash-to-plexGuid reverse map from database
- Deletes cached files for plexGuids no longer in library
- Returns count of deleted files

**Trigger:** Admin endpoint or weekly scheduled job

## Docker Configuration
**Volume mount required:**
```yaml
volumes:
  - ./cache/library:/app/cache/library
```

Ensures cached covers persist across container restarts.

## Related
- documentation/backend/database.md (PlexLibrary schema)
- documentation/features/bookdate.md (cover loading logic)
- documentation/integrations/audible.md (Audible thumbnail caching pattern)
- documentation/backend/services/jobs.md (scan processors)
