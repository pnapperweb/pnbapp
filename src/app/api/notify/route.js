import { NextResponse } from 'next/server';

// Send FCM push notification to a device token
// Called when a new message or call is initiated
export async function POST(request) {
  try {
    const { fcmToken, title, body, data } = await request.json();
    if (!fcmToken) return NextResponse.json({ error: 'fcmToken required' }, { status: 400 });

    const serverKey = process.env.FCM_SERVER_KEY;
    if (!serverKey) return NextResponse.json({ error: 'FCM_SERVER_KEY not configured' }, { status: 500 });

    const res = await fetch('https://fcm.googleapis.com/fcm/send', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `key=${serverKey}`,
      },
      body: JSON.stringify({
        to:           fcmToken,
        notification: { title, body, icon: '/icon.png', click_action: 'FLUTTER_NOTIFICATION_CLICK' },
        data:         data || {},
        priority:     'high',
      }),
    });

    const result = await res.json();
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
