# P&B — iOS Build & Install Guide

This is a **WKWebView wrapper** for `https://pnbapp.vercel.app` — a native iOS
shell that loads your live app full-screen with camera/mic access, push
notifications, and proper status bar styling.

---

## Prerequisites

- A **Mac** with Xcode 15+ installed (free from Mac App Store)
- An **Apple ID** (free — enough to sideload on your own device)
- An iPhone running iOS 16+

---

## Option A — Run directly on your iPhone (Free, 5 min)

### Steps

1. **Open the project**
   ```
   Double-click PnB.xcodeproj
   ```
   Or: Xcode → File → Open → select the `PnB/` folder

2. **Set your Team** (sign the app)
   - Click **PnB** in the project navigator (top left)
   - Select the **PnB target** → **Signing & Capabilities**
   - Under **Team**, select your personal Apple ID
   - Xcode will auto-generate a provisioning profile

3. **Change the Bundle ID** (must be unique)
   - Change `com.pnbapp.ios` to something like `com.yourname.pnb`

4. **Select your device**
   - Plug in your iPhone via USB
   - In the toolbar, select your iPhone from the device dropdown (next to the ▶ button)

5. **Hit Run ▶**
   - Xcode builds and installs (~30 sec)
   - First time: on your iPhone go to  
     **Settings → General → VPN & Device Management → [Your Apple ID] → Trust**

Done — the app icon appears on your home screen.

---

## Option B — Build an IPA for sharing (Paid Apple Developer account, $99/yr)

```
Product → Archive → Distribute App → Ad Hoc / Development
```

This produces a `.ipa` you can share via TestFlight or direct install.

---

## Option C — No Mac? Use a cloud build service

Services that build iOS apps without a Mac:

| Service | Free tier | Link |
|---------|-----------|------|
| **Codemagic** | 500 min/month free | codemagic.io |
| **Expo EAS** | Limited free | expo.dev/eas |
| **GitHub Actions + macOS runner** | 2000 min/month (public repos) | github.com |

Upload this project folder and trigger a build — it'll produce a `.ipa`.

---

## What's in the project

| File | Purpose |
|------|---------|
| `ContentView.swift` | Entire app — SwiftUI + WKWebView wrapper |
| `Info.plist` | Permissions, orientations, ATS config |
| `LaunchScreen.storyboard` | Dark splash screen with your icon centered |
| `Assets.xcassets/AppIcon.appiconset/` | All 15 required iOS icon sizes, pre-generated |

---

## Features baked in

- ✅ Full-screen (no Safari chrome)
- ✅ Dark mode forced (matches your `#080A0E` background)
- ✅ Camera + microphone permission prompts (for WebRTC calls)
- ✅ Portrait-only orientation lock
- ✅ External links open in Safari (Firebase auth redirects etc)
- ✅ `target="_blank"` links open inline
- ✅ Background modes for push notifications + VoIP
- ✅ Native JS alert dialogs
- ✅ Back/forward swipe gestures

---

## App details

| | |
|---|---|
| Bundle ID | `com.pnbapp.ios` (change before running) |
| Version | 1.8.0 (build 18) |
| URL | `https://pnbapp.vercel.app/chat` |
| Min iOS | 16.0 |
| Swift | 5.0 |
| Orientation | Portrait only |

