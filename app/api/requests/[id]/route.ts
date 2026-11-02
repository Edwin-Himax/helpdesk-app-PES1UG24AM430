import { NextRequest, NextResponse } from 'next/server';
import { markRequestResolved } from '@/lib/db';
import { invalidateLatestRequestsCache } from '@/lib/redis';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: {
    id: string;
  };
}

/**
 * PATCH /api/requests/[id]
 * Bonus Challenge (Section 10):
 * Marks the request as resolved in PostgreSQL and clears the Redis cache.
 */
export async function PATCH(
  _req: NextRequest,
  { params }: RouteContext
) {
  try {
    const id = parseInt(params.id, 10);

    if (isNaN(id) || id <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid request ID' },
        { status: 400 }
      );
    }

    // Update PostgreSQL
    const updated = await markRequestResolved(id);

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Request not found' },
        { status: 404 }
      );
    }

    // Invalidate Redis cache key "help:latest"
    await invalidateLatestRequestsCache();

    return NextResponse.json({
      success: true,
      id,
      message: 'Request marked as resolved and cache invalidated',
    });
  } catch (error) {
    console.error('Error resolving request:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
