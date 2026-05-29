# Deploying P&B to Vercel

## Local development

```bash
npm install
npm run dev
# → http://localhost:3000
```

---

## Deploy to Vercel (current setup — pnbapp.vercel.app)

### Option A — Drag & drop zip (what you're doing now)

1. Go to https://vercel.com → your `paulandbrooke` project
2. **Settings → Git** — if connected to GitHub, disconnect it first OR use Option B below
3. Go to the **Deployments** tab → click **Deploy** → drag the zip
4. ⚠️ **After uploading**: go to Deployments, find the new one, click the three-dot menu → **Promote to Production**
5. Hard-refresh the browser (`Cmd+Shift+R` / `Ctrl+Shift+R`) to bust the cache

### Option B — GitHub (recommended for ongoing updates)

```bash
# First time
git init && git add . && git commit -m "P&B update"
gh repo create pandb-web --private --push --source=.

# Every update
git add . && git commit -m "update" && git push
# Vercel auto-deploys on push
```

### Environment variables (Vercel → Settings → Environment Variables)

| Key | Value |
|-----|-------|
| NEXT_PUBLIC_FIREBASE_API_KEY | AIzaSyCPsYlID8_6gpdJnKwpCEdlBbTym7t-az8 |
| NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN | pnbapp-c0d76.firebaseapp.com |
| NEXT_PUBLIC_FIREBASE_PROJECT_ID | pnbapp-c0d76 |
| NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET | pnbapp-c0d76.firebasestorage.app |
| NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID | 704901765343 |
| NEXT_PUBLIC_FIREBASE_APP_ID | 1:704901765343:web:7b4c23c9a8fbe36013316a |
| ANTHROPIC_API_KEY | (your key) |

---

## Firebase Firestore rules

Paste in Firebase Console → Firestore → Rules → Publish:

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
      match /offerCandidates/{doc} { allow read, write: if request.auth != null; }
      match /answerCandidates/{doc} { allow read, write: if request.auth != null; }
    }
  }
}
```

## Note on image/video uploads

Images and videos are compressed and stored as base64 directly in Firestore messages.
Firebase Storage is NOT used — no Storage rules needed.
