<template>
  <div
    v-if="isTauriApp"
    class="window-controls"
    :class="{ 'window-controls--divider': withDivider }"
  >
    <button
      class="window-btn"
      @click="minimizeWindow"
      title="Minimize"
      aria-label="Minimize"
    >
      <Minus :size="14" stroke-width="2.5" />
    </button>
    <button
      class="window-btn"
      @click="toggleMaximize"
      title="Maximize"
      aria-label="Maximize"
    >
      <svg
        class="window-maximize-icon"
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
      class="window-btn close"
      @click="closeWindow"
      title="Close"
      aria-label="Close"
    >
      <X :size="14" stroke-width="2.5" />
    </button>
  </div>
</template>

<script setup>
import { Minus, X } from "lucide-vue-next";
import { useTauri } from "../tauri";

defineProps({
  withDivider: {
    type: Boolean,
    default: false,
  },
});

const { isTauriApp } = useTauri();
let windowApiPromise = null;

function loadWindowApi() {
  if (!windowApiPromise) {
    windowApiPromise = import("@tauri-apps/api/window");
  }
  return windowApiPromise;
}

async function minimizeWindow() {
  const { getCurrentWindow } = await loadWindowApi();
  await getCurrentWindow().minimize();
}

async function toggleMaximize() {
  const { getCurrentWindow } = await loadWindowApi();
  const win = getCurrentWindow();
  if (await win.isMaximized()) await win.unmaximize();
  else await win.maximize();
}

async function closeWindow() {
  const { getCurrentWindow } = await loadWindowApi();
  await getCurrentWindow().close();
}
</script>

<style scoped>
.window-controls {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-left: 4px;
  flex-shrink: 0;
  -webkit-app-region: no-drag;
}

.window-controls--divider {
  padding-left: 8px;
  border-left: 1px solid var(--border);
}

.window-btn {
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
  -webkit-user-select: none;
  user-select: none;
  line-height: 1;
  flex-shrink: 0;
}

.window-btn:hover {
  background: var(--surface-2);
  color: var(--text);
}

.window-btn:active {
  background: var(--border);
}

.window-btn svg {
  display: block;
  stroke: currentColor;
}

.window-maximize-icon rect {
  transition: stroke 0.15s ease;
}

.window-btn.close:hover {
  background: rgba(239, 68, 68, 0.12);
  color: #ef4444;
}

.window-btn.close:active {
  background: rgba(239, 68, 68, 0.2);
  color: #dc2626;
}
</style>
