<template>
  <div class="shell" :class="{ 'sidebar-open': effectiveSidebarOpen }">
    <div class="shell-header" data-tauri-drag-region>
      <button
        type="button"
        class="menu-btn"
        :aria-label="effectiveSidebarOpen ? 'Close sidebar' : 'Open sidebar'"
        :aria-expanded="effectiveSidebarOpen"
        @click="toggleSidebar"
      >
        <Menu :size="20" stroke-width="2.2" />
      </button>
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
          <button class="user-btn" @click="toggleUserMenu">
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

    <div
      class="shell-body"
      @touchstart.passive="handleBodyTouchStart"
      @touchmove.passive="handleBodyTouchMove"
      @touchend.passive="handleBodyTouchEnd"
      @touchcancel.passive="handleBodyTouchEnd"
    >
      <svg class="shell-divider" aria-hidden="true">
        <path d="M 0 0 H 8 A 8 8 0 0 0 0 8 Z" fill="var(--surface)" />
        <path
          d="M 0.5 99999 V 8 Q 0.5 0.5 8 0.5 H 99999"
          fill="none"
          stroke="var(--border)"
          stroke-width="1"
          shape-rendering="geometricPrecision"
        />
      </svg>
      <div
        v-if="hoverZoneActive"
        class="sidebar-hover-zone"
        @mouseenter="hoverExpanded = true"
      ></div>
      <Sidebar
        class="shell-sidebar"
        :user="user"
        :selection="selection"
        :owner-uid="ownerUid"
        :all-users="allUsers"
        :presence-users="presenceUsers"
        :dm-index="dmIndex"
        :channel-unread="channelUnread"
        @select="handleSelect"
        @open-new-dm="onOpenNewDm"
        @mouseleave="onSidebarMouseLeave"
      />
      <transition name="scrim-fade">
        <div
          v-if="sidebarOpen"
          class="mobile-scrim"
          @click="sidebarOpen = false"
        ></div>
      </transition>
      <div class="shell-main">
        <div
          class="chat-slot"
          v-show="selection.kind === 'channel'"
          :aria-hidden="selection.kind !== 'channel'"
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
import { Settings2, LogOut, ShieldCheck, Menu } from "lucide-vue-next";
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
  partnerUidFromThread,
  markDmRead,
  dmPreviewText,
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
const MOBILE_BREAKPOINT = 640;
const isMobileViewport = ref(window.innerWidth <= MOBILE_BREAKPOINT);

function isAutoSidebarBehaviorEnabledFromPrefs() {
  const prefs = props.user?.preferences || {};
  if (typeof prefs.autoSidebarBehavior === "boolean") {
    return prefs.autoSidebarBehavior;
  }
  return prefs.autoExpandSidebar === true || prefs.autoCollapseSidebar === true;
}

const sidebarOpen = ref(
  !isMobileViewport.value && !isAutoSidebarBehaviorEnabledFromPrefs(),
);
const hoverExpanded = ref(false);

const effectiveSidebarOpen = computed(
  () => sidebarOpen.value || hoverExpanded.value,
);

const autoSidebarBehaviorEnabled = computed(() => {
  return isAutoSidebarBehaviorEnabledFromPrefs();
});

const hoverZoneActive = computed(() => {
  if (isMobileViewport.value) return false;
  if (sidebarOpen.value) return false;
  return autoSidebarBehaviorEnabled.value;
});

function applySidebarModeForViewport() {
  hoverExpanded.value = false;
  if (isMobileViewport.value) {
    sidebarOpen.value = false;
    return;
  }
  if (autoSidebarBehaviorEnabled.value) {
    sidebarOpen.value = false;
    return;
  }
  sidebarOpen.value = true;
}

function updateViewportState() {
  const nextIsMobile = window.innerWidth <= MOBILE_BREAKPOINT;
  if (nextIsMobile === isMobileViewport.value) return;
  isMobileViewport.value = nextIsMobile;
  applySidebarModeForViewport();
}

function onSidebarMouseLeave() {
  if (hoverExpanded.value) hoverExpanded.value = false;
}

function toggleSidebar() {
  hoverExpanded.value = false;
  const next = !sidebarOpen.value;
  if (isMobileViewport.value && next) {
    showDropdown.value = false;
    onlinePanelOpen.value = false;
  }
  sidebarOpen.value = next;
}

function toggleUserMenu() {
  const next = !showDropdown.value;
  if (isMobileViewport.value && next) {
    sidebarOpen.value = false;
    hoverExpanded.value = false;
    onlinePanelOpen.value = false;
  }
  showDropdown.value = next;
}

const SWIPE_TRIGGER_DISTANCE = 60;
const SWIPE_HORIZONTAL_BIAS = 1.5;

const touchState = {
  startX: 0,
  startY: 0,
  active: false,
  intent: null,
};

function shouldIgnoreSwipeTarget(target) {
  return !!target?.closest?.(
    "input, textarea, button, a, [contenteditable='true'], .gif-message, .reaction-picker, .attach-menu, .dropdown",
  );
}

function handleBodyTouchStart(e) {
  if (!isMobileViewport.value) return;
  if (e.touches.length !== 1) return;
  if (shouldIgnoreSwipeTarget(e.target)) return;
  touchState.startX = e.touches[0].clientX;
  touchState.startY = e.touches[0].clientY;
  touchState.active = true;
  touchState.intent = null;
}

function handleBodyTouchMove(e) {
  if (!touchState.active) return;
  const dx = e.touches[0].clientX - touchState.startX;
  const dy = e.touches[0].clientY - touchState.startY;
  if (touchState.intent === null) {
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
    touchState.intent =
      Math.abs(dx) > Math.abs(dy) * SWIPE_HORIZONTAL_BIAS
        ? "horizontal"
        : "vertical";
  }
  if (touchState.intent !== "horizontal") return;
  if (!sidebarOpen.value && dx > SWIPE_TRIGGER_DISTANCE) {
    sidebarOpen.value = true;
    touchState.active = false;
  } else if (sidebarOpen.value && dx < -SWIPE_TRIGGER_DISTANCE) {
    sidebarOpen.value = false;
    touchState.active = false;
  }
}

function handleBodyTouchEnd() {
  touchState.active = false;
}

function onOpenNewDm() {
  if (shouldCollapseOnNavigate()) {
    sidebarOpen.value = false;
    hoverExpanded.value = false;
  }
  showNewDmDialog.value = true;
}

function shouldCollapseOnNavigate() {
  if (isMobileViewport.value) return true;
  return autoSidebarBehaviorEnabled.value;
}

const selection = ref({ kind: "channel" });
const channelUnread = ref(0);
const hasLoadedDmIndex = ref(false);
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

watch(autoSidebarBehaviorEnabled, (enabled, previous) => {
  if (enabled === previous) return;
  if (isMobileViewport.value) {
    hoverExpanded.value = false;
    sidebarOpen.value = false;
    return;
  }
  if (enabled) {
    hoverExpanded.value = false;
    sidebarOpen.value = false;
    return;
  }
  sidebarOpen.value = true;
});

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
  dmPartners.value[threadId] = buildPartnerSnapshot(partnerUid);
  if (!mountedDmThreads.value.includes(threadId)) {
    mountedDmThreads.value.push(threadId);
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
  if (shouldCollapseOnNavigate()) {
    sidebarOpen.value = false;
    hoverExpanded.value = false;
  }
}

async function handleStartDm(partner) {
  showNewDmDialog.value = false;
  if (!partner?.uid || partner.uid === props.user.uid) return;
  const threadId = await ensureDmThread(props.user.uid, partner.uid);
  if (!threadId) return;
  handleSelect({ kind: "dm", threadId, partnerUid: partner.uid });
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
  await stopPresence();
  await logoutCurrentUser();
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
  if (e.key === "Escape") {
    if (showDropdown.value) showDropdown.value = false;
  }
}

function dmNotificationTitle(partnerUid) {
  const user = allUsers.value[partnerUid];
  if (user?.displayName) return user.displayName;
  const profile = presenceUsers.value[partnerUid]?.profile;
  if (profile?.displayName) return profile.displayName;
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
    await ensureNotificationPermission();
  }

  document.addEventListener("click", handleClickOutside);
  document.addEventListener("keydown", handleKeydown);
  document.addEventListener("visibilitychange", handleAppForeground);
  window.addEventListener("focus", handleAppForeground);
  window.addEventListener("resize", updateViewportState);

  applySidebarModeForViewport();

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
      const isFirstLoad = !hasLoadedDmIndex.value;
      hasLoadedDmIndex.value = true;
      dmIndex.value = data;
      if (isFirstLoad) return;
      for (const [threadId, entry] of Object.entries(data)) {
        if (!entry) continue;
        const last = Number(entry.lastMessageAt || 0);
        const read = Number(entry.lastReadAt || 0);
        const isFromOther =
          entry.lastMessageFromUid &&
          entry.lastMessageFromUid !== props.user.uid;
        if (last <= read || !isFromOther) continue;
        const onThisThread =
          selection.value.kind === "dm" &&
          selection.value.threadId === threadId;
        if (onThisThread && !document.hidden) {
          markDmRead(props.user.uid, threadId);
          continue;
        }
        if (!props.user.preferences?.notificationsEnabled) continue;
        const body = dmPreviewText(entry);
        if (!body) continue;
        const partnerUid =
          entry.partnerUid || partnerUidFromThread(threadId, props.user.uid);
        void sendSystemNotification({
          title: dmNotificationTitle(partnerUid),
          body,
          icon: "/icon.png",
        });
      }
    },
  );
});

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
  document.removeEventListener("keydown", handleKeydown);
  document.removeEventListener("visibilitychange", handleAppForeground);
  window.removeEventListener("focus", handleAppForeground);
  window.removeEventListener("resize", updateViewportState);
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
  overscroll-behavior: none;
}

.shell-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px 0 6px;
  height: 48px;
  flex-shrink: 0;
  background: var(--surface);
  gap: 12px;
}

.menu-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: var(--surface-2);
  border: none;
  color: var(--text);
  border-radius: 8px;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 140ms ease;
}

.menu-btn:hover,
.menu-btn:active {
  background: rgba(44, 42, 39, 0.1);
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
  font-family: var(--font-brand);
  font-size: 16px;
  font-weight: 800;
  color: var(--text);
  letter-spacing: -0.01em;
  line-height: 1;
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
  margin-left: auto;
}

.shell-body {
  position: relative;
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.shell-divider {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: hidden;
  z-index: 5;
}

.sidebar-hover-zone {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 12px;
  z-index: 10;
}

@media (min-width: 641px) {
  .shell-sidebar {
    --sidebar-width: 232px;
    transition: margin-left 470ms var(--ease-soft);
    will-change: margin-left;
  }
  .shell:not(.sidebar-open) .shell-sidebar {
    margin-left: -232px;
  }
  .shell-divider {
    left: 232px;
    transition: left 470ms var(--ease-soft);
    will-change: left;
  }
  .shell:not(.sidebar-open) .shell-divider {
    left: -8px;
  }
}

.shell-main {
  position: relative;
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  transition: filter 220ms ease;
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

.mobile-scrim {
  display: none;
}

.scrim-fade-enter-active,
.scrim-fade-leave-active {
  transition: opacity 200ms ease;
}
.scrim-fade-enter-from,
.scrim-fade-leave-to {
  opacity: 0;
}

@media (max-width: 640px) {
  .shell-header {
    height: 52px;
    min-height: 52px;
    padding: 0 8px;
    gap: 6px;
    border-bottom: 1px solid var(--border);
  }
  .menu-btn {
    width: 40px;
    height: 40px;
    border-radius: 10px;
  }
  .shell-divider {
    display: none;
  }
  .shell-wordmark {
    display: none;
  }
  .shell-logo {
    width: 22px;
    height: 22px;
  }
  .online-btn {
    display: none;
  }
  .shell-body {
    position: relative;
    overscroll-behavior: contain;
  }
  .shell-sidebar {
    --sidebar-width: 100%;
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 50;
    width: min(88vw, 340px);
    max-width: none;
    border-right: 1px solid var(--border);
    transform: translateX(-100%);
    transition:
      transform 390ms var(--ease-out-quint),
      box-shadow 390ms var(--ease-soft);
    box-shadow: 0 0 0 rgba(0, 0, 0, 0);
    will-change: transform;
  }
  .shell.sidebar-open .shell-sidebar {
    transform: translateX(0);
    box-shadow: 4px 0 24px rgba(0, 0, 0, 0.18);
  }
  .shell.sidebar-open .shell-main {
    pointer-events: none;
    filter: saturate(0.96) brightness(0.98);
  }
  .mobile-scrim {
    display: block;
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.34);
    z-index: 40;
    -webkit-backdrop-filter: blur(3px);
    backdrop-filter: blur(3px);
    touch-action: none;
  }
  .shell-actions {
    gap: 2px;
  }
  .user-btn {
    padding: 5px 7px;
  }
  .avatar {
    width: 27px;
    height: 27px;
    font-size: 11px;
  }
  .chevron {
    display: none;
  }
  .dropdown {
    right: 6px;
    top: calc(100% + 6px);
    max-width: min(320px, calc(100vw - 12px));
  }
}
</style>
