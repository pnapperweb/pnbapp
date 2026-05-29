importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            'AIzaSyCPsYlID8_6gpdJnKwpCEdlBbTym7t-az8',
  authDomain:        'pnbapp-c0d76.firebaseapp.com',
  projectId:         'pnbapp-c0d76',
  storageBucket:     'pnbapp-c0d76.firebasestorage.app',
  messagingSenderId: '704901765343',
  appId:             '1:704901765343:web:7b4c23c9a8fbe36013316a',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  const { title, body, icon, data } = payload.notification || payload.data || {};
  self.registration.showNotification(title || 'P&B', {
    body:    body || 'You have a new notification',
    icon:    icon || '/icon.png',
    badge:   '/icon.png',
    tag:     data?.chatId || 'pandb',
    data:    data || {},
    actions: data?.callType
      ? [{ action: 'accept', title: '✅ Accept' }, { action: 'decline', title: '❌ Decline' }]
      : [{ action: 'open', title: 'Open' }],
  });
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const data = event.notification.data || {};
  const url  = data.chatId ? `/chat/${data.chatId}` : '/chat';
  if (event.action === 'decline') return;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const c of clientList) {
        if (c.url.includes(self.location.origin) && 'focus' in c) {
          c.postMessage({ type: 'NOTIFICATION_CLICK', data });
          return c.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
