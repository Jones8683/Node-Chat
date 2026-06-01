<template>
  <aside class="sidebar">
    <div class="sidebar-section">
      <div class="sidebar-section-head">
        <span class="sidebar-section-label">Channels</span>
      </div>
      <button
        type="button"
        class="sidebar-row"
        :class="{ active: selection.kind === 'channel' }"
        @click="$emit('select', { kind: 'channel' })"
      >
        <img
          src="/favicon.png"
          class="channel-logo"
          alt=""
          aria-hidden="true"
        />
        <span class="sidebar-row-name">Node Central</span>
        <span
          v-if="channelUnread > 0"
          class="unread-dot"
          aria-label="Unread"
        ></span>
      </button>
    </div>

    <div class="sidebar-section">
      <div class="sidebar-section-head">
        <span class="sidebar-section-label">Direct Messages</span>
        <button
          type="button"
          class="sidebar-add-btn"
          title="New direct message"
          aria-label="New direct message"
          @click="$emit('open-new-dm')"
        >
          <Plus :size="14" stroke-width="2.4" />
        </button>
      </div>
      <div v-if="!dmRows.length" class="sidebar-empty">
        No conversations yet
      </div>
      <button
        v-for="row in dmRows"
        :key="row.threadId"
        type="button"
        class="sidebar-row"
        :class="{ active: isRowActive(row) }"
        @click="
          $emit('select', {
            kind: 'dm',
            threadId: row.threadId,
            partnerUid: row.partnerUid,
          })
        "
      >
        <div class="dm-avatar-wrap">
          <div
            class="dm-avatar"
            :style="
              getAvatarStyle(
                row.displayName,
                row.partnerUid,
                row.avatarColor,
                ownerUid,
              )
            "
          >
            {{ getAvatarInitial(row.displayName, row.partnerUid, ownerUid) }}
          </div>
          <span v-if="row.isOnline" class="dm-presence-dot"></span>
        </div>
        <div class="dm-text">
          <div class="dm-name">{{ row.displayName }}</div>
          <div class="dm-preview">{{ row.preview }}</div>
        </div>
        <span v-if="row.unread" class="unread-dot" aria-label="Unread"></span>
      </button>
    </div>
  </aside>
</template>

<script setup>
import { computed } from "vue";
import { Plus } from "lucide-vue-next";
import { getAvatarInitial, getAvatarStyle } from "../avatar";
import { userIsOnline } from "../presence";
import { dmPreviewText } from "../dmUtils";

const props = defineProps({
  user: { type: Object, required: true },
  selection: { type: Object, required: true },
  ownerUid: { type: String, default: null },
  allUsers: { type: Object, default: () => ({}) },
  presenceUsers: { type: Object, default: () => ({}) },
  dmIndex: { type: Object, default: () => ({}) },
  channelUnread: { type: Number, default: 0 },
});

defineEmits(["select", "open-new-dm"]);

const dmRows = computed(() => {
  const entries = props.dmIndex || {};
  const rows = [];
  for (const [threadId, entry] of Object.entries(entries)) {
    if (!entry) continue;
    const partnerUid = entry.partnerUid;
    if (!partnerUid) continue;
    const userData = props.allUsers[partnerUid] || {};
    const profile = props.presenceUsers[partnerUid]?.profile || {};
    const displayName =
      userData.displayName || profile.displayName || "Unknown";
    const avatarColor =
      userData.preferences?.avatarColor || profile.avatarColor || null;
    const last = Number(entry.lastMessageAt || 0);
    const read = Number(entry.lastReadAt || 0);
    const unread =
      last > read &&
      entry.lastMessageFromUid &&
      entry.lastMessageFromUid !== props.user.uid;
    const isOnline = userIsOnline(props.presenceUsers[partnerUid]);
    rows.push({
      threadId,
      partnerUid,
      displayName,
      avatarColor,
      preview: dmPreviewText(entry),
      unread,
      isOnline,
      lastMessageAt: last,
    });
  }
  rows.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
  return rows;
});

function isRowActive(row) {
  return (
    props.selection.kind === "dm" && props.selection.threadId === row.threadId
  );
}
</script>

<style scoped>
.sidebar {
  width: var(--sidebar-width, 232px);
  flex-shrink: 0;
  background: var(--surface);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 4px 8px calc(16px + env(safe-area-inset-bottom));
  gap: 6px;
}

.sidebar-section {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 6px;
}

.sidebar-section:first-child {
  margin-top: 0;
}

.sidebar-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px 4px;
}

.sidebar-section-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}

.sidebar-add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition:
    background 140ms ease,
    color 140ms ease,
    transform 140ms var(--ease-out-quint);
}

.sidebar-add-btn:hover {
  background: var(--surface-2);
  color: var(--text);
}

.sidebar-add-btn:active {
  transform: scale(0.92);
}

.sidebar-empty {
  font-size: 12px;
  color: var(--text-muted);
  padding: 6px 10px;
}

.sidebar-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  border: none;
  background: transparent;
  border-radius: 8px;
  padding: 6px 8px;
  cursor: pointer;
  color: var(--text);
  font-family: "Satoshi", sans-serif;
  font-size: 14px;
  text-align: left;
  transition:
    background 140ms ease,
    color 140ms ease;
  min-height: 38px;
}

.sidebar-row::before {
  content: "";
  position: absolute;
  left: -8px;
  top: 50%;
  width: 3px;
  height: 0;
  border-radius: 0 3px 3px 0;
  background: var(--accent);
  transform: translateY(-50%);
  transition:
    height 180ms var(--ease-out-quint),
    opacity 140ms ease;
  opacity: 0;
}

.sidebar-row:hover {
  background: var(--surface-2);
}

.sidebar-row.active {
  background: rgba(90, 90, 240, 0.14);
}

.sidebar-row.active:hover {
  background: rgba(90, 90, 240, 0.18);
}

.sidebar-row.active::before {
  height: 22px;
  opacity: 1;
}

.sidebar-row.active .sidebar-row-name,
.sidebar-row.active .dm-name {
  color: var(--text);
  font-weight: 700;
}

.channel-logo {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  object-fit: contain;
  flex-shrink: 0;
  -webkit-user-drag: none;
  user-select: none;
  -webkit-user-select: none;
  pointer-events: none;
}

.sidebar-row-name {
  flex: 1;
  font-weight: 600;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dm-avatar-wrap {
  position: relative;
  flex-shrink: 0;
}

.dm-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  letter-spacing: 0;
}

.dm-presence-dot {
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

.dm-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.dm-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
}

.dm-preview {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
}

.unread-dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
}

@media (max-width: 640px) {
  .sidebar {
    width: 100%;
    padding: 8px 10px calc(20px + env(safe-area-inset-bottom));
    gap: 8px;
  }

  .sidebar-section {
    margin-top: 8px;
  }

  .sidebar-section-head {
    padding: 8px 10px 6px;
  }

  .sidebar-row {
    min-height: 44px;
    padding: 8px 10px;
    border-radius: 10px;
  }

  .sidebar-row::before {
    left: -10px;
  }

  .channel-logo,
  .dm-avatar {
    width: 32px;
    height: 32px;
  }

  .sidebar-row,
  .sidebar-add-btn {
    touch-action: manipulation;
  }
}
</style>
