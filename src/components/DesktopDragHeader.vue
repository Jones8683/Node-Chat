<template>
  <div
    v-if="isTauriApp"
    class="desktop-titlebar"
    @mousedown="onDragStart"
    @dblclick="onDblClick"
  >
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
import WindowControls from "./WindowControls.vue";
import { useTauri } from "../tauri";

const { isTauriApp } = useTauri();

let windowApiPromise = null;

function loadWindowApi() {
  if (!windowApiPromise) {
    windowApiPromise = import("@tauri-apps/api/window");
  }
  return windowApiPromise;
}

function onDragStart(e) {
  if (e.button !== 0) return;
  if (e.target.closest("button")) return;
  const startX = e.clientX;
  const startY = e.clientY;
  const onMove = async (moveE) => {
    if (Math.hypot(moveE.clientX - startX, moveE.clientY - startY) < 4) return;
    cleanup();
    const { getCurrentWindow } = await loadWindowApi();
    getCurrentWindow()
      .startDragging()
      .catch(() => {});
  };
  const onUp = () => cleanup();
  const cleanup = () => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  };
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
}

async function onDblClick(e) {
  if (e.target.closest("button")) return;
  const { getCurrentWindow } = await loadWindowApi();
  const win = getCurrentWindow();
  if (await win.isMaximized()) win.unmaximize();
  else win.maximize();
}
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
  pointer-events: none;
  -webkit-user-select: none;
  user-select: none;
}

.desktop-titlebar-logo {
  width: 20px;
  height: 20px;
  object-fit: contain;
  pointer-events: none;
  -webkit-user-drag: none;
  -webkit-user-select: none;
  user-select: none;
}

.desktop-titlebar-wordmark {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: -0.18px;
  color: var(--text);
  white-space: nowrap;
  pointer-events: none;
  -webkit-user-select: none;
  user-select: none;
}
</style>
