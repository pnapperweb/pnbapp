import { NextResponse } from 'next/server';

// Server-side Giphy proxy — API key never exposed to browser
// Free key: https://developers.giphy.com/ → Create App → SDK (takes 2 mins, no CC)
const GIPHY_KEY = process.env.GIPHY_API_KEY || '';

export async function GET(request) {
  if (!GIPHY_KEY) {
    return NextResponse.json({ error: 'GIPHY_API_KEY not set', data: [] }, { status: 500 });
  }
  const { searchParams } = new URL(request.url);
  const q     = searchParams.get('q') || '';
  const limit = searchParams.get('limit') || '24';

  const endpoint = q.trim()
    ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(q)}&limit=${limit}&rating=g&lang=en`
    : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=${limit}&rating=g`;

  try {
    const res  = await fetch(endpoint, { next: { revalidate: 60 } });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e.message, data: [] }, { status: 500 });
  }
}
