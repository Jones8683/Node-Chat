import { db, auth } from "./firebase";
import {
  ref as dbRef,
  set,
  get,
  update,
  remove,
  query,
  orderByChild,
  equalTo,
} from "firebase/database";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  updatePassword,
  updateEmail,
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

  const oldDisplayName = user.displayName;
  const oldNameKey =
    oldDisplayName && oldDisplayName.trim()
      ? oldDisplayName.toLowerCase().replace(/\s+/g, "_")
      : null;

  // Remove old username entry if it exists
  if (oldNameKey) {
    await remove(dbRef(db, `usernames/${oldNameKey}`));
  }

  // Add new username entry
  await set(dbRef(db, `usernames/${nameKey}`), uid);

  // Update auth profile
  await updateProfile(user, { displayName: newDisplayName });

  // Update user node
  await update(dbRef(db, `users/${uid}`), {
    displayName: newDisplayName,
  });

  // Update messages with new display name (separate from user data)
  const messagesSnap = await get(dbRef(db, "messages"));
  if (messagesSnap.exists()) {
    const messages = messagesSnap.val();
    for (const [msgId, msg] of Object.entries(messages)) {
      if (msg.uid === uid) {
        await update(dbRef(db, `messages/${msgId}`), {
          displayName: newDisplayName,
        });
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

export async function getAllUsers() {
  const snap = await get(dbRef(db, "users"));
  if (!snap.exists()) return [];

  return Object.entries(snap.val()).map(([uid, data]) => ({
    uid,
    ...data,
  }));
}

export async function deleteUserAccount(uid) {
  const userSnap = await get(dbRef(db, `users/${uid}`));
  if (!userSnap.exists()) {
    throw new Error("User not found");
  }

  const userData = userSnap.val();

  const messagesSnap = await get(dbRef(db, "messages"));
  if (messagesSnap.exists()) {
    const messages = messagesSnap.val();

    for (const [msgId, msg] of Object.entries(messages)) {
      if (msg.uid === uid) {
        await remove(dbRef(db, `messages/${msgId}`));
      }
    }
  }

  // Clean up username entry (defensive check for empty displayName)
  if (userData.displayName && userData.displayName.trim()) {
    const nameKey = userData.displayName.toLowerCase().replace(/\s+/g, "_");
    await remove(dbRef(db, `usernames/${nameKey}`));
  }

  await remove(dbRef(db, `users/${uid}`));
  await remove(dbRef(db, `admins/${uid}`));

  // Delete from Firebase Auth if it's the current user
  const currentUser = auth.currentUser;
  if (currentUser && currentUser.uid === uid) {
    await currentUser.delete();
  }
}

export async function promoteToAdmin(uid) {
  await set(dbRef(db, `admins/${uid}`), true);
}

export async function demoteFromAdmin(uid) {
  await remove(dbRef(db, `admins/${uid}`));
}

export async function getUserByEmail(email) {
  const snap = await get(dbRef(db, "users"));
  if (!snap.exists()) return null;

  for (const [uid, user] of Object.entries(snap.val())) {
    if (user.email === email) {
      return { uid, ...user };
    }
  }

  return null;
}
