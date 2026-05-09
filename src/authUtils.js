import { db, auth } from "./firebase";
import {
  ref as dbRef,
  set,
  get,
  update,
  remove,
  push,
} from "firebase/database";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  updatePassword,
} from "firebase/auth";
import cryptoRandomString from "crypto-random-string";

export function generateInviteToken() {
  return cryptoRandomString({ length: 7, type: "alphanumeric" }).toUpperCase();
}

export async function createInviteToken() {
  const token = generateInviteToken();
  const now = Date.now();
  const expiresAt = now + 24 * 60 * 60 * 1000;

  await set(dbRef(db, `invites/${token}`), {
    createdAt: now,
    expiresAt,
    used: false,
  });

  return token;
}

export async function getValidInvites() {
  const snap = await get(dbRef(db, "invites"));
  if (!snap.exists()) return [];

  const now = Date.now();
  return Object.entries(snap.val())
    .filter(([, data]) => !data.used && data.expiresAt > now)
    .map(([token, data]) => ({ token, ...data }));
}

export async function deleteInviteToken(token) {
  await remove(dbRef(db, `invites/${token}`));
}

export async function validateInviteToken(token) {
  const snap = await get(dbRef(db, `invites/${token}`));
  if (!snap.exists()) {
    return { valid: false, error: "Invite not found" };
  }

  const data = snap.val();
  if (data.used) {
    return { valid: false, error: "Invite already used" };
  }

  const now = Date.now();
  if (data.expiresAt < now) {
    return { valid: false, error: "Invite expired" };
  }

  return { valid: true };
}

export async function consumeInviteToken(token, uid) {
  const snap = await get(dbRef(db, `invites/${token}`));
  if (!snap.exists()) {
    throw new Error("Invite not found");
  }

  const data = snap.val();
  if (data.used) {
    throw new Error("Invite already used");
  }

  const now = Date.now();
  if (data.expiresAt < now) {
    throw new Error("Invite expired");
  }

  await update(dbRef(db, `invites/${token}`), {
    used: true,
    usedAt: now,
    usedByUid: uid,
  });

  await remove(dbRef(db, `invites/${token}`));
}

export async function signupWithToken(
  token,
  email,
  password,
  displayName = "",
) {
  const validation = await validateInviteToken(token);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const userCred = await createUserWithEmailAndPassword(auth, email, password);

  try {
    if (displayName.trim()) {
      const nameKey = displayName.toLowerCase().replace(/\s+/g, "_");
      const existingUser = await get(dbRef(db, `usernames/${nameKey}`));
      if (existingUser.exists()) {
        throw new Error("Display name already taken");
      }

      await updateProfile(userCred.user, { displayName });
      await set(dbRef(db, `usernames/${nameKey}`), userCred.user.uid);
    }

    await set(dbRef(db, `users/${userCred.user.uid}`), {
      email,
      displayName: displayName.trim(),
      createdAt: Date.now(),
    });
    await consumeInviteToken(token, userCred.user.uid);
    if (displayName.trim()) {
      try {
        if (auth && auth.currentUser) {
          const { uid, displayName: dn } = auth.currentUser;
          const signupName = displayName.trim() || dn || null;
          await recordAuditEvent({
            action: "signup",
            actorUid: uid,
            actorName: signupName,
            details: `with invite code ${token}`,
          });
        }
      } catch (e) {}
    }
    return userCred.user;
  } catch (error) {
    await userCred.user.delete();
    throw error;
  }
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
    let name = actorName || null;
    if (!name && uid) {
      try {
        const userSnap = await get(dbRef(db, `users/${uid}`));
        name = userSnap.exists() ? userSnap.val().displayName || null : null;
      } catch {
        name = null;
      }
    }
    const event = {
      action: action || "unknown",
      actorUid: uid,
      actorName: name || uid,
      targetUid: targetUid || null,
      targetName: targetName || null,
      details: details || null,
      ts: Date.now(),
    };

    await push(dbRef(db, `auditLogs/${uid}`), event);
  } catch (e) {
    console.error("Failed to write audit event:", e);
  }
}

export async function changeDisplayName(uid, newDisplayName) {
  const nameKey = newDisplayName.toLowerCase().replace(/\s+/g, "_");
  const snap = await get(dbRef(db, `usernames/${nameKey}`));
  if (snap.exists() && snap.val() !== uid) {
    throw new Error("Display name already taken");
  }

  const user = auth.currentUser;
  if (!user || user.uid !== uid) {
    throw new Error("Not authorized");
  }

  const userSnap = await get(dbRef(db, `users/${uid}`));
  const dbDisplayName = userSnap.exists() ? userSnap.val().displayName : null;
  const oldDisplayName = dbDisplayName || user.displayName;
  const hadDisplayName = !!(dbDisplayName && dbDisplayName.trim());
  const oldNameKey =
    oldDisplayName && oldDisplayName.trim()
      ? oldDisplayName.toLowerCase().replace(/\s+/g, "_")
      : null;

  if (oldNameKey && oldNameKey !== nameKey) {
    await remove(dbRef(db, `usernames/${oldNameKey}`));
  }

  await set(dbRef(db, `usernames/${nameKey}`), uid);
  await updateProfile(user, { displayName: newDisplayName });
  await update(dbRef(db, `users/${uid}`), { displayName: newDisplayName });
  try {
    await update(dbRef(db, `presence/${uid}/profile`), {
      displayName: newDisplayName,
    });
  } catch (e) {}

  await batchUpdateMessageDisplayNames(uid, newDisplayName);
  try {
    await recordAuditEvent({
      action: hadDisplayName ? "display_name_changed" : "signup",
      targetUid: uid,
      targetName: newDisplayName,
    });
  } catch (e) {}
}

export async function changeAvatarColor(uid, avatarColor) {
  await update(dbRef(db, `users/${uid}/preferences`), {
    avatarColor: avatarColor ?? null,
  });

  try {
    await update(dbRef(db, `presence/${uid}/profile`), {
      avatarColor: avatarColor ?? null,
    });
  } catch (e) {}

  await batchUpdateMessageAvatarColor(uid, avatarColor ?? null);
}

export async function changeUserPassword(newPassword) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Not authenticated");
  }

  await updatePassword(user, newPassword);
}

export async function isUserAdmin(uid) {
  const snap = await get(dbRef(db, `admins/${uid}`));
  return snap.exists() && snap.val() === true;
}

export async function getOwnerUid() {
  try {
    const snap = await get(dbRef(db, "owner"));
    return snap.exists() ? snap.val() : null;
  } catch {
    return null;
  }
}

export async function isUserOwner(uid) {
  const ownerUid = await getOwnerUid();
  return ownerUid === uid;
}

export async function getAllUsers() {
  const snap = await get(dbRef(db, "users"));
  if (!snap.exists()) return [];

  return Object.entries(snap.val()).map(([uid, data]) => ({
    uid,
    ...data,
  }));
}

export async function adminRenameUser(uid, newDisplayName) {
  const userSnap = await get(dbRef(db, `users/${uid}`));
  if (!userSnap.exists()) throw new Error("User not found");
  const userData = userSnap.val();

  const newNameKey = newDisplayName.toLowerCase().replace(/\s+/g, "_");
  const snap = await get(dbRef(db, `usernames/${newNameKey}`));
  if (snap.exists() && snap.val() !== uid) {
    throw new Error("Display name already taken");
  }

  const oldDisplayName = userData.displayName;
  if (oldDisplayName && oldDisplayName.trim()) {
    const oldKey = oldDisplayName.toLowerCase().replace(/\s+/g, "_");
    if (oldKey !== newNameKey) {
      await remove(dbRef(db, `usernames/${oldKey}`));
    }
  }
  await set(dbRef(db, `usernames/${newNameKey}`), uid);

  await update(dbRef(db, `users/${uid}`), { displayName: newDisplayName });

  try {
    await update(dbRef(db, `presence/${uid}/profile`), {
      displayName: newDisplayName,
    });
  } catch (e) {}

  await batchUpdateMessageDisplayNames(uid, newDisplayName);

  try {
    await recordAuditEvent({
      action: "name_renamed",
      targetUid: uid,
      targetName: newDisplayName,
      details: oldDisplayName || null,
    });
  } catch (e) {}
}

async function batchUpdateMessageDisplayNames(uid, newDisplayName) {
  const messagesSnap = await get(dbRef(db, "messages"));
  if (!messagesSnap.exists()) return;

  const authoredPaths = [];
  const replyPaths = [];
  const mentionPaths = [];
  const msgs = messagesSnap.val();

  for (const [msgId, msg] of Object.entries(msgs)) {
    if (msg.uid === uid) {
      authoredPaths.push(`messages/${msgId}/displayName`);
    }
    if (msg.replyTo?.uid === uid) {
      replyPaths.push(`messages/${msgId}/replyTo/displayName`);
    }
    if (msg.mentions?.[uid]) {
      mentionPaths.push(`messages/${msgId}/mentions/${uid}/displayName`);
    }
  }

  if (authoredPaths.length > 0) {
    await Promise.all(
      authoredPaths.map((path) => set(dbRef(db, path), newDisplayName)),
    );
  }

  if (replyPaths.length > 0) {
    await Promise.all(
      replyPaths.map((path) => set(dbRef(db, path), newDisplayName)),
    );
  }

  if (mentionPaths.length > 0) {
    await Promise.all(
      mentionPaths.map((path) => set(dbRef(db, path), newDisplayName)),
    );
  }
}

async function batchUpdateMessageAvatarColor(uid, avatarColor) {
  const messagesSnap = await get(dbRef(db, "messages"));
  if (!messagesSnap.exists()) return;

  const updates = {};
  const msgs = messagesSnap.val();

  for (const [msgId, msg] of Object.entries(msgs)) {
    if (msg.uid === uid) {
      updates[`messages/${msgId}/avatarColor`] = avatarColor;
    }
    if (msg.replyTo?.uid === uid) {
      updates[`messages/${msgId}/replyTo/avatarColor`] = avatarColor;
    }
    if (msg.mentions?.[uid]) {
      updates[`messages/${msgId}/mentions/${uid}/avatarColor`] = avatarColor;
    }
  }

  if (Object.keys(updates).length > 0) {
    await update(dbRef(db), updates);
  }
}

export async function promoteToAdmin(uid) {
  await set(dbRef(db, `admins/${uid}`), true);
}

export async function demoteFromAdmin(uid) {
  await remove(dbRef(db, `admins/${uid}`));
}
