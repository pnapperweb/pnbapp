'use client';
import { useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export function usePushNotifications(user) {
  useEffect(() => {
    if (!user || typeof window === 'undefined') return;
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;

    async function setup() {
      try {
        // Register service worker
        const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

        // Request permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        // Get FCM token
        const { getMessaging, getToken } = await import('firebase/messaging');
        const { default: app }           = await import('../lib/firebase');
        const messaging = getMessaging(app);

        const fcmToken = await getToken(messaging, {
          vapidKey:          process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
          serviceWorkerRegistration: reg,
        });

        if (fcmToken) {
          // Save token to user document so server can send notifications
          await updateDoc(doc(db, 'users', user.uid), { fcmToken, fcmUpdatedAt: new Date() });
        }

        // Handle foreground messages
        const { onMessage } = await import('firebase/messaging');
        onMessage(messaging, payload => {
          const { title, body } = payload.notification || {};
          if (title && Notification.permission === 'granted') {
            new Notification(title, { body, icon: '/icon.png' });
          }
        });
      } catch (e) {
        console.warn('Push notification setup failed:', e.message);
      }
    }

    setup();
  }, [user]);
}
