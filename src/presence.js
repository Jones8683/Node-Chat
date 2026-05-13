import { db } from "./firebase";
import {
  ref as dbRef,
  onValue,
  onDisconnect,
  set,
  remove,
  update,
  serverTimestamp,
  goOnline,
  push,
} from "firebase/database";

const HEARTBEAT_MS = 25000;
const STALE_TAB_MS = 90000;

let currentUid = null;
let currentProfile = null;
let tabId = null;
let connectedUnsub = null;
let heartbeatTimer = null;
let isConnected = false;
let visibilityHandler = null;
let focusHandler = null;
let onlineHandler = null;
let pageShowHandler = null;
let beforeUnloadHandler = null;

function tabRef() {
  if (!currentUid || !tabId) return null;
  return dbRef(db, `presence/${currentUid}/tabs/${tabId}`);
}

function lastSeenRef() {
  if (!currentUid) return null;
  return dbRef(db, `presence/${currentUid}/lastSeen`);
}

function profileRef() {
  if (!currentUid) return null;
  return dbRef(db, `presence/${currentUid}/profile`);
}

async function writeTab() {
  const ref = tabRef();
  if (!ref) return;
  try {
    await set(ref, {
      online: true,
      seenAt: serverTimestamp(),
      focused: typeof document !== "undefined" ? !document.hidden : true,
    });
  } catch (e) {}
}

async function writeProfile() {
  const ref = profileRef();
  if (!ref || !currentProfile) return;
  try {
    await update(ref, {
      displayName: currentProfile.displayName || null,
      avatarColor: currentProfile.avatarColor || null,
    });
  } catch (e) {}
}

async function armDisconnect() {
  const tRef = tabRef();
  const lRef = lastSeenRef();
  if (!tRef || !lRef) return;
  try {
    await onDisconnect(tRef).remove();
    await onDisconnect(lRef).set(serverTimestamp());
  } catch (e) {}
}

async function touchLastSeen() {
  const ref = lastSeenRef();
  if (!ref) return;
  try {
    await set(ref, serverTimestamp());
  } catch (e) {}
}

function clearHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function scheduleHeartbeat() {
  clearHeartbeat();
  heartbeatTimer = setInterval(async () => {
    if (!currentUid) return;
    await writeTab();
    await touchLastSeen();
  }, HEARTBEAT_MS);
}

async function handleConnectionChange(connected) {
  isConnected = connected;
  if (!connected || !currentUid) return;
  await writeProfile();
  await armDisconnect();
  await writeTab();
  await touchLastSeen();
}

async function forceReconnect() {
  if (!currentUid) return;
  try {
    goOnline(db);
  } catch (e) {}
  if (isConnected) {
    await writeTab();
    await touchLastSeen();
  }
}

function attachWindowListeners() {
  if (typeof window === "undefined") return;

  visibilityHandler = () => {
    if (!document.hidden) forceReconnect();
    else if (currentUid) writeTab();
  };
  focusHandler = () => forceReconnect();
  onlineHandler = () => forceReconnect();
  pageShowHandler = () => forceReconnect();
  beforeUnloadHandler = () => {
    const ref = tabRef();
    if (ref) {
      try {
        remove(ref);
      } catch (e) {}
    }
  };

  document.addEventListener("visibilitychange", visibilityHandler);
  window.addEventListener("focus", focusHandler);
  window.addEventListener("online", onlineHandler);
  window.addEventListener("pageshow", pageShowHandler);
  window.addEventListener("beforeunload", beforeUnloadHandler);
}

function detachWindowListeners() {
  if (typeof window === "undefined") return;
  if (visibilityHandler)
    document.removeEventListener("visibilitychange", visibilityHandler);
  if (focusHandler) window.removeEventListener("focus", focusHandler);
  if (onlineHandler) window.removeEventListener("online", onlineHandler);
  if (pageShowHandler) window.removeEventListener("pageshow", pageShowHandler);
  if (beforeUnloadHandler)
    window.removeEventListener("beforeunload", beforeUnloadHandler);
  visibilityHandler = null;
  focusHandler = null;
  onlineHandler = null;
  pageShowHandler = null;
  beforeUnloadHandler = null;
}

export async function startPresence(user) {
  if (!user || !user.uid) return;
  if (currentUid && currentUid !== user.uid) {
    await stopPresence();
  }
  currentUid = user.uid;
  currentProfile = {
    displayName: user.displayName || null,
    avatarColor: user.preferences?.avatarColor || null,
  };
  if (!tabId) {
    tabId = (
      push(dbRef(db, `presence/${currentUid}/tabs`)).key ||
      `${Date.now()}-${Math.random().toString(36).slice(2)}`
    ).replace(/[^a-zA-Z0-9_-]/g, "");
  }

  attachWindowListeners();

  connectedUnsub = onValue(dbRef(db, ".info/connected"), (snap) => {
    handleConnectionChange(snap.val() === true);
  });

  scheduleHeartbeat();
}

export function updatePresenceProfile(profile = {}) {
  currentProfile = {
    displayName: profile.displayName ?? currentProfile?.displayName ?? null,
    avatarColor: profile.avatarColor ?? currentProfile?.avatarColor ?? null,
  };
  writeProfile();
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

export function isTabActive(tab) {
  if (!tab || typeof tab !== "object") return false;
  if (tab.online !== true) return false;
  const seenAt = Number(tab.seenAt || 0);
  if (!seenAt) return true;
  return Date.now() - seenAt < STALE_TAB_MS;
}

export function userIsOnline(presenceEntry) {
  if (!presenceEntry || typeof presenceEntry !== "object") return false;
  const tabs = presenceEntry.tabs || {};
  for (const tab of Object.values(tabs)) {
    if (isTabActive(tab)) return true;
  }
  return false;
}
