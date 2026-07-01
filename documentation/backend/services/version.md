# Version Display

**Status:** ✅ Implemented | Build-time version injection + GitHub release check

## Overview
Shows the running app version in the UI (`VersionBadge`) and flags when a newer release is available on the fork's GitHub repo.

## Key Details
- **Source of truth:** `package.json` `version` field (semver, no `v` prefix)
- **Build args:** `APP_VERSION`, `GIT_COMMIT`, `BUILD_DATE` — set in `dockerfile.unified`, populated by CI (`build-unified-image.yml`, `pre-release-checks.yml`) from `package.json` + `git rev-parse --short=7 HEAD` + current UTC time
- **Client access:** baked in as `NEXT_PUBLIC_APP_VERSION` / `NEXT_PUBLIC_GIT_COMMIT` (read directly, no API call); falls back to `GET /api/version` if unset (e.g. local dev)
- **Repo used for release links/update checks:** `GITHUB_REPO` constant in `src/components/ui/VersionBadge.tsx` — hardcoded to this fork (`blinkidy/ReadMeABook-Plus`), not the upstream project
- **Update check:** fetches `package.json` from the fork's `main` branch every 6h, compares semver; shows an amber pulse + the newer version if available
- **Click target:** `https://github.com/{GITHUB_REPO}/releases/tag/v{version}` — resolves because `.github/workflows/release.yml` creates a GitHub Release (with auto-generated notes) whenever a `v*` tag is pushed

## API/Interfaces
- `GET /api/version` → `{ version: "v1.0.0", fullVersion: "1.0.0", commit: "abc1234", buildDate: "..." }`

## Related: [ui/VersionBadge.tsx](../../../src/components/ui/VersionBadge.tsx), [deployment/docker.md](../../deployment/docker.md)
