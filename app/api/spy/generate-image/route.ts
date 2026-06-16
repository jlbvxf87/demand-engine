import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { isAdminAuthed } from '@/lib/admin-auth';
import { isMachineAuthed } from '@/lib/machine-auth';
import { getServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PROMPT_SYSTEM = `You write photorealistic DALL-E 3 image prompts for health vertical ad creatives.

RULES:
- Always photorealistic, professional ad photography style
- Focus on lifestyle and emotion — never show medical procedures, pills, injections, or dramatic before/after
- Show the OUTCOME feeling: confidence, energy, vitality, freedom, joy
- Real people in real settings — not clinical, not stock-photo cheesy
- Lighting: warm, natural, cinematic
- No text, logos, or overlays in the image
- Aspect ratio note: always end with "16:9 cinematic crop, magazine quality"

OUTPUT: Return only the image prompt. No explanation. No quotes. Just the prompt.`;

export async function POST(req: Request) {
  if (!(await isAdminAuthed()) && !isMachineAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!anthropicKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  if (!openaiKey) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });

  const { ad_id } = (await req.json()) as { ad_id: string };
  if (!ad_id) return NextResponse.json({ error: 'ad_id required' }, { status: 400 });

  const supabase = getServiceClient();
  const { data: ad } = await supabase
    .from('spy_ads')
    .select('page_name, page_headline, page_offer, page_product, vertical, intelligence_json, psychology_json')
    .eq('id', ad_id)
    .single();

  if (!ad) return NextResponse.json({ error: 'Ad not found' }, { status: 404 });

  const intel = ad.intelligence_json as Record<string, string> | null;
  const psych = ad.psychology_json as Record<string, string> | null;

  const context = [
    `Brand: ${ad.page_name ?? 'unknown'}`,
    `Vertical: ${ad.vertical ?? 'health'}`,
    `Headline: ${ad.page_headline ?? 'not available'}`,
    `Product: ${ad.page_product ?? 'not available'}`,
    `Offer: ${ad.page_offer ?? 'not available'}`,
    `Funnel type: ${intel?.funnel_type ?? 'unknown'}`,
    `Hook type: ${intel?.hook_type ?? 'unknown'}`,
    `Core desire: ${psych?.core_desire_activated ?? 'feeling healthy and confident'}`,
    `Core fear: ${psych?.core_fear_activated ?? 'unknown'}`,
    `Identity hook: ${psych?.identity_hook ?? 'unknown'}`,
  ].join('\n');

  // Step 1: Haiku writes the DALL-E prompt
  const haiku = new Anthropic({ apiKey: anthropicKey });
  let imagePrompt: string;

  try {
    const resp = await haiku.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: PROMPT_SYSTEM,
      messages: [{ role: 'user', content: `Write a DALL-E 3 image prompt for this ad:\n\n${context}` }],
    });
    imagePrompt = resp.content.find(c => c.type === 'text')?.text?.trim() ?? '';
  } catch {
    return NextResponse.json({ error: 'Failed to generate image prompt' }, { status: 500 });
  }

  if (!imagePrompt) {
    return NextResponse.json({ error: 'Empty image prompt from Haiku' }, { status: 500 });
  }

  const openai = new OpenAI({ apiKey: openaiKey });

  try {
    const image = await openai.images.generate({
      model: 'gpt-image-1',
      prompt: imagePrompt,
      n: 1,
      size: '1536x1024',
      quality: 'high',
    });

    const b64 = image.data?.[0]?.b64_json;
    const url  = image.data?.[0]?.url;
    const finalUrl = url ?? (b64 ? `data:image/png;base64,${b64}` : null);
    if (!finalUrl) return NextResponse.json({ error: 'No image returned' }, { status: 500 });

    return NextResponse.json({ image_url: finalUrl, prompt: imagePrompt });
  } catch (e) {
    return NextResponse.json(
      { error: `DALL-E error: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    );
  }
}
