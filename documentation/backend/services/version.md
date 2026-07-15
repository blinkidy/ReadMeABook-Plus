# Version Display

**Status:** Implemented | Release and candidate build identity

## Overview
Shows the running app version in the UI (`VersionBadge`) and flags when a newer release is available on the fork's GitHub repo.

## Key Details
- **Release identity:** release builds use the `package.json` semver and display `v1.1.1`.
- **Candidate identity:** manually published test images use the immutable seven-character commit identity and display `sha-abc1234`.
- **Build args:** `APP_VERSION`, `GIT_COMMIT`, and `BUILD_DATE` are injected by the Docker workflows.
- **Client access:** `NEXT_PUBLIC_APP_VERSION` and `NEXT_PUBLIC_GIT_COMMIT`; `GET /api/version` is the local-development fallback.
- **Release checks:** only semver releases compare against `main/package.json` every six hours. Candidate builds skip semver checks.
- **Links:** release badges link to their GitHub Release; candidate badges link to the exact commit.

## Cutting a Release
`.github/workflows/cut-release.yml` is the normal manual release path from `main`. It runs tests, tags `v{package.json version}`, builds and publishes the multi-arch Docker image (including `latest`), and creates the GitHub Release. Directly pushed `v*` tags remain supported by the fallback build and release workflows.

Manual runs of `.github/workflows/build-unified-image.yml` publish testable SHA tags without moving `latest`. After validation, cut a release to publish the version tags and update `latest`.

## API/Interfaces
- Release: `{ version: "v1.1.1", fullVersion: "1.1.1", commit: "abc1234", buildDate: "..." }`
- Candidate: `{ version: "sha-abc1234", fullVersion: "sha-abc1234", commit: "abc1234", buildDate: "..." }`

## Related
- `src/components/ui/VersionBadge.tsx`
- `documentation/deployment/docker.md`
