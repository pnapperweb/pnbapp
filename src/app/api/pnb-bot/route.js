import { NextResponse } from 'next/server';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Detect scheduling intent: "send X to Y at Z"
function parseScheduleIntent(query) {
  const pattern = /send\s+['"]?(.+?)['"]?\s+to\s+([a-zA-Z\s]+?)\s+at\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{2}:\d{2})/i;
  const match = query.match(pattern);
  if (!match) return null;
  return {
    message:    match[1].trim(),
    targetName: match[2].trim(),
    timeStr:    match[3].trim(),
  };
}

export async function POST(request) {
  try {
    const { context, userQuery, userId } = await request.json();
    if (!ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });

    // ── Handle schedule intent ────────────────────────────────────────────
    const sched = parseScheduleIntent(userQuery);
    if (sched) {
      return NextResponse.json({
        reply: `Got it! I'll schedule your message.`,
        scheduleAction: sched,
      });
    }

    // ── Regular AI reply ──────────────────────────────────────────────────
    const system = `You are pnb-bot, a warm and helpful AI assistant built into P&B — a private encrypted messaging app used exclusively by Paul Napper and his partner Brooke Napper.
You have been provided their recent chat messages as context below. Always use this context when answering — never say you lack access to messages or chat history.
You help Paul summarise conversations, identify tasks or plans, draft replies, and answer questions about what was discussed.
You can also schedule messages — if Paul says "Send 'hello' to Brooke at 8am", reply with a confirmation and include a JSON block like:
<schedule>{"message":"hello","targetName":"Brooke","time":"08:00"}</schedule>
Be warm, personal, and concise. This is a couples app so respond with that intimacy in mind.
Current date/time: ${new Date().toLocaleString('en-AU')}

Chat context (use this to answer all questions):
${context || '(No messages loaded yet — answer helpfully based on the question alone.)'}`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system,
        messages: [{ role: 'user', content: userQuery }],
      }),
    });

    if (!res.ok) {
      const e = await res.json();
      return NextResponse.json({ error: e.error?.message }, { status: res.status });
    }

    const data  = await res.json();
    const text  = data.content?.[0]?.text || 'No response.';

    // Check if Claude embedded a schedule block
    const schedMatch = text.match(/<schedule>([\s\S]*?)<\/schedule>/);
    if (schedMatch) {
      try {
        const scheduleAction = JSON.parse(schedMatch[1]);
        return NextResponse.json({
          reply: text.replace(/<schedule>[\s\S]*?<\/schedule>/, '').trim(),
          scheduleAction,
        });
      } catch {}
    }

    return NextResponse.json({ reply: text });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
