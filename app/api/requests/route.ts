import { NextRequest, NextResponse } from 'next/server';
import {
  insertHelpRequest,
  getLatestHelpRequests,
  HelpRequest,
} from '@/lib/db';
import {
  getCachedLatestRequests,
  setCachedLatestRequests,
  invalidateLatestRequestsCache,
} from '@/lib/redis';

// Force dynamic execution for Next.js API route handlers to avoid static build caching
export const dynamic = 'force-dynamic';

/**
 * GET /api/requests
 * Returns the latest 10 requests, newest first.
 *
 * Algorithm:
 * 1. Check Redis for the key help:latest.
 * 2. If present, return cached list with source: "Redis".
 * 3. If absent, query PostgreSQL, cache in Redis with 60-second TTL, and return with source: "PostgreSQL".
 *
 * Cache Miss Response:
 * {
 *   "source": "PostgreSQL",
 *   "requests": [ ... ]
 * }
 *
 * Cache Hit Response:
 * {
 *   "source": "Redis",
 *   "requests": [ ... ]
 * }
 */
export async function GET() {
  try {
    // 1. Check Redis for help:latest
    const cached = await getCachedLatestRequests<HelpRequest[]>();

    if (cached !== null && Array.isArray(cached)) {
      // 2. Cache Hit -> return source: "Redis"
      return NextResponse.json({
        source: 'Redis',
        requests: cached,
      });
    }

    // 3. Cache Miss -> Query PostgreSQL
    const requests = await getLatestHelpRequests(10);

    // Store in Redis with 60-second TTL
    await setCachedLatestRequests(requests);

    // Return source: "PostgreSQL"
    return NextResponse.json({
      source: 'PostgreSQL',
      requests,
    });
  } catch (error) {
    console.error('Error in GET /api/requests:', error);

    // Rule: If Redis or unexpected error occurs, fall back to PostgreSQL rather than crash
    try {
      const fallbackRequests = await getLatestHelpRequests(10);
      return NextResponse.json({
        source: 'PostgreSQL',
        requests: fallbackRequests,
      });
    } catch (fallbackError) {
      return NextResponse.json(
        { source: 'PostgreSQL', requests: [], error: 'Database error' },
        { status: 500 }
      );
    }
  }
}

/**
 * POST /api/requests
 * Creates a new help request in PostgreSQL and invalidates the Redis cache.
 *
 * Expected Request:
 * {
 *   "student_name": "Abhi",
 *   "message": "How do I reset my campus Wi-Fi password?"
 * }
 *
 * Expected Successful Response (201):
 * {
 *   "success": true,
 *   "id": 7
 * }
 *
 * Expected Invalid Response (400):
 * {
 *   "success": false,
 *   "error": "student_name and message are required"
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: 'student_name and message are required' },
        { status: 400 }
      );
    }

    const student_name = typeof body.student_name === 'string' ? body.student_name.trim() : '';
    const message = typeof body.message === 'string' ? body.message.trim() : '';

    // Validation: Reject empty name or empty message
    if (!student_name || !message) {
      return NextResponse.json(
        { success: false, error: 'student_name and message are required' },
        { status: 400 }
      );
    }

    // Constraint validation: student_name VARCHAR(50), message VARCHAR(200)
    if (student_name.length > 50) {
      return NextResponse.json(
        { success: false, error: 'student_name cannot exceed 50 characters' },
        { status: 400 }
      );
    }

    if (message.length > 200) {
      return NextResponse.json(
        { success: false, error: 'message cannot exceed 200 characters' },
        { status: 400 }
      );
    }

    // Insert into PostgreSQL using parameterized query
    const { id } = await insertHelpRequest(student_name, message);

    // Invalidate Redis cache key "help:latest"
    await invalidateLatestRequestsCache();

    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/requests:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
