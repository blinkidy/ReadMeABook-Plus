/**
 * BookDate: Record Swipe Action
 * Documentation: documentation/features/bookdate-prd.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthenticatedRequest } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db';
import { createRequestForUser } from '@/lib/services/request-creator.service';
import { RMABLogger } from '@/lib/utils/logger';

const logger = RMABLogger.create('API.BookDateSwipe');
type RequestFormat = 'audiobook' | 'epub' | 'both';

async function handler(req: AuthenticatedRequest) {
  try {
    const userId = req.user!.id;
    const body = await req.json();
    const {
      recommendationId,
      action,
      markedAsKnown = false,
      requestFormat = 'audiobook',
      requestAlreadyCreated = false,
    } = body;

    if (!recommendationId || !action) {
      return NextResponse.json({ error: 'recommendationId and action are required' }, { status: 400 });
    }
    if (!['left', 'right', 'up'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Must be "left", "right", or "up"' }, { status: 400 });
    }
    if (!['audiobook', 'epub', 'both'].includes(requestFormat)) {
      return NextResponse.json({ error: 'Invalid requestFormat. Must be "audiobook", "epub", or "both"' }, { status: 400 });
    }

    const recommendation = await prisma.bookDateRecommendation.findUnique({
      where: { id: recommendationId },
    });
    if (!recommendation || recommendation.userId !== userId) {
      return NextResponse.json({ error: 'Recommendation not found or does not belong to user' }, { status: 404 });
    }

    const createdRequests: string[] = [];
    const skippedRequests: Array<{ format: string; reason: string }> = [];
    if (action === 'right' && !markedAsKnown && !requestAlreadyCreated) {
      const formats: Array<'audiobook' | 'epub'> = requestFormat === 'both'
        ? ['audiobook', 'epub']
        : [requestFormat as Exclude<RequestFormat, 'both'>];

      for (const mediaType of formats) {
        const result = await createRequestForUser(userId, {
          asin: recommendation.audnexusAsin || undefined,
          title: recommendation.title,
          author: recommendation.author,
          narrator: recommendation.narrator || undefined,
          description: recommendation.description || undefined,
          coverArtUrl: recommendation.coverUrl || undefined,
        }, { mediaType, bypassIgnore: true });

        if (!result.success) {
          // Availability and duplicate state can change between opening the
          // confirmation and submitting it. Treat those as an idempotent
          // success so BookDate still records and advances the card.
          skippedRequests.push({ format: mediaType, reason: result.reason });
          continue;
        }
        createdRequests.push(mediaType);
      }
    }

    await prisma.bookDateSwipe.create({
      data: {
        userId,
        recommendationId,
        bookTitle: recommendation.title,
        bookAuthor: recommendation.author,
        action,
        markedAsKnown: Boolean(markedAsKnown),
      },
    });

    return NextResponse.json({
      success: true,
      action,
      markedAsKnown: Boolean(markedAsKnown),
      requestFormat: requestFormat as RequestFormat,
      createdRequests,
      skippedRequests,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to record swipe';
    logger.error('Swipe error', { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return requireAuth(req, handler);
}
