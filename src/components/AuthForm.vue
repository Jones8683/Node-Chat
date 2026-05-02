<template>
  <div class="auth-page">
    <div class="auth-card">
      <div class="logo">Node Chat</div>
      <p class="subtitle">
        {{ isLogin ? "Sign in to continue" : "Sign up with invite" }}
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
            @click="
              isLogin = true;
              error = '';
            "
          >
            Sign In
          </button>
          <button
            class="tab-btn"
            :class="{ active: !isLogin }"
            type="button"
            role="tab"
            :aria-selected="!isLogin"
            @click="
              isLogin = false;
              error = '';
            "
          >
            Sign Up
          </button>
        </div>
      </div>

      <div class="auth-stage" :style="{ height: `${stageHeight}px` }">
        <form
          ref="loginFormEl"
          class="auth-panel"
          :class="{ 'is-active': isLogin, 'is-inactive': !isLogin }"
          :aria-hidden="!isLogin"
          @submit.prevent="submitLogin"
        >
          <fieldset class="auth-fields" :disabled="loading || !isLogin">
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
                  placeholder="Password"
                  autocomplete="current-password"
                  :disabled="loading"
                />
                <button
                  type="button"
                  class="toggle-pw"
                  @click="showPassword = !showPassword"
                  :disabled="loading"
                >
                  <EyeOff v-if="showPassword" :size="16" stroke-width="2" />
                  <Eye v-else :size="16" stroke-width="2" />
                </button>
              </div>
            </div>
            <button type="submit" class="submit-btn" :disabled="loading">
              {{ loading ? "Signing in..." : "Sign in" }}
            </button>
            <p class="error" v-if="error">{{ error }}</p>
          </fieldset>
        </form>

        <form
          ref="signupFormEl"
          class="auth-panel"
          :class="{ 'is-active': !isLogin, 'is-inactive': isLogin }"
          :aria-hidden="isLogin"
          @submit.prevent="submitSignup"
          autocomplete="off"
        >
          <fieldset class="auth-fields" :disabled="loading || isLogin">
            <div class="field">
              <label for="invite-token">Invite Code</label>
              <input
                v-model="signupToken"
                id="invite-token"
                name="invite-token"
                type="text"
                placeholder="Paste your invite code"
                autocomplete="off"
                :disabled="loading"
              />
            </div>

            <div class="field">
              <label for="signup-email">Email</label>
              <input
                v-model="signupEmail"
                id="signup-email"
                name="signup-email"
                type="email"
                placeholder="you@example.com"
                autocomplete="email"
                :disabled="loading"
              />
            </div>

            <div class="field">
              <label for="signup-password">Password</label>
              <div class="password-wrap">
                <input
                  v-model="signupPassword"
                  id="signup-password"
                  name="signup-password"
                  :type="showSignupPassword ? 'text' : 'password'"
                  placeholder="At least 6 characters"
                  autocomplete="new-password"
                  :disabled="loading"
                />
                <button
                  type="button"
                  class="toggle-pw"
                  @click="showSignupPassword = !showSignupPassword"
                  :disabled="loading"
                >
                  <EyeOff
                    v-if="showSignupPassword"
                    :size="16"
                    stroke-width="2"
                  />
                  <Eye v-else :size="16" stroke-width="2" />
                </button>
              </div>
            </div>

            <button type="submit" class="submit-btn" :disabled="loading">
              {{ loading ? "Creating account..." : "Create account" }}
            </button>
            <p class="error" v-if="error">{{ error }}</p>
          </fieldset>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { auth } from "../firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { signupWithToken } from "../authUtils";
import { Eye, EyeOff } from "lucide-vue-next";

const isLogin = ref(true);
const email = ref("");
const password = ref("");
const error = ref("");
const loading = ref(false);
const showPassword = ref(false);

const signupToken = ref("");
const signupEmail = ref("");
const signupPassword = ref("");
const showSignupPassword = ref(false);

const stageHeight = ref(380);
const loginFormEl = ref(null);
const signupFormEl = ref(null);

let resizeObserver = null;

function syncStageHeight() {
  const activeForm = isLogin.value ? loginFormEl.value : signupFormEl.value;
  if (!activeForm) return;
  stageHeight.value = activeForm.offsetHeight;
}

function attachObserver() {
  if (resizeObserver) {
    resizeObserver.disconnect();
  }

  const activeForm = isLogin.value ? loginFormEl.value : signupFormEl.value;
  if (!activeForm) return;

  resizeObserver = new ResizeObserver(() => {
    syncStageHeight();
  });

  resizeObserver.observe(activeForm);
  syncStageHeight();
}

watch(isLogin, async () => {
  await nextTick();
  attachObserver();
});

onMounted(async () => {
  await nextTick();
  attachObserver();
});

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect();
  }
});

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
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/email-already-in-use":
      return "Email already in use.";
    default:
      if (code && typeof code === "string" && code.includes("Invite")) {
        return code;
      }
      if (code && typeof code === "string" && code.includes("Display name")) {
        return code;
      }
      return "Something went wrong. Try again.";
  }
}

async function submitLogin() {
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

async function submitSignup() {
  if (!signupToken.value.trim()) {
    error.value = "Please enter your invite code.";
    return;
  }

  if (!signupEmail.value || !signupPassword.value) {
    error.value = "Please fill in all fields.";
    return;
  }

  loading.value = true;
  error.value = "";

  try {
    await signupWithToken(
      signupToken.value.trim(),
      signupEmail.value,
      signupPassword.value,
    );
  } catch (e) {
    const msg = e.message || "";
    if (msg.includes("Invite")) {
      error.value = msg;
    } else if (msg.includes("Display name")) {
      error.value = msg;
    } else if (msg.includes("email")) {
      error.value = "Email already in use.";
    } else {
      error.value = msg || "Signup failed. Try again.";
    }
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
  border-radius: 14px;
  padding: 36px;
}

.auth-stage {
  position: relative;
  overflow: hidden;
  transition: height 320ms cubic-bezier(0.2, 0.9, 0.25, 1);
}

.auth-panel {
  width: 100%;
  transition:
    opacity 220ms cubic-bezier(0.2, 0.9, 0.3, 1),
    transform 220ms cubic-bezier(0.2, 0.9, 0.3, 1),
    filter 220ms cubic-bezier(0.2, 0.9, 0.3, 1);
  will-change: opacity, transform;
}

.auth-panel.is-active {
  position: relative;
  opacity: 1;
  transform: translateY(0) scale(1);
  pointer-events: auto;
  z-index: 2;
}

.auth-panel.is-inactive {
  position: absolute;
  inset: 0;
  opacity: 0;
  transform: translateY(14px) scale(0.982);
  pointer-events: none;
  z-index: 1;
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

.char-count {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-muted);
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
  padding: 11px;
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
