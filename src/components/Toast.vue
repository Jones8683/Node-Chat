<template>
  <teleport to="body">
    <transition name="toast">
      <div v-if="toastVisible" class="toast" role="status" aria-live="polite">
        <span class="toast-check">✓</span>
        {{ toastMessage }}
      </div>
    </transition>
  </teleport>
</template>

<script setup>
import { toastMessage, toastVisible } from "../toast";
</script>

<style scoped>
.toast {
  position: fixed;
  bottom: 28px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--text);
  color: var(--bg);
  padding: 10px 18px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  font-family: "Satoshi", sans-serif;
  display: flex;
  align-items: center;
  gap: 7px;
  z-index: 9999;
  pointer-events: none;
  white-space: nowrap;
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.18),
    0 1px 4px rgba(0, 0, 0, 0.1);
}

.toast-check {
  font-size: 12px;
  opacity: 0.7;
}

.toast-enter-active {
  transition:
    opacity 180ms ease,
    transform 220ms var(--ease-out-quint);
}

.toast-leave-active {
  transition:
    opacity 140ms ease,
    transform 160ms ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(8px) scale(0.95);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(4px) scale(0.97);
}
</style>
