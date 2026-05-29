import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';

const API_KEY    = process.env.NEXT_PUBLIC_STREAM_API_KEY || 'ujfp2tzc6vn3';
const API_SECRET = process.env.STREAM_API_SECRET         || 'sftwjrv9vwacckcpvv2x5svyasnt46bz5ushq9fga5dsnsz8wy9rmkb8t5bqzgmm';

function generateToken(userId) {
  const header  = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now     = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ user_id: userId, iat: now - 1 })).toString('base64url');
  const sig     = createHmac('sha256', API_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${sig}`;
}

export async function POST(request) {
  try {
    const { uid } = await request.json();
    if (!uid) return NextResponse.json({ error: 'uid required' }, { status: 400 });
    return NextResponse.json({ token: generateToken(uid) });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
