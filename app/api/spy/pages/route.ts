import { NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type MetaPageResult = {
  id: string;
  name: string;
  category?: string;
  fan_count?: number;
};

type MetaSearchResponse = {
  data: MetaPageResult[];
  error?: { message?: string; code?: number };
};

export async function GET(req: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = process.env.META_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: 'META_ACCESS_TOKEN not configured' },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim();
  if (!q) {
    return NextResponse.json({ error: 'q query param is required' }, { status: 400 });
  }

  const params = new URLSearchParams({
    q,
    type: 'page',
    fields: 'id,name,category,fan_count',
    limit: '10',
    access_token: token,
  });

  const metaRes = await fetch(
    `https://graph.facebook.com/v21.0/search?${params.toString()}`
  );

  const metaData = (await metaRes.json()) as MetaSearchResponse;

  if (!metaRes.ok || metaData.error) {
    return NextResponse.json(
      { error: metaData.error?.message ?? 'Meta API error' },
      { status: 502 }
    );
  }

  const pages = (metaData.data ?? []).slice(0, 5).map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category ?? null,
    fan_count: p.fan_count ?? null,
  }));

  return NextResponse.json({ pages });
}
