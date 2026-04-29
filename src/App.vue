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
    />
    <SetDisplayName v-else-if="user && !user.displayName" @done="refreshUser" />
    <AuthForm v-else />
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from "vue";
import { auth } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import AuthForm from "./components/AuthForm.vue";
import ChatRoom from "./components/ChatRoom.vue";
import SetDisplayName from "./components/SetDisplayName.vue";

const user = ref(null);
const authReady = ref(false);
const chatReady = ref(false);
const showLoadingPage = computed(
  () => !authReady.value || (user.value?.displayName && !chatReady.value),
);

function refreshUser() {
  user.value = { ...auth.currentUser };
}

function handleChatReady() {
  chatReady.value = true;
}

onMounted(() => {
  onAuthStateChanged(auth, (u) => {
    user.value = u ? { ...u } : null;
    authReady.value = true;
    chatReady.value = false;
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
