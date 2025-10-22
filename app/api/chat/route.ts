import { NextRequest } from 'next/server';
import { streamText } from 'ai';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const messages = body?.messages ?? [];
  const result = await streamText({
    model: 'moonshotai/kimi-k2-0905',
    messages
  });
  return result.toTextStreamResponse();
}
