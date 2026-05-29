# Firestore + Storage Rules

## How to update Firestore rules

1. Go to https://console.firebase.google.com → select pnbapp
2. Click **Firestore Database** → **Rules** tab
3. Replace ALL content with the rules below → click **Publish**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /users/{uid} {
      allow read:  if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == uid;
    }

    match /chats/{chatId} {
      allow read:   if request.auth != null && request.auth.uid in resource.data.members;
      allow create: if request.auth != null && request.auth.uid in request.resource.data.members;
      allow update: if request.auth != null && request.auth.uid in resource.data.members;
      allow delete: if false;
    }

    match /messages/{messageId} {
      allow read:   if request.auth != null;
      allow create: if request.auth != null && request.resource.data.senderId == request.auth.uid;
      allow update: if request.auth != null;
      allow delete: if false;
    }

    match /callSignals/{uid} {
      allow read:   if request.auth != null && request.auth.uid == uid;
      allow write:  if request.auth != null;
      allow delete: if request.auth != null;
    }

    match /calls/{callId} {
      allow read, write: if request.auth != null;
      match /offerCandidates/{doc} {
        allow read, write: if request.auth != null;
      }
      match /answerCandidates/{doc} {
        allow read, write: if request.auth != null;
      }
    }
  }
}
```

## Vercel environment variables to add

Go to Vercel → your project → Settings → Environment Variables and add:

| Key | Value |
|-----|-------|
| NEXT_PUBLIC_FIREBASE_API_KEY | AIzaSyCPsYlID8_6gpdJnKwpCEdlBbTym7t-az8 |
| NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN | pnbapp-c0d76.firebaseapp.com |
| NEXT_PUBLIC_FIREBASE_PROJECT_ID | pnbapp-c0d76 |
| NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET | pnbapp-c0d76.firebasestorage.app |
| NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID | 704901765343 |
| NEXT_PUBLIC_FIREBASE_APP_ID | 1:704901765343:web:7b4c23c9a8fbe36013316a |
| NEXT_PUBLIC_STREAM_API_KEY | ujfp2tzc6vn3 |
| STREAM_API_SECRET | sftwjrv9vwacckcpvv2x5svyasnt46bz5ushq9fga5dsnsz8wy9rmkb8t5bqzgmm |

After adding, redeploy.

## Note on image uploads

Images are now stored as compressed base64 directly in Firestore messages.
Firebase Storage is NOT needed for chat images or avatars.
No CORS configuration required.
