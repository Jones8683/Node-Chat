<template>
  <div id="app">
    <div v-if="showLoadingPage" class="loading-page">
      <div class="loading-spinner" aria-hidden="true">
        <span></span>
      </div>
    </div>
    <ChatRoom
      v-if="user && user.displayName"
      :user="user"
      @ready="handleChatReady"
      @open-settings="showSettings = true"
      @open-admin="showAdmin = true"
    />
    <SetDisplayName v-else-if="user && !user.displayName" @done="refreshUser" />
    <AuthForm v-else-if="authReady" />

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
import { ref, onMounted, computed, watch } from "vue";
import { auth, db } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ref as dbRef, onValue } from "firebase/database";
import AuthForm from "./components/AuthForm.vue";
import ChatRoom from "./components/ChatRoom.vue";
import SetDisplayName from "./components/SetDisplayName.vue";
import SettingsModal from "./components/SettingsModal.vue";
import AdminPanel from "./components/AdminPanel.vue";

const user = ref(null);
const authReady = ref(false);
const chatReady = ref(false);
const showSettings = ref(false);
const showAdmin = ref(false);
const showLoadingPage = computed(
  () => !authReady.value || (user.value?.displayName && !chatReady.value),
);

let userDbUnsub = null;

function refreshUser() {
  if (!auth.currentUser) return;
  user.value = {
    ...auth.currentUser,
    displayName: user.value?.displayName ?? auth.currentUser.displayName ?? "",
  };
}

function handleChatReady() {
  chatReady.value = true;
}

const anyModalOpen = computed(() => showSettings.value || showAdmin.value);
watch(anyModalOpen, (isOpen) => {
  if (isOpen) {
    document.documentElement.style.overflow = "hidden";
  } else {
    document.documentElement.style.overflow = "";
  }
});

onMounted(() => {
  onAuthStateChanged(auth, (u) => {
    if (userDbUnsub) {
      userDbUnsub();
      userDbUnsub = null;
    }

    chatReady.value = false;

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
        }
      });
    } else {
      user.value = null;
      authReady.value = true;
    }
  });
});
</script>

<style scoped>
.loading-page {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--bg);
  z-index: 20;
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
  border: 2px solid rgba(44, 42, 39, 0.12);
  border-top-color: rgba(44, 42, 39, 0.68);
  animation: loadingSpin 0.95s linear infinite;
}

@keyframes loadingSpin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>
