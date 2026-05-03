<template>
  <transition name="modal-fade" appear>
    <div
      v-if="isOpen"
      class="modal-overlay"
      @click="closeIfClickedOutside"
      @keydown.esc="close"
    >
      <div class="modal-container" role="dialog" aria-modal="true">
        <div class="modal-header">
          <div>
            <h2 class="modal-title">Settings</h2>
            <p class="modal-subtitle">Account and profile</p>
          </div>
          <button class="modal-close" @click="close">
            <X :size="20" stroke-width="2" />
          </button>
        </div>

        <div class="modal-tabs">
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'account' }"
            @click="activeTab = 'account'"
          >
            Account
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'preferences' }"
            @click="activeTab = 'preferences'"
          >
            Preferences
          </button>
        </div>

        <div class="modal-content">
          <div v-if="activeTab === 'account'">
            <div class="section">
              <h3 class="section-title">PROFILE</h3>
              <div class="profile-header">
                <div
                  class="profile-avatar"
                  :style="{ background: currentAvatarColor }"
                >
                  {{ user.displayName?.[0]?.toUpperCase() }}
                </div>
                <div class="profile-meta">
                  <div class="profile-name">{{ user.displayName }}</div>
                  <div class="profile-email">{{ user.email }}</div>
                </div>
              </div>
              <div class="avatar-color-row">
                <span class="avatar-color-label">Color</span>
                <div class="color-swatches">
                  <button
                    v-for="c in AVATAR_PALETTE"
                    :key="c"
                    class="color-swatch"
                    :class="{ selected: avatarColor === c }"
                    :style="{ background: c }"
                    :disabled="savingColor"
                    @click="setAvatarColor(c)"
                    :aria-label="`Set avatar color to ${c}`"
                  ></button>
                </div>
              </div>
            </div>

            <div class="divider"></div>

            <form
              class="section"
              autocomplete="off"
              @submit.prevent="changeUsername"
            >
              <h3 class="section-title">DISPLAY NAME</h3>
              <div class="field">
                <label for="new-username">
                  New name
                  <span class="char-count">{{ newUsername.length }}/12</span>
                </label>
                <input
                  v-model="newUsername"
                  id="new-username"
                  type="text"
                  name="settings-new-display-name"
                  maxlength="12"
                  :placeholder="user.displayName"
                  autocomplete="off"
                  :disabled="loadingUsername"
                />
              </div>

              <button
                class="submit-btn"
                type="submit"
                :disabled="loadingUsername || !newUsername.trim()"
              >
                {{ loadingUsername ? "Updating..." : "Save" }}
              </button>

              <p v-if="errorUsername" class="error">{{ errorUsername }}</p>
              <p v-if="successUsername" class="success">
                {{ successUsername }}
              </p>
            </form>

            <div class="divider"></div>

            <form
              class="section"
              autocomplete="off"
              @submit.prevent="changePassword"
            >
              <h3 class="section-title">PASSWORD</h3>
              <div class="field">
                <label for="current-password">Current password</label>
                <div class="password-wrap">
                  <input
                    v-model="currentPassword"
                    id="current-password"
                    name="settings-current-password"
                    :type="showCurrentPassword ? 'text' : 'password'"
                    placeholder="Enter current password"
                    autocomplete="off"
                    :disabled="loadingPassword"
                  />
                  <button
                    type="button"
                    class="toggle-pw"
                    @click="showCurrentPassword = !showCurrentPassword"
                    :disabled="loadingPassword"
                    :aria-pressed="showCurrentPassword"
                    :aria-label="
                      showCurrentPassword
                        ? 'Hide current password'
                        : 'Show current password'
                    "
                  >
                    <EyeOff
                      v-if="showCurrentPassword"
                      :size="16"
                      stroke-width="2"
                    />
                    <Eye v-else :size="16" stroke-width="2" />
                  </button>
                </div>
              </div>

              <div class="field">
                <label for="new-password">New password</label>
                <div class="password-wrap">
                  <input
                    v-model="newPassword"
                    id="new-password"
                    name="settings-new-password"
                    :type="showNewPassword ? 'text' : 'password'"
                    placeholder="At least 6 characters"
                    autocomplete="new-password"
                    :disabled="loadingPassword"
                  />
                  <button
                    type="button"
                    class="toggle-pw"
                    @click="showNewPassword = !showNewPassword"
                    :disabled="loadingPassword"
                    :aria-pressed="showNewPassword"
                    :aria-label="
                      showNewPassword
                        ? 'Hide new password'
                        : 'Show new password'
                    "
                  >
                    <EyeOff
                      v-if="showNewPassword"
                      :size="16"
                      stroke-width="2"
                    />
                    <Eye v-else :size="16" stroke-width="2" />
                  </button>
                </div>
              </div>

              <div class="field">
                <label for="confirm-password">Confirm new password</label>
                <div class="password-wrap">
                  <input
                    v-model="confirmPassword"
                    id="confirm-password"
                    name="settings-confirm-password"
                    :type="showConfirmPassword ? 'text' : 'password'"
                    placeholder="Confirm new password"
                    autocomplete="new-password"
                    :disabled="loadingPassword"
                  />
                  <button
                    type="button"
                    class="toggle-pw"
                    @click="showConfirmPassword = !showConfirmPassword"
                    :disabled="loadingPassword"
                    :aria-pressed="showConfirmPassword"
                    :aria-label="
                      showConfirmPassword
                        ? 'Hide confirm password'
                        : 'Show confirm password'
                    "
                  >
                    <EyeOff
                      v-if="showConfirmPassword"
                      :size="16"
                      stroke-width="2"
                    />
                    <Eye v-else :size="16" stroke-width="2" />
                  </button>
                </div>
              </div>

              <button
                class="submit-btn"
                type="submit"
                :disabled="
                  loadingPassword ||
                  !newPassword.trim() ||
                  !currentPassword.trim() ||
                  !confirmPassword.trim()
                "
              >
                {{ loadingPassword ? "Updating..." : "Change password" }}
              </button>

              <p v-if="errorPassword" class="error">{{ errorPassword }}</p>
              <p v-if="successPassword" class="success">
                {{ successPassword }}
              </p>
            </form>
          </div>

          <div v-if="activeTab === 'preferences'" class="section">
            <h3 class="section-title">NOTIFICATIONS</h3>
            <div class="pref-row">
              <div class="pref-info">
                <div class="pref-label">Browser notifications</div>
                <div class="pref-desc">
                  Get notified for new messages when the tab isn't active
                </div>
              </div>
              <button
                class="toggle-btn"
                :class="{ active: notificationsEnabled, saving: savingNotif }"
                @click="toggleNotifications"
                :aria-pressed="notificationsEnabled"
              >
                <span class="toggle-thumb"></span>
              </button>
            </div>
            <p v-if="notifError" class="error notif-error">{{ notifError }}</p>
            <p v-if="notifBlocked" class="notif-hint">
              Notifications are blocked by your browser. Click the lock icon in
              the address bar to allow them, then try again.
            </p>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, computed } from "vue";
import { auth, db } from "../firebase";
import { reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { ref as dbRef, update } from "firebase/database";
import { X, Eye, EyeOff } from "lucide-vue-next";
import { changeDisplayName, changeUserPassword } from "../authUtils";

const props = defineProps({ isOpen: Boolean, user: Object });
const emit = defineEmits(["close", "refreshUser"]);

const activeTab = ref("account");
const newUsername = ref("");
const loadingUsername = ref(false);
const errorUsername = ref("");
const successUsername = ref("");

const currentPassword = ref("");
const newPassword = ref("");
const confirmPassword = ref("");
const loadingPassword = ref(false);
const errorPassword = ref("");
const successPassword = ref("");

const showCurrentPassword = ref(false);
const showNewPassword = ref(false);
const showConfirmPassword = ref(false);

const AVATAR_PALETTE = [
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#ec4899",
  "#f43f5e",
  "#ef4444",
  "#f97316",
  "#fb923c",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
  "#64748b",
];

const FALLBACK_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f43f5e",
  "#f97316",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
];
function hashColor(name) {
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}

const avatarColor = computed(
  () => props.user?.preferences?.avatarColor || null,
);
const currentAvatarColor = computed(
  () => avatarColor.value || hashColor(props.user?.displayName || "?"),
);
const savingColor = ref(false);

async function setAvatarColor(color) {
  if (savingColor.value) return;
  savingColor.value = true;
  try {
    await update(dbRef(db, `users/${props.user.uid}/preferences`), {
      avatarColor: color ?? null,
    });
  } finally {
    savingColor.value = false;
  }
}

const notificationsEnabled = computed(
  () => !!props.user?.preferences?.notificationsEnabled,
);
const savingNotif = ref(false);
const notifError = ref("");
const notifBlocked = ref(false);

watch(
  () => props.isOpen,
  (isOpen) => {
    if (isOpen) {
      newUsername.value = "";
      loadingUsername.value = false;
      errorUsername.value = "";
      successUsername.value = "";
      currentPassword.value = "";
      newPassword.value = "";
      confirmPassword.value = "";
      loadingPassword.value = false;
      errorPassword.value = "";
      successPassword.value = "";
      showCurrentPassword.value = false;
      showNewPassword.value = false;
      showConfirmPassword.value = false;
      notifError.value = "";
      notifBlocked.value = false;
    }
  },
);

async function toggleNotifications() {
  notifError.value = "";
  notifBlocked.value = false;

  const enabling = !notificationsEnabled.value;

  if (enabling) {
    if (!("Notification" in window)) {
      notifError.value = "Your browser doesn't support notifications.";
      return;
    }
    if (Notification.permission === "denied") {
      notifBlocked.value = true;
      return;
    }
    if (Notification.permission !== "granted") {
      const result = await Notification.requestPermission();
      if (result !== "granted") {
        notifBlocked.value = true;
        return;
      }
    }
  }

  savingNotif.value = true;
  try {
    await update(dbRef(db, `users/${props.user.uid}/preferences`), {
      notificationsEnabled: enabling,
    });
  } catch {
    notifError.value = "Failed to save preference. Try again.";
  } finally {
    savingNotif.value = false;
  }
}

function closeIfClickedOutside(e) {
  if (e.target === e.currentTarget) close();
}

function close() {
  emit("close");
}

function onKeyDown(e) {
  if (e.key === "Escape") close();
}

onMounted(() => window.addEventListener("keydown", onKeyDown));
onUnmounted(() => window.removeEventListener("keydown", onKeyDown));

async function changeUsername() {
  const trimmed = newUsername.value.trim();

  if (!trimmed) {
    errorUsername.value = "Please enter a display name";
    return;
  }
  if (trimmed.length < 2) {
    errorUsername.value = "Display name must be at least 2 characters";
    return;
  }
  if (!/^[a-zA-Z0-9_\-. ]+$/.test(trimmed)) {
    errorUsername.value =
      "Only letters, numbers, spaces, and _ - . are allowed";
    return;
  }
  if (trimmed === props.user.displayName) {
    errorUsername.value = "New name must be different from current";
    return;
  }

  loadingUsername.value = true;
  errorUsername.value = "";
  successUsername.value = "";

  try {
    await changeDisplayName(props.user.uid, trimmed);
    successUsername.value = "Display name updated!";
    newUsername.value = "";
    emit("refreshUser");
    setTimeout(() => {
      successUsername.value = "";
    }, 3000);
  } catch (e) {
    errorUsername.value = e.message || "Failed to update display name";
  } finally {
    loadingUsername.value = false;
  }
}

async function changePassword() {
  if (!currentPassword.value) {
    errorPassword.value = "Please enter your current password";
    return;
  }
  if (!newPassword.value) {
    errorPassword.value = "Please enter a new password";
    return;
  }
  if (newPassword.value.length < 6) {
    errorPassword.value = "New password must be at least 6 characters";
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    errorPassword.value = "Passwords do not match";
    return;
  }
  if (newPassword.value === currentPassword.value) {
    errorPassword.value = "New password must be different from current";
    return;
  }

  loadingPassword.value = true;
  errorPassword.value = "";
  successPassword.value = "";

  try {
    const user = auth.currentUser;
    const credential = EmailAuthProvider.credential(
      user.email,
      currentPassword.value,
    );
    await reauthenticateWithCredential(user, credential);
    await changeUserPassword(newPassword.value);

    successPassword.value = "Password updated!";
    currentPassword.value = "";
    newPassword.value = "";
    confirmPassword.value = "";
    setTimeout(() => {
      successPassword.value = "";
    }, 3000);
  } catch (e) {
    if (
      e.code === "auth/wrong-password" ||
      e.code === "auth/invalid-credential"
    ) {
      errorPassword.value = "Current password is incorrect";
    } else if (e.code === "auth/too-many-requests") {
      errorPassword.value = "Too many attempts. Try again later.";
    } else {
      errorPassword.value = e.message || "Failed to update password";
    }
  } finally {
    loadingPassword.value = false;
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.38);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  padding: 20px;
  overflow-y: auto;
}

.modal-container {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  width: 100%;
  max-width: 700px;
  height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition:
    opacity 200ms ease,
    transform 200ms ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.995);
}
.modal-fade-enter-to,
.modal-fade-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.modal-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text);
  margin: 0 0 4px 0;
}

.modal-subtitle {
  font-size: 13px;
  color: var(--text-muted);
  margin: 0;
}

.modal-close {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  transition: color 0.2s;
}

.modal-close:hover {
  color: var(--text);
}

.modal-close:focus-visible,
.tab-btn:focus-visible,
.submit-btn:focus-visible,
.toggle-pw:focus-visible,
.field input:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(90, 90, 240, 0.18);
}

.modal-tabs {
  display: flex;
  gap: 8px;
  padding: 14px 14px 0 14px;
  border-bottom: 1px solid transparent;
  flex-shrink: 0;
}

.tab-btn {
  flex: 1;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--text-muted);
  cursor: pointer;
  padding: 12px 14px;
  font-size: 14px;
  font-weight: 600;
  font-family: "Satoshi", sans-serif;
  transition: all 0.2s;
}

.tab-btn:hover {
  color: var(--text);
}

.tab-btn:active {
  transform: translateY(1px);
}

.tab-btn.active {
  color: var(--text);
  border-color: rgba(90, 90, 240, 0.22);
  background: rgba(90, 90, 240, 0.08);
}

.modal-content {
  flex: 1;
  overflow-y: auto;
  padding: 0;
  overscroll-behavior-y: contain;
  scrollbar-width: thin;
  scrollbar-color: rgba(44, 42, 39, 0.28) transparent;
}

.modal-content::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.modal-content::-webkit-scrollbar-track {
  background: transparent;
}

.modal-content::-webkit-scrollbar-thumb {
  background: rgba(44, 42, 39, 0.22);
  border-radius: 999px;
  border: 2px solid transparent;
  background-clip: padding-box;
}

.section {
  padding: 32px;
}

.section-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin: 0 0 24px 0;
}

.profile-header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 20px;
}

.profile-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  color: #fff;
  font-size: 17px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.13);
}

.profile-meta {
  min-width: 0;
  flex: 1;
}

.profile-name {
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.profile-email {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.avatar-color-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.avatar-color-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  white-space: nowrap;
  flex-shrink: 0;
}

.divider {
  height: 1px;
  background: var(--border);
  margin: 0;
}

.field {
  margin-bottom: 24px;
}

.field label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 8px;
}

.char-count {
  font-size: 11px;
  font-weight: 500;
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
    transform 180ms ease;
}

.field input:focus {
  border-color: var(--accent);
  box-shadow: none;
}

.field input::placeholder {
  color: var(--text-muted);
}

.field input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: var(--surface);
}

.password-wrap {
  position: relative;
}

.password-wrap input {
  padding-right: 48px;
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

.toggle-pw:hover:not(:disabled) {
  color: var(--text);
  transform: translateY(-50%) scale(1.05);
}

.toggle-pw:disabled {
  cursor: not-allowed;
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

.submit-btn:active:not(:disabled) {
  transform: translateY(0);
}

.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error {
  color: var(--danger);
  font-size: 13px;
  margin: 12px 0 0 0;
}

.success {
  color: var(--accent);
  font-size: 13px;
  margin: 12px 0 0 0;
}

.color-swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  flex: 1;
  min-width: 0;
}

.color-swatch {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  position: relative;
  padding: 0;
  flex-shrink: 0;
  transition:
    transform 160ms cubic-bezier(0.34, 1.56, 0.64, 1),
    box-shadow 160ms ease;
  outline: none;
}

.color-swatch:hover {
  transform: scale(1.22);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.22);
}

.color-swatch:disabled {
  pointer-events: none;
}

.color-swatch.selected::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='20 6 9 17 4 12'%3E%3C/polyline%3E%3C/svg%3E")
    center/12px no-repeat;
}

.pref-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 0;
  border-bottom: 1px solid var(--border);
}

.pref-info {
  flex: 1;
  min-width: 0;
}

.pref-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 3px;
}

.pref-desc {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.4;
}

.toggle-btn {
  position: relative;
  width: 48px;
  height: 28px;
  border-radius: 999px;
  border: none;
  background: rgba(44, 42, 39, 0.18);
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  transition:
    background 280ms ease,
    box-shadow 280ms ease;
  outline: none;
}

.toggle-btn:focus-visible {
  box-shadow: 0 0 0 3px rgba(90, 90, 240, 0.22);
}

.toggle-btn.active {
  background: var(--accent);
  box-shadow: 0 2px 8px rgba(90, 90, 240, 0.28);
}

.toggle-btn.saving {
  pointer-events: none;
}

.toggle-thumb {
  position: absolute;
  top: 4px;
  left: 4px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  box-shadow:
    0 1px 5px rgba(0, 0, 0, 0.22),
    0 0 0 0.5px rgba(0, 0, 0, 0.06);
  transition:
    transform 350ms cubic-bezier(0.34, 1.56, 0.64, 1),
    width 180ms ease,
    border-radius 180ms ease;
  will-change: transform;
}

.toggle-btn:active .toggle-thumb {
  width: 24px;
  border-radius: 10px;
}

.toggle-btn.active .toggle-thumb {
  transform: translateX(20px);
}

.toggle-btn.active:active .toggle-thumb {
  transform: translateX(16px);
  width: 24px;
  border-radius: 10px;
}

.notif-error {
  margin-top: 10px;
}

.notif-hint {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 10px;
  line-height: 1.5;
  background: rgba(44, 42, 39, 0.04);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 10px 12px;
}

@media (prefers-reduced-motion: reduce) {
  .modal-container,
  .modal-overlay,
  .modal-fade-enter-active,
  .modal-fade-leave-active,
  .tab-btn,
  .submit-btn,
  .toggle-pw,
  .toggle-btn,
  .toggle-thumb,
  .field input {
    transition: none !important;
  }
}
</style>
