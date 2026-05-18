<template>
  <div id="app">
    <ChatRoom
      v-if="status === 'authenticated'"
      :key="user.uid"
      :user="user"
      @ready="onChatReady"
      @open-settings="showSettings = true"
      @open-admin="showAdmin = true"
    />
    <SetDisplayName
      v-else-if="status === 'needsDisplayName'"
      @done="refreshUser"
    />
    <AuthForm v-else-if="status === 'unauthenticated'" />

    <div
      class="loading-page"
      :class="{ 'loading-page--hidden': !showLoadingPage }"
      :aria-hidden="!showLoadingPage"
    >
      <div class="loading-stack" role="status" aria-live="polite">
        <div class="loading-spinner" aria-hidden="true">
          <span></span>
        </div>
        <div class="loading-label">Loading Node Chat</div>
      </div>
    </div>

    <template v-if="user">
      <SettingsModal
        :is-open="showSettings"
        :user="user"
        @close="showSettings = false"
        @refreshUser="refreshUser"
      />

      <AdminPanel
        :key="user.uid"
        :is-open="showAdmin"
        :current-user-uid="user.uid"
        @close="showAdmin = false"
      />
    </template>
  </div>
</template>

<script setup>
import {
  defineAsyncComponent,
  ref,
  computed,
  watch,
  onMounted,
  onUnmounted,
} from "vue";
import { onAuthStateChanged } from "firebase/auth";
import { ref as dbRef, onValue } from "firebase/database";
import { auth, db } from "./firebase";

const AuthForm = defineAsyncComponent(
  () => import("./components/AuthForm.vue"),
);
const ChatRoom = defineAsyncComponent(
  () => import("./components/ChatRoom.vue"),
);
const SetDisplayName = defineAsyncComponent(
  () => import("./components/SetDisplayName.vue"),
);
const SettingsModal = defineAsyncComponent(
  () => import("./components/SettingsModal.vue"),
);
const AdminPanel = defineAsyncComponent(
  () => import("./components/AdminPanel.vue"),
);

const status = ref("loading");
const user = ref(null);
const chatReady = ref(false);
const showSettings = ref(false);
const showAdmin = ref(false);

const showLoadingPage = computed(
  () =>
    status.value === "loading" ||
    (status.value === "authenticated" && !chatReady.value),
);

const hideAppScroll = computed(
  () => showLoadingPage.value || showSettings.value || showAdmin.value,
);

watch(
  hideAppScroll,
  (hide) => {
    document.documentElement.style.overflow = hide ? "hidden" : "";
  },
  { immediate: true },
);

let authUnsub = null;
let userUnsub = null;
let adminUnsub = null;
let initialAdminStatus = null;

function applyUser(authUser, data) {
  const displayName = (data?.displayName || authUser.displayName || "").trim();
  user.value = {
    ...authUser,
    displayName,
    preferences: data?.preferences || {},
  };
  status.value = displayName ? "authenticated" : "needsDisplayName";
}

function refreshUser() {
  const current = auth.currentUser;
  if (!current) return;
  onValue(
    dbRef(db, `users/${current.uid}`),
    (snap) => applyUser(current, snap.val() || {}),
    () => applyUser(current, {}),
    { onlyOnce: true },
  );
}

function onChatReady() {
  chatReady.value = true;
}

function subscribeToUser(authUser) {
  userUnsub = onValue(
    dbRef(db, `users/${authUser.uid}`),
    (snap) => applyUser(authUser, snap.val() || {}),
    () => applyUser(authUser, {}),
  );
}

function subscribeToAdminStatus(uid) {
  initialAdminStatus = null;
  adminUnsub = onValue(dbRef(db, `admins/${uid}`), (snap) => {
    const isAdmin = snap.exists() && snap.val() === true;
    if (initialAdminStatus === null) {
      initialAdminStatus = isAdmin;
      return;
    }
    if (initialAdminStatus !== isAdmin) {
      window.location.reload();
    }
  });
}

function teardownSubscriptions() {
  if (userUnsub) {
    userUnsub();
    userUnsub = null;
  }
  if (adminUnsub) {
    adminUnsub();
    adminUnsub = null;
  }
  initialAdminStatus = null;
}

onMounted(() => {
  authUnsub = onAuthStateChanged(auth, (authUser) => {
    teardownSubscriptions();
    chatReady.value = false;

    if (!authUser) {
      user.value = null;
      status.value = "unauthenticated";
      return;
    }

    if (!user.value || user.value.uid !== authUser.uid) {
      user.value = null;
      status.value = "loading";
    }

    subscribeToUser(authUser);
    subscribeToAdminStatus(authUser.uid);
  });
});

onUnmounted(() => {
  teardownSubscriptions();
  if (authUnsub) {
    authUnsub();
    authUnsub = null;
  }
  document.documentElement.style.overflow = "";
});
</script>

<style scoped>
.loading-page {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--bg);
  opacity: 1;
  transition: opacity 0s;
  will-change: opacity;
}

.loading-page--hidden {
  opacity: 0;
  pointer-events: none;
  transition: opacity 260ms ease-in;
}

.loading-stack {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.loading-spinner {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
}

.loading-spinner span {
  width: 22px;
  height: 22px;
  border-radius: 999px;
  border: 2px solid rgba(44, 42, 39, 0.1);
  border-top-color: rgba(44, 42, 39, 0.72);
  animation: loadingSpin 0.85s cubic-bezier(0.65, 0, 0.35, 1) infinite;
  will-change: transform;
}

.loading-label {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--text-muted);
  animation: loadingLabelPulse 1.6s ease-in-out infinite;
}

@keyframes loadingSpin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes loadingLabelPulse {
  0%,
  100% {
    opacity: 0.65;
  }
  50% {
    opacity: 1;
  }
}
</style>
