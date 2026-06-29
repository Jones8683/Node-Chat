# Node Chat

A private, invite-only chat app built with Vue 3 and Firebase. Runs in the browser or as a Windows desktop app via Tauri.

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/Jones8683/Node-Chat
cd Node-Chat
npm install
```

### 2. Configure

```bash
cp .env.example .env
```

Fill in your Firebase project credentials (find them in **Firebase Console → Project Settings → Your apps**) and your Giphy API key.

### 3. Deploy database rules

In the Firebase console go to **Realtime Database → Rules**, paste the contents of `database.rules.json`, and publish.

### 4. Run

```bash
# Web
npm run dev

# Desktop
npm run tauri:dev
```

### 5. First account

Create an invite token manually in the database under `/invites/$token`, sign up, then set `/owner` in the database to your UID. After that you can manage everything from the Admin panel.

---

## Build

```bash
# Web
npm run build

# Desktop
npm run tauri:build
```

---
