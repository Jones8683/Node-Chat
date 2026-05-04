<template>
  <div class="auth-page">
    <div class="auth-card">
      <div class="logo">Node Chat</div>
      <p class="subtitle">Pick a display name to get started</p>
      <form @submit.prevent="submit">
        <div class="field">
          <label for="displayName"
            >Display name
            <span class="char-count">{{ name.length }}/12</span></label
          >
          <input
            v-model="name"
            id="displayName"
            name="displayName"
            type="text"
            maxlength="12"
            placeholder="How you'll appear in chat"
            autocomplete="off"
          />
        </div>
        <button type="submit" class="submit-btn" :disabled="loading">
          {{ loading ? "Checking..." : "Let's go" }}
        </button>
        <p class="error" v-if="error">{{ error }}</p>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";

onMounted(() => {
  document.title = "Set Up Profile • Node Chat";
});
import { changeDisplayName } from "../authUtils";
import { auth } from "../firebase";

const emit = defineEmits(["done"]);
const name = ref("");
const error = ref("");
const loading = ref(false);

async function submit() {
  const trimmed = name.value.trim();

  if (!trimmed) {
    error.value = "Please enter a display name";
    return;
  }
  if (trimmed.length < 2) {
    error.value = "Display name must be at least 2 characters";
    return;
  }
  if (!/^[a-zA-Z0-9_\-. ]+$/.test(trimmed)) {
    error.value = "Only letters, numbers, spaces, and _ - . are allowed";
    return;
  }

  loading.value = true;
  error.value = "";

  try {
    await changeDisplayName(auth.currentUser.uid, trimmed);
    emit("done");
  } catch (e) {
    error.value = e?.message || "Something went wrong. Try again.";
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background-image: url("data:image/svg+xml,%3Csvg width='24' height='24' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='12' cy='12' r='1.1' fill='%232c2a27' opacity='0.09'/%3E%3C/svg%3E");
  background-size: 24px 24px;
  background-position: center center;
}

@keyframes cardIn {
  from {
    opacity: 0;
    transform: translateY(16px) scale(0.982);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.auth-card {
  width: 100%;
  max-width: 380px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 36px;
  animation: cardIn 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.logo {
  font-size: 22px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 4px;
}

.subtitle {
  color: var(--text-muted);
  font-size: 15px;
  margin-bottom: 28px;
}

.field {
  margin-bottom: 14px;
}

.field label {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 5px;
}

.char-count {
  font-weight: 400;
  color: var(--text-muted);
}

.field input {
  width: 100%;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 10px 12px;
  color: var(--text);
  font-size: 15px;
  font-family: "Satoshi", sans-serif;
  outline: none;
  transition: border-color 0.2s;
}

.field input:focus {
  border-color: var(--accent);
}

.field input::placeholder {
  color: var(--text-muted);
}

.submit-btn {
  width: 100%;
  background: var(--text);
  color: var(--bg);
  border: none;
  border-radius: var(--radius);
  padding: 13px 11px;
  font-size: 15px;
  font-weight: 600;
  font-family: "Satoshi", sans-serif;
  cursor: pointer;
  margin-top: 8px;
  transition: opacity 0.2s;
}

.submit-btn:hover:not(:disabled) {
  opacity: 0.85;
  transform: translateY(-1px);
  box-shadow: 0 10px 18px rgba(44, 42, 39, 0.06);
}

.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error {
  color: var(--danger);
  font-size: 13px;
  margin-top: 10px;
  text-align: center;
}

.field input,
.auth-card {
  scrollbar-width: thin;
  scrollbar-color: rgba(44, 42, 39, 0.28) transparent;
}

.field input::-webkit-scrollbar,
.auth-card::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.field input::-webkit-scrollbar-thumb,
.auth-card::-webkit-scrollbar-thumb {
  background: rgba(44, 42, 39, 0.22);
  border-radius: 999px;
}
</style>
