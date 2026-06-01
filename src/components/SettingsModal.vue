<template>
  <transition name="modal-fade" appear>
    <div v-if="isOpen" class="modal-overlay" @click="closeIfClickedOutside">
      <div class="modal-container" role="dialog" aria-modal="true">
        <div class="modal-header">
          <div>
            <h2 class="modal-title">Settings</h2>
            <p class="modal-subtitle">Account and profile</p>
          </div>
          <button type="button" class="modal-close" @click="close">
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
                    :class="{ selected: currentAvatarColor === c }"
                    :style="{ background: c }"
                    @click="setAvatarColor(c)"
                    :aria-label="`Set avatar color to ${c}`"
                    :aria-pressed="currentAvatarColor === c"
                  ></button>
                </div>
              </div>
              <p v-if="colorError" class="error color-error">
                {{ colorError }}
              </p>
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
              <input
                type="text"
                name="username"
                autocomplete="username"
                :value="user.email"
                aria-hidden="true"
                tabindex="-1"
                readonly
                class="visually-hidden"
              />
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

          <div v-if="activeTab === 'preferences'">
            <div class="section">
              <h3 class="section-title">NOTIFICATIONS</h3>
              <div class="pref-card">
                <div class="pref-row">
                  <div class="pref-info">
                    <div class="pref-label">Desktop notifications</div>
                    <div class="pref-desc">
                      Get notified for new messages when the window isn't
                      focused.
                    </div>
                  </div>
                  <button
                    class="toggle-switch"
                    :class="{ active: notificationsEnabled }"
                    @click="toggleNotifications"
                    :aria-pressed="notificationsEnabled"
                    aria-label="Toggle desktop notifications"
                  >
                    <span class="toggle-switch__thumb"></span>
                  </button>
                </div>
                <p v-if="notifError" class="pref-message pref-message--error">
                  {{ notifError }}
                </p>
                <p v-if="notifBlocked" class="pref-message pref-message--hint">
                  Notifications are blocked. Allow them in your app or browser
                  settings, then try again.
                </p>
                <transition
                  name="pref-reveal"
                  @before-enter="onRevealBeforeEnter"
                  @enter="onRevealEnter"
                  @after-enter="onRevealAfterEnter"
                  @before-leave="onRevealBeforeLeave"
                  @leave="onRevealLeave"
                >
                  <div v-if="notificationsEnabled" class="pref-sub">
                    <div class="pref-sub-title">Notify me on</div>
                    <div
                      class="order-toggle"
                      :class="{ right: notificationMode === 'all' }"
                      role="radiogroup"
                    >
                      <div class="order-pill" aria-hidden="true"></div>
                      <button
                        type="button"
                        class="order-btn"
                        :class="{ active: notificationMode === 'ping' }"
                        @click="setNotificationMode('ping')"
                        role="radio"
                        :aria-checked="notificationMode === 'ping'"
                      >
                        Mentions &amp; replies
                      </button>
                      <button
                        type="button"
                        class="order-btn"
                        :class="{ active: notificationMode === 'all' }"
                        @click="setNotificationMode('all')"
                        role="radio"
                        :aria-checked="notificationMode === 'all'"
                      >
                        All messages
                      </button>
                    </div>
                  </div>
                </transition>
              </div>
            </div>

            <div class="divider"></div>

            <div class="section">
              <h3 class="section-title">DISPLAY</h3>
              <div class="pref-card">
                <div class="pref-row">
                  <div class="pref-info">
                    <div class="pref-label">Auto sidebar behavior</div>
                    <div class="pref-desc">
                      When enabled, a collapsed sidebar auto-expands near the
                      left edge and auto-closes again after you navigate.
                    </div>
                  </div>
                  <button
                    class="toggle-switch"
                    :class="{ active: autoSidebarBehavior }"
                    @click="toggleAutoSidebarBehavior"
                    :aria-pressed="autoSidebarBehavior"
                    aria-label="Toggle auto sidebar behavior"
                  >
                    <span class="toggle-switch__thumb"></span>
                  </button>
                </div>
              </div>
              <div class="pref-card">
                <div class="pref-row">
                  <div class="pref-info">
                    <div class="pref-label">Show DM previews</div>
                    <div class="pref-desc">
                      Display the latest text from direct messages in the
                      sidebar.
                    </div>
                  </div>
                  <button
                    class="toggle-switch"
                    :class="{ active: showDmPreviews }"
                    @click="toggleShowDmPreviews"
                    :aria-pressed="showDmPreviews"
                    aria-label="Toggle DM previews in the sidebar"
                  >
                    <span class="toggle-switch__thumb"></span>
                  </button>
                </div>
              </div>
              <div class="pref-card">
                <div class="pref-row">
                  <div class="pref-info">
                    <div class="pref-label">Show timestamps</div>
                    <div class="pref-desc">
                      Display the time next to each message in chat.
                    </div>
                  </div>
                  <button
                    class="toggle-switch"
                    :class="{ active: showTimestamps }"
                    @click="toggleShowTimestamps"
                    :aria-pressed="showTimestamps"
                    aria-label="Toggle message timestamps"
                  >
                    <span class="toggle-switch__thumb"></span>
                  </button>
                </div>
                <p
                  v-if="timestampError"
                  class="pref-message pref-message--error"
                >
                  {{ timestampError }}
                </p>
                <transition
                  name="pref-reveal"
                  @before-enter="onRevealBeforeEnter"
                  @enter="onRevealEnter"
                  @after-enter="onRevealAfterEnter"
                  @before-leave="onRevealBeforeLeave"
                  @leave="onRevealLeave"
                >
                  <div v-if="showTimestamps" class="pref-sub">
                    <div class="pref-sub-title">Time format</div>
                    <div
                      class="order-toggle"
                      :class="{ right: timeFormat === '24h' }"
                      role="radiogroup"
                    >
                      <div class="order-pill" aria-hidden="true"></div>
                      <button
                        type="button"
                        class="order-btn"
                        :class="{ active: timeFormat === '12h' }"
                        @click="setTimeFormat('12h')"
                        role="radio"
                        :aria-checked="timeFormat === '12h'"
                      >
                        12-hour
                      </button>
                      <button
                        type="button"
                        class="order-btn"
                        :class="{ active: timeFormat === '24h' }"
                        @click="setTimeFormat('24h')"
                        role="radio"
                        :aria-checked="timeFormat === '24h'"
                      >
                        24-hour
                      </button>
                    </div>
                  </div>
                </transition>
              </div>
            </div>
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
import {
  changeAvatarColor,
  changeDisplayName,
  changeUserPassword,
  validateDisplayName,
} from "../authUtils";
import {
  notificationsSupported,
  ensureNotificationPermission,
} from "../notifications";

const props = defineProps({ isOpen: Boolean, user: Object });
const emit = defineEmits(["close", "refresh-user"]);

const AVATAR_PALETTE = [
  "#f43f5e",
  "#ef4444",
  "#f97316",
  "#fb923c",
  "#eab308",
  "#bef264",
  "#84cc16",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#d946ef",
  "#ec4899",
  "#ff66b2",
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

const colorError = ref("");
const optimisticAvatarColor = ref(null);

const avatarColor = computed(
  () => props.user?.preferences?.avatarColor || null,
);
const currentAvatarColor = computed(
  () =>
    optimisticAvatarColor.value ||
    avatarColor.value ||
    hashColor(props.user?.displayName || "?"),
);

watch(avatarColor, () => {
  optimisticAvatarColor.value = null;
});

async function setAvatarColor(color) {
  if (currentAvatarColor.value === color) return;
  colorError.value = "";
  const previous = optimisticAvatarColor.value;
  optimisticAvatarColor.value = color;
  try {
    await changeAvatarColor(props.user.uid, color);
  } catch {
    optimisticAvatarColor.value = previous;
    colorError.value = "Failed to update color. Try again.";
  }
}

const notificationsEnabled = computed(
  () => !!props.user?.preferences?.notificationsEnabled,
);
const notificationMode = computed(
  () => props.user?.preferences?.notificationMode || "ping",
);
const showTimestamps = computed(
  () => props.user?.preferences?.showTimestamps !== false,
);
const showDmPreviews = computed(
  () => props.user?.preferences?.showDmPreviews !== false,
);
const timeFormat = computed(() =>
  props.user?.preferences?.timeFormat === "24h" ? "24h" : "12h",
);
const autoSidebarBehavior = computed(() => {
  const prefs = props.user?.preferences || {};
  if (typeof prefs.autoSidebarBehavior === "boolean") {
    return prefs.autoSidebarBehavior;
  }
  return prefs.autoExpandSidebar === true || prefs.autoCollapseSidebar === true;
});

const notifError = ref("");
const notifBlocked = ref(false);
const timestampError = ref("");

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
      timestampError.value = "";
      colorError.value = "";
      optimisticAvatarColor.value = null;
    }
  },
);

async function writePreferences(patch) {
  await update(dbRef(db, `users/${props.user.uid}/preferences`), patch);
}

async function toggleNotifications() {
  notifError.value = "";
  notifBlocked.value = false;
  const enabling = !notificationsEnabled.value;

  if (enabling) {
    if (!notificationsSupported()) {
      notifError.value = "This device doesn't support notifications.";
      return;
    }
    const granted = await ensureNotificationPermission();
    if (!granted) {
      notifBlocked.value = true;
      return;
    }
  }

  try {
    await writePreferences({ notificationsEnabled: enabling });
  } catch {
    notifError.value = "Failed to save preference. Try again.";
  }
}

async function setNotificationMode(mode) {
  if (notificationMode.value === mode) return;
  notifError.value = "";
  try {
    await writePreferences({ notificationMode: mode });
  } catch {
    notifError.value = "Failed to save notification preference.";
  }
}

async function toggleShowTimestamps() {
  timestampError.value = "";
  try {
    await writePreferences({ showTimestamps: !showTimestamps.value });
  } catch {
    timestampError.value = "Failed to save timestamp preference.";
  }
}

async function toggleShowDmPreviews() {
  try {
    await writePreferences({ showDmPreviews: !showDmPreviews.value });
  } catch {}
}

async function setTimeFormat(format) {
  if (timeFormat.value === format) return;
  timestampError.value = "";
  try {
    await writePreferences({ timeFormat: format });
  } catch {
    timestampError.value = "Failed to save time format preference.";
  }
}

async function toggleAutoSidebarBehavior() {
  const next = !autoSidebarBehavior.value;
  try {
    await writePreferences({
      autoSidebarBehavior: next,
      autoExpandSidebar: next,
      autoCollapseSidebar: next,
    });
  } catch {}
}

function onRevealBeforeEnter(el) {
  el.style.overflow = "hidden";
  el.style.height = "0px";
  el.style.opacity = "0";
  el.style.marginTop = "0px";
  el.style.paddingTop = "0px";
  el.style.borderTopColor = "transparent";
}
function onRevealEnter(el, done) {
  const targetMarginTop = "14px";
  const targetPaddingTop = "14px";
  el.style.height = "auto";
  el.style.marginTop = targetMarginTop;
  el.style.paddingTop = targetPaddingTop;
  const targetHeight = el.scrollHeight;
  el.style.height = "0px";
  el.style.marginTop = "0px";
  el.style.paddingTop = "0px";
  void el.offsetHeight;
  const dur = 260;
  const ease = "cubic-bezier(0.4, 0, 0.2, 1)";
  el.style.transition =
    `height ${dur}ms ${ease}, ` +
    `opacity ${dur}ms ${ease}, ` +
    `margin-top ${dur}ms ${ease}, ` +
    `padding-top ${dur}ms ${ease}, ` +
    `border-top-color ${dur}ms ${ease}`;
  el.style.height = targetHeight + "px";
  el.style.opacity = "1";
  el.style.marginTop = targetMarginTop;
  el.style.paddingTop = targetPaddingTop;
  el.style.borderTopColor = "";

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    el.removeEventListener("transitionend", onEnd);
    done();
  };
  const onEnd = (e) => {
    if (e.target !== el || e.propertyName !== "height") return;
    finish();
  };
  el.addEventListener("transitionend", onEnd);
  setTimeout(finish, dur + 60);
}
function onRevealAfterEnter(el) {
  el.style.transition = "";
  el.style.height = "";
  el.style.overflow = "";
  el.style.opacity = "";
  el.style.marginTop = "";
  el.style.paddingTop = "";
  el.style.borderTopColor = "";
}
function onRevealBeforeLeave(el) {
  el.style.overflow = "hidden";
  el.style.height = el.scrollHeight + "px";
  el.style.opacity = "1";
  el.style.marginTop = "14px";
  el.style.paddingTop = "14px";
}
function onRevealLeave(el, done) {
  void el.offsetHeight;
  const dur = 220;
  const ease = "cubic-bezier(0.4, 0, 0.2, 1)";
  el.style.transition =
    `height ${dur}ms ${ease}, ` +
    `opacity ${dur}ms ${ease}, ` +
    `margin-top ${dur}ms ${ease}, ` +
    `padding-top ${dur}ms ${ease}, ` +
    `border-top-color ${dur}ms ${ease}`;
  el.style.height = "0px";
  el.style.opacity = "0";
  el.style.marginTop = "0px";
  el.style.paddingTop = "0px";
  el.style.borderTopColor = "transparent";

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    el.removeEventListener("transitionend", onEnd);
    done();
  };
  const onEnd = (e) => {
    if (e.target !== el || e.propertyName !== "height") return;
    finish();
  };
  el.addEventListener("transitionend", onEnd);
  setTimeout(finish, dur + 60);
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

let usernameSuccessTimer = null;
let passwordSuccessTimer = null;

onMounted(() => window.addEventListener("keydown", onKeyDown));
onUnmounted(() => {
  window.removeEventListener("keydown", onKeyDown);
  if (usernameSuccessTimer) clearTimeout(usernameSuccessTimer);
  if (passwordSuccessTimer) clearTimeout(passwordSuccessTimer);
});

async function changeUsername() {
  const trimmed = newUsername.value.trim();

  const validationError = validateDisplayName(trimmed);
  if (validationError) {
    errorUsername.value = validationError;
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
    emit("refresh-user");
    if (usernameSuccessTimer) clearTimeout(usernameSuccessTimer);
    usernameSuccessTimer = setTimeout(() => {
      successUsername.value = "";
      usernameSuccessTimer = null;
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
    if (passwordSuccessTimer) clearTimeout(passwordSuccessTimer);
    passwordSuccessTimer = setTimeout(() => {
      successPassword.value = "";
      passwordSuccessTimer = null;
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
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

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
  -webkit-backdrop-filter: blur(4px);
  backdrop-filter: blur(4px);
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

.modal-fade-enter-active {
  transition:
    opacity 220ms ease,
    transform 260ms var(--ease-out-quint);
}
.modal-fade-leave-active {
  transition:
    opacity 160ms ease,
    transform 200ms cubic-bezier(0.4, 0, 1, 1);
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.985);
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
  border-radius: 8px;
  transition:
    color 160ms ease,
    background 160ms ease,
    transform 160ms var(--ease-out-quint);
}

.modal-close:hover {
  color: var(--text);
  background: var(--surface-2);
}

.modal-close:active {
  transform: scale(0.9);
  transition-duration: 80ms;
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
  transition: all 120ms ease;
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
  scrollbar-gutter: stable;
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
  margin: 0 0 20px 0;
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
  transition: background 260ms var(--ease-spring);
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

.color-swatch:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(90, 90, 240, 0.32);
}

.color-swatch.selected::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='20 6 9 17 4 12'%3E%3C/polyline%3E%3C/svg%3E")
    center/12px no-repeat;
}

.color-error {
  margin-top: 12px;
}

.divider {
  height: 1px;
  background: var(--border);
  margin: 0 32px;
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

.pref-card {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px 18px;
}

.pref-card + .pref-card {
  margin-top: 12px;
}

.pref-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.pref-info {
  min-width: 0;
  flex: 1;
}

.pref-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 3px;
}

.pref-desc {
  font-size: 12.5px;
  color: var(--text-muted);
  line-height: 1.45;
}

.pref-message {
  margin: 12px 0 0 0;
  font-size: 12.5px;
  line-height: 1.45;
}

.pref-message--error {
  color: var(--danger);
}

.pref-message--hint {
  color: var(--text-muted);
}

.pref-sub {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--border);
}

.pref-sub-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.8px;
  margin-bottom: 8px;
}

.order-toggle {
  position: relative;
  display: inline-grid;
  grid-template-columns: 1fr 1fr;
  width: max-content;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 3px;
  overflow: hidden;
}

.order-pill {
  position: absolute;
  inset: 3px auto 3px 3px;
  width: calc(50% - 3px);
  border-radius: 999px;
  background: #f7f2e6;
  box-shadow:
    0 1px 4px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 #f7f2e6;
  transform: translateX(0);
  transition: transform 220ms cubic-bezier(0.2, 0.9, 0.25, 1);
  pointer-events: none;
}

.order-toggle.right .order-pill {
  transform: translateX(100%);
}

.order-btn {
  position: relative;
  z-index: 1;
  background: transparent;
  border: none;
  border-radius: 999px;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
  font-family: "Satoshi", sans-serif;
  padding: 6px 14px;
  cursor: pointer;
  transition: color 180ms ease;
  white-space: nowrap;
}

.order-btn:hover:not(:disabled) {
  color: var(--text);
}

.order-btn.active {
  color: var(--text);
}

.order-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(90, 90, 240, 0.22);
}

@media (prefers-reduced-motion: reduce) {
  .modal-close,
  .tab-btn,
  .submit-btn,
  .toggle-pw,
  .color-swatch,
  .field input,
  .order-btn,
  .order-pill {
    transition: none !important;
  }
}

@media (max-width: 640px) {
  .modal-overlay {
    padding: 0;
    align-items: stretch;
    justify-content: stretch;
  }
  .modal-container {
    width: 100%;
    max-width: none;
    height: 100%;
    max-height: 100%;
    border-radius: 0;
    border: none;
  }
  .modal-fade-enter-from,
  .modal-fade-leave-to {
    opacity: 0;
    transform: translateY(100%) scale(1);
  }
  .field input {
    font-size: 16px;
  }
}
</style>
