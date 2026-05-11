import { isTauri } from "@tauri-apps/api/core";

let tauriNotificationModulePromise = null;

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
  } catch {
    return false;
  }
}

export async function sendSystemNotification({ title, body = "", icon }) {
  try {
    if (isTauri()) {
      const notification = await getTauriNotificationModule();
      if (!notification) return false;

      const granted = await notification.isPermissionGranted();
      if (!granted) return false;

      await notification.sendNotification({
        title,
        body,
        ...(icon ? { icon } : {}),
      });
      return true;
    }

    if (!notificationsSupported() || Notification.permission !== "granted") {
      return false;
    }

    const n = new Notification(title, {
      body,
      ...(icon ? { icon } : {}),
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };

    return true;
  } catch {
    return false;
  }
}
