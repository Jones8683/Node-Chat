<template>
  <transition name="modal-fade" appear>
    <div v-if="isOpen" class="modal-overlay" @click="closeIfClickedOutside">
      <div class="modal-container" role="dialog" aria-modal="true">
        <div class="modal-header">
          <div>
            <h2 class="modal-title">New Direct Message</h2>
            <p class="modal-subtitle">Start a conversation with another member</p>
          </div>
          <button type="button" class="modal-close" @click="close">
            <X :size="20" stroke-width="2" />
          </button>
        </div>

        <div class="search-row">
          <div class="user-search">
            <Search :size="14" stroke-width="2.25" class="user-search-icon" />
            <input
              ref="inputRef"
              v-model="searchQuery"
              type="text"
              class="user-search-input"
              placeholder="Search members"
              autocomplete="off"
              spellcheck="false"
              @keydown="handleKeydown"
            />
            <button
              v-if="searchQuery"
              type="button"
              class="user-search-clear"
              @click="searchQuery = ''"
              title="Clear search"
              aria-label="Clear search"
            >
              <X :size="12" stroke-width="2.5" />
            </button>
          </div>
        </div>

        <div class="modal-content">
          <div v-if="!filtered.length" class="empty">
            {{ searchQuery ? `No users match "${searchQuery}"` : "No other members yet" }}
          </div>
          <button
            v-for="(row, i) in filtered"
            :key="row.uid"
            type="button"
            class="member-row"
            :class="{ active: i === activeIndex }"
            @mouseenter="activeIndex = i"
            @click="select(row)"
          >
            <div class="member-avatar-wrap">
              <div
                class="member-avatar"
                :style="
                  getAvatarStyle(row.displayName, row.uid, row.avatarColor, ownerUid)
                "
              >
                {{ getAvatarInitial(row.displayName, row.uid, ownerUid) }}
              </div>
              <span v-if="row.isOnline" class="member-presence-dot"></span>
            </div>
            <div class="member-text">
              <div class="member-name">{{ row.displayName }}</div>
              <div class="member-sub">
                {{ row.isOnline ? "Online" : "Offline" }}
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import { X, Search } from "lucide-vue-next";
import { getAvatarInitial, getAvatarStyle } from "../avatar";
import { userIsOnline } from "../presence";

const props = defineProps({
  isOpen: Boolean,
  user: { type: Object, required: true },
  allUsers: { type: Object, default: () => ({}) },
  presenceUsers: { type: Object, default: () => ({}) },
  ownerUid: { type: String, default: null },
});
const emit = defineEmits(["close", "start-dm"]);

const searchQuery = ref("");
const activeIndex = ref(0);
const inputRef = ref(null);

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .trim();
}

const candidates = computed(() => {
  const result = [];
  for (const [uid, data] of Object.entries(props.allUsers || {})) {
    if (uid === props.user.uid) continue;
    if (!data?.displayName) continue;
    const presence = props.presenceUsers[uid];
    const profile = presence?.profile || {};
    result.push({
      uid,
      displayName: data.displayName || profile.displayName || "Unknown",
      avatarColor:
        data.preferences?.avatarColor || profile.avatarColor || null,
      isOnline: userIsOnline(presence),
    });
  }
  result.sort((a, b) => {
    if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
    return (a.displayName || "").localeCompare(b.displayName || "");
  });
  return result;
});

const filtered = computed(() => {
  const q = normalize(searchQuery.value);
  if (!q) return candidates.value;
  return candidates.value.filter((c) =>
    normalize(c.displayName).includes(q),
  );
});

watch(filtered, () => {
  activeIndex.value = 0;
});

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      searchQuery.value = "";
      activeIndex.value = 0;
      nextTick(() => {
        inputRef.value?.focus();
      });
    }
  },
);

function close() {
  emit("close");
}

function closeIfClickedOutside(e) {
  if (e.target === e.currentTarget) close();
}

function select(row) {
  emit("start-dm", { uid: row.uid });
}

function handleKeydown(e) {
  if (!filtered.value.length) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
    return;
  }
  if (e.key === "ArrowDown") {
    e.preventDefault();
    activeIndex.value = (activeIndex.value + 1) % filtered.value.length;
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    activeIndex.value =
      (activeIndex.value - 1 + filtered.value.length) % filtered.value.length;
  } else if (e.key === "Enter") {
    e.preventDefault();
    const row = filtered.value[activeIndex.value];
    if (row) select(row);
  } else if (e.key === "Escape") {
    e.preventDefault();
    close();
  }
}

function onGlobalKeydown(e) {
  if (!props.isOpen) return;
  if (e.key === "Escape") {
    e.preventDefault();
    close();
  }
}

onMounted(() => window.addEventListener("keydown", onGlobalKeydown));
onUnmounted(() => window.removeEventListener("keydown", onGlobalKeydown));
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
  max-width: 460px;
  height: 560px;
  max-height: calc(100vh - 40px);
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
  padding: 22px 24px 16px;
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
.search-input:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(90, 90, 240, 0.18);
}

.search-row {
  padding: 14px 18px 4px;
  flex-shrink: 0;
}

.user-search {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--surface-2);
  border: 1px solid rgba(44, 42, 39, 0.08);
  border-radius: 999px;
  padding: 8px 12px 8px 14px;
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

.modal-content {
  flex: 1;
  overflow-y: auto;
  padding: 6px 10px 14px;
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

.empty {
  padding: 32px 16px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}

.member-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  border: none;
  background: transparent;
  border-radius: 10px;
  padding: 8px 10px;
  cursor: pointer;
  color: var(--text);
  font-family: "Satoshi", sans-serif;
  text-align: left;
  transition: background 140ms ease;
}

.member-row:hover,
.member-row.active {
  background: var(--surface-2);
}

.member-avatar-wrap {
  position: relative;
  flex-shrink: 0;
}

.member-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.member-presence-dot {
  position: absolute;
  bottom: -1px;
  right: -1px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #3ba55c;
  border: 2px solid var(--surface);
  box-sizing: content-box;
}

.member-text {
  flex: 1;
  min-width: 0;
}

.member-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.member-sub {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.3;
}
</style>
