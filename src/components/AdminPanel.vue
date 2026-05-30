<template>
  <transition name="modal-fade" appear>
    <div v-if="isOpen" class="modal-overlay" @click="closeIfClickedOutside">
      <div class="modal-container">
        <div class="modal-header">
          <h2 class="modal-title">Admin</h2>
          <button type="button" class="modal-close" @click="close">
            <X :size="20" stroke-width="2" />
          </button>
        </div>

        <div class="modal-tabs">
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'invites' }"
            @click="activeTab = 'invites'"
          >
            Invites
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'users' }"
            @click="activeTab = 'users'"
          >
            Users
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'controls' }"
            @click="activeTab = 'controls'"
          >
            Controls
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'audit' }"
            @click="activeTab = 'audit'"
          >
            Audit Log
          </button>
        </div>

        <div class="modal-content">
          <p v-if="adminActionError" class="error">
            {{ adminActionError }}
          </p>
          <div v-if="activeTab === 'invites'">
            <div class="section">
              <button
                class="action-btn"
                @click="generateInvite"
                :disabled="generatingInvite"
              >
                {{
                  generatingInvite ? "Generating..." : "Generate Invite Code"
                }}
              </button>

              <p v-if="errorInvite" class="error">{{ errorInvite }}</p>
            </div>

            <div class="section">
              <h3 class="section-title">Active Invites</h3>
              <div v-if="loadingInvites" class="loading">
                Loading invites...
              </div>
              <div v-else-if="invites.length === 0" class="empty-state">
                No active invites yet. Generate one above.
              </div>
              <div v-else class="invites-list">
                <div
                  class="invite-item"
                  v-for="invite in invites"
                  :key="invite.token"
                >
                  <div class="invite-info">
                    <div class="invite-token-row">
                      <div class="invite-token">{{ invite.token }}</div>
                      <span class="invite-state">Active</span>
                    </div>
                    <div class="invite-expires">
                      Expires: {{ formatRemaining(invite.expiresAt) }}
                    </div>
                  </div>
                  <div class="invite-actions">
                    <button
                      class="copy-btn"
                      @click="copyToClipboard(invite.token)"
                      title="Copy invite code"
                    >
                      <Copy :size="14" stroke-width="2" />
                      Copy
                    </button>
                    <button
                      class="delete-btn-invite"
                      @click="deleteInvite(invite.token)"
                      title="Delete invite"
                    >
                      <Trash2 :size="14" stroke-width="2" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="activeTab === 'controls'">
            <div class="control-card-flat">
              <div class="lock-row">
                <div class="control-card-top" style="flex: 1; min-width: 0">
                  <div class="control-title">Lock Chat</div>
                  <div class="control-desc">
                    Prevent non-admins from sending messages.
                  </div>
                </div>
                <button
                  class="lock-toggle-btn"
                  :class="{ 'lock-toggle-btn--locked': chatLocked }"
                  @click="toggleChatLock"
                  :disabled="lockLoading"
                >
                  <Lock v-if="!chatLocked" :size="12" stroke-width="2.5" />
                  <Unlock v-else :size="12" stroke-width="2.5" />
                  {{
                    lockLoading
                      ? "..."
                      : chatLocked
                        ? "Unlock Chat"
                        : "Lock Chat"
                  }}
                </button>
              </div>
              <div
                class="lock-status"
                :class="{ 'lock-status--locked': chatLocked }"
              >
                <span class="lock-status-dot"></span>
                <span>{{
                  chatLocked
                    ? "Chat is locked — only admins can send messages"
                    : "Chat is open — all users can send messages"
                }}</span>
              </div>
            </div>

            <div class="control-card-flat purge-card">
              <div class="control-card-top">
                <div class="control-title-row">
                  <div class="control-title">Purge Messages</div>
                  <div class="purge-count-badge">
                    <span class="purge-count-label">Current</span>
                    <strong class="purge-count-value">
                      {{
                        loadingMessagesCount
                          ? "..."
                          : totalMessagesCount === null
                            ? "-"
                            : totalMessagesCount
                      }}
                    </strong>
                  </div>
                </div>
                <div class="control-desc">
                  Permanently delete messages from the database. This cannot be
                  undone.
                </div>
              </div>
              <div class="purge-row">
                <div class="order-toggle">
                  <div
                    class="order-pill"
                    :class="{ right: purgeOrder === 'oldest' }"
                  ></div>
                  <button
                    type="button"
                    class="order-btn"
                    :class="{ active: purgeOrder === 'newest' }"
                    :disabled="purging"
                    @click="purgeOrder = 'newest'"
                  >
                    Newest
                  </button>
                  <button
                    type="button"
                    class="order-btn"
                    :class="{ active: purgeOrder === 'oldest' }"
                    :disabled="purging"
                    @click="purgeOrder = 'oldest'"
                  >
                    Oldest
                  </button>
                </div>
                <div
                  class="custom-select"
                  :class="{ open: purgeDropdownOpen }"
                  ref="purgeDropdownRef"
                >
                  <button
                    class="custom-select-btn"
                    type="button"
                    :disabled="purging"
                    @click="purgeDropdownOpen = !purgeDropdownOpen"
                  >
                    <span>{{
                      purgeOptions.find((o) => o.value === purgeAmount)?.label
                    }}</span>
                    <ChevronDown
                      :size="12"
                      stroke-width="2.5"
                      class="custom-select-chevron"
                    />
                  </button>
                  <transition name="dropdown-pop">
                    <div v-if="purgeDropdownOpen" class="custom-select-menu">
                      <button
                        v-for="opt in purgeOptions"
                        :key="opt.value"
                        type="button"
                        class="custom-select-option"
                        :class="{ selected: purgeAmount === opt.value }"
                        @click="
                          purgeAmount = opt.value;
                          purgeDropdownOpen = false;
                        "
                      >
                        <span>{{ opt.label }}</span>
                        <Check
                          v-if="purgeAmount === opt.value"
                          :size="12"
                          stroke-width="3"
                          class="option-check"
                        />
                      </button>
                    </div>
                  </transition>
                </div>
                <button
                  class="purge-btn"
                  @click="promptPurge"
                  :disabled="purging"
                >
                  <Trash2 :size="13" stroke-width="2.5" />
                  {{ purging ? "Purging..." : "Purge" }}
                </button>
              </div>
              <div v-if="purgeError" class="purge-error-msg">
                <AlertTriangle :size="12" stroke-width="2.5" />
                <span>{{ purgeError }}</span>
              </div>
            </div>
          </div>

          <div v-if="activeTab === 'users'">
            <div v-if="loadingUsers" class="loading">Loading users...</div>
            <div v-else>
              <div v-if="!usersError" class="stats-section">
                <div class="stat-item">
                  <div class="stat-value">{{ totalUsersCount }}</div>
                  <div class="stat-label">Total Users</div>
                </div>
                <div class="stat-item">
                  <div class="stat-value">{{ adminCount }}</div>
                  <div class="stat-label">Admins</div>
                </div>
              </div>
              <div v-if="usersError" class="error users-error">
                {{ usersError }}
              </div>
              <div v-if="!usersError && users.length > 0" class="user-search">
                <Search
                  :size="14"
                  stroke-width="2.25"
                  class="user-search-icon"
                />
                <input
                  ref="userSearchInputRef"
                  id="admin-user-search"
                  name="admin-user-search"
                  type="text"
                  class="user-search-input"
                  placeholder="Search users"
                  v-model="userSearchQuery"
                  @keydown.escape.stop.prevent="onUserSearchEscape"
                  spellcheck="false"
                  autocomplete="off"
                />
                <button
                  v-if="userSearchQuery"
                  type="button"
                  class="user-search-clear"
                  @click="clearUserSearch"
                  title="Clear search"
                  aria-label="Clear search"
                >
                  <X :size="12" stroke-width="2.5" />
                </button>
              </div>
              <div v-if="users.length === 0" class="empty-state">
                No users found
              </div>
              <div
                v-else-if="filteredUsers.length === 0"
                class="empty-state user-search-empty"
              >
                No users match "{{ userSearchQuery }}"
              </div>
              <div v-else class="users-list">
                <div class="user-item" v-for="u in filteredUsers" :key="u.uid">
                  <div class="user-info">
                    <div class="user-avatar">
                      {{ getAvatarInitial(u.displayName) }}
                    </div>
                    <div class="user-details">
                      <div class="user-name-slot">
                        <template v-if="editingUserId === u.uid">
                          <div class="username-edit-row">
                            <input
                              class="username-edit-input"
                              v-model="editingUserName"
                              :id="`edit-username-${u.uid}`"
                              :name="`edit-username-${u.uid}`"
                              @keydown.enter="saveUsername(u.uid)"
                              @keydown.escape="cancelEditUsername"
                              maxlength="12"
                              autofocus
                            />
                            <button
                              class="username-save-btn"
                              @click="saveUsername(u.uid)"
                            >
                              Save
                            </button>
                            <button
                              class="username-cancel-btn"
                              @click="cancelEditUsername"
                            >
                              Cancel
                            </button>
                          </div>
                        </template>
                        <template v-else>
                          <span class="user-name">{{
                            u.displayName || "(no name)"
                          }}</span>
                          <Crown
                            v-if="isUserAdminStatus(u.uid)"
                            :size="12"
                            stroke-width="2.5"
                            class="crown-icon"
                          />
                          <span v-if="isUserMuted(u.uid)" class="muted-badge"
                            >muted</span
                          >
                        </template>
                      </div>
                      <div class="user-meta">
                        <span class="user-email">{{
                          u.email || "(no email)"
                        }}</span>
                        <span v-if="u.createdAt" class="user-meta-sep">·</span>
                        <span v-if="u.createdAt" class="user-created">{{
                          formatDate(u.createdAt)
                        }}</span>
                      </div>
                    </div>
                  </div>
                  <div class="user-actions">
                    <button
                      class="edit-name-btn"
                      @click="startEditUsername(u)"
                      title="Edit username"
                    >
                      <Pencil :size="13" stroke-width="2" />
                    </button>
                    <button
                      v-if="canShowMuteButton(u.uid)"
                      class="role-btn mute-btn"
                      :class="{ 'mute-btn--muted': isUserMuted(u.uid) }"
                      :disabled="mutingUid === u.uid"
                      @click="toggleMute(u.uid)"
                    >
                      <Mic
                        v-if="isUserMuted(u.uid)"
                        :size="12"
                        stroke-width="2.5"
                      />
                      <MicOff v-else :size="12" stroke-width="2.5" />
                      {{
                        mutingUid === u.uid
                          ? "..."
                          : isUserMuted(u.uid)
                            ? "Unmute"
                            : "Mute"
                      }}
                    </button>
                    <button
                      v-if="!isUserAdminStatus(u.uid)"
                      class="role-btn"
                      @click="promptPromoteUser(u.uid, u.displayName)"
                    >
                      Promote
                    </button>
                    <button
                      v-else
                      class="role-btn demote-btn"
                      @click="promptDemoteUser(u.uid, u.displayName)"
                    >
                      Demote
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-if="activeTab === 'audit'">
            <div v-if="loadingAudit" class="loading">Loading audit...</div>
            <div v-else-if="auditError" class="error users-error">
              {{ auditError }}
            </div>
            <div v-else-if="auditEntries.length === 0" class="empty-state">
              No audit events yet.
            </div>
            <div v-else class="audit-list">
              <div
                class="audit-row"
                v-for="ev in auditEntries"
                :key="ev.id + ev.actorUid"
              >
                <span class="audit-action-pill">{{
                  formatAuditAction(ev.action)
                }}</span>
                <div class="audit-main" v-html="formatAuditText(ev)"></div>
                <div class="audit-ts">{{ formatDateTime(ev.ts) }}</div>
              </div>
            </div>
          </div>
        </div>

        <teleport to="body">
          <transition name="confirm-pop">
            <div
              v-if="confirmAction.show"
              class="confirmation-overlay"
              @click="cancelConfirm"
            >
              <div class="confirmation-box" @click.stop>
                <h3>{{ confirmAction.title }}</h3>
                <p>{{ confirmAction.message }}</p>
                <div
                  class="confirmation-actions"
                  :class="{
                    'confirmation-actions--single': confirmAction.infoOnly,
                  }"
                >
                  <template v-if="confirmAction.infoOnly">
                    <button class="ok-btn" @click="cancelConfirm">OK</button>
                  </template>
                  <template v-else>
                    <button class="cancel-btn" @click="cancelConfirm">
                      Cancel
                    </button>
                    <button
                      class="danger-btn"
                      @click="confirmAction.confirm"
                      :disabled="confirmAction.loading"
                    >
                      {{
                        confirmAction.loading
                          ? "Processing..."
                          : confirmAction.action
                      }}
                    </button>
                  </template>
                </div>
              </div>
            </div>
          </transition>
        </teleport>

        <div v-if="copyFeedback" class="copy-feedback">Copied!</div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { auth, db } from "../firebase";
import copy from "clipboard-copy";
import {
  X,
  Copy,
  Trash2,
  Pencil,
  Crown,
  AlertTriangle,
  ChevronDown,
  Check,
  Lock,
  Unlock,
  MicOff,
  Mic,
  Search,
} from "lucide-vue-next";
import {
  ref as dbRef,
  query,
  orderByKey,
  limitToFirst,
  limitToLast,
  get,
  set,
  remove,
  onValue,
} from "firebase/database";
import {
  createInviteToken,
  promoteToAdmin,
  demoteFromAdmin,
  deleteInviteToken,
  adminRenameUser,
  recordAuditEvent,
} from "../authUtils";

const props = defineProps({
  isOpen: Boolean,
  currentUserUid: String,
});

const emit = defineEmits(["close"]);

const activeTab = ref("invites");
const auditEntries = ref([]);
const loadingAudit = ref(false);
const auditError = ref("");
let auditListener = null;
const invites = ref([]);
const loadingInvites = ref(false);
const generatingInvite = ref(false);
const errorInvite = ref("");

const users = ref([]);
const loadingUsers = ref(false);
const adminUsers = ref(new Set());
const ownerUsers = ref(new Set());
const usersError = ref("");
const adminRoleResolved = ref(false);

const totalUsersCount = ref(0);
const adminCount = ref(0);
const totalMessagesCount = ref(null);
const loadingMessagesCount = ref(false);
const adminActionError = ref("");

const copyFeedback = ref(false);

const editingUserId = ref(null);
const editingUserName = ref("");

const userSearchQuery = ref("");
const userSearchInputRef = ref(null);

const purgeAmount = ref("100");
const purgeOrder = ref("newest");
const purging = ref(false);
const purgeError = ref("");
const purgeDropdownOpen = ref(false);
const purgeDropdownRef = ref(null);

const chatLocked = ref(false);
const lockLoading = ref(false);
let settingsListener = null;

const mutedUsers = ref(new Set());
const mutingUid = ref(null);
let muteListener = null;

const purgeOptions = [
  { value: "50", label: "50 messages" },
  { value: "100", label: "100 messages" },
  { value: "200", label: "200 messages" },
  { value: "500", label: "500 messages" },
  { value: "all", label: "All messages" },
];

const confirmAction = ref({
  show: false,
  title: "",
  message: "",
  action: "",
  confirm: null,
  loading: false,
  infoOnly: false,
});

let invitesListener = null;
let adminsListener = null;
let ownerListener = null;
let usersListener = null;
let messagesListener = null;
const now = ref(Date.now());
let inviteInterval = null;
let _prevAdminSet = null;
let adminsLoaded = false;
let ownerLoaded = false;

const hasAdminAccess = computed(() => {
  const uid = props.currentUserUid;
  return !!uid && (adminUsers.value.has(uid) || ownerUsers.value.has(uid));
});

const canUseAdminPanel = computed(
  () => adminRoleResolved.value && hasAdminAccess.value,
);

const filteredUsers = computed(() => {
  const raw = userSearchQuery.value.trim().toLowerCase();
  if (!raw) return users.value;

  const tokens = raw.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return users.value;

  return users.value.filter((u) => {
    const name = (u.displayName || "").toLowerCase();
    const email = (u.email || "").toLowerCase();
    const uid = (u.uid || "").toLowerCase();
    const isAdmin = adminUsers.value.has(u.uid);
    const isOwner = ownerUsers.value.has(u.uid);
    const isMuted = mutedUsers.value.has(u.uid);

    const roleTags = [];
    if (isOwner) roleTags.push("owner");
    if (isAdmin) roleTags.push("admin");
    if (!isAdmin && !isOwner) roleTags.push("member", "user");
    if (isMuted) roleTags.push("muted");

    return tokens.every((token) => {
      if (
        name.includes(token) ||
        email.includes(token) ||
        uid.includes(token)
      ) {
        return true;
      }
      return roleTags.some((tag) => tag.includes(token));
    });
  });
});

function clearUserSearch() {
  userSearchQuery.value = "";
  const el = userSearchInputRef.value;
  if (el && typeof el.focus === "function") {
    el.focus();
  }
}

function onUserSearchEscape() {
  if (userSearchQuery.value) {
    clearUserSearch();
    return;
  }
  const el = userSearchInputRef.value;
  if (el && typeof el.blur === "function") {
    el.blur();
  }
}

function syncAdminRoleResolved() {
  adminRoleResolved.value = adminsLoaded && ownerLoaded;
}

function ensureInvitesListener() {
  if (invitesListener || !canUseAdminPanel.value) return;
  loadingInvites.value = true;
  if (!inviteInterval) {
    inviteInterval = setInterval(() => {
      now.value = Date.now();
    }, 1000);
  }
  invitesListener = onValue(
    dbRef(db, "invites"),
    (snap) => {
      const now = Date.now();
      invites.value = snap.exists()
        ? Object.entries(snap.val())
            .filter(([, data]) => !data.used && data.expiresAt > now)
            .map(([token, data]) => ({ token, ...data }))
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        : [];
      loadingInvites.value = false;
      errorInvite.value = "";
    },
    (error) => {
      invites.value = [];
      loadingInvites.value = false;
      errorInvite.value =
        error?.code === "PERMISSION_DENIED" ||
        String(error?.message || "")
          .toLowerCase()
          .includes("permission")
          ? "Database rules are blocking invite reads. Make sure your uid is listed under /admins or /owner and the rules are published."
          : "Failed to load invites.";
    },
  );
}

function stopInvitesListener() {
  if (invitesListener) {
    invitesListener();
    invitesListener = null;
  }
  if (inviteInterval) {
    clearInterval(inviteInterval);
    inviteInterval = null;
  }
  invites.value = [];
  loadingInvites.value = false;
  errorInvite.value = "";
}

onMounted(() => {
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("pointerdown", onOutsideClick);
  settingsListener = onValue(
    dbRef(db, "settings/chatLocked"),
    (snap) => {
      chatLocked.value = snap.val() === true;
    },
    (error) => {},
  );
  muteListener = onValue(
    dbRef(db, "muted"),
    (snap) => {
      mutedUsers.value = new Set(snap.exists() ? Object.keys(snap.val()) : []);
    },
    (error) => {},
  );

  adminsListener = onValue(
    dbRef(db, "admins"),
    (snap) => {
      adminsLoaded = true;
      const newSet = new Set(snap.exists() ? Object.keys(snap.val()) : []);
      adminUsers.value = newSet;
      adminCount.value = newSet.size;
      if (users.value.length) sortUsers();

      const currentUid = auth.currentUser && auth.currentUser.uid;
      if (currentUid) {
        if (_prevAdminSet === null) {
          _prevAdminSet = new Set(newSet);
        } else {
          const wasAdmin = _prevAdminSet.has(currentUid);
          const isAdminNow = newSet.has(currentUid);
          if (wasAdmin !== isAdminNow && !isAdminNow) {
            close();
          }
          _prevAdminSet = new Set(newSet);
        }
      } else {
        _prevAdminSet = new Set(newSet);
      }
      syncAdminRoleResolved();
    },
    (error) => {},
  );

  ownerListener = onValue(
    dbRef(db, "owner"),
    (snap) => {
      ownerLoaded = true;
      ownerUsers.value = new Set();
      if (snap.exists()) ownerUsers.value.add(snap.val());
      if (users.value.length) sortUsers();
      syncAdminRoleResolved();
    },
    (error) => {},
  );
});

onUnmounted(() => {
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("pointerdown", onOutsideClick);
  if (invitesListener) invitesListener();
  if (settingsListener) settingsListener();
  if (muteListener) muteListener();
  if (adminsListener) adminsListener();
  if (ownerListener) ownerListener();
  if (usersListener) usersListener();
  if (auditListener) auditListener();
  if (messagesListener) messagesListener();
  if (inviteInterval) clearInterval(inviteInterval);
  if (copyFeedbackTimer) clearTimeout(copyFeedbackTimer);
});

function stopUsersListener() {
  if (usersListener) {
    usersListener();
    usersListener = null;
  }
}

function ensureAuditListener() {
  if (auditListener || !canUseAdminPanel.value) return;
  loadingAudit.value = true;
  auditError.value = "";
  loadUsers();
  auditListener = onValue(
    dbRef(db, "auditLogs"),
    (snap) => {
      const all = snap.exists() ? snap.val() : {};
      const flat = [];
      for (const [actorUid, items] of Object.entries(all)) {
        for (const [id, ev] of Object.entries(items || {})) {
          flat.push({ id, actorUid, ...ev });
        }
      }
      flat.sort((a, b) => {
        const diff = (b.ts || 0) - (a.ts || 0);
        if (diff !== 0) return diff;
        return String(b.id || "").localeCompare(String(a.id || ""));
      });
      auditEntries.value = flat.slice(0, 500);
      loadingAudit.value = false;
      auditError.value = "";
    },
    (error) => {
      auditEntries.value = [];
      loadingAudit.value = false;
      auditError.value =
        error?.code === "PERMISSION_DENIED" ||
        String(error?.message || "")
          .toLowerCase()
          .includes("permission")
          ? "Database rules are blocking audit logs. Make sure your uid is listed in /admins or /owner and the rules are published."
          : "Failed to load audit logs.";
    },
  );
}

function stopAuditListener() {
  if (auditListener) {
    auditListener();
    auditListener = null;
  }
}

function ensureMessagesCountListener() {
  if (messagesListener || !canUseAdminPanel.value) return;
  loadingMessagesCount.value = true;
  messagesListener = onValue(
    dbRef(db, "messages"),
    (snap) => {
      totalMessagesCount.value = snap.exists()
        ? Object.keys(snap.val() || {}).length
        : 0;
      loadingMessagesCount.value = false;
    },
    () => {
      totalMessagesCount.value = null;
      loadingMessagesCount.value = false;
    },
  );
}

function stopMessagesCountListener() {
  if (messagesListener) {
    messagesListener();
    messagesListener = null;
  }
}

watch(
  [() => props.isOpen, () => activeTab.value, canUseAdminPanel],
  ([isOpen, tab, canUsePanel], prev) => {
    const prevIsOpen = prev ? prev[0] : null;
    const prevTab = prev ? prev[1] : null;
    if (
      prevIsOpen !== isOpen ||
      (prevTab !== tab && (prevTab === "users" || tab !== "users"))
    ) {
      userSearchQuery.value = "";
    }
    if (!isOpen || !canUsePanel) {
      stopInvitesListener();
      stopUsersListener();
      stopAuditListener();
      stopMessagesCountListener();
      return;
    }

    if (tab === "invites") ensureInvitesListener();
    else stopInvitesListener();

    if (tab === "users") loadUsers();
    else stopUsersListener();

    if (tab === "audit") ensureAuditListener();
    else stopAuditListener();

    if (tab === "controls") ensureMessagesCountListener();
    else stopMessagesCountListener();
  },
  { immediate: true },
);

function closeIfClickedOutside(e) {
  if (e.target === e.currentTarget) close();
}

function close() {
  emit("close");
}

function queueAuditEvent(payload) {
  void recordAuditEvent(payload).catch(() => {});
}

function onKeyDown(e) {
  if (e.key !== "Escape") return;
  if (!props.isOpen) return;

  if (purgeDropdownOpen.value) {
    e.preventDefault();
    e.stopPropagation();
    purgeDropdownOpen.value = false;
    return;
  }

  if (confirmAction.value.show) {
    e.preventDefault();
    e.stopPropagation();
    cancelConfirm();
    return;
  }

  if (editingUserId.value !== null) {
    e.preventDefault();
    e.stopPropagation();
    cancelEditUsername();
    return;
  }

  e.preventDefault();
  e.stopPropagation();
  close();
}

function onOutsideClick(e) {
  if (!props.isOpen || !purgeDropdownOpen.value) return;
  if (purgeDropdownRef.value && !purgeDropdownRef.value.contains(e.target)) {
    purgeDropdownOpen.value = false;
  }
}

async function generateInvite() {
  if (!canUseAdminPanel.value) return;
  generatingInvite.value = true;
  errorInvite.value = "";
  try {
    const token = await createInviteToken();
    queueAuditEvent({
      action: "invite_create",
      details: token,
    });
  } catch (e) {
    errorInvite.value =
      e?.code === "PERMISSION_DENIED" ||
      String(e?.message || "")
        .toLowerCase()
        .includes("permission")
        ? "Database rules are blocking invite writes. Make sure your uid is listed under /admins or /owner."
        : `Failed to generate invite${e?.message ? `: ${e.message}` : ""}`;
  } finally {
    generatingInvite.value = false;
  }
}

let copyFeedbackTimer = null;
function copyToClipboard(token) {
  copy(token).then(() => {
    copyFeedback.value = true;
    if (copyFeedbackTimer) clearTimeout(copyFeedbackTimer);
    copyFeedbackTimer = setTimeout(() => {
      copyFeedback.value = false;
      copyFeedbackTimer = null;
    }, 2000);
  });
}

async function deleteInvite(token) {
  try {
    await deleteInviteToken(token);
    invites.value = invites.value.filter((inv) => inv.token !== token);
    queueAuditEvent({
      action: "invite_delete",
      details: token,
    });
  } catch (e) {
    adminActionError.value = "Failed to delete invite.";
  }
}

async function loadUsers() {
  if (!canUseAdminPanel.value || usersListener) return;
  loadingUsers.value = true;
  usersError.value = "";
  try {
    usersListener = onValue(
      dbRef(db, "users"),
      (snap) => {
        const all = snap.exists() ? snap.val() : {};
        users.value = Object.entries(all)
          .map(([uid, data]) => ({ uid, ...data }))
          .filter((u) => u.displayName && u.displayName.trim());
        totalUsersCount.value = users.value.length;
        adminCount.value = adminUsers.value.size;
        sortUsers();
        loadingUsers.value = false;
      },
      (error) => {
        usersError.value =
          error?.code === "PERMISSION_DENIED" ||
          String(error?.message || "").includes("Permission denied")
            ? "Database rules are blocking the users list. Add your admin uid under /admins or /owner and publish the rules."
            : "Failed to load users.";

        if (auth.currentUser) {
          users.value = [
            {
              uid: auth.currentUser.uid,
              displayName: auth.currentUser.displayName || "You",
              email: auth.currentUser.email || "",
              createdAt: auth.currentUser.metadata?.creationTime
                ? new Date(auth.currentUser.metadata.creationTime).getTime()
                : null,
            },
          ];
          totalUsersCount.value = 1;
        }
        loadingUsers.value = false;
      },
    );
  } catch (e) {
    usersError.value =
      e?.code === "PERMISSION_DENIED" ||
      String(e?.message || "").includes("Permission denied")
        ? "Database rules are blocking the users list. Add your admin uid under /admins or /owner and publish the rules."
        : "Failed to load users.";

    if (auth.currentUser) {
      users.value = [
        {
          uid: auth.currentUser.uid,
          displayName: auth.currentUser.displayName || "You",
          email: auth.currentUser.email || "",
          createdAt: auth.currentUser.metadata?.creationTime
            ? new Date(auth.currentUser.metadata.creationTime).getTime()
            : null,
        },
      ];
      totalUsersCount.value = 1;
    }
    loadingUsers.value = false;
  }
}

function isUserAdminStatus(uid) {
  return adminUsers.value.has(uid);
}

function isUserOwnerStatus(uid) {
  return ownerUsers.value.has(uid);
}

function sortUsers() {
  users.value.sort((a, b) => {
    if (ownerUsers.value.has(a.uid)) return -1;
    if (ownerUsers.value.has(b.uid)) return 1;
    const aAdmin = adminUsers.value.has(a.uid);
    const bAdmin = adminUsers.value.has(b.uid);
    if (aAdmin !== bAdmin) return aAdmin ? -1 : 1;
    return (a.displayName || "").localeCompare(b.displayName || "");
  });
}

function formatDate(timestamp) {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRemaining(timestamp) {
  if (!timestamp) return "";
  try {
    const diff = timestamp - (now.value || Date.now());
    if (diff <= 0) return "Expired";
    const sec = Math.floor(diff / 1000);
    const days = Math.floor(sec / 86400);
    const hours = Math.floor((sec % 86400) / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    const seconds = sec % 60;

    function pad(n) {
      return String(n).padStart(2, "0");
    }

    if (days > 0) {
      const totalHours = days * 24 + hours;
      return `${totalHours}:${pad(minutes)}:${pad(seconds)}`;
    }
    if (hours > 0) {
      return `${hours}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${minutes}:${pad(seconds)}`;
  } catch (e) {
    return formatDate(timestamp);
  }
}

function getAvatarInitial(name) {
  return (name && name[0]?.toUpperCase()) || "?";
}

function resolveLiveActorName(ev) {
  if (!ev?.actorUid) return ev?.actorName || "Unknown";
  const user = users.value.find((entry) => entry.uid === ev.actorUid);
  if (user?.displayName) return user.displayName;
  return ev.actorName || ev.actorUid;
}

function resolveLiveTargetName(ev) {
  if (!ev?.targetUid) return ev?.targetName || "";
  const user = users.value.find((entry) => entry.uid === ev.targetUid);
  if (user?.displayName) return user.displayName;
  return ev.targetName || ev.targetUid;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatAuditAction(action) {
  const map = {
    mute: "User muted",
    unmute: "User unmuted",
    promote: "User promoted",
    demote: "User demoted",
    lock_chat: "Chat locked",
    unlock_chat: "Chat unlocked",
    purge_messages: "Messages purged",
    invite_create: "Invite created",
    invite_delete: "Invite deleted",
    name_renamed: "User renamed",
    display_name_changed: "Name changed",
    signup: "User signed up",
  };
  if (map[action]) return map[action];
  if (!action) return "Action";
  return action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatAuditText(ev) {
  const actorRaw = resolveLiveActorName(ev);
  const actor = `<strong>${escapeHtml(actorRaw)}</strong>`;
  const targetNameRaw = resolveLiveTargetName(ev);
  const target =
    ev.targetUid || ev.targetName ? ` ${escapeHtml(targetNameRaw)}` : "";
  const details = ev.details ? ` - ${escapeHtml(ev.details)}` : "";

  switch (ev.action) {
    case "mute":
      return `${actor} muted${target}${details}`;
    case "unmute":
      return `${actor} unmuted${target}${details}`;
    case "promote":
      return `${actor} promoted${target} to admin${details}`;
    case "demote":
      return `${actor} demoted${target} from admin${details}`;
    case "lock_chat":
      return `${actor} locked the chat${details}`;
    case "unlock_chat":
      return `${actor} unlocked the chat${details}`;
    case "purge_messages":
      return `${actor} purged messages${details}`;
    case "invite_create":
      return ev.details
        ? `${actor} created invite code ${escapeHtml(ev.details)}`
        : `${actor} created an invite code`;
    case "invite_delete":
      return ev.details
        ? `${actor} deleted invite code ${escapeHtml(ev.details)}`
        : `${actor} deleted an invite code`;
    case "name_renamed": {
      const oldName = ev.details;
      const newName = ev.targetName || targetNameRaw;
      const isSelf = ev.actorUid && ev.actorUid === ev.targetUid;
      if (isSelf) {
        return oldName && newName
          ? `${actor} changed their display name from ${escapeHtml(oldName)} to ${escapeHtml(newName)}`
          : `${actor} changed their display name`;
      }
      const targetLabel = escapeHtml(newName || ev.targetUid || "a user");
      return oldName
        ? `${actor} renamed ${escapeHtml(oldName)} to ${targetLabel}`
        : `${actor} renamed ${targetLabel}`;
    }
    case "display_name_changed": {
      const oldName = ev.details;
      const newName = ev.actorName;
      return oldName && newName
        ? `${actor} changed their display name from ${escapeHtml(oldName)} to ${escapeHtml(newName)}`
        : `${actor} changed their display name`;
    }
    case "signup":
      return ev.details
        ? `${actor} signed up with invite code ${escapeHtml(ev.details)}`
        : `${actor} signed up`;
    default:
      return `${actor} performed ${escapeHtml(ev.action || "an action")}${target}${details}`;
  }
}

function formatDateTime(ts) {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch (e) {
    return formatDate(ts);
  }
}

function showOwnerBlock(displayName, action) {
  const titles = {
    demoted: "Cannot Demote Owner",
    renamed: "Cannot Rename Owner",
    modified: "Cannot Modify Owner",
  };
  confirmAction.value = {
    show: true,
    title: titles[action] || "Cannot Edit Owner",
    message: `${displayName} is the owner and cannot be ${action}.`,
    action: "",
    confirm: null,
    loading: false,
    infoOnly: true,
  };
}

function promptPromoteUser(uid, displayName) {
  if (isUserOwnerStatus(uid)) {
    showOwnerBlock(displayName, "modified");
    return;
  }
  confirmAction.value = {
    show: true,
    title: "Promote to Admin?",
    message: `Promote ${displayName} to admin?`,
    action: "Promote",
    confirm: () => promoteUserConfirmed(uid),
    loading: false,
    infoOnly: false,
  };
}

async function promoteUserConfirmed(uid) {
  confirmAction.value.loading = true;
  try {
    const prevSnap = await get(dbRef(db, `admins/${uid}`));
    const wasAdmin = prevSnap.exists() && prevSnap.val() === true;

    await promoteToAdmin(uid);

    const newSnap = await get(dbRef(db, `admins/${uid}`));
    const isNowAdmin = newSnap.exists() && newSnap.val() === true;

    if (isNowAdmin)
      adminUsers.value = new Set([...(adminUsers.value || []), uid]);
    sortUsers();

    if (!wasAdmin && isNowAdmin) {
      try {
        const u = users.value.find((x) => x.uid === uid);
        await recordAuditEvent({
          action: "promote",
          targetUid: uid,
          targetName: u?.displayName || null,
        });
      } catch (e) {}
    }

    confirmAction.value.show = false;
  } catch (e) {
    adminActionError.value =
      "Failed to promote user: " + (e.message || "Unknown error");
    confirmAction.value.show = false;
  } finally {
    confirmAction.value.loading = false;
  }
}

function promptDemoteUser(uid, displayName) {
  if (isUserOwnerStatus(uid) && uid !== props.currentUserUid) {
    showOwnerBlock(displayName, "demoted");
    return;
  }
  if (uid === props.currentUserUid) {
    confirmAction.value = {
      show: true,
      title: "Cannot Demote Yourself",
      message: "You cannot remove your own admin privileges.",
      action: "",
      confirm: null,
      loading: false,
      infoOnly: true,
    };
    return;
  }
  confirmAction.value = {
    show: true,
    title: "Demote from Admin?",
    message: `Remove admin privileges from ${displayName}?`,
    action: "Demote",
    confirm: () => demoteUserConfirmed(uid),
    loading: false,
    infoOnly: false,
  };
}

async function demoteUserConfirmed(uid) {
  confirmAction.value.loading = true;
  try {
    const prevSnap = await get(dbRef(db, `admins/${uid}`));
    const wasAdmin = prevSnap.exists() && prevSnap.val() === true;

    await demoteFromAdmin(uid);

    const newSnap = await get(dbRef(db, `admins/${uid}`));
    const isNowAdmin = newSnap.exists() && newSnap.val() === true;

    if (!isNowAdmin)
      adminUsers.value = new Set(
        [...(adminUsers.value || [])].filter((x) => x !== uid),
      );
    sortUsers();

    if (wasAdmin && !isNowAdmin) {
      try {
        const u = users.value.find((x) => x.uid === uid);
        await recordAuditEvent({
          action: "demote",
          targetUid: uid,
          targetName: u?.displayName || null,
        });
      } catch (e) {}
    }

    confirmAction.value.show = false;
  } catch (e) {
    adminActionError.value =
      "Failed to demote user: " + (e.message || "Unknown error");
    confirmAction.value.show = false;
  } finally {
    confirmAction.value.loading = false;
  }
}

function cancelConfirm() {
  confirmAction.value.show = false;
}

function isUserMuted(uid) {
  return mutedUsers.value.has(uid);
}

function canShowMuteButton(uid) {
  if (uid === props.currentUserUid) return false;
  const currentIsOwner = isUserOwnerStatus(props.currentUserUid);
  const targetIsOwner = isUserOwnerStatus(uid);
  const targetIsAdmin = isUserAdminStatus(uid);
  if (targetIsOwner || targetIsAdmin) return currentIsOwner;
  return isUserAdminStatus(props.currentUserUid) || currentIsOwner;
}

async function toggleMute(uid) {
  mutingUid.value = uid;
  adminActionError.value = "";
  const previousMutedUsers = new Set(mutedUsers.value);
  const wasMuted = previousMutedUsers.has(uid);
  const nextMutedUsers = new Set(previousMutedUsers);
  if (wasMuted) {
    nextMutedUsers.delete(uid);
  } else {
    nextMutedUsers.add(uid);
  }
  mutedUsers.value = nextMutedUsers;
  try {
    if (wasMuted) {
      await remove(dbRef(db, `muted/${uid}`));
      const u = users.value.find((x) => x.uid === uid);
      queueAuditEvent({
        action: "unmute",
        targetUid: uid,
        targetName: u?.displayName || null,
      });
    } else {
      await set(dbRef(db, `muted/${uid}`), true);
      const u = users.value.find((x) => x.uid === uid);
      queueAuditEvent({
        action: "mute",
        targetUid: uid,
        targetName: u?.displayName || null,
      });
    }
  } catch (e) {
    mutedUsers.value = previousMutedUsers;
    adminActionError.value = wasMuted
      ? "Failed to unmute this user."
      : "Failed to mute this user.";
  } finally {
    mutingUid.value = null;
  }
}

async function toggleChatLock() {
  if (!canUseAdminPanel.value) return;
  lockLoading.value = true;
  adminActionError.value = "";
  const previousState = chatLocked.value;
  const next = !previousState;
  chatLocked.value = next;
  try {
    await set(dbRef(db, "settings/chatLocked"), next);
    queueAuditEvent({ action: next ? "lock_chat" : "unlock_chat" });
  } catch (e) {
    chatLocked.value = previousState;
    adminActionError.value = next
      ? "Failed to lock the chat."
      : "Failed to unlock the chat.";
  } finally {
    lockLoading.value = false;
  }
}

async function promptPurge() {
  purgeError.value = "";

  if (totalMessagesCount.value === null) {
    purgeError.value =
      "Could not read the current message count. Close and reopen Admin, then try again.";
    return;
  }

  const total = totalMessagesCount.value;
  const requested =
    purgeAmount.value === "all"
      ? total
      : Math.min(total, parseInt(purgeAmount.value, 10) || 0);

  if (requested <= 0) {
    purgeError.value = "There are no messages to purge.";
    return;
  }

  confirmAction.value = {
    show: true,
    title: "Purge Messages?",
    message: `This will permanently delete ${requested} messages from the database. This action cannot be undone.`,
    action: "Purge",
    confirm: executePurge,
    loading: false,
    infoOnly: false,
  };
}

async function executePurge() {
  confirmAction.value.loading = true;
  purging.value = true;
  purgeError.value = "";
  try {
    const messagesNode = dbRef(db, "messages");
    const purgeQuery =
      purgeAmount.value === "all"
        ? query(messagesNode, orderByKey())
        : query(
            messagesNode,
            orderByKey(),
            purgeOrder.value === "newest"
              ? limitToLast(parseInt(purgeAmount.value, 10))
              : limitToFirst(parseInt(purgeAmount.value, 10)),
          );
    const snap = await get(purgeQuery);
    if (snap.exists()) {
      const keys = [];
      snap.forEach((child) => {
        if (child.key) keys.push(child.key);
      });
      for (let i = 0; i < keys.length; i += 500) {
        const chunk = keys.slice(i, i + 500);
        await Promise.all(
          chunk.map((key) => remove(dbRef(db, `messages/${key}`))),
        );
      }
    }
    const purgedLabel =
      purgeAmount.value === "all"
        ? "all messages"
        : `the ${purgeOrder.value} ${purgeAmount.value} messages`;
    queueAuditEvent({
      action: "purge_messages",
      details: purgedLabel,
    });
    confirmAction.value.show = false;
  } catch (e) {
    const msg = String(e?.message || "");
    if (msg.toLowerCase().includes("permission")) {
      purgeError.value =
        "Permission denied — your Firebase rules need to allow admins to delete messages. Add a .write rule on /messages that checks root.child('admins').child(auth.uid).val() === true.";
    } else {
      purgeError.value = "Purge failed: " + (msg || "Unknown error");
    }
    confirmAction.value.show = false;
  } finally {
    purging.value = false;
    confirmAction.value.loading = false;
  }
}

function startEditUsername(u) {
  if (isUserOwnerStatus(u.uid) && u.uid !== props.currentUserUid) {
    showOwnerBlock(u.displayName || "This user", "renamed");
    return;
  }
  editingUserId.value = u.uid;
  editingUserName.value = u.displayName || "";
}

function cancelEditUsername() {
  editingUserId.value = null;
  editingUserName.value = "";
}

async function saveUsername(uid) {
  const newName = editingUserName.value.trim();
  if (!newName) return;
  const u = users.value.find((x) => x.uid === uid);
  const oldName = u?.displayName || null;

  if (newName === oldName) {
    cancelEditUsername();
    return;
  }

  try {
    await adminRenameUser(uid, newName);
    if (u) u.displayName = newName;
    cancelEditUsername();
  } catch (e) {
    adminActionError.value =
      "Failed to update username: " + (e.message || "Unknown error");
    cancelEditUsername();
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
  -webkit-backdrop-filter: blur(4px);
  backdrop-filter: blur(4px);
  -webkit-app-region: no-drag;
}

.modal-container {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  width: 100%;
  max-width: 800px;
  height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  position: relative;
  -webkit-app-region: no-drag;
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
  transform: translateY(-6px) scale(0.998);
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
  padding: 20px 24px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.modal-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
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

.modal-tabs {
  display: flex;
  gap: 8px;
  padding: 14px 14px 2px 14px;
  flex-shrink: 0;
}

.tab-btn {
  flex: 1;
  background: rgba(44, 42, 39, 0.03);
  border: 1px solid rgba(44, 42, 39, 0.08);
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

.tab-btn.active {
  color: var(--text);
  border-color: rgba(90, 90, 240, 0.22);
  background: rgba(90, 90, 240, 0.08);
}

.tab-btn:active {
  transform: translateY(1px);
}

.modal-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  overscroll-behavior-y: contain;
  scrollbar-width: thin;
  scrollbar-color: rgba(44, 42, 39, 0.28) transparent;
  scrollbar-gutter: stable;
}

.modal-content::-webkit-scrollbar {
  width: 8px;
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
  margin-bottom: 28px;
}
.section:last-child {
  margin-bottom: 0;
}

.section-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin: 0 0 14px 0;
}

.action-btn {
  width: 100%;
  background: var(--text);
  color: var(--bg);
  border: none;
  border-radius: var(--radius);
  padding: 12px;
  font-size: 14px;
  font-weight: 600;
  font-family: "Satoshi", sans-serif;
  cursor: pointer;
  transition:
    opacity 0.2s,
    transform 180ms ease;
  margin-bottom: 12px;
}

.action-btn:hover:not(:disabled) {
  opacity: 0.92;
  transform: translateY(-1px);
}
.action-btn:active:not(:disabled) {
  transform: translateY(0) scale(0.98);
  transition-duration: 80ms;
}
.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error {
  color: var(--danger);
  font-size: 13px;
  margin-top: 10px;
}

.users-error {
  margin: 0 0 16px 0;
}

.loading,
.empty-state {
  text-align: center;
  color: var(--text-muted);
  padding: 40px 20px;
  font-size: 14px;
}

.invites-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.invite-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(44, 42, 39, 0.08);
  border-radius: 12px;
  padding: 12px 14px;
  gap: 14px;
  transition:
    transform 180ms ease,
    border-color 180ms ease;
}

.invite-item:hover {
  transform: translateY(-1px);
  border-color: rgba(44, 42, 39, 0.16);
}

.invite-info {
  flex: 1;
  min-width: 0;
}

.invite-token-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.invite-token {
  font-size: 13px;
  font-family: monospace;
  font-weight: 700;
  color: var(--text);
  background: rgba(44, 42, 39, 0.04);
  border: 1px solid rgba(44, 42, 39, 0.06);
  border-radius: 999px;
  padding: 7px 12px;
}

.invite-state {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  color: var(--accent);
  background: rgba(90, 90, 240, 0.09);
  border: 1px solid rgba(90, 90, 240, 0.14);
  border-radius: 999px;
  padding: 5px 9px;
}

.invite-expires {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 8px;
}

.invite-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.copy-btn {
  background: var(--text);
  border: none;
  color: var(--bg);
  border-radius: 999px;
  padding: 9px 14px;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  font-family: "Satoshi", sans-serif;
  transition:
    opacity 0.2s,
    transform 180ms ease;
  white-space: nowrap;
}

.copy-btn:hover {
  opacity: 0.85;
  transform: translateY(-1px);
}

.delete-btn-invite {
  background: none;
  border: 1px solid rgba(44, 42, 39, 0.1);
  color: var(--text-muted);
  border-radius: 999px;
  padding: 8px;
  display: flex;
  align-items: center;
  cursor: pointer;
  transition: all 180ms ease;
}

.delete-btn-invite:hover {
  background: rgba(192, 57, 43, 0.06);
  border-color: rgba(192, 57, 43, 0.24);
  color: var(--danger);
  transform: translateY(-1px);
}

.stats-section {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.stat-item {
  flex: 1;
  background: rgba(90, 90, 240, 0.06);
  border: 1px solid rgba(90, 90, 240, 0.16);
  border-radius: 12px;
  padding: 14px 16px;
  text-align: center;
}

.stat-value {
  font-size: 26px;
  font-weight: 700;
  color: var(--accent);
  margin-bottom: 4px;
  line-height: 1;
}

.stat-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.user-search {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(44, 42, 39, 0.1);
  border-radius: 999px;
  padding: 8px 12px 8px 14px;
  margin: 0 0 14px 0;
}

.user-search-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.user-search-input {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text);
  font-size: 13.5px;
  font-weight: 500;
  font-family: "Satoshi", sans-serif;
  padding: 4px 0;
}

.user-search-input::placeholder {
  color: var(--text-muted);
  font-weight: 500;
}

.user-search-clear {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: none;
  background: rgba(44, 42, 39, 0.1);
  color: var(--text-muted);
  cursor: pointer;
  transition:
    background 160ms ease,
    color 160ms ease,
    transform 160ms ease;
}

.user-search-clear:hover {
  background: rgba(44, 42, 39, 0.18);
  color: var(--text);
}

.user-search-clear:active {
  transform: scale(0.88);
}

.user-search-empty {
  padding: 28px 20px;
  font-style: italic;
}

.users-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.user-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(44, 42, 39, 0.07);
  border-radius: 12px;
  padding: 12px 14px;
  gap: 12px;
  transition:
    transform 180ms ease,
    border-color 180ms ease,
    background 180ms ease;
}

.user-item:hover {
  transform: translateY(-1px);
  border-color: rgba(44, 42, 39, 0.13);
  background: rgba(255, 255, 255, 0.96);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.user-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--accent);
  color: var(--bg);
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.user-details {
  flex: 1;
  min-width: 0;
}

.user-name-slot {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 3px;
}

.crown-icon {
  color: #c9a84c;
  flex-shrink: 0;
}

.user-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-meta {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
}

.user-email {
  font-size: 12px;
  color: var(--text-muted);
  word-break: break-all;
  overflow-wrap: anywhere;
}

.user-meta-sep {
  font-size: 12px;
  color: var(--text-muted);
  opacity: 0.5;
}

.user-created {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
}

.user-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
  align-items: center;
}

.edit-name-btn {
  background: rgba(44, 42, 39, 0.03);
  border: 1px solid rgba(44, 42, 39, 0.1);
  color: var(--text-muted);
  border-radius: 999px;
  padding: 7px 9px;
  display: flex;
  align-items: center;
  cursor: pointer;
  transition: all 180ms ease;
}

.edit-name-btn:hover {
  background: rgba(44, 42, 39, 0.08);
  color: var(--text);
  border-color: rgba(44, 42, 39, 0.16);
  transform: translateY(-1px);
}

.role-btn {
  background: rgba(44, 42, 39, 0.03);
  border: 1px solid rgba(44, 42, 39, 0.1);
  color: var(--text);
  border-radius: 999px;
  padding: 7px 12px;
  font-size: 12px;
  font-weight: 600;
  font-family: "Satoshi", sans-serif;
  cursor: pointer;
  transition: all 180ms ease;
  white-space: nowrap;
}

.role-btn:hover {
  background: rgba(44, 42, 39, 0.08);
  border-color: rgba(44, 42, 39, 0.16);
  transform: translateY(-1px);
}

.demote-btn {
  border-color: rgba(192, 57, 43, 0.2);
  color: var(--danger);
}

.demote-btn:hover {
  background: rgba(192, 57, 43, 0.06);
  border-color: var(--danger);
}

.username-edit-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.username-edit-input {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 13px;
  font-weight: 600;
  font-family: "Satoshi", sans-serif;
  color: var(--text);
  outline: none;
  width: 130px;
  transition: border-color 0.15s;
}

.username-edit-input:focus {
  border-color: var(--accent);
}

.username-save-btn {
  background: var(--text);
  border: none;
  color: var(--bg);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  font-family: "Satoshi", sans-serif;
  cursor: pointer;
  transition: opacity 0.15s;
  white-space: nowrap;
}

.username-save-btn:hover {
  opacity: 0.82;
}

.username-cancel-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
  font-family: "Satoshi", sans-serif;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 6px;
  transition: color 0.15s;
  white-space: nowrap;
}

.username-cancel-btn:hover {
  color: var(--text);
}

.confirmation-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 500;
  -webkit-backdrop-filter: blur(3px);
  backdrop-filter: blur(3px);
}

.confirmation-box {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
  width: 100%;
  max-width: 360px;
  margin: 0 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}

.confirmation-box h3 {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
  margin: 0 0 8px 0;
}

.confirmation-box p {
  font-size: 14px;
  color: var(--text-muted);
  margin: 0 0 20px 0;
  line-height: 1.5;
}

.confirmation-actions {
  display: flex;
  gap: 10px;
}

.confirmation-actions--single {
  justify-content: center;
}

.cancel-btn,
.danger-btn,
.ok-btn {
  flex: 1;
  border: none;
  border-radius: var(--radius);
  padding: 10px;
  font-size: 14px;
  font-weight: 600;
  font-family: "Satoshi", sans-serif;
  cursor: pointer;
  transition:
    background 160ms ease,
    opacity 160ms ease,
    transform 160ms var(--ease-out-quint);
}

.cancel-btn {
  background: var(--surface-2);
  color: var(--text);
}

.cancel-btn:hover {
  background: var(--border);
}

.cancel-btn:active {
  transform: scale(0.98);
  transition-duration: 80ms;
}

.danger-btn {
  background: var(--danger);
  color: #fff;
}

.danger-btn:hover:not(:disabled) {
  opacity: 0.92;
}

.danger-btn:active:not(:disabled) {
  opacity: 0.85;
  transform: scale(0.98);
  transition-duration: 80ms;
}

.danger-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ok-btn {
  flex: 1 1 100%;
  width: 100%;
  background: var(--text);
  color: var(--bg);
}

.ok-btn:hover {
  opacity: 0.92;
}

.ok-btn:active {
  opacity: 0.85;
  transform: scale(0.98);
  transition-duration: 80ms;
}

.confirm-pop-enter-active {
  transition:
    opacity 180ms ease,
    transform 220ms var(--ease-out-quint);
}
.confirm-pop-leave-active {
  transition:
    opacity 140ms ease,
    transform 140ms ease;
}
.confirm-pop-enter-from {
  opacity: 0;
}
.confirm-pop-leave-to {
  opacity: 0;
}
.confirm-pop-enter-active .confirmation-box {
  animation: confirmBoxIn 240ms var(--ease-out-quint) both;
}
.confirm-pop-leave-active .confirmation-box {
  animation: confirmBoxOut 140ms ease both;
}

@keyframes confirmBoxIn {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes confirmBoxOut {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(0.98);
  }
}

.copy-feedback {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--text);
  color: var(--bg);
  padding: 10px 20px;
  border-radius: var(--radius);
  font-size: 13px;
  font-weight: 600;
  z-index: 400;
  pointer-events: none;
}

.audit-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.audit-row {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(44, 42, 39, 0.06);
}
.audit-action-pill {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: var(--accent);
  background: rgba(90, 90, 240, 0.09);
  border: 1px solid rgba(90, 90, 240, 0.18);
  border-radius: 999px;
  padding: 4px 9px;
  white-space: nowrap;
}
.audit-main {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--text);
  line-height: 1.45;
}
.audit-ts {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
  flex-shrink: 0;
}

.control-card-flat {
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
}

.control-card-flat + .control-card-flat {
  margin-top: 14px;
}

.purge-card {
  border-color: rgba(192, 57, 43, 0.18);
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow: visible;
}

.lock-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 18px;
}

.lock-toggle-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--bg);
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 700;
  font-family: "Satoshi", sans-serif;
  padding: 7px 14px;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all 0.2s;
}

.lock-toggle-btn:hover:not(:disabled) {
  border-color: rgba(44, 42, 39, 0.22);
  color: var(--text);
}

.lock-toggle-btn--locked {
  background: rgba(192, 57, 43, 0.08);
  border-color: rgba(192, 57, 43, 0.3);
  color: var(--danger);
}

.lock-toggle-btn--locked:hover:not(:disabled) {
  background: rgba(192, 57, 43, 0.13);
  border-color: var(--danger);
  color: var(--danger);
}

.lock-toggle-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.lock-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-top: 1px solid var(--border);
  background: var(--surface-2);
  font-size: 12px;
  color: var(--text-muted);
}

.lock-status--locked {
  background: rgba(192, 57, 43, 0.04);
  color: var(--danger);
  border-top-color: rgba(192, 57, 43, 0.12);
}

.lock-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #22c55e;
  flex-shrink: 0;
}

.lock-status--locked .lock-status-dot {
  background: var(--danger);
}

.muted-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(192, 57, 43, 0.1);
  border: 1px solid rgba(192, 57, 43, 0.22);
  color: var(--danger);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.3px;
  text-transform: uppercase;
}

.mute-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.mute-btn--muted {
  border-color: rgba(192, 57, 43, 0.2);
  color: var(--danger);
}

.mute-btn--muted:hover {
  background: rgba(192, 57, 43, 0.06);
  border-color: var(--danger);
}

.mute-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.control-card-top {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.control-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
}

.control-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.control-desc {
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.5;
}

.purge-count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid rgba(44, 42, 39, 0.12);
  border-radius: 999px;
  background: rgba(44, 42, 39, 0.04);
  min-height: 28px;
  padding: 0 10px;
  flex-shrink: 0;
}

.purge-count-label {
  display: inline-flex;
  align-items: center;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: var(--text-muted);
  line-height: 1;
}

.purge-count-value {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  font-weight: 700;
  color: var(--text);
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 640px) {
  .control-title-row {
    align-items: flex-start;
    flex-direction: column;
  }
}

.purge-row {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.order-toggle {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  width: fit-content;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 3px;
  flex-shrink: 0;
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

.order-pill.right {
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
  padding: 5px 12px;
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

.order-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.custom-select {
  position: relative;
}

.custom-select-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
  font-family: "Satoshi", sans-serif;
  padding: 8px 12px 8px 14px;
  cursor: pointer;
  outline: none;
  white-space: nowrap;
  transition:
    border-color 0.15s,
    box-shadow 0.15s,
    background 0.15s;
  min-width: 148px;
  justify-content: space-between;
}

.custom-select-btn:hover:not(:disabled) {
  background: var(--surface-2);
  border-color: rgba(44, 42, 39, 0.18);
}

.custom-select.open .custom-select-btn {
  border-color: rgba(44, 42, 39, 0.28);
}

.custom-select-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.custom-select-chevron {
  color: var(--text-muted);
  transition: transform 0.18s ease;
  flex-shrink: 0;
}

.custom-select.open .custom-select-chevron {
  transform: rotate(180deg);
}

.custom-select-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  min-width: 100%;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 4px;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.12),
    0 2px 8px rgba(0, 0, 0, 0.06);
  z-index: 100;
  overflow: hidden;
}

.custom-select-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  background: none;
  border: none;
  border-radius: 8px;
  color: var(--text);
  font-size: 13px;
  font-weight: 500;
  font-family: "Satoshi", sans-serif;
  padding: 8px 10px;
  cursor: pointer;
  text-align: left;
  transition: background 0.1s;
  gap: 12px;
}

.custom-select-option:hover {
  background: var(--surface-2);
}

.custom-select-option.selected {
  font-weight: 700;
  color: var(--text);
}

.option-check {
  color: var(--accent);
  flex-shrink: 0;
}

.dropdown-pop-enter-active {
  transition:
    opacity 0.12s ease,
    transform 0.12s cubic-bezier(0.16, 1, 0.3, 1);
}
.dropdown-pop-leave-active {
  transition:
    opacity 0.08s ease,
    transform 0.08s ease;
}
.dropdown-pop-enter-from {
  opacity: 0;
  transform: translateY(-4px) scale(0.97);
}
.dropdown-pop-leave-to {
  opacity: 0;
  transform: translateY(-3px) scale(0.98);
}

.purge-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--danger);
  border: none;
  border-radius: var(--radius);
  color: white;
  font-size: 13px;
  font-weight: 700;
  font-family: "Satoshi", sans-serif;
  padding: 9px 16px;
  cursor: pointer;
  white-space: nowrap;
  transition:
    opacity 0.2s,
    transform 180ms ease;
}

.purge-btn:hover:not(:disabled) {
  opacity: 0.88;
}

.purge-btn:active:not(:disabled) {
  opacity: 0.78;
}

.purge-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.purge-error-msg {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  background: rgba(192, 57, 43, 0.06);
  border: 1px solid rgba(192, 57, 43, 0.15);
  border-radius: var(--radius);
  padding: 10px 12px;
  color: var(--danger);
  font-size: 12.5px;
  line-height: 1.5;
}

.purge-error-msg svg {
  flex-shrink: 0;
  margin-top: 1px;
}

@media (prefers-reduced-motion: reduce) {
  .modal-overlay,
  .modal-container,
  .modal-fade-enter-active,
  .modal-fade-leave-active,
  .tab-btn,
  .action-btn,
  .copy-btn,
  .delete-btn-invite,
  .role-btn,
  .edit-name-btn,
  .cancel-btn,
  .danger-btn,
  .invite-item,
  .user-item {
    transition: none !important;
  }
}
</style>
