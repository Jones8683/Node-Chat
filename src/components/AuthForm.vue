<template>
  <div class="auth-page">
    <DesktopDragHeader />
    <div class="auth-content">
      <div class="auth-card">
        <div class="logo">Node Chat</div>
        <p class="subtitle">
          {{ isLogin ? "Log in to continue" : "Sign up with invite" }}
        </p>

        <div class="auth-tabs" role="tablist" aria-label="Authentication mode">
          <div class="auth-tabs-track">
            <div class="auth-tabs-pill" :class="{ signup: !isLogin }"></div>
            <button
              class="tab-btn"
              :class="{ active: isLogin }"
              type="button"
              role="tab"
              :aria-selected="isLogin"
              @click="switchMode(true)"
            >
              Log In
            </button>
            <button
              class="tab-btn"
              :class="{ active: !isLogin }"
              type="button"
              role="tab"
              :aria-selected="!isLogin"
              @click="switchMode(false)"
            >
              Sign Up
            </button>
          </div>
        </div>

        <form @submit.prevent="handleSubmit" autocomplete="off">
          <fieldset
            class="auth-fields"
            :disabled="loading"
            :aria-busy="loading"
          >
            <div
              class="field-collapse"
              :class="{ 'field-collapse--open': !isLogin }"
            >
              <div class="field-collapse-inner">
                <div class="field">
                  <label for="invite-token">Invite Code</label>
                  <input
                    v-model="signupToken"
                    id="invite-token"
                    name="invite-token"
                    type="text"
                    placeholder="Enter your invite code"
                    maxlength="7"
                    @input="
                      signupToken = $event.target.value
                        .toUpperCase()
                        .slice(0, 7)
                    "
                    autocomplete="off"
                    :disabled="loading || isLogin"
                    :tabindex="isLogin ? -1 : 0"
                  />
                </div>
                <div class="field">
                  <label for="display-name">
                    Display Name
                    <span class="char-count">{{ displayName.length }}/12</span>
                  </label>
                  <input
                    v-model="displayName"
                    id="display-name"
                    name="display-name"
                    type="text"
                    placeholder="How you'll appear in chat"
                    maxlength="12"
                    autocomplete="off"
                    :disabled="loading || isLogin"
                    :tabindex="isLogin ? -1 : 0"
                  />
                </div>
              </div>
            </div>

            <div class="field">
              <label for="email">Email</label>
              <input
                v-model="email"
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                autocomplete="email"
                :disabled="loading"
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
                  :placeholder="isLogin ? 'Password' : 'At least 6 characters'"
                  :autocomplete="isLogin ? 'current-password' : 'new-password'"
                  :disabled="loading"
                />
                <button
                  type="button"
                  class="toggle-pw"
                  @click="showPassword = !showPassword"
                  :disabled="loading"
                  :aria-pressed="showPassword"
                  :aria-label="showPassword ? 'Hide password' : 'Show password'"
                >
                  <EyeOff v-if="showPassword" :size="16" stroke-width="2" />
                  <Eye v-else :size="16" stroke-width="2" />
                </button>
              </div>
            </div>

            <button type="submit" class="submit-btn" :disabled="loading">
              <span
                class="btn-label-track"
                :class="{ 'btn-label-track--signup': !isLogin }"
              >
                <span class="btn-label-item btn-label-signin">
                  {{ loading && isLogin ? "Logging in..." : "Log in" }}
                </span>
                <span class="btn-label-item btn-label-createacc">
                  {{
                    loading && !isLogin
                      ? "Creating account..."
                      : "Create account"
                  }}
                </span>
              </span>
            </button>

            <p class="error" v-if="error" aria-live="polite">{{ error }}</p>
          </fieldset>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from "vue";
import { loginWithPassword, signupWithToken } from "../authUtils";
import { Eye, EyeOff } from "lucide-vue-next";
import DesktopDragHeader from "./DesktopDragHeader.vue";

const isLogin = ref(true);
const email = ref("");
const password = ref("");
const displayName = ref("");
const signupToken = ref("");
const showPassword = ref(false);
const error = ref("");
const loading = ref(false);

onMounted(() => {
  document.title = "Log In • Node Chat";
});

watch(isLogin, (val) => {
  document.title = val ? "Log In • Node Chat" : "Sign Up • Node Chat";
});

function switchMode(login) {
  if (loading.value) return;
  isLogin.value = login;
  error.value = "";
}

function friendlyError(err) {
  const code = err?.code || "";
  switch (code) {
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/missing-password":
      return "Please enter your password.";
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Invalid email or password.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again later.";
    case "auth/network-request-failed":
      return "Network error. Check your connection.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/email-already-in-use":
      return "Email already in use.";
    case "auth/user-disabled":
      return "This account has been disabled.";
  }
  const message = String(err?.message || "").trim();
  if (message) return message;
  return "Something went wrong. Try again.";
}

async function handleSubmit() {
  if (loading.value) return;
  error.value = "";
  if (isLogin.value) await submitLogin();
  else await submitSignup();
}

async function submitLogin() {
  if (!email.value.trim() || !password.value) {
    error.value = "Please enter your email and password.";
    return;
  }
  loading.value = true;
  try {
    await loginWithPassword(email.value.trim(), password.value);
  } catch (e) {
    error.value = friendlyError(e);
  } finally {
    loading.value = false;
  }
}

async function submitSignup() {
  if (!signupToken.value.trim()) {
    error.value = "Please enter your invite code.";
    return;
  }
  if (!displayName.value.trim()) {
    error.value = "Please enter a display name.";
    return;
  }
  if (!email.value.trim() || !password.value) {
    error.value = "Please fill in all fields.";
    return;
  }

  loading.value = true;
  try {
    await signupWithToken(
      signupToken.value.trim(),
      email.value.trim(),
      password.value,
      displayName.value,
    );
  } catch (e) {
    error.value = friendlyError(e);
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
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

.auth-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-image: url("data:image/svg+xml,%3Csvg width='24' height='24' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='12' cy='12' r='1.1' fill='%232c2a27' opacity='0.09'/%3E%3C/svg%3E");
  background-size: 24px 24px;
  background-position: center center;
}

.auth-content {
  display: flex;
  flex: 1;
  width: 100%;
  align-items: center;
  justify-content: center;
  padding: 20px;
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

.field-collapse {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transition:
    grid-template-rows 320ms cubic-bezier(0.2, 0.9, 0.25, 1),
    opacity 240ms ease;
}

.field-collapse--open {
  grid-template-rows: 1fr;
  opacity: 1;
}

.field-collapse-inner {
  overflow: hidden;
}

.btn-label-track {
  display: block;
  position: relative;
  height: 1.2em;
}

.btn-label-item {
  display: flex;
  position: absolute;
  inset: 0;
  align-items: center;
  justify-content: center;
  text-align: center;
  will-change: transform, opacity;
  transition:
    transform 240ms cubic-bezier(0.25, 0.46, 0.45, 0.94),
    opacity 200ms ease;
}

.btn-label-signin {
  transform: translateY(0);
  opacity: 1;
}

.btn-label-createacc {
  transform: translateY(6px);
  opacity: 0;
}

.btn-label-track--signup .btn-label-signin {
  transform: translateY(-6px);
  opacity: 0;
}

.btn-label-track--signup .btn-label-createacc {
  transform: translateY(0);
  opacity: 1;
}

.auth-fields {
  border: 0;
  padding: 0;
  margin: 0;
  min-width: 0;
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
  margin-bottom: 20px;
}

.auth-tabs {
  margin-bottom: 20px;
}

.auth-tabs-track {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  padding: 5px;
  background: rgba(244, 238, 225, 0.96);
  border: 1px solid rgba(44, 42, 39, 0.09);
  border-radius: 999px;
  overflow: hidden;
}

.auth-tabs-pill {
  position: absolute;
  inset: 5px auto 5px 5px;
  width: calc(50% - 5px);
  border-radius: 999px;
  background: linear-gradient(180deg, #fffdf8 0%, #f8f5ed 100%);
  box-shadow:
    0 6px 14px rgba(44, 42, 39, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.78);
  transform: translateX(0);
  transition: transform 220ms cubic-bezier(0.2, 0.9, 0.25, 1);
}

.auth-tabs-pill.signup {
  transform: translateX(100%);
}

.tab-btn {
  position: relative;
  z-index: 1;
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 14px 0;
  font-size: 14px;
  font-weight: 600;
  font-family: "Satoshi", sans-serif;
  transition:
    color 180ms ease,
    transform 180ms ease;
}

.tab-btn:hover {
  color: var(--text);
}

.tab-btn.active {
  color: var(--text);
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
  transition:
    border-color 180ms ease,
    box-shadow 180ms ease,
    transform 180ms ease,
    background-color 180ms ease;
}

.field input:focus {
  border-color: var(--accent);
  box-shadow: none;
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

.password-wrap input::-ms-reveal,
.password-wrap input::-ms-clear {
  display: none;
}

.password-wrap input::-webkit-credentials-auto-fill-button,
.password-wrap input::-webkit-textfield-decoration-container,
.password-wrap input::-webkit-clear-button {
  display: none !important;
  visibility: hidden !important;
  pointer-events: none !important;
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
  transition:
    color 180ms ease,
    transform 180ms ease;
}

.toggle-pw:hover {
  color: var(--text);
  transform: translateY(-50%) scale(1.05);
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
  transition:
    opacity 180ms ease,
    transform 180ms ease,
    box-shadow 180ms ease;
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

.field input {
  scrollbar-width: thin;
  scrollbar-color: rgba(44, 42, 39, 0.28) transparent;
}

.field input::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.field input::-webkit-scrollbar-track {
  background: transparent;
}

.field input::-webkit-scrollbar-thumb {
  background: rgba(44, 42, 39, 0.22);
  border-radius: 999px;
  border: 2px solid transparent;
  background-clip: padding-box;
}

.error {
  color: var(--danger);
  font-size: 13px;
  margin-top: 10px;
  text-align: center;
}
</style>
