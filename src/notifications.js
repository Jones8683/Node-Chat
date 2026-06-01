import { isTauri } from "@tauri-apps/api/core";
import { randomId } from "./randomId";

let tauriNotificationModulePromise = null;

const notificationHistory = new Map();
const NOTIFICATION_THROTTLE_MS = 1500;
const NOTIFICATION_HISTORY_SIZE = 50;

const TAB_ID = randomId();

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

export async function sendSystemNotification({ title, body = "", icon } = {}) {
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
    notificationHistory.delete(notificationHistory.keys().next().value);
  }

  try {
    if (isTauri()) {
      return await sendTauriNotification({ title, body, icon });
    } else {
      return await sendWebNotification({ title, body, icon });
    }
  } catch (err) {
    console.error("Failed to send notification:", err);
    return false;
  }
}

async function sendTauriNotification({ title, body, icon }) {
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
      silent: true,
      ...(icon ? { icon } : {}),
    });

    return true;
  } catch (err) {
    console.error("Tauri notification failed:", err);
    return false;
  }
}

async function sendWebNotification({ title, body, icon }) {
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
      tag: `${TAB_ID}:${hashNotification({ title, body })}`,
      requireInteraction: false,
      badge: "/icon.png",
      silent: true,
    });

    const closeTimer = setTimeout(() => {
      notification.close();
    }, 5000);

    notification.onclose = () => {
      clearTimeout(closeTimer);
    };

    notification.onclick = (event) => {
      try {
        event?.preventDefault?.();
        if (typeof parent !== "undefined" && parent !== window) {
          try {
            parent.focus?.();
          } catch {}
        }
        if (
          typeof window !== "undefined" &&
          typeof window.focus === "function"
        ) {
          window.focus();
        }
      } catch {}
      notification.close();
    };

    return true;
  } catch (err) {
    console.error("Web notification failed:", err);
    return false;
  }
}
