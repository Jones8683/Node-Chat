import { isTauri } from "@tauri-apps/api/core";

let tauriNotificationModulePromise = null;
let appWindowPromise = null;

const notificationHistory = new Map();
const NOTIFICATION_THROTTLE_MS = 1500;
const NOTIFICATION_HISTORY_SIZE = 50;

function hashNotification({ title, body }) {
  return `${title}|${body}`;
}

async function getTauriNotificationModule() {
  if (!isTauri()) return null;
  if (!tauriNotificationModulePromise) {
    tauriNotificationModulePromise = import("@tauri-apps/plugin-notification")
      .then((mod) => mod)
      .catch(() => null);
  }
  return tauriNotificationModulePromise;
}

async function getTauriWindowModule() {
  if (!isTauri()) return null;
  if (!appWindowPromise) {
    appWindowPromise = import("@tauri-apps/api/window")
      .then((mod) => mod.appWindow)
      .catch(() => null);
  }
  return appWindowPromise;
}

export function notificationsSupported() {
  if (isTauri()) return true;
  return typeof window !== "undefined" && "Notification" in window;
}

export async function ensureNotificationPermission() {
  try {
    if (isTauri()) {
      const notification = await getTauriNotificationModule();
      if (!notification) return false;

      const granted = await notification.isPermissionGranted();
      if (granted) return true;

      const permission = await notification.requestPermission();
      return permission === "granted";
    }

    if (!notificationsSupported()) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;

    const permission = await Notification.requestPermission();
    return permission === "granted";
  } catch (err) {
    console.error("Failed to request notification permission:", err);
    return false;
  }
}

export async function sendSystemNotification({
  title,
  body = "",
  icon,
  silent = false,
} = {}) {
  if (!title || typeof title !== "string") {
    console.error("Invalid notification title");
    return false;
  }

  const hash = hashNotification({ title, body });
  const now = Date.now();
  const lastTime = notificationHistory.get(hash);

  if (lastTime && now - lastTime < NOTIFICATION_THROTTLE_MS) {
    return false;
  }
  notificationHistory.set(hash, now);
  if (notificationHistory.size > NOTIFICATION_HISTORY_SIZE) {
    const oldest = Math.min(...notificationHistory.values());
    for (const [key, time] of notificationHistory.entries()) {
      if (time === oldest) {
        notificationHistory.delete(key);
        break;
      }
    }
  }

  try {
    if (isTauri()) {
      return await sendTauriNotification({ title, body, icon, silent });
    } else {
      return await sendWebNotification({ title, body, icon, silent });
    }
  } catch (err) {
    console.error("Failed to send notification:", err);
    return false;
  }
}

async function sendTauriNotification({ title, body, icon, silent }) {
  const notification = await getTauriNotificationModule();
  if (!notification) return false;

  try {
    const granted = await notification.isPermissionGranted();
    if (!granted) {
      console.warn("Notification permission not granted");
      return false;
    }

    await notification.sendNotification({
      title: title.slice(0, 256),
      body: body.slice(0, 256),
      ...(icon ? { icon } : {}),
    });

    if (!silent) {
      playNotificationSound().catch(() => {});
    }

    try {
      const appWindow = await getTauriWindowModule();
      if (appWindow) {
        appWindow.minimize(false).catch(() => {});
      }
    } catch (err) {}

    return true;
  } catch (err) {
    console.error("Tauri notification failed:", err);
    return false;
  }
}

async function sendWebNotification({ title, body, icon, silent }) {
  if (!notificationsSupported()) {
    return false;
  }

  if (Notification.permission !== "granted") {
    console.warn("Notification permission not granted");
    return false;
  }

  try {
    const notification = new Notification(title, {
      body,
      icon: icon || "/icon.png",
      tag: hashNotification({ title, body }),
      requireInteraction: false,
      badge: "/icon.png",
      silent: silent,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    const closeTimer = setTimeout(() => {
      notification.close();
    }, 5000);

    notification.onclose = () => {
      clearTimeout(closeTimer);
    };

    return true;
  } catch (err) {
    console.error("Web notification failed:", err);
    return false;
  }
}

async function playNotificationSound() {
  try {
    if (document.hidden || typeof AudioContext === "undefined") {
      return;
    }

    const audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
    const now = audioContext.currentTime;
    const duration = 0.1;

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = "sine";

    gainNode.gain.setValueAtTime(0.3, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);

    oscillator.start(now);
    oscillator.stop(now + duration);
  } catch (err) {}
}

export function clearNotificationHistory() {
  notificationHistory.clear();
}
