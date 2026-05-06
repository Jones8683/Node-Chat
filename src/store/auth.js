import { ref } from "vue";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ref as dbRef, onValue } from "firebase/database";

export const user = ref(null);
export const authReady = ref(false);

let resolveAuthReady;
const _authReadyPromise = new Promise((resolve) => {
  resolveAuthReady = resolve;
});

let userDbUnsub = null;

onAuthStateChanged(auth, (u) => {
  if (userDbUnsub) {
    userDbUnsub();
    userDbUnsub = null;
  }

  if (u) {
    let isFirst = true;
    const userRef = dbRef(db, `users/${u.uid}`);
    userDbUnsub = onValue(userRef, (snap) => {
      const data = snap.val() || {};
      user.value = {
        ...u,
        displayName: data.displayName || u.displayName || "",
        preferences: data.preferences || {},
      };
      if (isFirst) {
        isFirst = false;
        authReady.value = true;
        resolveAuthReady();
      }
    });
  } else {
    user.value = null;
    authReady.value = true;
    resolveAuthReady();
  }
});

export function waitForAuth() {
  return _authReadyPromise;
}
