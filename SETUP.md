# Paul & Brooke — Setup Guide

## Run locally

```
npm install
npm run dev
```
Open http://localhost:3000

## Deploy to Vercel (recommended — free)

1. Push to GitHub:
```
git init
git add .
git config --global user.email "your@email.com"
git config --global user.name "Your Name"
git commit -m "Paul & Brooke"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -f origin main
```

2. Go to https://vercel.com → New Project → Import your GitHub repo
3. Leave all settings as default → Deploy
4. Done — live URL in 2 minutes

## Required: Firestore Security Rules

Go to https://console.firebase.google.com → your project → Firestore → Rules tab
Paste the rules from FIRESTORE_RULES.md → Publish

## Required: Firebase Storage Rules

Go to Firebase Console → Storage → Rules tab
Paste:
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Environment variables (already set in .env.local)
All keys are pre-configured. No changes needed.
