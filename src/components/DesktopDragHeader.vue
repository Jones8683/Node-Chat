<template>
  <div v-if="isTauriApp" class="desktop-titlebar" data-tauri-drag-region>
    <div class="desktop-titlebar-brand">
      <img
        src="/icon.png"
        class="desktop-titlebar-logo"
        alt=""
        aria-hidden="true"
      />
      <span class="desktop-titlebar-wordmark">Node Chat</span>
    </div>
    <WindowControls />
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import WindowControls from "./WindowControls.vue";

const isTauriApp = ref(false);

onMounted(async () => {
  try {
    const { isTauri } = await import("@tauri-apps/api/core");
    isTauriApp.value = await isTauri();
  } catch {
    isTauriApp.value = false;
  }
});
</script>

<style scoped>
.desktop-titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 44px;
  padding: 0 8px 0 14px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
  flex-shrink: 0;
}

.desktop-titlebar-brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.desktop-titlebar-logo {
  width: 20px;
  height: 20px;
  object-fit: contain;
}

.desktop-titlebar-wordmark {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: -0.18px;
  color: var(--text);
  white-space: nowrap;
}
</style>
