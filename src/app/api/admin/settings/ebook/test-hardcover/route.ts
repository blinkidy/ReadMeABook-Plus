/**
 * Component: Hardcover API Key Connection Test
 * Documentation: documentation/backend/services/hardcover-sync.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireAdmin, AuthenticatedRequest } from '@/lib/middleware/auth';
import { searchHardcoverBooks } from '@/lib/services/hardcover-api.service';
import { RMABLogger } from '@/lib/utils/logger';

const logger = RMABLogger.create('API.Admin.Settings.TestHardcover');

export async function POST(request: NextRequest) {
  return requireAuth(request, async (req: AuthenticatedRequest) => {
    return requireAdmin(req, async () => {
      try {
        const { apiKey } = await request.json();

        if (!apiKey || apiKey.startsWith('••••')) {
          return NextResponse.json(
            { success: false, message: 'Please enter a Hardcover API key first' },
            { status: 400 }
          );
        }

        const { books } = await searchHardcoverBooks(apiKey, 'test', 1);

        return NextResponse.json({
          success: true,
          message: `Connected successfully (${books.length} sample result${books.length === 1 ? '' : 's'} returned)`,
        });
      } catch (error) {
        logger.warn('Hardcover connection test failed', { error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json({
          success: false,
          message: error instanceof Error ? error.message : 'Connection failed',
        });
      }
    });
  });
}
