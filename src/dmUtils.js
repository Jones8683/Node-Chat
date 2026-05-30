import { db } from "./firebase";
import {
  ref as dbRef,
  runTransaction,
  update,
  get,
  query,
  limitToLast,
} from "firebase/database";

export function dmThreadId(uidA, uidB) {
  if (!uidA || !uidB) return null;
  return uidA < uidB ? `${uidA}_${uidB}` : `${uidB}_${uidA}`;
}

export function partnerUidFromThread(threadId, myUid) {
  if (!threadId || !myUid) return null;
  const parts = String(threadId).split("_");
  if (parts.length !== 2) return null;
  if (parts[0] === myUid) return parts[1];
  if (parts[1] === myUid) return parts[0];
  return null;
}

export async function ensureDmThread(myUid, partnerUid) {
  if (!myUid || !partnerUid || myUid === partnerUid) return null;
  const threadId = dmThreadId(myUid, partnerUid);
  const metaRef = dbRef(db, `dms/threads/${threadId}/meta`);
  const now = Date.now();
  await runTransaction(metaRef, (current) => {
    if (current && current.members) return current;
    return {
      members: { [myUid]: true, [partnerUid]: true },
      createdAt: now,
    };
  });
  await update(dbRef(db, `dms/userIndex/${myUid}/${threadId}`), {
    partnerUid,
    lastReadAt: now,
  });
  return threadId;
}

function previewForMessage(message) {
  if (!message) return { preview: "", type: "text" };
  if (message.type === "gif") {
    return { preview: "GIF", type: "gif" };
  }
  const raw = String(message.text || "")
    .replace(/\s+/g, " ")
    .trim();
  return { preview: raw.slice(0, 140), type: "text" };
}

export function dmPreviewText(entry) {
  if (!entry) return "";
  if (entry.lastMessageType === "gif") return "🎞️ GIF";
  return entry.lastMessagePreview || "";
}

export async function recordDmSend({ threadId, myUid, partnerUid, message }) {
  if (!threadId || !myUid || !partnerUid) return;
  const { preview, type } = previewForMessage(message);
  const now = Date.now();

  const myEntry = {
    partnerUid,
    lastMessageAt: now,
    lastMessagePreview: preview,
    lastMessageType: type,
    lastMessageFromUid: myUid,
    lastReadAt: now,
  };

  const partnerEntry = {
    partnerUid: myUid,
    lastMessageAt: now,
    lastMessagePreview: preview,
    lastMessageType: type,
    lastMessageFromUid: myUid,
  };

  const metaUpdates = {
    [`dms/threads/${threadId}/meta/lastMessageAt`]: now,
    [`dms/threads/${threadId}/meta/lastMessagePreview`]: preview,
    [`dms/threads/${threadId}/meta/lastMessageType`]: type,
    [`dms/threads/${threadId}/meta/lastMessageFromUid`]: myUid,
  };

  await Promise.all([
    update(dbRef(db), metaUpdates),
    update(dbRef(db, `dms/userIndex/${myUid}/${threadId}`), myEntry),
    update(dbRef(db, `dms/userIndex/${partnerUid}/${threadId}`), partnerEntry),
  ]);
}

export async function markDmRead(myUid, threadId) {
  if (!myUid || !threadId) return;
  await update(dbRef(db, `dms/userIndex/${myUid}/${threadId}`), {
    lastReadAt: Date.now(),
  });
}

export async function refreshDmThreadLastMessage({
  threadId,
  myUid,
  partnerUid,
}) {
  if (!threadId || !myUid || !partnerUid) return;

  let lastMessageAt = 0;
  let lastMessagePreview = "";
  let lastMessageType = "text";
  let lastMessageFromUid = null;

  const latestRef = query(
    dbRef(db, `dms/threads/${threadId}/messages`),
    limitToLast(1),
  );
  const latestSnap = await get(latestRef);
  if (latestSnap.exists()) {
    const latestRaw = latestSnap.val() || {};
    const latestMsg = Object.values(latestRaw)[0];
    if (latestMsg && typeof latestMsg === "object") {
      const summary = previewForMessage(latestMsg);
      lastMessageAt = Number(latestMsg.timestamp || 0);
      lastMessagePreview = summary.preview;
      lastMessageType = summary.type;
      lastMessageFromUid = latestMsg.uid || null;
    }
  }

  const metaUpdates = {
    [`dms/threads/${threadId}/meta/lastMessageAt`]: lastMessageAt,
    [`dms/threads/${threadId}/meta/lastMessagePreview`]: lastMessagePreview,
    [`dms/threads/${threadId}/meta/lastMessageType`]: lastMessageType,
    [`dms/threads/${threadId}/meta/lastMessageFromUid`]: lastMessageFromUid,
  };

  const sharedFields = {
    partnerUid,
    lastMessageAt,
    lastMessagePreview,
    lastMessageType,
    lastMessageFromUid,
  };

  await Promise.all([
    update(dbRef(db), metaUpdates),
    update(dbRef(db, `dms/userIndex/${myUid}/${threadId}`), sharedFields),
    update(dbRef(db, `dms/userIndex/${partnerUid}/${threadId}`), {
      ...sharedFields,
      partnerUid: myUid,
    }),
  ]);
}
