<template>
  <transition name="modal-fade" appear>
    <div
      v-if="isOpen"
      class="modal-overlay"
      @click="closeIfClickedOutside"
      @keydown.esc="close"
    >
      <div class="modal-container" @keydown.esc="close">
        <div class="modal-header">
          <h2 class="modal-title">Admin</h2>
          <button class="modal-close" @click="close">
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
            @click="
              activeTab = 'users';
              loadUsers();
            "
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
        </div>

        <div class="modal-content">
          <div v-if="activeTab === 'invites'">
            <div class="section">
              <h3 class="section-title">Generate New Invite Code</h3>
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
                      Expires: {{ formatDate(invite.expiresAt) }}
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
            <div class="controls-section">
              <div class="controls-section-title">Moderation</div>
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
            </div>

            <div class="controls-section">
              <div class="controls-section-title">Danger Zone</div>
              <div class="danger-zone">
                <div class="control-card">
                  <div class="control-card-top">
                    <div class="control-title">Purge Messages</div>
                    <div class="control-desc">
                      Permanently delete messages from the database. This cannot
                      be undone.
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
                          purgeOptions.find((o) => o.value === purgeAmount)
                            ?.label
                        }}</span>
                        <ChevronDown
                          :size="12"
                          stroke-width="2.5"
                          class="custom-select-chevron"
                        />
                      </button>
                      <transition name="dropdown-pop">
                        <div
                          v-if="purgeDropdownOpen"
                          class="custom-select-menu"
                        >
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
              <div v-if="users.length === 0" class="empty-state">
                No users found
              </div>
              <div v-else class="users-list">
                <div class="user-item" v-for="u in users" :key="u.uid">
                  <div class="user-info">
                    <div class="user-avatar">
                      {{ (u.displayName || "?")[0].toUpperCase() }}
                    </div>
                    <div class="user-details">
                      <div class="user-name-slot">
                        <template v-if="editingUserId === u.uid">
                          <div class="username-edit-row">
                            <input
                              class="username-edit-input"
                              v-model="editingUserName"
                              @keydown.enter="saveUsername(u.uid)"
                              @keydown.esc="cancelEditUsername"
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
                      v-if="
                        (isUserMuted(u.uid) && canUnmute(u.uid)) ||
                        (!isUserMuted(u.uid) && canMute(u.uid))
                      "
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
        </div>

        <div
          v-if="confirmAction.show"
          class="confirmation-overlay"
          @click="cancelConfirm"
        >
          <div class="confirmation-box" @click.stop>
            <h3>{{ confirmAction.title }}</h3>
            <p>{{ confirmAction.message }}</p>
            <div class="confirmation-actions">
              <template v-if="confirmAction.infoOnly">
                <button class="cancel-btn" @click="cancelConfirm">OK</button>
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

        <div v-if="copyFeedback" class="copy-feedback">Copied!</div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";
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
  update,
  onValue,
} from "firebase/database";
import {
  createInviteToken,
  getAllUsers,
  promoteToAdmin,
  demoteFromAdmin,
  deleteInviteToken,
  adminRenameUser,
} from "../authUtils";

const props = defineProps({
  isOpen: Boolean,
  currentUserUid: String,
});

const emit = defineEmits(["close"]);

const activeTab = ref("invites");
const invites = ref([]);
const loadingInvites = ref(false);
const generatingInvite = ref(false);
const errorInvite = ref("");

const users = ref([]);
const loadingUsers = ref(false);
const adminUsers = ref(new Set());
const ownerUsers = ref(new Set());
const usersError = ref("");

const totalUsersCount = ref(0);
const adminCount = ref(0);

const copyFeedback = ref(false);

const editingUserId = ref(null);
const editingUserName = ref("");

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
  { value: "100", label: "100 messages" },
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

onMounted(() => {
  loadingInvites.value = true;
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("pointerdown", onOutsideClick);
  invitesListener = onValue(dbRef(db, "invites"), (snap) => {
    const now = Date.now();
    invites.value = snap.exists()
      ? Object.entries(snap.val())
          .filter(([, data]) => !data.used && data.expiresAt > now)
          .map(([token, data]) => ({ token, ...data }))
      : [];
    loadingInvites.value = false;
    errorInvite.value = "";
  });
  settingsListener = onValue(dbRef(db, "settings/chatLocked"), (snap) => {
    chatLocked.value = snap.val() === true;
  });
  muteListener = onValue(dbRef(db, "muted"), (snap) => {
    mutedUsers.value = new Set(snap.exists() ? Object.keys(snap.val()) : []);
  });

  adminsListener = onValue(dbRef(db, "admins"), (snap) => {
    adminUsers.value = new Set(snap.exists() ? Object.keys(snap.val()) : []);
    adminCount.value = adminUsers.value.size;
    if (users.value.length) sortUsers();
  });

  ownerListener = onValue(dbRef(db, "owner"), (snap) => {
    ownerUsers.value = new Set();
    if (snap.exists()) ownerUsers.value.add(snap.val());
    if (users.value.length) sortUsers();
  });
});

onUnmounted(() => {
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("pointerdown", onOutsideClick);
  if (invitesListener) invitesListener();
  if (settingsListener) settingsListener();
  if (muteListener) muteListener();
  if (adminsListener) adminsListener();
  if (ownerListener) ownerListener();
});

function closeIfClickedOutside(e) {
  if (e.target === e.currentTarget) close();
}

function close() {
  emit("close");
}

function onKeyDown(e) {
  if (e.key === "Escape") {
    if (purgeDropdownOpen.value) {
      purgeDropdownOpen.value = false;
      return;
    }
    close();
  }
}

function onOutsideClick(e) {
  if (purgeDropdownRef.value && !purgeDropdownRef.value.contains(e.target)) {
    purgeDropdownOpen.value = false;
  }
}

async function generateInvite() {
  generatingInvite.value = true;
  errorInvite.value = "";
  try {
    const token = await createInviteToken();
  } catch (e) {
    errorInvite.value = "Failed to generate invite";
  } finally {
    generatingInvite.value = false;
  }
}

function copyToClipboard(token) {
  copy(token).then(() => {
    copyFeedback.value = true;
    setTimeout(() => {
      copyFeedback.value = false;
    }, 2000);
  });
}

async function deleteInvite(token) {
  try {
    await deleteInviteToken(token);
    invites.value = invites.value.filter((inv) => inv.token !== token);
  } catch (e) {
    console.error("Failed to delete invite:", e);
  }
}

async function loadUsers() {
  loadingUsers.value = true;
  usersError.value = "";
  try {
    const allUsers = await getAllUsers();
    users.value = allUsers.filter((u) => u.displayName && u.displayName.trim());
    totalUsersCount.value = users.value.length;
    adminCount.value = adminUsers.value.size;
    sortUsers();
  } catch (e) {
    console.error("Failed to load users:", e);
    usersError.value =
      e?.code === "PERMISSION_DENIED" ||
      String(e?.message || "").includes("Permission denied")
        ? "Database rules are blocking the users list. Add your admin uid under /admins and publish the rules."
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
  } finally {
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

function showOwnerBlock(displayName, action) {
  confirmAction.value = {
    show: true,
    title: "Cannot Edit Owner",
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
    await promoteToAdmin(uid);
    adminUsers.value.add(uid);
    sortUsers();
    confirmAction.value.show = false;
  } catch (e) {
    alert("Failed to promote user: " + (e.message || "Unknown error"));
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
    await demoteFromAdmin(uid);
    adminUsers.value.delete(uid);
    sortUsers();
    confirmAction.value.show = false;
  } catch (e) {
    alert("Failed to demote user: " + (e.message || "Unknown error"));
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

function canMute(uid) {
  if (uid === props.currentUserUid) return false;
  const currentIsOwner = isUserOwnerStatus(props.currentUserUid);
  const targetIsOwner = isUserOwnerStatus(uid);
  const targetIsAdmin = isUserAdminStatus(uid);
  if (targetIsOwner) return currentIsOwner;
  if (targetIsAdmin) return currentIsOwner;
  return isUserAdminStatus(props.currentUserUid) || currentIsOwner;
}

function canUnmute(uid) {
  if (uid === props.currentUserUid) return true;
  const currentIsOwner = isUserOwnerStatus(props.currentUserUid);
  return currentIsOwner || isUserAdminStatus(props.currentUserUid);
}

async function toggleMute(uid) {
  mutingUid.value = uid;
  try {
    if (isUserMuted(uid)) {
      await remove(dbRef(db, `muted/${uid}`));
    } else {
      await set(dbRef(db, `muted/${uid}`), true);
    }
  } catch (e) {
    console.error("Failed to toggle mute:", e);
  } finally {
    mutingUid.value = null;
  }
}

async function toggleChatLock() {
  lockLoading.value = true;
  try {
    await set(dbRef(db, "settings/chatLocked"), !chatLocked.value);
  } catch (e) {
    console.error("Failed to toggle chat lock:", e);
  } finally {
    lockLoading.value = false;
  }
}

function promptPurge() {
  purgeError.value = "";
  const label =
    purgeAmount.value === "all"
      ? "ALL messages"
      : `the ${purgeAmount.value} ${purgeOrder.value} messages`;
  confirmAction.value = {
    show: true,
    title: "Purge Messages?",
    message: `This will permanently delete ${label} from the database. This action cannot be undone.`,
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
    if (purgeAmount.value === "all") {
      await remove(messagesNode);
    } else {
      const n = parseInt(purgeAmount.value, 10);
      const limiter =
        purgeOrder.value === "newest" ? limitToLast(n) : limitToFirst(n);
      const q = query(messagesNode, orderByKey(), limiter);
      const snap = await get(q);
      if (snap.exists()) {
        const removals = [];
        snap.forEach((child) => {
          removals.push(remove(dbRef(db, `messages/${child.key}`)));
        });
        await Promise.all(removals);
      }
    }
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
  const name = editingUserName.value.trim();
  if (!name) return;
  try {
    await adminRenameUser(uid, name);
    const u = users.value.find((x) => x.uid === uid);
    if (u) u.displayName = name;
    cancelEditUsername();
  } catch (e) {
    alert("Failed to update username: " + (e.message || "Unknown error"));
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
  transition: color 0.2s;
}

.modal-close:hover {
  color: var(--text);
}

.modal-tabs {
  display: flex;
  gap: 8px;
  padding: 14px 14px 0 14px;
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
  opacity: 0.85;
  transform: translateY(-1px);
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
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.92) 0%,
    rgba(248, 247, 245, 0.96) 100%
  );
  border: 1px solid rgba(44, 42, 39, 0.08);
  border-radius: 12px;
  padding: 12px 14px;
  gap: 14px;
  box-shadow: 0 4px 12px rgba(20, 20, 20, 0.03);
  transition:
    transform 180ms ease,
    box-shadow 180ms ease;
}

.invite-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(20, 20, 20, 0.05);
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
    box-shadow 180ms ease;
}

.user-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 20px rgba(20, 20, 20, 0.06);
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
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
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
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 300;
}

.confirmation-box {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
  max-width: 360px;
  width: calc(100% - 40px);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
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

.cancel-btn,
.danger-btn {
  flex: 1;
  border: none;
  border-radius: var(--radius);
  padding: 10px;
  font-size: 14px;
  font-weight: 600;
  font-family: "Satoshi", sans-serif;
  cursor: pointer;
  transition:
    opacity 0.2s,
    transform 180ms ease;
}

.cancel-btn {
  background: var(--surface-2);
  color: var(--text);
}

.cancel-btn:hover {
  opacity: 0.8;
  transform: translateY(-1px);
}

.danger-btn {
  background: var(--danger);
  color: white;
}

.danger-btn:hover:not(:disabled) {
  opacity: 0.85;
  transform: translateY(-1px);
}
.danger-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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

.controls-section {
  margin-bottom: 20px;
}

.controls-section-title {
  font-size: 10px;
  font-weight: 800;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 1.1px;
  margin-bottom: 10px;
}

.control-card-flat {
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
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

.danger-zone {
  border: 1px solid rgba(192, 57, 43, 0.18);
  border-radius: 12px;
}

.danger-zone-header {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 10px 16px;
  background: rgba(192, 57, 43, 0.06);
  border-bottom: 1px solid rgba(192, 57, 43, 0.12);
  border-radius: 11px 11px 0 0;
}

.danger-zone-icon {
  color: var(--danger);
  flex-shrink: 0;
}

.danger-zone-label {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 1.2px;
  color: var(--danger);
}

.control-card {
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
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

.control-desc {
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.5;
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
  background: linear-gradient(180deg, #fffdf8 0%, #f8f5ed 100%);
  box-shadow:
    0 1px 4px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.78);
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
  box-shadow: 0 0 0 3px rgba(44, 42, 39, 0.06);
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
  opacity: 0.85;
  transform: translateY(-1px);
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
