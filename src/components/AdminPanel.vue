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
                          <Crown
                            v-if="isUserAdminStatus(u.uid)"
                            :size="12"
                            stroke-width="2.5"
                            class="crown-icon"
                          />
                          <span class="user-name">{{
                            u.displayName || "(no name)"
                          }}</span>
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
import { auth } from "../firebase";
import { X, Copy, Trash2, Pencil, Crown } from "lucide-vue-next";
import {
  createInviteToken,
  getValidInvites,
  getAllUsers,
  promoteToAdmin,
  demoteFromAdmin,
  isUserAdmin,
  getOwnerUid,
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

const confirmAction = ref({
  show: false,
  title: "",
  message: "",
  action: "",
  confirm: null,
  loading: false,
  infoOnly: false,
});

onMounted(() => {
  loadInvites();
  window.addEventListener("keydown", onKeyDown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", onKeyDown);
});

function closeIfClickedOutside(e) {
  if (e.target === e.currentTarget) close();
}

function close() {
  emit("close");
}

function onKeyDown(e) {
  if (e.key === "Escape") close();
}

async function loadInvites() {
  loadingInvites.value = true;
  errorInvite.value = "";
  try {
    invites.value = (await getValidInvites()) || [];
  } catch (e) {
    console.error("Error loading invites:", e);
  } finally {
    loadingInvites.value = false;
  }
}

async function generateInvite() {
  generatingInvite.value = true;
  errorInvite.value = "";
  try {
    const token = await createInviteToken();
    invites.value.unshift({
      token,
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      used: false,
    });
  } catch (e) {
    errorInvite.value = "Failed to generate invite";
  } finally {
    generatingInvite.value = false;
  }
}

function copyToClipboard(token) {
  navigator.clipboard.writeText(token).then(() => {
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
  adminUsers.value = new Set();
  ownerUsers.value = new Set();
  try {
    const allUsers = await getAllUsers();
    users.value = allUsers.filter((u) => u.displayName && u.displayName.trim());
    totalUsersCount.value = users.value.length;
    adminCount.value = 0;

    const ownerUid = await getOwnerUid();
    if (ownerUid) ownerUsers.value.add(ownerUid);

    await Promise.all(
      users.value.map(async (u) => {
        const admin = await isUserAdmin(u.uid);
        if (admin) {
          adminUsers.value.add(u.uid);
          adminCount.value++;
        }
      }),
    );
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
    adminCount.value++;
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
    adminCount.value--;
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
  border: 1px solid rgba(44, 42, 39, 0.07);
  border-radius: 14px;
  padding: 14px;
  gap: 14px;
  box-shadow: 0 10px 28px rgba(20, 20, 20, 0.05);
  transition:
    transform 180ms ease,
    box-shadow 180ms ease;
}

.invite-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 32px rgba(20, 20, 20, 0.08);
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
  padding: 10px 14px;
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
  border: 1px solid rgba(44, 42, 39, 0.12);
  color: var(--text);
  border-radius: 999px;
  padding: 8px;
  display: flex;
  align-items: center;
  cursor: pointer;
  transition: all 180ms ease;
}

.delete-btn-invite:hover {
  background: var(--surface-2);
  border-color: var(--danger);
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
  background: var(--surface-2);
  color: var(--text);
  border-color: rgba(44, 42, 39, 0.2);
  transform: translateY(-1px);
}

.role-btn {
  background: rgba(44, 42, 39, 0.03);
  border: 1px solid rgba(44, 42, 39, 0.1);
  color: var(--text);
  border-radius: 999px;
  padding: 7px 14px;
  font-size: 12px;
  font-weight: 600;
  font-family: "Satoshi", sans-serif;
  cursor: pointer;
  transition: all 180ms ease;
  white-space: nowrap;
}

.role-btn:hover {
  background: var(--surface-2);
  border-color: var(--accent);
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
