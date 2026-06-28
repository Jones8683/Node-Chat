import { db, auth } from "./firebase";
import {
  ref as dbRef,
  set,
  get,
  update,
  remove,
  push,
  runTransaction,
} from "firebase/database";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  updatePassword,
} from "firebase/auth";
import cryptoRandomString from "crypto-random-string";

const INVITE_TTL_MS = 24 * 60 * 60 * 1000;
const DISPLAY_NAME_MIN = 2;
const DISPLAY_NAME_MAX = 12;
const DISPLAY_NAME_PATTERN = /^[a-zA-Z0-9_\-. ]+$/;
const PASSWORD_MIN = 6;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeDisplayName(raw) {
  return String(raw || "").trim();
}

function nameToKey(name) {
  return normalizeDisplayName(name).toLowerCase().replace(/\s+/g, "_");
}

export function validateDisplayName(raw) {
  const name = normalizeDisplayName(raw);
  if (!name) return "Please enter a display name.";
  if (name.length < DISPLAY_NAME_MIN)
    return `Display name must be at least ${DISPLAY_NAME_MIN} characters.`;
  if (name.length > DISPLAY_NAME_MAX)
    return `Display name must be at most ${DISPLAY_NAME_MAX} characters.`;
  if (!DISPLAY_NAME_PATTERN.test(name))
    return "Only letters, numbers, spaces, and _ - . are allowed.";
  return null;
}

function generateInviteToken() {
  return cryptoRandomString({ length: 7, type: "alphanumeric" }).toUpperCase();
}

export async function createInviteToken() {
  const token = generateInviteToken();
  const now = Date.now();
  await set(dbRef(db, `invites/${token}`), {
    createdAt: now,
    expiresAt: now + INVITE_TTL_MS,
    used: false,
  });
  return token;
}

export async function deleteInviteToken(token) {
  await remove(dbRef(db, `invites/${token}`));
}

async function validateInviteToken(token) {
  const key = String(token || "")
    .trim()
    .toUpperCase();
  if (!key) return { valid: false, error: "Please enter your invite code." };
  const snap = await get(dbRef(db, `invites/${key}`));
  if (!snap.exists()) return { valid: false, error: "Invite not found." };
  const data = snap.val();
  if (data.used) return { valid: false, error: "Invite already used." };
  if ((data.expiresAt || 0) < Date.now())
    return { valid: false, error: "Invite expired." };
  return { valid: true, token: key };
}

async function consumeInviteToken(token, uid) {
  const path = `invites/${token}`;
  const now = Date.now();
  const snap = await get(dbRef(db, path));
  if (!snap.exists()) throw new Error("Invite not found.");
  const current = snap.val();
  if (current.used) throw new Error("Invite already used.");
  if ((current.expiresAt || 0) < now) throw new Error("Invite expired.");
  await set(dbRef(db, path), {
    ...current,
    used: true,
    usedAt: now,
    usedByUid: uid,
  });
  remove(dbRef(db, path)).catch(() => {});
}

async function reserveUsername(nameKey, uid) {
  const result = await runTransaction(
    dbRef(db, `usernames/${nameKey}`),
    (current) => {
      if (current === null || current === uid) return uid;
      return;
    },
  );
  return result.committed === true && result.snapshot.val() === uid;
}

async function releaseUsername(nameKey, uid) {
  try {
    await runTransaction(dbRef(db, `usernames/${nameKey}`), (current) =>
      current === uid ? null : current,
    );
  } catch (e) {}
}

export async function signupWithToken(rawToken, email, password) {
  const normalizedEmail = String(email || "").trim();
  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    throw new Error("Please enter a valid email address.");
  }
  if (!password || String(password).length < PASSWORD_MIN) {
    throw new Error(`Password must be at least ${PASSWORD_MIN} characters.`);
  }

  const tokenCheck = await validateInviteToken(rawToken);
  if (!tokenCheck.valid) throw new Error(tokenCheck.error);
  const token = tokenCheck.token;

  const userCred = await createUserWithEmailAndPassword(
    auth,
    normalizedEmail,
    password,
  );
  const uid = userCred.user.uid;

  try {
    await set(dbRef(db, `users/${uid}`), {
      email: normalizedEmail,
      createdAt: Date.now(),
      preferences: { showTimestamps: true },
      pendingInviteToken: token,
    });
    await consumeInviteToken(token, uid);
    return userCred.user;
  } catch (error) {
    remove(dbRef(db, `users/${uid}`)).catch(() => {});
    throw error;
  }
}

export async function loginWithPassword(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function logoutCurrentUser() {
  await signOut(auth);
}

export async function recordAuditEvent({
  action,
  actorUid = null,
  actorName = null,
  targetUid = null,
  targetName = null,
  details = null,
} = {}) {
  try {
    const user = auth.currentUser;
    const uid = actorUid || (user && user.uid) || null;
    if (!uid) return;
    let name = actorName;
    if (!name) {
      try {
        const snap = await get(dbRef(db, `users/${uid}/displayName`));
        if (snap.exists()) name = snap.val();
      } catch (e) {}
    }
    if (!name) name = (user && user.displayName) || uid;
    await push(dbRef(db, `auditLogs/${uid}`), {
      action: action || "unknown",
      actorUid: uid,
      actorName: name,
      targetUid: targetUid || null,
      targetName: targetName || null,
      details: details || null,
      ts: Date.now(),
    });
  } catch (e) {}
}

export async function changeDisplayName(uid, rawName) {
  const user = auth.currentUser;
  if (!user || user.uid !== uid) throw new Error("Not authorized.");

  const nameError = validateDisplayName(rawName);
  if (nameError) throw new Error(nameError);
  const newName = normalizeDisplayName(rawName);
  const newKey = nameToKey(newName);

  const userSnap = await get(dbRef(db, `users/${uid}`));
  const userData = userSnap.exists() ? userSnap.val() : {};
  const oldName = userData.displayName || user.displayName || "";
  const oldKey = oldName ? nameToKey(oldName) : null;
  const isFirstTimeSet = !oldName;
  const inviteToken =
    userData.pendingInviteToken || userData.inviteToken || null;

  if (oldKey === newKey && oldName === newName) return;

  const reserved = await reserveUsername(newKey, uid);
  if (!reserved) throw new Error("Display name already taken.");

  try {
    await updateProfile(user, { displayName: newName });
    const userUpdate = { displayName: newName };
    if (isFirstTimeSet) {
      userUpdate.pendingInviteToken = null;
      userUpdate.inviteToken = null;
    }
    await update(dbRef(db, `users/${uid}`), userUpdate);
    update(dbRef(db, `presence/${uid}/profile`), {
      displayName: newName,
    }).catch(() => {});
    if (oldKey && oldKey !== newKey) await releaseUsername(oldKey, uid);
    batchUpdateMessageFields(uid, { displayName: newName }).catch(() => {});
    recordAuditEvent(
      isFirstTimeSet
        ? {
            action: "signup",
            actorUid: uid,
            actorName: newName,
            details: inviteToken,
          }
        : {
            action: "display_name_changed",
            actorUid: uid,
            actorName: newName,
            details: oldName,
          },
    );
  } catch (error) {
    await releaseUsername(newKey, uid);
    throw error;
  }
}

export async function changeAvatarColor(uid, avatarColor) {
  const color = avatarColor ?? null;
  await update(dbRef(db, `users/${uid}/preferences`), { avatarColor: color });
  update(dbRef(db, `presence/${uid}/profile`), { avatarColor: color }).catch(
    () => {},
  );
  batchUpdateMessageFields(uid, { avatarColor: color }).catch(() => {});
}

export async function changeUserPassword(newPassword) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated.");
  await updatePassword(user, newPassword);
}

export async function adminRenameUser(uid, rawName) {
  const nameError = validateDisplayName(rawName);
  if (nameError) throw new Error(nameError);
  const newName = normalizeDisplayName(rawName);
  const newKey = nameToKey(newName);

  const userSnap = await get(dbRef(db, `users/${uid}`));
  if (!userSnap.exists()) throw new Error("User not found.");
  const userData = userSnap.val();
  const oldName = userData.displayName || "";
  const oldKey = oldName ? nameToKey(oldName) : null;

  if (oldKey === newKey && oldName === newName) return;

  const claimSnap = await get(dbRef(db, `usernames/${newKey}`));
  if (claimSnap.exists() && claimSnap.val() !== uid) {
    throw new Error("Display name already taken.");
  }

  await set(dbRef(db, `usernames/${newKey}`), uid);
  if (oldKey && oldKey !== newKey) {
    remove(dbRef(db, `usernames/${oldKey}`)).catch(() => {});
  }

  await update(dbRef(db, `users/${uid}`), { displayName: newName });
  update(dbRef(db, `presence/${uid}/profile`), { displayName: newName }).catch(
    () => {},
  );
  batchUpdateMessageFields(uid, { displayName: newName }).catch(() => {});

  const actingUid = auth.currentUser?.uid || null;
  const isSelfRename = actingUid && actingUid === uid;
  recordAuditEvent(
    isSelfRename
      ? {
          action: "display_name_changed",
          actorUid: uid,
          actorName: newName,
          details: oldName || null,
        }
      : {
          action: "name_renamed",
          targetUid: uid,
          targetName: newName,
          details: oldName || null,
        },
  );
}

async function getDmThreadIdsForUser(uid) {
  try {
    const snap = await get(dbRef(db, `dms/userIndex/${uid}`));
    if (!snap.exists()) return [];
    return Object.keys(snap.val() || {});
  } catch (e) {
    return [];
  }
}

async function batchUpdateMessageFields(uid, fields) {
  const updates = {};

  const messagesSnap = await get(dbRef(db, "messages"));
  if (messagesSnap.exists()) {
    for (const [msgId, msg] of Object.entries(messagesSnap.val())) {
      if (msg.uid === uid) {
        for (const [field, value] of Object.entries(fields)) {
          updates[`messages/${msgId}/${field}`] = value;
        }
      }
      if (msg.replyTo?.uid === uid) {
        for (const [field, value] of Object.entries(fields)) {
          updates[`messages/${msgId}/replyTo/${field}`] = value;
        }
      }
    }
  }

  const threadIds = await getDmThreadIdsForUser(uid);
  for (const threadId of threadIds) {
    try {
      const dmSnap = await get(dbRef(db, `dms/threads/${threadId}/messages`));
      if (!dmSnap.exists()) continue;
      for (const [msgId, msg] of Object.entries(dmSnap.val())) {
        if (msg.uid === uid) {
          for (const [field, value] of Object.entries(fields)) {
            updates[`dms/threads/${threadId}/messages/${msgId}/${field}`] =
              value;
          }
        }
        if (msg.replyTo?.uid === uid) {
          for (const [field, value] of Object.entries(fields)) {
            updates[
              `dms/threads/${threadId}/messages/${msgId}/replyTo/${field}`
            ] = value;
          }
        }
      }
    } catch (e) {}
  }

  if (Object.keys(updates).length) await update(dbRef(db), updates);
}

export async function promoteToAdmin(uid) {
  await set(dbRef(db, `admins/${uid}`), true);
}

export async function demoteFromAdmin(uid) {
  await remove(dbRef(db, `admins/${uid}`));
}
