![node-chat](https://socialify.git.ci/jones8683/node-chat/image?custom_language=Vue&description=1&font=Inter&issues=1&language=1&logo=https%3A%2F%2Fraw.githubusercontent.com%2FJones8683%2FNode-Chat%2Fmain%2Fpublic%2Ffavicon.png&name=1&owner=1&pattern=Diagonal+Stripes&stargazers=1&theme=Dark)

<p align="center">
 A private, invite-only chat app built with Vue 3 and Firebase. Runs in the browser or as a Windows desktop app via Tauri.
</p>

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
