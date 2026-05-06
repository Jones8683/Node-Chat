<template>
  <div id="app">
    <div v-if="!authReady" class="loading-page">
      <div class="loading-spinner" aria-hidden="true">
        <span></span>
      </div>
    </div>
    <RouterView v-else />
  </div>
</template>

<script setup>
import { authReady } from "./store/auth";
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
