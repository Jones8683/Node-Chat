<template>
  <div v-if="isTauriApp" class="desktop-titlebar" data-tauri-drag-region>
    <div class="desktop-titlebar-brand">
      <img src="/icon.png" class="desktop-titlebar-logo" alt="" aria-hidden="true" />
      <span class="desktop-titlebar-wordmark">Node Chat</span>
    </div>
    <div class="desktop-titlebar-controls">
      <button
        class="desktop-window-btn"
        @click="minimizeWindow"
        title="Minimize"
        aria-label="Minimize"
      >
        <Minus :size="14" stroke-width="2.5" />
      </button>
      <button
        class="desktop-window-btn"
        @click="toggleMaximize"
        title="Maximize"
        aria-label="Maximize"
      >
        <svg
          class="desktop-window-maximize-icon"
          width="13"
          height="13"
          viewBox="0 0 13 13"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect
            x="4"
            y="1"
            width="8"
            height="8"
            rx="1.5"
            stroke="currentColor"
            stroke-width="1.4"
          />
          <rect
            x="1"
            y="4"
            width="8"
            height="8"
            rx="1.5"
            stroke="currentColor"
            stroke-width="1.4"
            fill="var(--surface)"
          />
        </svg>
      </button>
      <button
        class="desktop-window-btn desktop-window-btn-close"
        @click="closeWindow"
        title="Close"
        aria-label="Close"
      >
        <X :size="14" stroke-width="2.5" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { Minus, X } from "lucide-vue-next";

const isTauriApp = ref(false);

async function minimizeWindow() {
  if (!isTauriApp.value) return;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().minimize();
  } catch (e) {
    console.error("Minimize failed:", e);
  }
}

async function toggleMaximize() {
  if (!isTauriApp.value) return;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const win = getCurrentWindow();
    const isMaximized = await win.isMaximized();
    if (isMaximized) {
      await win.unmaximize();
    } else {
      await win.maximize();
    }
  } catch (e) {
    console.error("Maximize failed:", e);
  }
}

async function closeWindow() {
  if (!isTauriApp.value) return;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().close();
  } catch (e) {
    console.error("Close failed:", e);
  }
}

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

.desktop-titlebar-controls {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-left: 8px;
  -webkit-app-region: no-drag;
}

.desktop-window-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  border-radius: 6px;
  transition:
    background 0.15s ease,
    color 0.15s ease;
  padding: 0;
  user-select: none;
  line-height: 1;
}

.desktop-window-btn:hover {
  background: var(--surface-2);
  color: var(--text);
}

.desktop-window-btn:active {
  background: var(--border);
}

.desktop-window-btn svg {
  display: block;
  stroke: currentColor;
}

.desktop-window-btn-close:hover {
  background: rgba(239, 68, 68, 0.12);
  color: #ef4444;
}

.desktop-window-btn-close:active {
  background: rgba(239, 68, 68, 0.2);
  color: #dc2626;
}
</style>