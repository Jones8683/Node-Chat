<template>
  <div class="auth-page">
    <div class="auth-card">
      <div class="logo">Node Chat</div>
      <p class="subtitle">Sign in to continue</p>
      <form @submit.prevent="submit">
        <div class="field">
          <label for="email">Email</label>
          <input
            v-model="email"
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            autocomplete="email"
          />
        </div>
        <div class="field">
          <label for="password">Password</label>
          <div class="password-wrap">
            <input
              v-model="password"
              id="password"
              name="password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="Password"
              autocomplete="current-password"
            />
            <button
              type="button"
              class="toggle-pw"
              @click="showPassword = !showPassword"
            >
              <svg
                v-if="showPassword"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"
                />
                <path
                  d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"
                />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
              <svg
                v-else
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>
        </div>
        <button type="submit" class="submit-btn" :disabled="loading">
          {{ loading ? "Signing in..." : "Sign in" }}
        </button>
        <p class="error" v-if="error">{{ error }}</p>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { auth } from "../firebase";
import { signInWithEmailAndPassword } from "firebase/auth";

const email = ref("");
const password = ref("");
const error = ref("");
const loading = ref(false);
const showPassword = ref(false);

function friendlyError(code) {
  switch (code) {
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Invalid email or password.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again later.";
    case "auth/network-request-failed":
      return "Network error. Check your connection.";
    default:
      return "Something went wrong. Try again.";
  }
}

async function submit() {
  if (!email.value || !password.value) return;
  error.value = "";
  loading.value = true;
  try {
    await signInWithEmailAndPassword(auth, email.value, password.value);
  } catch (e) {
    error.value = friendlyError(e.code);
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
}

.auth-card {
  width: 100%;
  max-width: 380px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 36px;
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
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 5px;
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

.password-wrap {
  position: relative;
}

.password-wrap input {
  padding-right: 56px;
}

.toggle-pw {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  transition: color 0.2s;
}

.toggle-pw:hover {
  color: var(--text);
}

.submit-btn {
  width: 100%;
  background: var(--text);
  color: var(--bg);
  border: none;
  border-radius: var(--radius);
  padding: 11px;
  font-size: 15px;
  font-weight: 600;
  font-family: "Satoshi", sans-serif;
  cursor: pointer;
  margin-top: 8px;
  transition: opacity 0.2s;
}

.submit-btn:hover:not(:disabled) {
  opacity: 0.85;
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

input[type="password"]::-ms-reveal,
input[type="password"]::-webkit-contacts-auto-fill-button,
input::-webkit-credentials-auto-fill-button {
  display: none;
}
</style>
