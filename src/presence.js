import { db } from "./firebase";
import {
  ref as dbRef,
  onValue,
  onDisconnect,
  set,
  remove,
  serverTimestamp,
  goOnline,
} from "firebase/database";
import { randomId } from "./randomId";

const HEARTBEAT_MS = 25000;
const STALE_TAB_MS = 5 * 60 * 1000;

let currentUid = null;
let currentProfile = null;
let tabId = null;
let connectedUnsub = null;
let heartbeatTimer = null;
let isConnected = false;
let visibilityHandler = null;
let focusHandler = null;
let onlineHandler = null;
let offlineHandler = null;
let pageShowHandler = null;
let pageHideHandler = null;
let beforeUnloadHandler = null;

function tabRef() {
  if (!currentUid || !tabId) return null;
  return dbRef(db, `presence/${currentUid}/tabs/${tabId}`);
}

function profileRef() {
  if (!currentUid) return null;
  return dbRef(db, `presence/${currentUid}/profile`);
}

function lastSeenRef() {
  if (!currentUid) return null;
  return dbRef(db, `presence/${currentUid}/lastSeen`);
}

function profilePayload() {
  return {
    displayName: currentProfile?.displayName || null,
    avatarColor: currentProfile?.avatarColor || null,
  };
}

async function writeTabOnline() {
  const tRef = tabRef();
  if (!tRef) return;
  try {
    await set(tRef, { online: true, seenAt: serverTimestamp() });
  } catch (e) {}
  try {
    const pRef = profileRef();
    if (pRef) await set(pRef, profilePayload());
  } catch (e) {}
  try {
    const lRef = lastSeenRef();
    if (lRef) await set(lRef, serverTimestamp());
  } catch (e) {}
}

async function writeProfileOnly() {
  const pRef = profileRef();
  if (!pRef) return;
  try {
    await set(pRef, profilePayload());
  } catch (e) {}
}

async function armDisconnect() {
  const tRef = tabRef();
  const lRef = lastSeenRef();
  if (tRef) {
    try {
      await onDisconnect(tRef).remove();
    } catch (e) {}
  }
  if (lRef) {
    try {
      await onDisconnect(lRef).set(serverTimestamp());
    } catch (e) {}
  }
}

function clearHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function scheduleHeartbeat() {
  clearHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (isConnected) {
      void writeTabOnline();
      return;
    }
    reconnect();
  }, HEARTBEAT_MS);
}

async function handleConnectionChange(connected) {
  isConnected = connected;
  if (!connected || !currentUid) return;
  await armDisconnect();
  await writeTabOnline();
}

function reconnect() {
  if (!currentUid) return;
  try {
    goOnline(db);
  } catch (e) {}
  void writeTabOnline();
}

function attachWindowListeners() {
  if (typeof window === "undefined") return;
  visibilityHandler = () => {
    if (!document.hidden) reconnect();
  };
  focusHandler = () => reconnect();
  onlineHandler = () => reconnect();
  offlineHandler = () => {
    isConnected = false;
  };
  pageShowHandler = () => reconnect();
  pageHideHandler = (event) => {
    if (event?.persisted) return;
    const tRef = tabRef();
    if (!tRef) return;
    try {
      remove(tRef);
    } catch (e) {}
  };
  beforeUnloadHandler = () => {
    const tRef = tabRef();
    if (!tRef) return;
    try {
      remove(tRef);
    } catch (e) {}
  };
  document.addEventListener("visibilitychange", visibilityHandler);
  window.addEventListener("focus", focusHandler);
  window.addEventListener("online", onlineHandler);
  window.addEventListener("offline", offlineHandler);
  window.addEventListener("pageshow", pageShowHandler);
  window.addEventListener("pagehide", pageHideHandler);
  window.addEventListener("beforeunload", beforeUnloadHandler);
}

function detachWindowListeners() {
  if (typeof window === "undefined") return;
  if (visibilityHandler)
    document.removeEventListener("visibilitychange", visibilityHandler);
  if (focusHandler) window.removeEventListener("focus", focusHandler);
  if (onlineHandler) window.removeEventListener("online", onlineHandler);
  if (offlineHandler) window.removeEventListener("offline", offlineHandler);
  if (pageShowHandler) window.removeEventListener("pageshow", pageShowHandler);
  if (pageHideHandler) window.removeEventListener("pagehide", pageHideHandler);
  if (beforeUnloadHandler)
    window.removeEventListener("beforeunload", beforeUnloadHandler);
  visibilityHandler = null;
  focusHandler = null;
  onlineHandler = null;
  offlineHandler = null;
  pageShowHandler = null;
  pageHideHandler = null;
  beforeUnloadHandler = null;
}

export async function startPresence(user) {
  if (!user || !user.uid) return;
  if (currentUid || connectedUnsub || heartbeatTimer) {
    await stopPresence();
  }
  currentUid = user.uid;
  tabId = randomId();
  currentProfile = {
    displayName: user.displayName || null,
    avatarColor: user.preferences?.avatarColor || null,
  };
  attachWindowListeners();
  void writeProfileOnly();
  connectedUnsub = onValue(dbRef(db, ".info/connected"), (snap) => {
    void handleConnectionChange(snap.val() === true);
  });
  scheduleHeartbeat();
}

export function updatePresenceProfile(profile = {}) {
  currentProfile = {
    displayName: profile.displayName ?? currentProfile?.displayName ?? null,
    avatarColor: profile.avatarColor ?? currentProfile?.avatarColor ?? null,
  };
  void writeProfileOnly();
}

export async function stopPresence() {
  clearHeartbeat();
  detachWindowListeners();
  if (connectedUnsub) {
    try {
      connectedUnsub();
    } catch (e) {}
    connectedUnsub = null;
  }
  const tRef = tabRef();
  const lRef = lastSeenRef();
  if (tRef) {
    try {
      await onDisconnect(tRef).cancel();
    } catch (e) {}
    try {
      await remove(tRef);
    } catch (e) {}
  }
  if (lRef) {
    try {
      await onDisconnect(lRef).cancel();
    } catch (e) {}
    try {
      await set(lRef, serverTimestamp());
    } catch (e) {}
  }
  currentUid = null;
  currentProfile = null;
  tabId = null;
  isConnected = false;
}

function isTabActive(tab) {
  if (!tab || typeof tab !== "object") return false;
  if (tab.online !== true) return false;
  const seenAt = Number(tab.seenAt || 0);
  if (!seenAt) return true;
  const age = Date.now() - seenAt;
  if (age < 0) return true;
  return age < STALE_TAB_MS;
}

export function userIsOnline(presenceEntry) {
  if (!presenceEntry || typeof presenceEntry !== "object") return false;
  const tabs = presenceEntry.tabs;
  if (tabs && typeof tabs === "object") {
    for (const tab of Object.values(tabs)) {
      if (isTabActive(tab)) return true;
    }
    return false;
  }
  if (presenceEntry.online === true) {
    const seen = Number(presenceEntry.lastSeen || 0);
    if (!seen) return true;
    return Date.now() - seen < STALE_TAB_MS;
  }
  return false;
}
