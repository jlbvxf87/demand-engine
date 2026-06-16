import { NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Proxy Meta ad snapshot URLs so the token is always current.
// Stored snapshot URLs bake the old token in — this strips it and injects the live token.
export async function GET(req: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = process.env.META_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'META_ACCESS_TOKEN not configured' }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const storedUrl = searchParams.get('url');
  if (!storedUrl) {
    return NextResponse.json({ error: 'url required' }, { status: 400 });
  }

  try {
    const parsed = new URL(storedUrl);
    parsed.searchParams.set('access_token', token);
    return NextResponse.redirect(parsed.toString());
  } catch {
    return NextResponse.json({ error: 'Invalid snapshot URL' }, { status: 400 });
  }
}
