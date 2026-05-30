<template>
  <div class="shell">
    <div class="shell-header" data-tauri-drag-region>
      <div class="shell-brand">
        <img src="/icon.png" class="shell-logo" alt="" aria-hidden="true" />
        <span class="shell-wordmark">Node Chat</span>
      </div>
      <div class="shell-actions">
        <button
          v-if="!isDm"
          class="online-btn"
          :class="{ active: onlinePanelOpen }"
          title="Members"
          @click="onlinePanelOpen = !onlinePanelOpen"
        >
          <span class="online-btn-dot"></span>
          <span class="online-btn-count">{{ onlineUsers.length }} online</span>
        </button>
        <div class="user-menu" ref="menuRef">
          <button class="user-btn" @click="showDropdown = !showDropdown">
            <div
              class="avatar"
              :style="
                getAvatarStyle(user.displayName, user.uid, userColor, ownerUid)
              "
            >
              {{ getAvatarInitial(user.displayName, user.uid, ownerUid) }}
            </div>
            <svg
              class="chevron"
              :class="{ open: showDropdown }"
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
            >
              <path
                d="M2 4L6 8L10 4"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
          <transition name="dropdown-fade">
            <div class="dropdown" v-if="showDropdown">
              <div class="dropdown-profile">
                <div
                  class="avatar large"
                  :style="
                    getAvatarStyle(
                      user.displayName,
                      user.uid,
                      userColor,
                      ownerUid,
                    )
                  "
                >
                  {{ getAvatarInitial(user.displayName, user.uid, ownerUid) }}
                </div>
                <div class="dropdown-info">
                  <div class="dropdown-name">{{ user.displayName }}</div>
                  <div class="dropdown-email">{{ user.email }}</div>
                </div>
              </div>
              <div class="divider"></div>
              <button class="dropdown-item" @click="openSettings">
                <Settings2 :size="14" stroke-width="2" />
                Settings
              </button>
              <button
                v-if="isAdmin"
                class="dropdown-item admin-item"
                @click="openAdmin"
              >
                <ShieldCheck :size="14" stroke-width="2" />
                Admin
              </button>
              <div class="divider"></div>
              <button class="dropdown-item danger" @click="logout">
                <LogOut :size="14" stroke-width="2" />
                Sign Out
              </button>
            </div>
          </transition>
        </div>
        <WindowControls with-divider />
      </div>
    </div>

    <div class="shell-body">
      <Sidebar
        :user="user"
        :selection="selection"
        :owner-uid="ownerUid"
        :all-users="allUsers"
        :presence-users="presenceUsers"
        :dm-index="dmIndex"
        :channel-unread="channelUnread"
        @select="handleSelect"
        @open-new-dm="showNewDmDialog = true"
      />
      <div class="shell-main">
        <div
          class="chat-slot"
          v-show="selection.kind === 'channel'"
          aria-hidden="selection.kind !== 'channel'"
        >
          <ChatRoom
            :user="user"
            mode="channel"
            :owner-uid="ownerUid"
            :admin-users="adminUsers"
            :all-users="allUsers"
            :presence-users="presenceUsers"
            :is-muted="isMuted"
            :all-muted-users="allMutedUsers"
            :online-panel-open="onlinePanelOpen"
            :is-active="selection.kind === 'channel'"
            @ready="onChannelReady"
            @unread-count="onChannelUnreadCount"
          />
        </div>
        <template v-for="threadId in mountedDmThreads" :key="threadId">
          <div
            class="chat-slot"
            v-show="selection.kind === 'dm' && selection.threadId === threadId"
            :aria-hidden="
              !(selection.kind === 'dm' && selection.threadId === threadId)
            "
          >
            <ChatRoom
              :user="user"
              mode="dm"
              :thread-id="threadId"
              :partner="dmPartners[threadId]"
              :owner-uid="ownerUid"
              :admin-users="adminUsers"
              :all-users="allUsers"
              :presence-users="presenceUsers"
              :is-muted="isMuted"
              :all-muted-users="allMutedUsers"
              :online-panel-open="onlinePanelOpen"
              :is-active="
                selection.kind === 'dm' && selection.threadId === threadId
              "
            />
          </div>
        </template>
      </div>
    </div>

    <NewDmDialog
      v-if="showNewDmDialog"
      :is-open="showNewDmDialog"
      :user="user"
      :all-users="allUsers"
      :presence-users="presenceUsers"
      :owner-uid="ownerUid"
      @close="showNewDmDialog = false"
      @start-dm="handleStartDm"
    />
  </div>
</template>

<script setup>
import {
  ref,
  computed,
  onMounted,
  onUnmounted,
  watch,
  defineAsyncComponent,
} from "vue";
import { db } from "../firebase";
import { ref as dbRef, onValue } from "firebase/database";
import { Settings2, LogOut, ShieldCheck } from "lucide-vue-next";
import { getAvatarInitial, getAvatarStyle } from "../avatar";
import WindowControls from "./WindowControls.vue";
import Sidebar from "./Sidebar.vue";
import { initBadge, updateBadge, clearBadge } from "../faviconBadge";
import {
  ensureNotificationPermission,
  sendSystemNotification,
} from "../notifications";
import {
  startPresence,
  stopPresence,
  updatePresenceProfile,
  userIsOnline,
} from "../presence";
import { logoutCurrentUser } from "../authUtils";
import {
  ensureDmThread,
  ensureMyDmIndexEntry,
  partnerUidFromThread,
  markDmRead,
} from "../dmUtils";

const ChatRoom = defineAsyncComponent(() => import("./ChatRoom.vue"));
const NewDmDialog = defineAsyncComponent(() => import("./NewDmDialog.vue"));

const props = defineProps({ user: { type: Object, required: true } });
const emit = defineEmits(["ready", "open-settings", "open-admin"]);

const allUsers = ref({});
const presenceUsers = ref({});
const ownerUid = ref(null);
const adminUsers = ref(new Set());
const isMuted = ref(false);
const allMutedUsers = ref(new Set());
const dmIndex = ref({});

const showDropdown = ref(false);
const showNewDmDialog = ref(false);
const onlinePanelOpen = ref(false);
const menuRef = ref(null);

const selection = ref({ kind: "channel" });
const channelUnread = ref(0);
const knownDmThreads = ref(new Set());
const hasEmittedReady = ref(false);
const mountedDmThreads = ref([]);
const dmPartners = ref({});

const userColor = computed(() => props.user?.preferences?.avatarColor || null);

const isAdmin = computed(
  () =>
    adminUsers.value.has(props.user.uid) || ownerUid.value === props.user.uid,
);

const isDm = computed(() => selection.value.kind === "dm");

const onlineUsers = computed(() => {
  return Object.entries(presenceUsers.value)
    .map(([uid, data]) => (userIsOnline(data) ? uid : null))
    .filter(Boolean);
});

let usersListener = null;
let presenceListener = null;
let ownerListener = null;
let adminsListener = null;
let muteListener = null;
let allMutedUsersListener = null;
let dmIndexListener = null;

function onChannelUnreadCount(n) {
  channelUnread.value = n || 0;
  recomputeBadge();
}

const dmUnreadTotal = computed(() => {
  let total = 0;
  const entries = dmIndex.value || {};
  for (const [threadId, entry] of Object.entries(entries)) {
    if (selection.value.kind === "dm" && selection.value.threadId === threadId)
      continue;
    if (!entry) continue;
    const last = Number(entry.lastMessageAt || 0);
    const read = Number(entry.lastReadAt || 0);
    if (last > read && entry.lastMessageFromUid !== props.user.uid) total++;
  }
  return total;
});

function recomputeBadge() {
  const total = channelUnread.value + dmUnreadTotal.value;
  if (total > 0) updateBadge(total);
  else clearBadge();
}

watch(dmUnreadTotal, recomputeBadge);

function buildPartnerSnapshot(partnerUid) {
  const partnerData = allUsers.value[partnerUid] || {};
  const presenceProfile = presenceUsers.value[partnerUid]?.profile || {};
  return {
    uid: partnerUid,
    displayName:
      partnerData.displayName || presenceProfile.displayName || "Unknown",
    avatarColor:
      partnerData.preferences?.avatarColor ||
      presenceProfile.avatarColor ||
      null,
  };
}

function ensureDmMounted(threadId, partnerUid) {
  if (!threadId || !partnerUid) return;
  dmPartners.value = {
    ...dmPartners.value,
    [threadId]: buildPartnerSnapshot(partnerUid),
  };
  if (!mountedDmThreads.value.includes(threadId)) {
    mountedDmThreads.value = [...mountedDmThreads.value, threadId];
  }
}

function handleSelect(sel) {
  if (sel?.kind === "dm") {
    const partnerUid = sel.partnerUid;
    if (!partnerUid) return;
    const threadId = sel.threadId;
    ensureDmMounted(threadId, partnerUid);
    selection.value = {
      kind: "dm",
      threadId,
      partner: dmPartners.value[threadId],
    };
    onlinePanelOpen.value = false;
    markDmRead(props.user.uid, threadId);
  } else {
    selection.value = { kind: "channel" };
  }
}

async function handleStartDm(partner) {
  showNewDmDialog.value = false;
  if (!partner?.uid) return;
  if (partner.uid === props.user.uid) return;
  try {
    const threadId = await ensureDmThread(props.user.uid, partner.uid);
    if (!threadId) return;
    await ensureMyDmIndexEntry(props.user.uid, partner.uid, threadId);
    handleSelect({ kind: "dm", threadId, partnerUid: partner.uid });
  } catch (err) {
    console.error("Failed to start DM:", err);
  }
}

function openSettings() {
  showDropdown.value = false;
  emit("open-settings");
}

function openAdmin() {
  showDropdown.value = false;
  emit("open-admin");
}

async function logout() {
  showDropdown.value = false;
  try {
    await stopPresence();
    await logoutCurrentUser();
  } catch (err) {
    console.error("Failed to sign out:", err);
  }
}

function onChannelReady() {
  if (!hasEmittedReady.value) {
    hasEmittedReady.value = true;
    emit("ready");
  }
}

function handleClickOutside(e) {
  if (menuRef.value && !menuRef.value.contains(e.target)) {
    showDropdown.value = false;
  }
}

function handleKeydown(e) {
  if (e.key === "Escape" && showDropdown.value) {
    showDropdown.value = false;
  }
}

function previewBodyForDm(entry) {
  if (!entry) return "";
  if (entry.lastMessageType === "gif") return "🎞️ GIF";
  return entry.lastMessagePreview || "";
}

function dmNotificationTitle(partnerUid) {
  const u = allUsers.value[partnerUid];
  if (u?.displayName) return u.displayName;
  const p = presenceUsers.value[partnerUid]?.profile;
  if (p?.displayName) return p.displayName;
  return "New message";
}

function handleAppForeground() {
  if (document.hidden) return;
  document.title = "Node Chat";
  if (selection.value.kind === "dm") {
    markDmRead(props.user.uid, selection.value.threadId);
  }
}

watch(
  () => [props.user.displayName, props.user.preferences?.avatarColor],
  ([displayName, avatarColor]) => {
    updatePresenceProfile({ displayName, avatarColor });
  },
);

onMounted(async () => {
  initBadge();
  document.title = "Node Chat";
  if (props.user.preferences?.notificationsEnabled) {
    try {
      await ensureNotificationPermission();
    } catch {}
  }

  document.addEventListener("click", handleClickOutside);
  document.addEventListener("keydown", handleKeydown);
  document.addEventListener("visibilitychange", handleAppForeground);
  window.addEventListener("focus", handleAppForeground);

  await startPresence({
    uid: props.user.uid,
    displayName: props.user.displayName,
    preferences: props.user.preferences || {},
  });

  usersListener = onValue(dbRef(db, "users"), (snap) => {
    allUsers.value = snap.exists() ? snap.val() : {};
  });
  presenceListener = onValue(dbRef(db, "presence"), (snap) => {
    presenceUsers.value = snap.exists() ? snap.val() : {};
  });
  ownerListener = onValue(dbRef(db, "owner"), (snap) => {
    ownerUid.value = snap.exists() ? snap.val() : null;
  });
  adminsListener = onValue(dbRef(db, "admins"), (snap) => {
    adminUsers.value = new Set(snap.exists() ? Object.keys(snap.val()) : []);
  });
  muteListener = onValue(dbRef(db, `muted/${props.user.uid}`), (snap) => {
    isMuted.value = snap.val() === true;
  });
  allMutedUsersListener = onValue(dbRef(db, "muted"), (snap) => {
    const data = snap.val();
    allMutedUsers.value = new Set(
      data ? Object.keys(data).filter((uid) => data[uid] === true) : [],
    );
  });

  dmIndexListener = onValue(
    dbRef(db, `dms/userIndex/${props.user.uid}`),
    (snap) => {
      const data = snap.exists() ? snap.val() : {};
      const previous = knownDmThreads.value;
      const next = new Set();
      const isFirstLoad = previous.size === 0;
      for (const [threadId, entry] of Object.entries(data)) {
        next.add(threadId);
        if (!entry) continue;
        const last = Number(entry.lastMessageAt || 0);
        const read = Number(entry.lastReadAt || 0);
        if (
          !isFirstLoad &&
          last > read &&
          entry.lastMessageFromUid &&
          entry.lastMessageFromUid !== props.user.uid
        ) {
          const onThisThread =
            selection.value.kind === "dm" &&
            selection.value.threadId === threadId;
          if (onThisThread && !document.hidden) {
            markDmRead(props.user.uid, threadId);
          } else {
            const shouldNotify =
              !!props.user.preferences?.notificationsEnabled &&
              (document.hidden || !onThisThread);
            if (shouldNotify) {
              const partnerUid =
                entry.partnerUid ||
                partnerUidFromThread(threadId, props.user.uid);
              const title = dmNotificationTitle(partnerUid);
              const body = previewBodyForDm(entry);
              if (body) {
                void sendSystemNotification({
                  title,
                  body,
                  icon: "/icon.png",
                });
              }
            }
          }
        }
      }
      knownDmThreads.value = next;
      dmIndex.value = data;
    },
  );
});

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
  document.removeEventListener("keydown", handleKeydown);
  document.removeEventListener("visibilitychange", handleAppForeground);
  window.removeEventListener("focus", handleAppForeground);
  if (usersListener) usersListener();
  if (presenceListener) presenceListener();
  if (ownerListener) ownerListener();
  if (adminsListener) adminsListener();
  if (muteListener) muteListener();
  if (allMutedUsersListener) allMutedUsersListener();
  if (dmIndexListener) dmIndexListener();
  stopPresence();
});
</script>

<style scoped>
.shell {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  width: 100%;
  overflow: hidden;
  min-height: 0;
  padding-bottom: env(safe-area-inset-bottom);
}

.shell-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px 0 14px;
  height: 48px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  background: var(--surface);
  gap: 12px;
}

.shell-brand {
  display: flex;
  align-items: center;
  gap: 9px;
  flex-shrink: 0;
  pointer-events: none;
  user-select: none;
  -webkit-user-select: none;
}

.shell-logo {
  width: 24px;
  height: 24px;
  object-fit: contain;
  flex-shrink: 0;
  pointer-events: none;
  -webkit-user-drag: none;
  user-select: none;
  -webkit-user-select: none;
}

.shell-wordmark {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.2px;
  white-space: nowrap;
  pointer-events: none;
  user-select: none;
  -webkit-user-select: none;
}

.shell-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.shell-body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.shell-main {
  position: relative;
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

.chat-slot {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

.online-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--surface);
  border: 1px solid rgba(44, 42, 39, 0.1);
  border-radius: 999px;
  padding: 6px 12px 6px 10px;
  cursor: pointer;
  color: var(--text);
  font-size: 12px;
  font-weight: 600;
  font-family: "Satoshi", sans-serif;
  transition:
    border-color 0.15s,
    background 0.15s,
    transform 0.15s;
  flex-shrink: 0;
}

.online-btn:hover,
.online-btn.active {
  border-color: rgba(44, 42, 39, 0.14);
  background: var(--surface-2);
  box-shadow: inset 0 0 0 1px rgba(44, 42, 39, 0.03);
}

.online-btn:active {
  transform: translateY(1px);
}

.online-btn-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #3ba55c;
  flex-shrink: 0;
  box-shadow: 0 0 0 2px rgba(59, 165, 92, 0.25);
  animation: shellPresencePulse 2.4s ease-in-out infinite;
}

.online-btn-count {
  letter-spacing: 0.1px;
}

@keyframes shellPresencePulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(59, 165, 92, 0.4);
  }
  50% {
    box-shadow: 0 0 0 5px rgba(59, 165, 92, 0);
  }
}

.user-menu {
  position: relative;
}

.user-btn {
  display: flex;
  align-items: center;
  gap: 7px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 5px 7px;
  border-radius: var(--radius);
  color: var(--text);
  font-family: "Satoshi", sans-serif;
  font-size: 13px;
  font-weight: 600;
  transition:
    background 0.15s,
    box-shadow 0.15s,
    transform 0.15s;
}

.user-btn:hover {
  background: var(--surface-2);
  box-shadow: inset 0 0 0 1px rgba(44, 42, 39, 0.04);
}

.user-btn:active {
  transform: translateY(1px);
}

.avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  letter-spacing: 0;
}

.avatar.large {
  width: 40px;
  height: 40px;
  font-size: 16px;
}

.chevron {
  color: var(--text-muted);
  transition: transform 0.2s;
}

.chevron.open {
  transform: rotate(180deg);
}

.dropdown-fade-enter-active {
  transition:
    opacity 0.2s ease,
    transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
  transform-origin: top right;
}
.dropdown-fade-leave-active {
  transition:
    opacity 0.13s ease,
    transform 0.13s ease;
  transform-origin: top right;
}
.dropdown-fade-enter-from {
  opacity: 0;
  transform: translateY(-8px) scale(0.92);
}
.dropdown-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.97);
}

.dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 240px;
  width: auto;
  max-width: calc(100vw - 32px);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 6px;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.13),
    0 1px 4px rgba(0, 0, 0, 0.06);
  z-index: 100;
}

.dropdown-profile {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 10px;
  background: var(--surface-2);
  border-radius: 8px;
  margin-bottom: 4px;
}

.dropdown-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  gap: 2px;
}

.dropdown-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dropdown-email {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.divider {
  height: 1px;
  background: var(--border);
  margin: 4px 0;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  background: none;
  border: none;
  border-radius: var(--radius);
  padding: 8px 10px;
  color: var(--text);
  font-family: "Satoshi", sans-serif;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  transition:
    background 160ms ease,
    color 160ms ease,
    transform 160ms var(--ease-out-quint);
}

.dropdown-item:hover {
  background: var(--surface-2);
}

.dropdown-item:active {
  transform: scale(0.98);
  transition-duration: 80ms;
}

.dropdown-item.danger {
  color: var(--danger);
}

.dropdown-item.danger:hover {
  background: rgba(192, 57, 43, 0.08);
}

.dropdown-item.admin-item {
  color: #22c55e;
}

.dropdown-item.admin-item:hover {
  background: rgba(34, 197, 94, 0.08);
  color: #22c55e;
}
</style>
