import { db, auth } from "./firebase";
import { ref as dbRef, set, get, update, remove } from "firebase/database";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  updatePassword,
} from "firebase/auth";

export function generateInviteToken() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let token = "";
  for (let i = 0; i < 7; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
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
    return userCred.user;
  } catch (error) {
    await userCred.user.delete();
    throw error;
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

  const messagesSnap = await get(dbRef(db, "messages"));
  if (messagesSnap.exists()) {
    const msgs = messagesSnap.val();
    for (const [msgId, msg] of Object.entries(msgs)) {
      const payload = {};
      if (msg.uid === uid) {
        payload.displayName = newDisplayName;
      }
      if (msg.replyTo?.uid === uid) {
        payload["replyTo/displayName"] = newDisplayName;
      }
      if (Object.keys(payload).length > 0) {
        await update(dbRef(db, `messages/${msgId}`), payload);
      }
    }
  }
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

  const messagesSnap = await get(dbRef(db, "messages"));
  if (messagesSnap.exists()) {
    const msgs = messagesSnap.val();
    for (const [msgId, msg] of Object.entries(msgs)) {
      const payload = {};
      if (msg.uid === uid) {
        payload.displayName = newDisplayName;
      }
      if (msg.replyTo?.uid === uid) {
        payload["replyTo/displayName"] = newDisplayName;
      }
      if (Object.keys(payload).length > 0) {
        await update(dbRef(db, `messages/${msgId}`), payload);
      }
    }
  }
}

export async function promoteToAdmin(uid) {
  await set(dbRef(db, `admins/${uid}`), true);
}

export async function demoteFromAdmin(uid) {
  await remove(dbRef(db, `admins/${uid}`));
}
