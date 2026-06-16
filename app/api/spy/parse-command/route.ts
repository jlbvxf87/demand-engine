import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { isAdminAuthed } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SYSTEM = `You convert natural language search requests into the most accurate keyword query for Meta's Ad Library.

COMMAND SYNTAX:
- Plain text = the search keyword (2-4 words — Meta searches ad copy AND advertiser names)
- brands:N = number of unique brands to return
- video = video ads only
- image = image ads only
- proven = proven winners (30+ days, significant spend)
- dominant = highest tier advertisers only
- scaling = emerging advertisers only
- min-days:N = ads running at least N days
- inactive = inactive/stopped ads
- all-ads = active + inactive

ACCURACY RULES — always pick the most specific keyword for the vertical:
- GLP-1 / semaglutide / weight loss medication / Ozempic → "GLP-1"
- TRT / testosterone / low T / men's health hormones → "testosterone TRT"
- Peptides / BPC-157 / sermorelin / TB-500 → "peptides" (or specific compound if named)
- Joint pain / cortisone / orthopedic / surgery alternative → "joint pain"
- Brand searches: use the brand's full real name as it appears on Facebook
- "profitable" / "winning" / "best performing" / "most successful" → proven
- "long running" / "established" / "been running months" → min-days:30
- Strip all filler: "show me", "find", "get", "look up", "their", "all", "can you"
- Return ONLY the command string. No explanation. No quotes.

EXAMPLES:
"show me Gameday Men's Health ads" → "Gameday Men's Health"
"Hims TRT video ads" → "Hims TRT video"
"top 5 proven GLP-1 brands" → "GLP-1 brands:5 proven"
"most profitable weight loss brands running video" → "GLP-1 brands:10 proven video"
"find semaglutide ads running 60+ days" → "semaglutide min-days:60"
"show all inactive TRT ads" → "testosterone TRT inactive"
"top 3 peptide brands" → "peptides brands:3"
"Fridays Health" → "Fridays Health"
"Beyond the Scale transformation ads" → "Beyond the Scale"
"dominant joint pain advertisers" → "joint pain dominant brands:5"
"what brands are spending most on GLP-1" → "GLP-1 brands:10 proven"`;

export async function POST(req: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { input } = (await req.json()) as { input?: string };
  if (!input?.trim()) {
    return NextResponse.json({ error: 'input required' }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ command: input });
  }

  const client = new Anthropic({ apiKey });

  try {
    const resp = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 60,
      system: SYSTEM,
      messages: [{ role: 'user', content: input.trim() }],
    });

    const text = resp.content.find(c => c.type === 'text')?.text?.trim() ?? input;
    return NextResponse.json({ command: text });
  } catch {
    return NextResponse.json({ command: input });
  }
}
