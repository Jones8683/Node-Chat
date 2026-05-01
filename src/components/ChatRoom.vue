<template>
  <div class="chat">
    <div class="header" @wheel="forwardWheelToMessages">
      <div class="user-menu" ref="menuRef">
        <button class="user-btn" @click="showDropdown = !showDropdown">
          <div class="avatar">{{ user.displayName[0].toUpperCase() }}</div>
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
        <div class="dropdown" v-if="showDropdown">
          <div class="dropdown-profile">
            <div class="avatar large">
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
          <button v-if="isAdmin" class="dropdown-item" @click="openAdmin">
            <ShieldCheck :size="14" stroke-width="2" />
            Admin
          </button>
          <div class="divider"></div>
          <button class="dropdown-item danger" @click="logout">
            <LogOut :size="14" stroke-width="2" />
            Sign Out
          </button>
        </div>
      </div>
      <div class="header-title">Node Chat</div>
    </div>

    <div class="messages" ref="messageContainer" @scroll="handleMessageScroll">
      <button
        class="load-more"
        v-if="hasMore"
        @click="loadMore"
        :disabled="isLoadingMore"
      >
        {{ isLoadingMore ? "Loading..." : "Load previous messages" }}
      </button>
      <div
        class="message"
        v-for="msg in messages"
        :key="msg.id"
        :data-message-id="msg.id"
      >
        <span class="name">{{ msg.displayName }}:</span>
        <span class="text" v-html="formatMessage(msg.text)"></span>
        <span class="timestamp">{{ formatTimestamp(msg.timestamp) }}</span>
      </div>
    </div>

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
        @keydown.enter.exact.prevent="sendMessage"
        @keydown="handleComposerKeydown"
        @input="handleComposerInput"
        placeholder="Type a message..."
      ></textarea>
      <span class="char-warning" v-if="newMessage.length > 1800">{{
        2000 - newMessage.length
      }}</span>
      <button
        @click="sendMessage"
        class="send-btn"
        :disabled="!newMessage.trim()"
      >
        <Send :size="15" stroke-width="2" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from "vue";
import { auth, db } from "../firebase";
import { signOut } from "firebase/auth";
import { ShieldCheck, User, LogOut, Send } from "lucide-vue-next";
import {
  ref as dbRef,
  push,
  query,
  limitToLast,
  onValue,
  serverTimestamp,
  set,
  remove,
  onDisconnect,
  goOnline,
  get,
} from "firebase/database";
import { isUserAdmin } from "../authUtils";

const props = defineProps(["user"]);
const emit = defineEmits(["ready", "open-settings", "open-admin"]);
const messages = ref([]);
const newMessage = ref("");
const menuRef = ref(null);
const messageContainer = ref(null);
const composerRef = ref(null);
const showDropdown = ref(false);
const typingUsers = ref([]);
const hasMore = ref(false);
const isAdmin = ref(false);
const isLoadingMore = ref(false);
const MESSAGE_BATCH_SIZE = 100;
const SCROLL_BOTTOM_THRESHOLD = 24;
let messageLimit = MESSAGE_BATCH_SIZE;
let totalCount = 0;
let unreadCount = 0;
let initialLoadDone = false;
let hasPositionedInitialScroll = false;
let knownIds = new Set();
let typingTimeout = null;
let myTypingRef = null;
let messagesListener = null;
let typingListener = null;
let pendingScrollAnchor = null;
let shouldScrollToBottom = false;
let hasEmittedReady = false;

function isNearBottom(scrollEl) {
  if (!scrollEl) return true;
  return (
    scrollEl.scrollHeight - scrollEl.clientHeight - scrollEl.scrollTop <=
    SCROLL_BOTTOM_THRESHOLD
  );
}

function handleMessageScroll() {
  if (!messageContainer.value || isLoadingMore.value) return;
  shouldScrollToBottom = isNearBottom(messageContainer.value);
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

  isAdmin.value = await isUserAdmin(props.user.uid);

  isLoadingMore.value = true;
  pendingScrollAnchor = captureScrollAnchor(scrollEl);
  messageLimit += MESSAGE_BATCH_SIZE;
  subscribeMessages();
}

onMounted(async () => {
  document.addEventListener("visibilitychange", handleVisibilityChange);
  document.addEventListener("click", handleClickOutside);

  myTypingRef = dbRef(db, `typing/${props.user.uid}`);
  onDisconnect(myTypingRef).remove();

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
  clearTimeout(typingTimeout);
  if (messagesListener) messagesListener();
  if (typingListener) typingListener();
  if (myTypingRef) remove(myTypingRef);
});

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
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  height: 48px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  background: var(--surface);
}

.header-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: 0.5px;
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
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--text-muted);
  color: var(--surface);
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.avatar.large {
  width: 36px;
  height: 36px;
  font-size: 15px;
}

.chevron {
  color: var(--text-muted);
  transition: transform 0.2s;
}

.chevron.open {
  transform: rotate(180deg);
}

.dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  min-width: 220px;
  width: auto;
  max-width: calc(100vw - 32px);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
  z-index: 100;
}

.dropdown-profile {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
}

.dropdown-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.dropdown-name {
  font-size: 13px;
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
  scrollbar-gutter: stable;
}

.messages::-webkit-scrollbar {
  width: 4px;
}

.messages::-webkit-scrollbar-track {
  background: transparent;
}

.messages::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 4px;
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

.message {
  font-size: 15px;
  line-height: 1.55;
  padding: 2px 6px;
  margin: 0 -6px;
  border-radius: 4px;
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr) max-content;
  gap: 6px;
  align-items: baseline;
}

.message:hover {
  background: rgba(44, 42, 39, 0.08);
}

.name {
  font-weight: 700;
  color: var(--text);
  flex-shrink: 0;
  align-self: baseline;
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

.timestamp {
  font-size: 11px;
  color: var(--text-muted);
  flex-shrink: 0;
  justify-self: end;
  align-self: baseline;
  text-align: right;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
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
  border-color: #aaa;
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
</style>
