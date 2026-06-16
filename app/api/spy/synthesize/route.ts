import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { isAdminAuthed } from '@/lib/admin-auth';
import { isMachineAuthed } from '@/lib/machine-auth';
import { getServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const SYSTEM = `You are a senior media buyer and direct response strategist with $50M+ in Meta health ad spend. You write crisp, actionable research briefs for creative teams. No fluff. Numbers whenever possible. Think like someone briefing a team in 60 seconds.`;

type BrandInput = {
  page_name: string | null;
  totalAdCount: number;
  winnerScore: number;
  spendMin: number;
  spendMax: number;
  daysRunning: number;
  adBody: string | null;
};

export async function POST(req: Request) {
  if (!(await isAdminAuthed()) && !isMachineAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { brands, keyword, search_id } = (await req.json()) as {
    brands: BrandInput[];
    keyword: string;
    /** Optional — when present, the brief gets persisted onto this row. */
    search_id?: string;
  };

  if (!brands?.length) {
    return NextResponse.json({ error: 'brands required' }, { status: 400 });
  }

  const client = new Anthropic();

  const brandLines = brands.slice(0, 8).map((b, i) => {
    const spendMid = (b.spendMin + b.spendMax) / 2;
    const monthlyEst = b.daysRunning > 0 && spendMid > 0
      ? `~$${Math.round((spendMid / b.daysRunning) * 30 / 1000)}K/mo`
      : 'spend hidden';
    return `${i + 1}. ${b.page_name ?? 'Unknown'} — ${b.totalAdCount} ads · ${b.daysRunning}d running · ${monthlyEst} · score ${b.winnerScore}
   Copy: "${(b.adBody ?? '').slice(0, 180)}"`;
  }).join('\n\n');

  const resp = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 700,
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: `Keyword: "${keyword}"

Brands found (ranked by winner score):
${brandLines}

Write a research brief with exactly these 5 sections. Use bullet points. Be specific:

**Market Signal** — who's dominating, what tier, overall competition level
**Dominant Patterns** — hook types, funnel approaches, and angles that are winning across these brands
**Spend Leaders** — top 2-3 brands with estimated monthly spend and why they're winning
**Gap / Opportunity** — what angle, hook, or audience is NOT being owned that a smart entrant could take
**Recommended Play** — specific funnel type + hook + positioning to compete in this market right now`,
    }],
  });

  const brief = resp.content.find(c => c.type === 'text')?.text?.trim() ?? '';

  // Persist the brief so loading this search later via Recent Searches
  // restores it instead of regenerating (or worse — losing it entirely).
  if (search_id && brief) {
    const supabase = getServiceClient();
    await supabase.from('spy_searches').update({ brief }).eq('id', search_id);
  }

  return NextResponse.json({ brief });
}
