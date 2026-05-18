<template>
  <div id="app">
    <ChatRoom
      v-if="status === 'authenticated'"
      :user="user"
      :key="user.uid"
      @ready="handleChatReady"
      @open-settings="showSettings = true"
      @open-admin="showAdmin = true"
    />
    <SetDisplayName
      v-else-if="status === 'needsDisplayName'"
      @done="refreshUser"
    />
    <AuthForm v-else-if="status === 'unauthenticated'" />

    <transition name="loading-fade">
      <div v-if="showLoadingPage" class="loading-page">
        <div class="loading-stack" role="status" aria-live="polite">
          <div class="loading-spinner" aria-hidden="true">
            <span></span>
          </div>
          <div class="loading-label">Loading Node Chat</div>
        </div>
      </div>
    </transition>

    <SettingsModal
      :is-open="showSettings"
      :user="user"
      @close="showSettings = false"
      @refreshUser="refreshUser"
    />

    <AdminPanel
      :is-open="showAdmin"
      :current-user-uid="user?.uid"
      @close="showAdmin = false"
    />
  </div>
</template>

<script setup>
import {
  defineAsyncComponent,
  ref,
  onMounted,
  onUnmounted,
  computed,
  watch,
} from "vue";
import { auth, db } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ref as dbRef, onValue } from "firebase/database";

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

let userDbUnsub = null;
let authUnsub = null;

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
  const currentUser = auth.currentUser;
  if (!currentUser) return;
  const userRef = dbRef(db, `users/${currentUser.uid}`);
  onValue(
    userRef,
    (snap) => applyUser(currentUser, snap.val() || {}),
    () => applyUser(currentUser, {}),
    { onlyOnce: true },
  );
}

function handleChatReady() {
  chatReady.value = true;
}

const anyModalOpen = computed(() => showSettings.value || showAdmin.value);
const hideAppOverflow = computed(
  () => anyModalOpen.value || showLoadingPage.value,
);
watch(
  hideAppOverflow,
  (hide) => {
    document.documentElement.style.overflow = hide ? "hidden" : "";
  },
  { immediate: true },
);

onMounted(() => {
  authUnsub = onAuthStateChanged(auth, (u) => {
    if (userDbUnsub) {
      userDbUnsub();
      userDbUnsub = null;
    }

    chatReady.value = false;

    if (!u) {
      user.value = null;
      status.value = "unauthenticated";
      return;
    }

    if (!user.value || user.value.uid !== u.uid) {
      user.value = null;
      status.value = "loading";
    }

    const userRef = dbRef(db, `users/${u.uid}`);
    userDbUnsub = onValue(
      userRef,
      (snap) => applyUser(u, snap.val() || {}),
      () => applyUser(u, {}),
    );
  });
});

onUnmounted(() => {
  if (userDbUnsub) {
    userDbUnsub();
    userDbUnsub = null;
  }
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
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--bg);
  z-index: 1000;
  will-change: opacity, transform;
}

.loading-fade-enter-active {
  transition: opacity 180ms ease-out;
}
.loading-fade-leave-active {
  transition: opacity 260ms ease-in;
}
.loading-fade-enter-from,
.loading-fade-leave-to {
  opacity: 0;
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
  color: var(--text-muted);
  letter-spacing: 0.02em;
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

@keyframes loadingFadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
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
