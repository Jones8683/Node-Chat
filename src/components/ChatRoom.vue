<template>
  <div class="chat">
    <div class="header" @wheel="forwardWheelToMessages">
      <div class="user-menu" ref="menuRef">
        <button class="user-btn" @click="showDropdown = !showDropdown">
          <div class="avatar" :style="{ background: getAvatarColor(user.displayName) }">{{ user.displayName[0].toUpperCase() }}</div>
          <span class="username">{{ user.displayName }}</span>
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
            <div class="avatar large" :style="{ background: getAvatarColor(user.displayName) }">
              {{ user.displayName[0].toUpperCase() }}
            </div>
            <div class="dropdown-info">
              <div class="dropdown-name">{{ user.displayName }}</div>
              <div class="dropdown-email">{{ user.email }}</div>
            </div>
          </div>
          <div class="divider"></div>
          <button class="dropdown-item" @click="openSettings">
            <User :size="14" stroke-width="2" />
            Settings
          </button>
          <button v-if="isAdmin" class="dropdown-item admin-item" @click="openAdmin">
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
      <img :src="'/icon.png'" class="header-logo" alt="Node Chat" />
      <button
        class="online-btn"
        @click="showOnlinePanel = !showOnlinePanel"
        :class="{ active: showOnlinePanel }"
        :title="showOnlinePanel ? 'Hide members' : 'Show members'"
      >
        <span class="online-btn-dot"></span>
        <span class="online-btn-count">{{ onlineUsers.length }} online</span>
      </button>
    </div>

    <div class="chat-body">
      <div class="chat-main">
        <div class="messages" ref="messageContainer">
          <button
            class="load-more"
            v-if="hasMore"
            @click="loadMore"
            :disabled="isLoadingMore"
          >
            {{ isLoadingMore ? "Loading..." : "Load previous messages" }}
          </button>
          <template v-for="item in groupedMessages" :key="item.id">
            <div v-if="item.type === 'date'" class="date-separator">
              <span class="date-label">{{ item.label }}</span>
            </div>
            <div
              v-else
              class="message"
              :data-message-id="item.id"
              :class="{ 'message--editing': editingId === item.id, 'message--start': item.isGroupStart }"
            >
              <div v-if="item.isGroupStart" class="msg-header">
                <span class="msg-name">{{ item.displayName }}</span>
                <span class="msg-time">{{ formatTimestamp(item.timestamp) }}</span>
              </div>

              <template v-if="editingId === item.id">
                <div class="edit-area">
                  <textarea
                    class="edit-input"
                    v-model="editText"
                    @keydown.enter.exact.prevent="saveEdit(item.id)"
                    @keydown.esc.prevent="cancelEdit"
                    @input="resizeEditInput($event.target)"
                    maxlength="2000"
                    rows="1"
                  ></textarea>
                </div>
              </template>

              <template v-else>
                <div class="msg-body">
                  <span class="text"><span v-html="formatMessage(item.text)"></span><span v-if="item.editedAt" class="edited-label"> (edited)</span></span>
                </div>
                <div class="msg-actions" v-if="item.uid === user.uid || isAdmin">
                  <button
                    v-if="item.uid === user.uid"
                    class="msg-action-btn"
                    @click="startEdit(item)"
                    title="Edit"
                  >
                    <Pencil :size="15" stroke-width="2" />
                  </button>
                  <button
                    class="msg-action-btn danger"
                    @click="promptDelete(item.id)"
                    title="Delete"
                  >
                    <Trash2 :size="15" stroke-width="2" />
                  </button>
                </div>
              </template>
            </div>
          </template>
        </div>

        <transition name="jump-fade">
          <button v-if="showJumpButton" class="jump-to-bottom" @click="scrollToBottom">
            <span v-if="scrollUnread > 0" class="jump-unread">{{ scrollUnread }}</span>
            <ChevronDown :size="16" stroke-width="2.5" />
          </button>
        </transition>

        <div class="typing-area" @wheel="forwardWheelToMessages">
          <div class="typing-indicator" v-if="typingUsers.length">
            <div class="dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <span class="typing-names">
              <template v-for="(name, i) in typingUsers" :key="name">
                <strong>{{ name }}</strong>
                <template v-if="i < typingUsers.length - 2">, </template>
                <template v-else-if="i === typingUsers.length - 2"> and </template>
              </template>
              {{ typingUsers.length === 1 ? "is" : "are" }} typing...
            </span>
          </div>
        </div>

        <div class="input-row" @wheel="forwardWheelToMessages">
          <textarea
            ref="composerRef"
            v-model="newMessage"
            id="message"
            name="message"
            autocomplete="off"
            rows="1"
            maxlength="2000"
            enterkeyhint="send"
            inputmode="text"
            @keydown.enter.exact.prevent="sendMessage"
            @keydown="handleComposerKeydown"
            @input="handleComposerInput"
            placeholder="Type a message..."
          ></textarea>
          <span class="char-warning" v-if="newMessage.length > 1800">{{
            2000 - newMessage.length
          }}</span>
          <button
            @mousedown.prevent
            @click="sendMessage"
            class="send-btn"
            :disabled="!newMessage.trim()"
          >
            <Send :size="15" stroke-width="2" />
          </button>
        </div>
      </div>

      <transition name="panel-slide">
        <div v-if="showOnlinePanel" class="online-panel">
          <div class="online-panel-header">
            <span class="online-panel-dot"></span>
            <span class="online-panel-title">Online</span>
            <span class="online-panel-count">{{ onlineUsers.length }}</span>
          </div>
          <div class="online-panel-list">
            <div
              v-for="(u, i) in onlineUsers"
              :key="u.uid"
              class="online-item"
              :class="{ 'online-item--you': u.uid === props.user.uid }"
              :style="{ animationDelay: `${i * 45}ms` }"
            >
              <div class="online-avatar" :style="{ background: getAvatarColor(u.displayName) }">
                {{ u.displayName[0].toUpperCase() }}
                <span class="online-avatar-dot"></span>
              </div>
              <span class="online-item-name">{{ u.displayName }}</span>
              <span v-if="u.uid === props.user.uid" class="online-you-tag">You</span>
            </div>
            <template v-if="offlineMembers.length">
              <div class="panel-section-label">Recently seen</div>
              <div
                v-for="u in offlineMembers"
                :key="u.uid"
                class="online-item offline-item"
              >
                <div class="online-avatar offline-avatar" :style="{ background: getAvatarColor(u.displayName) }">
                  {{ u.displayName[0].toUpperCase() }}
                </div>
                <div class="offline-item-body">
                  <span class="online-item-name offline-name">{{ u.displayName }}</span>
                  <span class="lastseen-text">{{ formatLastSeen(u.lastSeen) }}</span>
                </div>
              </div>
            </template>
          </div>
        </div>
      </transition>
    </div>

    <teleport to="body">
      <div v-if="deleteDialog.show" class="delete-overlay" @click="cancelDelete">
        <div class="delete-box" @click.stop>
          <h3>Delete Message?</h3>
          <p>Delete <strong>{{ deleteDialog.name }}</strong>'s message? This cannot be undone.</p>
          <div class="delete-actions">
            <button class="del-cancel-btn" @click="cancelDelete">Cancel</button>
            <button class="del-confirm-btn" @click="confirmDelete">Delete</button>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from "vue";
import { auth, db } from "../firebase";
import { signOut } from "firebase/auth";
import { ShieldCheck, User, Users, LogOut, Send, Pencil, Trash2, ChevronDown } from "lucide-vue-next";
import {
  ref as dbRef,
  push,
  query,
  limitToLast,
  onValue,
  serverTimestamp,
  set,
  update,
  remove,
  onDisconnect,
  goOnline,
  get,
} from "firebase/database";
import { isUserAdmin } from "../authUtils";

const props = defineProps(["user"]);
const emit = defineEmits(["ready", "open-settings", "open-admin"]);
const messages = ref([]);
const isAtBottom = ref(true);
const showJumpButton = ref(false);
const scrollUnread = ref(0);
const SHOW_JUMP_THRESHOLD = 110;
const GROUP_TIMEOUT = 5 * 60 * 1000;
const onlineUsers = ref([]);
const showOnlinePanel = ref(false);
const AVATAR_COLORS = ["#6366f1","#8b5cf6","#ec4899","#f43f5e","#f97316","#22c55e","#14b8a6","#3b82f6"];

function getAvatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function formatDateLabel(timestamp) {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

const groupedMessages = computed(() => {
  const result = [];
  let lastDateKey = null;
  messages.value.forEach((msg, i) => {
    const dateKey = msg.timestamp ? new Date(msg.timestamp).toDateString() : null;
    if (dateKey && dateKey !== lastDateKey) {
      lastDateKey = dateKey;
      result.push({ type: "date", id: `date-${dateKey}`, label: formatDateLabel(msg.timestamp) });
    }
    const prev = i > 0 ? messages.value[i - 1] : null;
    const crossedDate = prev && prev.timestamp && msg.timestamp &&
      new Date(prev.timestamp).toDateString() !== new Date(msg.timestamp).toDateString();
    const isGroupStart =
      !prev ||
      prev.uid !== msg.uid ||
      !prev.timestamp ||
      !msg.timestamp ||
      msg.timestamp - prev.timestamp > GROUP_TIMEOUT ||
      crossedDate;
    result.push({ ...msg, type: "message", isGroupStart });
  });
  return result;
});
const newMessage = ref("");
const menuRef = ref(null);
const messageContainer = ref(null);
const composerRef = ref(null);
const showDropdown = ref(false);
const typingUsers = ref([]);
const hasMore = ref(false);
const isAdmin = ref(false);
const isLoadingMore = ref(false);
const editingId = ref(null);
const editText = ref("");
const deleteDialog = ref({ show: false, id: null, name: "" });
const MESSAGE_BATCH_SIZE = 100;
const SCROLL_BOTTOM_THRESHOLD = 24;
let messageLimit = MESSAGE_BATCH_SIZE;
let totalCount = 0;
let unreadCount = 0;
let initialLoadDone = false;
let hasPositionedInitialScroll = false;
let knownIds = new Set();
const allUsers = ref({});
let typingTimeout = null;
let myTypingRef = null;
let myPresenceRef = null;
let messagesListener = null;
let typingListener = null;
let presenceListener = null;
let usersListener = null;
let pendingScrollAnchor = null;
let shouldScrollToBottom = false;
let hasEmittedReady = false;

const offlineMembers = computed(() => {
  const onlineUids = new Set(onlineUsers.value.map((u) => u.uid));
  const cutoff = 7 * 24 * 3600000;
  return Object.entries(allUsers.value)
    .filter(([uid, data]) => !onlineUids.has(uid) && data.lastSeen && Date.now() - data.lastSeen < cutoff)
    .map(([uid, data]) => ({ uid, displayName: data.displayName || "?", lastSeen: data.lastSeen }))
    .sort((a, b) => b.lastSeen - a.lastSeen);
});

function formatLastSeen(ts) {
  if (!ts) return "a while ago";
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function isNearBottom(scrollEl) {
  if (!scrollEl) return true;
  return (
    scrollEl.scrollHeight - scrollEl.clientHeight - scrollEl.scrollTop <=
    SCROLL_BOTTOM_THRESHOLD
  );
}

function handleMessageScroll() {
  if (!messageContainer.value || isLoadingMore.value) return;
  const el = messageContainer.value;
  const distFromBottom = el.scrollHeight - el.clientHeight - el.scrollTop;
  const near = distFromBottom <= SCROLL_BOTTOM_THRESHOLD;
  shouldScrollToBottom = near;
  isAtBottom.value = near;
  showJumpButton.value = distFromBottom > SHOW_JUMP_THRESHOLD;
  if (near) {
    scrollUnread.value = 0;
    showJumpButton.value = false;
  }
}

function scrollToBottom() {
  const container = messageContainer.value;
  if (!container) return;
  container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  scrollUnread.value = 0;
  showJumpButton.value = false;
}

function forwardWheelToMessages(event) {
  const scrollEl = messageContainer.value;
  if (!scrollEl) return;

  const composer = composerRef.value;
  if (
    composer &&
    event.target instanceof Node &&
    composer.contains(event.target)
  ) {
    const canScrollUp = composer.scrollTop > 0;
    const canScrollDown =
      composer.scrollTop + composer.clientHeight < composer.scrollHeight;

    if (
      (event.deltaY < 0 && canScrollUp) ||
      (event.deltaY > 0 && canScrollDown)
    ) {
      return;
    }
  }

  event.preventDefault();
  scrollEl.scrollTop += event.deltaY;
}

function resizeComposer() {
  const composer = composerRef.value;
  if (!composer) return;
  composer.style.height = "0px";
  const nextHeight = Math.min(composer.scrollHeight, 160);
  composer.style.height = `${nextHeight}px`;
  composer.style.overflowY = composer.scrollHeight > 160 ? "auto" : "hidden";
}

function formatMessage(text) {
  if (!text) return "";
  const escapes = [];
  const withPlaceholders = text.replace(/\\(.)/g, (_, char) => {
    const idx = escapes.length;
    escapes.push(
      char.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"),
    );
    return `\x00${idx}\x00`;
  });

  let result = withPlaceholders
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*\*(.+?)\*\*\*/gs, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/gs, "<strong>$1</strong>")
    .replace(/__(.+?)__/gs, "<u>$1</u>")
    .replace(/\*(.+?)\*/gs, "<em>$1</em>")
    .replace(/_([^_]+)_/gs, "<em>$1</em>")
    .replace(/~~(.+?)~~/gs, "<s>$1</s>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(
      /(https?:\/\/[^\s<]+?)([.,!?;:)"']*(?:\s|$))/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>$2',
    )
    .replace(/\x00(\d+)\x00/g, (_, idx) => escapes[parseInt(idx)]);

  return result;
}

function captureScrollAnchor(scrollEl) {
  if (!scrollEl) return null;

  const containerTop = scrollEl.getBoundingClientRect().top;
  const firstVisibleMessage = Array.from(
    scrollEl.querySelectorAll(".message[data-message-id]"),
  ).find((element) => element.getBoundingClientRect().bottom >= containerTop);

  if (!firstVisibleMessage) {
    return {
      offset: scrollEl.scrollTop,
      previousHeight: scrollEl.scrollHeight,
    };
  }

  return {
    id: firstVisibleMessage.dataset.messageId,
    offset: firstVisibleMessage.getBoundingClientRect().top - containerTop,
    previousHeight: scrollEl.scrollHeight,
  };
}

function restoreScrollAnchor(scrollEl) {
  if (!scrollEl || !pendingScrollAnchor) return false;

  const anchor = pendingScrollAnchor;
  pendingScrollAnchor = null;

  if (anchor.id) {
    const anchorEl = scrollEl.querySelector(
      `.message[data-message-id="${anchor.id}"]`,
    );
    if (anchorEl) {
      const containerTop = scrollEl.getBoundingClientRect().top;
      const currentOffset = anchorEl.getBoundingClientRect().top - containerTop;
      scrollEl.scrollTop += currentOffset - anchor.offset;
      return true;
    }
  }

  if (typeof anchor.previousHeight === "number") {
    scrollEl.scrollTop =
      scrollEl.scrollHeight - anchor.previousHeight + anchor.offset;
    return true;
  }

  return false;
}

function formatTimestamp(timestamp) {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function handleComposerKeydown(e) {
  if (e.key === "ArrowUp" && !newMessage.value.trim()) {
    e.preventDefault();
    const lastOwn = [...messages.value].reverse().find((m) => m.uid === props.user.uid);
    if (lastOwn) startEdit(lastOwn);
    return;
  }
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
    if (e.key === "b") {
      e.preventDefault();
      wrapSelection("**");
    } else if (e.key === "i") {
      e.preventDefault();
      wrapSelection("*");
    } else if (e.key === "u") {
      e.preventDefault();
      wrapSelection("__");
    }
  }
}

function wrapSelection(marker) {
  const textarea = composerRef.value;
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = newMessage.value.slice(start, end);
  const before = newMessage.value.slice(0, start);
  const after = newMessage.value.slice(end);
  newMessage.value = `${before}${marker}${selected}${marker}${after}`;
  nextTick(() => {
    if (selected) {
      textarea.setSelectionRange(start + marker.length, end + marker.length);
    } else {
      textarea.setSelectionRange(start + marker.length, start + marker.length);
    }
    textarea.focus();
  });
}

function sanitizeMessage(text) {
  const normalized = text.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");

  while (lines.length && lines[0].trim() === "") {
    lines.shift();
  }

  while (lines.length && lines[lines.length - 1].trim() === "") {
    lines.pop();
  }

  return lines.join("\n");
}

function handleVisibilityChange() {
  if (!document.hidden) {
    unreadCount = 0;
    document.title = "Node Chat";
    goOnline(db);
  }
}

onMounted(() => {
  document.title = "Node Chat";
});

function handleClickOutside(e) {
  if (menuRef.value && !menuRef.value.contains(e.target)) {
    showDropdown.value = false;
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

async function handleTyping() {
  if (!myTypingRef) return;
  set(myTypingRef, { displayName: props.user.displayName });
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => remove(myTypingRef), 2000);
}

function handleComposerInput() {
  resizeComposer();
  handleTyping();
}

function subscribeMessages() {
  if (messagesListener) messagesListener();
  const messagesRef = query(dbRef(db, "messages"), limitToLast(messageLimit));
  messagesListener = onValue(messagesRef, (snapshot) => {
    const scrollEl = messageContainer.value;
    const wasNearBottom = isNearBottom(scrollEl);
    const data = snapshot.val();
    const loaded = data
      ? Object.entries(data).map(([id, msg]) => ({ id, ...msg }))
      : [];
    const sorted = loaded.sort(
      (a, b) => (a.timestamp || 0) - (b.timestamp || 0),
    );

    hasMore.value = sorted.length === messageLimit && totalCount > messageLimit;

    if (!initialLoadDone) {
      sorted.forEach((msg) => knownIds.add(msg.id));
      initialLoadDone = true;
    } else {
      sorted.forEach((msg) => {
        if (!knownIds.has(msg.id)) {
          knownIds.add(msg.id);
          if (document.hidden) {
            unreadCount++;
            document.title = `(${unreadCount}) Node Chat`;
          }
          if (!isNearBottom(messageContainer.value)) {
            scrollUnread.value++;
          }
        }
      });
    }

    messages.value = sorted;

    nextTick(() => {
      const container = messageContainer.value;
      if (!container) return;

      if (restoreScrollAnchor(container)) {
        isLoadingMore.value = false;
        shouldScrollToBottom = false;
        if (!hasEmittedReady) {
          hasEmittedReady = true;
          emit("ready");
        }
        return;
      }

      const needsInitialScroll = !hasPositionedInitialScroll;
      if (needsInitialScroll || wasNearBottom || shouldScrollToBottom) {
        container.scrollTop = container.scrollHeight;
        hasPositionedInitialScroll = true;
      }

      shouldScrollToBottom = false;

      if (!hasEmittedReady) {
        hasEmittedReady = true;
        emit("ready");
      }
    });
  });
}

async function loadMore() {
  const scrollEl = messageContainer.value;
  if (!scrollEl || isLoadingMore.value) return;

  isLoadingMore.value = true;
  pendingScrollAnchor = captureScrollAnchor(scrollEl);
  messageLimit += MESSAGE_BATCH_SIZE;
  subscribeMessages();
}

onMounted(async () => {
  document.addEventListener("visibilitychange", handleVisibilityChange);
  document.addEventListener("click", handleClickOutside);
  messageContainer.value?.addEventListener("scroll", handleMessageScroll, {
    passive: true,
  });

  myTypingRef = dbRef(db, `typing/${props.user.uid}`);
  onDisconnect(myTypingRef).remove();

  myPresenceRef = dbRef(db, `presence/${props.user.uid}`);
  onDisconnect(myPresenceRef).remove();
  set(myPresenceRef, { displayName: props.user.displayName, uid: props.user.uid });
  onDisconnect(dbRef(db, `users/${props.user.uid}/lastSeen`)).set(serverTimestamp());

  usersListener = onValue(dbRef(db, "users"), (snap) => {
    allUsers.value = snap.exists() ? snap.val() : {};
  });

  presenceListener = onValue(dbRef(db, "presence"), (snap) => {
    if (!snap.exists()) { onlineUsers.value = []; return; }
    onlineUsers.value = Object.entries(snap.val())
      .map(([uid, data]) => ({ uid, displayName: data.displayName || "?" }))
      .sort((a, b) => {
        if (a.uid === props.user.uid) return -1;
        if (b.uid === props.user.uid) return 1;
        return a.displayName.localeCompare(b.displayName);
      });
  });

  isAdmin.value = await isUserAdmin(props.user.uid);

  const countSnap = await get(dbRef(db, "messages"));
  totalCount = countSnap.exists() ? Object.keys(countSnap.val()).length : 0;
  hasMore.value = totalCount > messageLimit;

  typingListener = onValue(dbRef(db, "typing"), (snapshot) => {
    const data = snapshot.val();
    if (!data) {
      typingUsers.value = [];
      return;
    }
    typingUsers.value = Object.entries(data)
      .filter(([uid]) => uid !== props.user.uid)
      .map(([, val]) => val.displayName);
  });

  subscribeMessages();
  nextTick(resizeComposer);
});

onUnmounted(() => {
  document.removeEventListener("visibilitychange", handleVisibilityChange);
  document.removeEventListener("click", handleClickOutside);
  messageContainer.value?.removeEventListener("scroll", handleMessageScroll);
  clearTimeout(typingTimeout);
  if (messagesListener) messagesListener();
  if (typingListener) typingListener();
  if (presenceListener) presenceListener();
  if (usersListener) usersListener();
  if (myTypingRef) remove(myTypingRef);
  if (myPresenceRef) remove(myPresenceRef);
});

function startEdit(msg) {
  editingId.value = msg.id;
  editText.value = msg.text;
  nextTick(() => {
    const el = document.querySelector(".edit-input");
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
    resizeEditInput(el);
  });
}

function cancelEdit() {
  editingId.value = null;
  editText.value = "";
}

function resizeEditInput(el) {
  if (!el) return;
  el.style.height = "0px";
  el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
}

async function saveEdit(id) {
  const text = sanitizeMessage(editText.value);
  if (!text.trim()) { cancelEdit(); return; }
  const original = messages.value.find((m) => m.id === id);
  if (original && sanitizeMessage(original.text) === text) { cancelEdit(); return; }
  editingId.value = null;
  editText.value = "";
  await update(dbRef(db, `messages/${id}`), {
    text,
    editedAt: serverTimestamp(),
  });
}

async function promptDelete(id) {
  const msg = messages.value.find((m) => m.id === id);
  if (msg?.uid === props.user.uid) {
    await remove(dbRef(db, `messages/${id}`));
    return;
  }
  deleteDialog.value = { show: true, id, name: msg?.displayName || "this message" };
}

function cancelDelete() {
  deleteDialog.value = { show: false, id: null, name: "" };
}

async function confirmDelete() {
  const id = deleteDialog.value.id;
  deleteDialog.value = { show: false, id: null, name: "" };
  await remove(dbRef(db, `messages/${id}`));
}

async function sendMessage() {
  const text = sanitizeMessage(newMessage.value);
  if (!text.trim()) return;
  if (text.length > 2000) return;
  newMessage.value = "";
  nextTick(resizeComposer);
  clearTimeout(typingTimeout);
  if (myTypingRef) remove(myTypingRef);
  totalCount++;
  shouldScrollToBottom = true;
  await push(dbRef(db, "messages"), {
    text,
    displayName: props.user.displayName,
    uid: props.user.uid,
    timestamp: serverTimestamp(),
  });
}

async function logout() {
  showDropdown.value = false;
  if (myTypingRef) await remove(myTypingRef);
  if (myPresenceRef) {
    await set(dbRef(db, `users/${props.user.uid}/lastSeen`), serverTimestamp());
    await remove(myPresenceRef);
  }
  await signOut(auth);
}
</script>

<style scoped>
.chat {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  width: 100%;
  overflow: hidden;
  min-height: 0;
  padding-bottom: env(safe-area-inset-bottom);
}

.chat-body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.chat-main {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  position: relative;
  overflow: hidden;
}

.header {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: 0 16px;
  height: 48px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  background: var(--surface);
}

.header-logo {
  width: 28px;
  height: 28px;
  object-fit: contain;
  border-radius: 7px;
  flex-shrink: 0;
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
  transition: background 0.15s;
}

.user-btn:hover {
  background: var(--surface-2);
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
  transition: opacity 160ms ease, transform 160ms cubic-bezier(0.16, 1, 0.3, 1);
}
.dropdown-fade-leave-active {
  transition: opacity 120ms ease, transform 120ms ease;
}
.dropdown-fade-enter-from {
  opacity: 0;
  transform: translateY(-8px) scale(0.96);
}
.dropdown-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
}

.dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  min-width: 240px;
  width: auto;
  max-width: calc(100vw - 32px);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 6px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.13), 0 1px 4px rgba(0,0,0,0.06);
  z-index: 100;
}

.dropdown-profile {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 10px 10px 10px 10px;
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
  transition: background 0.15s;
}

.dropdown-item:hover {
  background: var(--surface-2);
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

.messages {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior-y: contain;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.load-more {
  align-self: stretch;
  width: 100%;
  background: rgba(44, 42, 39, 0.07);
  border: 1px solid #b2aba2;
  border-radius: 8px;
  padding: 10px 16px;
  font-size: 15px;
  font-family: "Satoshi", sans-serif;
  font-weight: 600;
  color: var(--text);
  cursor: pointer;
  margin-bottom: 12px;
  transition:
    background 0.15s,
    border-color 0.15s,
    color 0.15s;
  text-align: center;
}

.load-more:hover {
  background: rgba(44, 42, 39, 0.12);
  border-color: #9d958c;
  color: var(--text);
}

.load-more:disabled {
  opacity: 0.72;
  cursor: progress;
}

.date-separator {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 16px 0 10px;
  color: var(--text-muted);
}

.date-separator::before,
.date-separator::after {
  content: "";
  flex: 1;
  height: 1px;
  background: var(--border);
}

.date-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  white-space: nowrap;
  letter-spacing: 0.3px;
}

.jump-to-bottom {
  position: absolute;
  bottom: 88px;
  right: 20px;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: var(--text);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.22), 0 1px 4px rgba(0, 0, 0, 0.1);
  color: var(--surface);
  transition: transform 0.15s, box-shadow 0.15s;
  z-index: 20;
}

.jump-to-bottom:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.26), 0 2px 6px rgba(0, 0, 0, 0.1);
}

.jump-unread {
  position: absolute;
  top: -8px;
  right: -8px;
  background: var(--surface);
  color: var(--text);
  font-size: 10px;
  font-weight: 700;
  font-family: "Satoshi", sans-serif;
  border-radius: 999px;
  min-width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  line-height: 1;
  pointer-events: none;
  border: 1.5px solid var(--border);
  box-shadow: 0 1px 4px rgba(0,0,0,0.14);
}

.jump-fade-enter-active {
  transition: opacity 0.18s ease, transform 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}
.jump-fade-leave-active {
  transition: opacity 0.14s ease, transform 0.14s ease;
}
.jump-fade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.jump-fade-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

.message {
  font-size: 15px;
  line-height: 1.55;
  padding: 1px 16px;
  margin: 0 -16px;
  border-radius: 4px;
  position: relative;
}

.message--start {
  margin-top: 10px;
}

.message:first-child,
.message--start:first-child {
  margin-top: 0;
}

.message:hover {
  background: rgba(44, 42, 39, 0.05);
}

.message--editing {
  background: rgba(90, 90, 240, 0.04);
}

.msg-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 2px;
}

.msg-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
  line-height: 1.4;
}

.msg-time {
  font-size: 11px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.msg-body {
  min-width: 0;
}

.msg-actions {
  position: absolute;
  top: 0;
  transform: translateY(-50%);
  right: 8px;
  display: flex;
  gap: 1px;
  align-items: center;
  opacity: 0;
  pointer-events: none;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 2px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 10;
}

.message:hover .msg-actions {
  opacity: 1;
  pointer-events: all;
}

.msg-action-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  width: 24px;
  height: 24px;
  padding: 0;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition:
    background 0.12s,
    color 0.12s;
}

.msg-action-btn svg {
  transition: transform 0.1s ease;
}

.msg-action-btn:hover svg {
  transform: scale(1.1);
}

.msg-action-btn:hover {
  background: var(--surface-2);
  color: var(--text);
}

.msg-action-btn.danger:hover {
  background: rgba(192, 57, 43, 0.1);
  color: var(--danger);
}

.msg-action-btn.danger-active {
  background: rgba(192, 57, 43, 0.12);
  color: var(--danger);
}

.delete-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 500;
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
}

.delete-box {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
  width: 100%;
  max-width: 360px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}

.delete-box h3 {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
  margin: 0 0 8px 0;
}

.delete-box p {
  font-size: 14px;
  color: var(--text-muted);
  margin: 0 0 20px 0;
  line-height: 1.5;
}

.delete-actions {
  display: flex;
  gap: 10px;
}

.del-cancel-btn,
.del-confirm-btn {
  flex: 1;
  border: none;
  border-radius: var(--radius);
  padding: 10px;
  font-size: 14px;
  font-weight: 600;
  font-family: "Satoshi", sans-serif;
  cursor: pointer;
  transition: opacity 0.15s;
}

.del-cancel-btn {
  background: var(--surface-2);
  color: var(--text);
}

.del-cancel-btn:hover {
  opacity: 0.8;
}

.del-confirm-btn {
  background: var(--danger);
  color: #fff;
}

.del-confirm-btn:hover {
  opacity: 0.85;
}

.edited-label {
  font-size: 10px;
  color: var(--text-muted);
  margin-left: 3px;
}

.edit-area {
  min-width: 0;
  padding: 3px 0;
}

.edit-input {
  width: 100%;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 8px 10px;
  color: var(--text);
  font-size: 15px;
  font-family: "Satoshi", sans-serif;
  outline: none;
  resize: none;
  min-height: 36px;
  overflow-y: hidden;
  line-height: 1.4;
  transition: border-color 0.15s;
}

.edit-input:focus {
  border-color: var(--accent);
}

.text {
  color: var(--text);
  white-space: pre-wrap;
  word-break: break-word;
  min-width: 0;
}

.text :deep(a) {
  color: var(--text);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.text :deep(a):hover {
  color: #706d68;
}

.text :deep(code) {
  font-family: ui-monospace, Consolas, monospace;
  font-size: 13px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 3px;
  padding: 1px 5px;
}

.typing-area {
  height: 22px;
  padding: 0 20px;
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.typing-indicator {
  display: flex;
  align-items: center;
  gap: 7px;
}

.dots {
  display: flex;
  align-items: center;
  gap: 3px;
}

.dots span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--border);
  display: inline-block;
  animation: pulse 1.2s infinite ease-in-out;
}

.dots span:nth-child(1) {
  animation-delay: 0s;
}
.dots span:nth-child(2) {
  animation-delay: 0.2s;
}
.dots span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes pulse {
  0%,
  60%,
  100% {
    background: var(--border);
    transform: scale(1);
  }
  30% {
    background: var(--text-muted);
    transform: scale(1.3);
  }
}

.typing-names {
  font-size: 12px;
  color: var(--text-muted);
}

.input-row {
  display: flex;
  align-items: center;
  margin: 0 16px 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 10px 12px;
  gap: 8px;
  flex-shrink: 0;
}

.input-row:focus-within {
  border-color: var(--accent);
}

textarea {
  flex: 1;
  display: block;
  border: none;
  outline: none;
  font-size: 16px;
  font-family: "Satoshi", sans-serif;
  background: transparent;
  color: var(--text);
  padding: 0;
  line-height: 1.4;
  resize: none;
  min-height: 22px;
  max-height: 160px;
  overflow-y: hidden;
  scrollbar-width: thin;
  margin: 0;
}

textarea::placeholder {
  color: var(--text-muted);
}

.char-warning {
  font-size: 11px;
  color: var(--danger);
  flex-shrink: 0;
  align-self: flex-end;
  padding-bottom: 2px;
}

.send-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  padding: 4px;
  transition: color 0.2s;
  flex-shrink: 0;
}

.send-btn:hover {
  color: var(--text);
}

.send-btn:disabled {
  cursor: default;
  color: var(--text-muted);
  opacity: 0.6;
}

.send-btn:disabled:hover {
  color: var(--text-muted);
}

.online-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 5px 11px 5px 9px;
  cursor: pointer;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
  font-family: "Satoshi", sans-serif;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
  flex-shrink: 0;
  justify-self: end;
}

.online-btn:hover,
.online-btn.active {
  border-color: rgba(44, 42, 39, 0.3);
  color: var(--text);
  background: var(--bg);
}

.online-btn-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #22c55e;
  flex-shrink: 0;
  box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.25);
}

.online-btn-count {
  letter-spacing: 0.1px;
}

.online-panel {
  width: 216px;
  flex-shrink: 0;
  background: var(--surface);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.online-panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 18px 14px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.online-panel-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #22c55e;
  flex-shrink: 0;
  animation: presencePulse 2.4s ease-in-out infinite;
}

@keyframes presencePulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
  50% { box-shadow: 0 0 0 5px rgba(34, 197, 94, 0); }
}

.online-panel-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--text-muted);
  flex: 1;
}

.online-panel-count {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 1px 7px;
  min-width: 22px;
  text-align: center;
}

.online-panel-list {
  flex: 1;
  overflow-y: auto;
  padding: 10px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.online-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 8px;
  border-radius: 8px;
  transition: background 0.12s;
  animation: itemIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes itemIn {
  from { opacity: 0; transform: translateX(10px); }
  to   { opacity: 1; transform: translateX(0); }
}

.online-item:hover {
  background: var(--bg);
}

.online-item--you {
  background: var(--bg);
}

.online-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
  position: relative;
  letter-spacing: 0.3px;
}

.online-avatar-dot {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #22c55e;
  border: 2px solid var(--surface);
}

.online-item--you .online-avatar-dot {
  border-color: var(--bg);
}

.online-item-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.panel-section-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
  padding: 10px 8px 4px;
}

.offline-item {
  opacity: 0.6;
  animation: none;
}

.offline-item:hover {
  opacity: 0.85;
}

.offline-avatar {
  filter: grayscale(0.45);
}

.offline-item-body {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1;
}

.offline-name {
  flex: unset;
  font-size: 13px;
}

.lastseen-text {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 500;
}

.online-you-tag {
  font-size: 10px;
  font-weight: 600;
  line-height: 1;
  color: var(--text-muted);
  background: var(--border);
  border-radius: 999px;
  padding: 3px 7px 2px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
}

.panel-slide-enter-active {
  transition: width 0.26s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease;
  overflow: hidden;
}
.panel-slide-leave-active {
  transition: width 0.22s ease-in, opacity 0.18s ease-in;
  overflow: hidden;
}
.panel-slide-enter-from,
.panel-slide-leave-to {
  width: 0;
  opacity: 0;
}
</style>
