import { NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/admin-auth';
import { getServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const supabase = getServiceClient();

  const [{ data: search }, { data: ads }] = await Promise.all([
    supabase.from('spy_searches').select('id, keyword, ad_count, created_at, brief').eq('id', id).single(),
    supabase.from('spy_ads').select('*').eq('search_id', id).order('winner_score', { ascending: false }),
  ]);

  if (!search) return NextResponse.json({ error: 'Search not found' }, { status: 404 });
  return NextResponse.json({ search, ads: ads ?? [] });
}
