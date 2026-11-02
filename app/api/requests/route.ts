import { NextRequest, NextResponse } from 'next/server';
import { insertHelpRequest } from '@/lib/db';
import { invalidateLatestRequestsCache } from '@/lib/redis';

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

    // Validate non-empty fields
    if (!student_name || !message) {
      return NextResponse.json(
        { success: false, error: 'student_name and message are required' },
        { status: 400 }
      );
    }

    // Additional length validation based on database schema
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

    // Insert into PostgreSQL with parameterized query
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
