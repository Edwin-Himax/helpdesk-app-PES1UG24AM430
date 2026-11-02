import { NextRequest, NextResponse } from 'next/server';
import { incrementBoardViews, getBoardViews } from '@/lib/redis';

export const dynamic = 'force-dynamic';

/**
 * GET /api/views
 * Query param: ?increment=true (default) to increment using atomic Redis INCR
 * Query param: ?increment=false to just read the current count
 *
 * Response:
 * {
 *   "views": 42,
 *   "count": 42
 * }
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const shouldIncrement = searchParams.get('increment') !== 'false';

    let views: number;
    if (shouldIncrement) {
      views = await incrementBoardViews();
    } else {
      views = await getBoardViews();
    }

    return NextResponse.json({
      views,
      count: views,
    });
  } catch (error) {
    console.error('Error handling GET /api/views:', error);
    return NextResponse.json(
      { views: 0, count: 0, error: 'Failed to access view counter' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/views
 * Increments Redis key `help:views` using atomic Redis INCR.
 * "Use Redis INCR, not a read-then-write sequence."
 *
 * Response:
 * {
 *   "success": true,
 *   "views": 43,
 *   "count": 43
 * }
 */
export async function POST() {
  try {
    const views = await incrementBoardViews();
    return NextResponse.json({
      success: true,
      views,
      count: views,
    });
  } catch (error) {
    console.error('Error handling POST /api/views:', error);
    return NextResponse.json(
      { success: false, views: 0, error: 'Failed to increment view counter' },
      { status: 500 }
    );
  }
}
