/**
 * Component: Version API Route
 * Documentation: documentation/backend/services/version.md
 */

import { NextResponse } from 'next/server';

function displayVersion(version: string): string {
  if (version === 'unknown') return 'vDEV';
  return /^\d+\.\d+\.\d+(?:[-+].+)?$/.test(version) ? `v${version}` : version;
}

export async function GET() {
  const appVersion = process.env.APP_VERSION || 'unknown';
  const gitCommit = process.env.GIT_COMMIT || 'unknown';
  const buildDate = process.env.BUILD_DATE || 'unknown';

  return NextResponse.json({
    version: displayVersion(appVersion),
    fullVersion: appVersion,
    commit: gitCommit,
    buildDate,
  });
}
