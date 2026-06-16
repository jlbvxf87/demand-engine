import { NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/admin-auth';
import { getServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const supabase = getServiceClient();
  const { data } = await supabase
    .from('spy_searches')
    .select('id, keyword, ad_count, created_at')
    .order('created_at', { ascending: false })
    .limit(20);
  return NextResponse.json({ searches: data ?? [] });
}
