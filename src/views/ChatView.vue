<template>
  <div>
    <div v-if="!chatReady" class="loading-page" aria-hidden="true">
      <div class="loading-spinner">
        <span></span>
      </div>
    </div>
    <ChatRoom
      v-if="user"
      :user="user"
      @ready="chatReady = true"
      @open-settings="showSettings = true"
      @open-admin="showAdmin = true"
    />
    <SettingsModal
      :is-open="showSettings"
      :user="user"
      @close="showSettings = false"
    />
    <AdminPanel
      :is-open="showAdmin"
      :current-user-uid="user?.uid"
      @close="showAdmin = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, defineAsyncComponent } from "vue";
import { user } from "../store/auth";

const ChatRoom = defineAsyncComponent(
  () => import("../components/ChatRoom.vue"),
);
const SettingsModal = defineAsyncComponent(
  () => import("../components/SettingsModal.vue"),
);
const AdminPanel = defineAsyncComponent(
  () => import("../components/AdminPanel.vue"),
);

const chatReady = ref(false);
const showSettings = ref(false);
const showAdmin = ref(false);

const anyModalOpen = computed(() => showSettings.value || showAdmin.value);

watch(anyModalOpen, (isOpen) => {
  document.documentElement.style.overflow = isOpen ? "hidden" : "";
});
</script>

<style scoped>
.loading-page {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
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
