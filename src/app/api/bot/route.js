import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { prompt, messages = [] } = await request.json();

    const systemPrompt = `You are pnb-bot, a helpful AI assistant built into the P&B private messaging platform.
You help users summarise conversations, draft replies, extract tasks, and answer questions.
Be concise and friendly. When summarising, focus on key points and action items.`;

    const userContent = messages.length > 0
      ? `Conversation context:\n\n${messages.map(m => `${m.senderName}: ${m.text}`).join('\n')}\n\n---\n\n${prompt}`
      : prompt;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      }),
    });

    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.error?.message || 'AI error' }, { status: res.status });
    return NextResponse.json({ text: data.content?.[0]?.text || 'No response.' });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
