<template>
  <div class="chat" :class="{ 'picker-locked': reactionPickerVisible }">
    <div class="chat-body">
      <div class="chat-main">
        <div class="messages-wrap">
          <div class="messages" ref="messageContainer">
            <div v-if="showDmIntro" class="dm-intro">
              <div
                class="dm-intro-avatar"
                :style="
                  getAvatarStyle(
                    partner.displayName,
                    partner.uid,
                    partner.avatarColor,
                    ownerUid,
                  )
                "
              >
                {{
                  getAvatarInitial(partner.displayName, partner.uid, ownerUid)
                }}
              </div>
              <div class="dm-intro-name">{{ partner.displayName }}</div>
              <div class="dm-intro-text">
                This is the beginning of your message history with
                <strong>{{ partner.displayName }}</strong
                >.
              </div>
            </div>
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
                :class="{
                  'message--editing': editingId === item.id,
                  'message--start': item.isGroupStart,
                  'message--ping': isMessagePing(item),
                  'message--highlighted': highlightedMessageId === item.id,
                  'message--picker-active': reactionPickerMessageId === item.id,
                  'message--touch-active': touchActiveMessageId === item.id,
                }"
                @touchstart.passive="handleMessageTouchStart(item.id, $event)"
                @touchmove.passive="handleMessageTouchMove"
                @touchend.passive="handleMessageTouchEnd"
                @touchcancel.passive="handleMessageTouchEnd"
              >
                <div
                  v-if="item.replyTo"
                  class="reply-row"
                  @click.stop="jumpToMessage(item.replyTo.id)"
                >
                  <div class="reply-connector-cell">
                    <div class="reply-connector"></div>
                  </div>
                  <div class="reply-content">
                    <template v-if="item.replyTo.deleted">
                      <em class="reply-text reply-text--deleted"
                        >Original message was deleted</em
                      >
                    </template>
                    <template v-else>
                      <div
                        class="reply-avatar-small"
                        :style="
                          getAvatarStyle(
                            resolveDisplayName(
                              item.replyTo.uid,
                              item.replyTo.displayName,
                            ),
                            item.replyTo.uid,
                            item.replyTo.avatarColor,
                          )
                        "
                      >
                        {{
                          getAvatarInitial(
                            resolveDisplayName(
                              item.replyTo.uid,
                              item.replyTo.displayName,
                            ),
                            item.replyTo.uid,
                          )
                        }}
                      </div>
                      <span
                        class="reply-name"
                        :style="{
                          color: getAvatarColor(
                            resolveDisplayName(
                              item.replyTo.uid,
                              item.replyTo.displayName,
                            ),
                            item.replyTo.uid,
                            item.replyTo.avatarColor,
                          ),
                        }"
                        >{{
                          resolveDisplayName(
                            item.replyTo.uid,
                            item.replyTo.displayName,
                          )
                        }}</span
                      >
                      <span
                        class="reply-text"
                        v-html="formatReplyPreview(item.replyTo)"
                      ></span>
                    </template>
                  </div>
                </div>

                <div class="msg-row">
                  <div class="msg-left">
                    <div
                      v-if="item.isGroupStart"
                      class="msg-avatar"
                      :style="
                        getAvatarStyle(
                          resolveDisplayName(item.uid, item.displayName),
                          item.uid,
                          item.avatarColor,
                        )
                      "
                    >
                      {{
                        getAvatarInitial(
                          resolveDisplayName(item.uid, item.displayName),
                          item.uid,
                        )
                      }}
                    </div>
                    <span v-else-if="showTimestamps" class="msg-side-time">{{
                      formatTimestampShort(item.timestamp)
                    }}</span>
                  </div>

                  <div class="msg-right">
                    <div v-if="item.isGroupStart" class="msg-header">
                      <span
                        class="msg-name"
                        :style="{
                          color: getAvatarColor(
                            resolveDisplayName(item.uid, item.displayName),
                            item.uid,
                            item.avatarColor,
                          ),
                        }"
                        >{{
                          resolveDisplayName(item.uid, item.displayName)
                        }}</span
                      >
                      <span v-if="showTimestamps" class="msg-time">{{
                        formatTimestamp(item.timestamp)
                      }}</span>
                    </div>

                    <template v-if="editingId === item.id">
                      <div class="edit-area">
                        <MessageComposer
                          class="edit-input"
                          ref="editInputRef"
                          v-model="editText"
                          :max-length="10000"
                          aria-label="Edit message"
                          :resolve-mention="resolveMentionFromText"
                          @submit="saveEdit(item.id)"
                          @keydown="handleEditKeydown($event, item.id)"
                          @input="handleEditInput($event, item.id)"
                          @blur="closeMentionPicker"
                        />
                        <transition name="mention-fade">
                          <div
                            v-if="
                              !isDm &&
                              mentionVisible &&
                              activeMentionTarget === `edit:${item.id}` &&
                              mentionResults.length
                            "
                            class="mention-autocomplete mention-autocomplete--edit"
                            :class="{
                              'picker--keyboard': pickerKeyboardActive,
                            }"
                            ref="mentionPickerRef"
                            @mousemove="pickerKeyboardActive = false"
                          >
                            <div
                              v-for="(mentionUser, i) in mentionResults"
                              :key="mentionUser.uid"
                              class="mention-item"
                              :class="{
                                active: i === mentionActiveIndex,
                                'mention-item--everyone':
                                  mentionUser.isEveryone,
                              }"
                              @mouseenter="mentionActiveIndex = i"
                              @mousedown.prevent="insertMention(mentionUser)"
                            >
                              <div
                                v-if="mentionUser.isEveryone"
                                class="mention-avatar mention-avatar--everyone"
                              >
                                @
                              </div>
                              <div
                                v-else
                                class="mention-avatar"
                                :style="
                                  getAvatarStyle(
                                    mentionUser.displayName,
                                    mentionUser.uid,
                                    mentionUser.avatarColor,
                                  )
                                "
                              >
                                {{
                                  getAvatarInitial(
                                    mentionUser.displayName,
                                    mentionUser.uid,
                                  )
                                }}
                              </div>
                              <span class="mention-name">{{
                                mentionUser.displayName
                              }}</span>
                            </div>
                          </div>
                        </transition>
                      </div>
                    </template>

                    <template v-else>
                      <div
                        v-if="item.type === 'poll'"
                        class="msg-body msg-body--poll"
                      >
                        <div
                          class="poll-card"
                          :class="{ 'poll-card--closed': isPollClosed(item) }"
                        >
                          <div class="poll-card-header">
                            <span class="poll-card-eyebrow">
                              <ChartBarBig :size="12" stroke-width="2.4" />
                              {{ isPollClosed(item) ? "Poll ended" : "Poll" }}
                            </span>
                            <span
                              v-if="item.pollMulti"
                              class="poll-card-tag"
                              title="Multiple answers allowed"
                              >Multiple choice</span
                            >
                          </div>
                          <h4 class="poll-question">{{ item.pollQuestion }}</h4>
                          <div class="poll-options">
                            <button
                              v-for="opt in getPollOptions(item)"
                              :key="opt.key"
                              type="button"
                              class="poll-option"
                              :class="{
                                'poll-option--voted': opt.iVoted,
                                'poll-option--leading':
                                  opt.isLeading && pollTotalVotes(item) > 0,
                                'poll-option--closed': isPollClosed(item),
                              }"
                              :disabled="
                                isPollClosed(item) ||
                                isMuted ||
                                (chatLocked && !isAdmin)
                              "
                              @click="togglePollVote(item, opt.key)"
                            >
                              <span
                                class="poll-option-fill"
                                :style="{ width: opt.percent + '%' }"
                              ></span>
                              <span class="poll-option-content">
                                <span class="poll-option-check">
                                  <Check
                                    v-if="opt.iVoted"
                                    :size="11"
                                    stroke-width="3.2"
                                  />
                                </span>
                                <span class="poll-option-label">{{
                                  opt.label
                                }}</span>
                                <span class="poll-option-stats">
                                  <span class="poll-option-votes"
                                    >{{ opt.votes }}
                                    {{
                                      opt.votes === 1 ? "vote" : "votes"
                                    }}</span
                                  >
                                  <span class="poll-option-percent"
                                    >{{ opt.percent }}%</span
                                  >
                                </span>
                              </span>
                            </button>
                          </div>
                          <div class="poll-card-footer">
                            <button
                              v-if="pollTotalVoters(item) > 0"
                              type="button"
                              class="poll-total poll-total--btn"
                              @click="openViewVotes(item)"
                            >
                              {{ pollTotalVoters(item) }}
                              {{
                                pollTotalVoters(item) === 1 ? "vote" : "votes"
                              }}
                            </button>
                            <span v-else class="poll-total">
                              {{ pollTotalVoters(item) }}
                              {{
                                pollTotalVoters(item) === 1 ? "vote" : "votes"
                              }}
                            </span>
                            <span
                              v-if="item.pollExpiresAt"
                              class="poll-time-remaining"
                              :class="{
                                'poll-time-remaining--ended':
                                  isPollClosed(item),
                              }"
                            >
                              <span class="poll-time-dot"></span>
                              {{ formatPollTimeRemaining(item) }}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div
                        v-else-if="item.type === 'gif' && item.gif"
                        class="msg-body msg-body--gif"
                      >
                        <button
                          type="button"
                          class="gif-message"
                          :style="{
                            aspectRatio: `${item.gif.width || 1} / ${item.gif.height || 1}`,
                            maxWidth: getGifDisplayWidth(item.gif) + 'px',
                          }"
                          @click="openGifLightbox(item.gif, item.id)"
                        >
                          <img
                            :src="item.gif.url"
                            :alt="item.gif.title || 'GIF'"
                            class="gif-message-img"
                            loading="lazy"
                            draggable="false"
                          />
                        </button>
                      </div>

                      <div
                        v-else
                        class="msg-body"
                        :class="{ 'msg-body--emoji': isEmojiOnly(item.text) }"
                      >
                        <span class="text"
                          ><span v-html="formatMessage(item)"></span
                          ><span v-if="item.editedAt" class="edited-label">
                            (edited)</span
                          ></span
                        >
                      </div>
                      <TransitionGroup
                        v-if="getReactionList(item).length"
                        name="reaction-pop"
                        tag="div"
                        class="reactions-row"
                      >
                        <button
                          v-for="r in getReactionList(item)"
                          :key="r.emoji"
                          type="button"
                          class="reaction-badge"
                          :class="{ 'reaction-badge--me': r.iReacted }"
                          :disabled="isMuted"
                          @click="toggleReaction(item.id, r.emoji)"
                        >
                          <span
                            class="reaction-emoji"
                            v-html="twemojify(r.emoji)"
                          ></span>
                          <span class="reaction-count">{{ r.count }}</span>
                          <span class="reaction-tooltip">{{ r.tooltip }}</span>
                        </button>
                        <button
                          key="__add__"
                          type="button"
                          class="reaction-badge reaction-badge--add"
                          title="Add reaction"
                          :disabled="isMuted"
                          @click.stop="openReactionPicker(item.id, $event)"
                        >
                          <SmilePlus :size="14" :stroke-width="2" />
                        </button>
                      </TransitionGroup>
                      <div class="msg-actions">
                        <button
                          class="msg-action-btn"
                          title="Add Reaction"
                          :disabled="isMuted"
                          @click.stop="openReactionPicker(item.id, $event)"
                        >
                          <SmilePlus :size="16" :stroke-width="2" />
                        </button>
                        <button
                          v-if="item.type === 'gif' && item.gif?.url"
                          class="msg-action-btn"
                          :class="{ active: copiedMessageId === item.id }"
                          @click="copyGifLink(item)"
                          :title="
                            copiedMessageId === item.id
                              ? 'Link copied'
                              : 'Copy GIF link'
                          "
                        >
                          <Check
                            v-if="copiedMessageId === item.id"
                            :size="16"
                            :stroke-width="2"
                          />
                          <Copy v-else :size="16" :stroke-width="2" />
                        </button>
                        <button
                          v-else-if="item.type !== 'poll'"
                          class="msg-action-btn"
                          :class="{ active: copiedMessageId === item.id }"
                          @click="copyMessageText(item)"
                          :title="
                            copiedMessageId === item.id
                              ? 'Copied'
                              : 'Copy message'
                          "
                        >
                          <Check
                            v-if="copiedMessageId === item.id"
                            :size="16"
                            :stroke-width="2"
                          />
                          <Copy v-else :size="16" :stroke-width="2" />
                        </button>
                        <button
                          v-if="
                            item.uid === user.uid &&
                            item.type !== 'poll' &&
                            item.type !== 'gif'
                          "
                          class="msg-action-btn"
                          @click="startEdit(item)"
                          title="Edit"
                        >
                          <Pencil :size="16" :stroke-width="2" />
                        </button>
                        <button
                          class="msg-action-btn"
                          @click="startReply(item)"
                          title="Reply"
                        >
                          <CornerUpLeft :size="16" :stroke-width="2" />
                        </button>
                        <button
                          v-if="
                            item.uid === user.uid ||
                            (!isDm &&
                              isAdmin &&
                              (ownerUid !== item.uid || user.uid === ownerUid))
                          "
                          class="msg-action-btn danger"
                          @click="promptDelete(item.id)"
                          title="Delete"
                        >
                          <Trash2 :size="16" :stroke-width="2" />
                        </button>
                      </div>
                    </template>
                  </div>
                </div>
              </div>
            </template>
          </div>

          <transition name="jump-fade">
            <button
              v-if="showJumpButton"
              class="jump-to-bottom"
              @click="scrollToBottom"
            >
              <span v-if="scrollUnread > 0" class="jump-unread">{{
                scrollUnread
              }}</span>
              <ChevronDown :size="16" stroke-width="2.5" />
            </button>
          </transition>
        </div>

        <div class="composer-wrap">
          <GifPicker
            v-if="gifPickerMounted"
            ref="gifPickerRef"
            :is-open="gifPickerVisible"
            @close="gifPickerVisible = false"
            @select="handleGifSelected"
          />

          <transition name="emoji-fade">
            <div
              v-if="emojiVisible && emojiResults.length"
              class="emoji-autocomplete"
              :class="{ 'picker--keyboard': pickerKeyboardActive }"
              ref="emojiPickerRef"
              @mousemove="pickerKeyboardActive = false"
            >
              <div
                v-for="(emoji, i) in emojiResults"
                :key="emoji.id"
                class="emoji-item"
                :class="{ active: i === emojiActiveIndex }"
                @mouseenter="emojiActiveIndex = i"
                @mousedown.prevent="insertEmoji(emoji)"
              >
                <span
                  class="emoji-native"
                  v-html="twemojify(emoji.skins[0].native)"
                ></span>
                <span class="emoji-name">{{
                  emoji.id.replace(/_/g, " ")
                }}</span>
                <span class="emoji-shortcode">:{{ emoji.id }}:</span>
              </div>
            </div>
          </transition>

          <transition name="mention-fade">
            <div
              v-if="
                !isDm &&
                mentionVisible &&
                activeMentionTarget === 'composer' &&
                mentionResults.length
              "
              class="mention-autocomplete"
              :class="{ 'picker--keyboard': pickerKeyboardActive }"
              ref="mentionPickerRef"
              @mousemove="pickerKeyboardActive = false"
            >
              <div
                v-for="(mentionUser, i) in mentionResults"
                :key="mentionUser.uid"
                class="mention-item"
                :class="{
                  active: i === mentionActiveIndex,
                  'mention-item--everyone': mentionUser.isEveryone,
                }"
                @mouseenter="mentionActiveIndex = i"
                @mousedown.prevent="insertMention(mentionUser)"
              >
                <div
                  v-if="mentionUser.isEveryone"
                  class="mention-avatar mention-avatar--everyone"
                >
                  @
                </div>
                <div
                  v-else
                  class="mention-avatar"
                  :style="
                    getAvatarStyle(
                      mentionUser.displayName,
                      mentionUser.uid,
                      mentionUser.avatarColor,
                    )
                  "
                >
                  {{
                    getAvatarInitial(mentionUser.displayName, mentionUser.uid)
                  }}
                </div>
                <span class="mention-name">{{ mentionUser.displayName }}</span>
              </div>
            </div>
          </transition>

          <div class="typing-area" ref="typingAreaRef">
            <div class="typing-indicator" v-if="typingUsers.length">
              <div class="dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <span class="typing-names">
                <template v-if="typingSummary.overflow">
                  <span class="typing-name">{{ typingSummary.names[0] }}</span>
                  and {{ typingSummary.overflow }}
                  {{ typingSummary.overflow === 1 ? "other" : "others" }}
                </template>
                <template v-else>
                  <template
                    v-for="(name, i) in typingSummary.names"
                    :key="name"
                  >
                    <span class="typing-name">{{ name }}</span>
                    <template v-if="i < typingSummary.names.length - 2"
                      >,
                    </template>
                    <template v-else-if="i === typingSummary.names.length - 2">
                      and
                    </template>
                  </template>
                </template>
                {{ typingUsers.length === 1 ? " is" : " are" }} typing...
              </span>
            </div>
          </div>

          <div class="chat-banner-stack">
            <transition name="chat-banner">
              <div
                v-if="isMuted"
                key="muted"
                class="chat-banner chat-banner--muted"
              >
                <MicOff :size="13" stroke-width="2.5" />
                <span>You've been muted by an admin</span>
              </div>
              <div
                v-else-if="!isDm && chatLocked && !isAdmin"
                key="locked"
                class="chat-banner chat-banner--locked"
              >
                <Lock :size="13" stroke-width="2.5" />
                <span>Chat is locked by an admin</span>
              </div>
            </transition>
            <transition name="chat-banner">
              <div
                v-if="slurWarningVisible"
                key="slur"
                class="chat-banner chat-banner--slur"
              >
                <ShieldAlert
                  :key="slurShakeKey"
                  :size="13"
                  stroke-width="2.5"
                />
                <span
                  >This message contains language that isn't allowed in this
                  chat.</span
                >
              </div>
            </transition>
          </div>

          <div class="input-wrap" @mousedown="handleComposerAreaMousedown">
            <div v-if="replyingTo" class="reply-bar">
              <span class="reply-bar-to"
                >Replying to
                <strong
                  :style="{
                    color: getAvatarColor(
                      resolveDisplayName(
                        replyingTo.uid,
                        replyingTo.displayName,
                      ),
                      replyingTo.uid,
                      replyingTo.avatarColor,
                    ),
                  }"
                  >{{
                    resolveDisplayName(replyingTo.uid, replyingTo.displayName)
                  }}</strong
                ></span
              >
              <button
                type="button"
                class="reply-bar-close"
                @click="cancelReply"
                title="Cancel reply"
                aria-label="Cancel reply"
              >
                <X :size="13" stroke-width="2.5" />
              </button>
            </div>

            <div
              class="input-row"
              ref="inputRowRef"
              @mousedown="handleComposerAreaMousedown"
            >
              <div class="attach-wrap" ref="attachWrapRef">
                <transition name="attach-menu">
                  <div v-if="attachMenuVisible" class="attach-menu" role="menu">
                    <button
                      type="button"
                      class="attach-menu-item"
                      role="menuitem"
                      @mousedown.prevent
                      @click="handlePickGif"
                    >
                      <span class="attach-menu-icon">
                        <Film :size="18" stroke-width="2.2" />
                      </span>
                      <span class="attach-menu-label">Send a GIF</span>
                    </button>
                    <button
                      v-if="!isDm"
                      type="button"
                      class="attach-menu-item"
                      role="menuitem"
                      @mousedown.prevent
                      @click="handleCreatePoll"
                    >
                      <span class="attach-menu-icon">
                        <ChartBarBig :size="18" stroke-width="2.2" />
                      </span>

                      <span class="attach-menu-label">Create Poll</span>
                    </button>
                  </div>
                </transition>
                <button
                  type="button"
                  class="attach-btn"
                  :class="{ open: attachMenuVisible }"
                  :disabled="isMuted || (chatLocked && !isAdmin)"
                  aria-label="Open attachment menu"
                  :aria-expanded="attachMenuVisible"
                  @mousedown.prevent
                  @click="toggleAttachMenu"
                >
                  <Plus :size="20" stroke-width="2.4" />
                </button>
              </div>
              <MessageComposer
                ref="composerRef"
                v-model="newMessage"
                class="message-composer"
                :max-length="10000"
                :aria-label="isDm ? 'Direct message' : 'Message Node Central'"
                :disabled="isMuted || (chatLocked && !isAdmin)"
                :resolve-mention="resolveMentionFromText"
                :placeholder="
                  isMuted
                    ? 'You are muted'
                    : chatLocked && !isAdmin
                      ? 'Chat is locked'
                      : 'Type a message...'
                "
                @submit="sendMessage"
                @keydown="handleComposerKeydown"
                @input="handleComposerInput"
                @blur="closeComposerPickers"
              />
              <span class="char-warning" v-if="newMessage.length > 9000">{{
                10000 - newMessage.length
              }}</span>
            </div>
          </div>
        </div>
      </div>

      <transition name="panel-slide">
        <div v-if="!isDm && onlinePanelOpen" class="online-panel">
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
              <div
                class="online-avatar"
                :style="
                  getAvatarStyle(
                    resolveDisplayName(u.uid, u.displayName),
                    u.uid,
                    u.avatarColor,
                  )
                "
              >
                {{
                  getAvatarInitial(
                    resolveDisplayName(u.uid, u.displayName),
                    u.uid,
                  )
                }}
              </div>
              <span class="online-item-name">{{
                resolveDisplayName(u.uid, u.displayName)
              }}</span>
              <MicOff
                v-if="allMutedUsers.has(u.uid)"
                :size="12"
                stroke-width="2.5"
                class="user-muted-icon"
              />
              <Crown
                v-if="adminUsers.has(u.uid)"
                :size="12"
                stroke-width="2.5"
                class="online-crown"
              />
            </div>
            <template v-if="offlineMembers.length">
              <div class="panel-section-label">
                Offline — {{ offlineMembers.length }}
              </div>
              <div
                v-for="u in offlineMembers"
                :key="u.uid"
                class="online-item offline-item"
              >
                <div
                  class="online-avatar offline-avatar"
                  :style="
                    getAvatarStyle(
                      resolveDisplayName(u.uid, u.displayName),
                      u.uid,
                      u.avatarColor,
                    )
                  "
                >
                  {{
                    getAvatarInitial(
                      resolveDisplayName(u.uid, u.displayName),
                      u.uid,
                    )
                  }}
                </div>
                <div class="offline-info">
                  <div class="offline-name-row">
                    <span class="online-item-name offline-name">{{
                      resolveDisplayName(u.uid, u.displayName)
                    }}</span>
                    <MicOff
                      v-if="allMutedUsers.has(u.uid)"
                      :size="12"
                      stroke-width="2.5"
                      class="user-muted-icon"
                    />
                    <Crown
                      v-if="adminUsers.has(u.uid)"
                      :size="12"
                      stroke-width="2.5"
                      class="online-crown"
                    />
                  </div>
                  <span
                    v-if="formatLastSeen(u.lastSeen)"
                    class="offline-last-seen"
                    >{{ formatLastSeen(u.lastSeen) }}</span
                  >
                </div>
              </div>
            </template>
          </div>
        </div>
      </transition>
    </div>

    <teleport to="body">
      <transition name="modal-fade">
        <div
          v-if="deleteDialog.show"
          class="delete-overlay"
          @click="cancelDelete"
        >
          <div class="delete-box" @click.stop>
            <h3>Delete Message?</h3>
            <p>
              Delete <strong>{{ deleteDialog.name }}</strong
              >'s message? This cannot be undone.
            </p>
            <div class="delete-actions">
              <button class="del-cancel-btn" @click="cancelDelete">
                Cancel
              </button>
              <button class="del-confirm-btn" @click="confirmDelete">
                Delete
              </button>
            </div>
          </div>
        </div>
      </transition>

      <transition name="modal-fade">
        <div
          v-if="pollDialog.show"
          class="poll-overlay"
          @click="cancelPollDialog"
        >
          <div class="poll-modal" @click.stop>
            <div class="poll-modal-head">
              <h3 class="poll-modal-title">Create a Poll</h3>
              <button
                type="button"
                class="poll-modal-close"
                @click="cancelPollDialog"
                aria-label="Close"
              >
                <X :size="18" stroke-width="2.2" />
              </button>
            </div>

            <div class="poll-section">
              <label class="poll-section-label" for="poll-question-input"
                >Question</label
              >
              <div class="poll-input-wrap">
                <input
                  id="poll-question-input"
                  name="poll-question"
                  ref="pollQuestionRef"
                  v-model="pollDialog.question"
                  type="text"
                  class="poll-text-input"
                  placeholder="What question do you want to ask?"
                  maxlength="300"
                  @keydown.enter.prevent="submitPoll"
                  @keydown.escape="cancelPollDialog"
                />
              </div>
              <span class="poll-char-count"
                >{{ pollDialog.question.length }} / 300</span
              >
            </div>

            <div class="poll-section">
              <label class="poll-section-label">Answers</label>
              <div class="poll-answer-rows">
                <div
                  v-for="(opt, idx) in pollDialog.options"
                  :key="idx"
                  class="poll-answer-row"
                >
                  <input
                    v-model="pollDialog.options[idx]"
                    :id="`poll-answer-${idx}`"
                    :name="`poll-answer-${idx}`"
                    type="text"
                    class="poll-text-input poll-text-input--answer"
                    placeholder="Type your answer"
                    maxlength="80"
                    @keydown.enter.prevent="handleAnswerEnter(idx)"
                    @keydown.escape="cancelPollDialog"
                  />
                  <button
                    v-if="pollDialog.options.length > 2"
                    type="button"
                    class="poll-answer-remove"
                    @click="removePollOption(idx)"
                    aria-label="Remove answer"
                  >
                    <Trash2 :size="18" stroke-width="2" />
                  </button>
                </div>
              </div>
              <div class="poll-add-answer-wrap">
                <button
                  v-if="pollDialog.options.length < POLL_MAX_OPTIONS"
                  type="button"
                  class="poll-add-answer-btn"
                  @click="addPollOption"
                >
                  <Plus :size="14" stroke-width="2.6" />
                  Add another answer
                </button>
              </div>
            </div>

            <div class="poll-section">
              <label class="poll-section-label">Duration</label>
              <div class="poll-duration-wrap" ref="pollDurationRef">
                <button
                  type="button"
                  class="poll-duration-btn"
                  :class="{ open: pollDialog.durationOpen }"
                  @click="togglePollDurationDropdown"
                >
                  <span>{{
                    getPollDurationLabel(pollDialog.durationHours)
                  }}</span>
                  <ChevronDown
                    :size="16"
                    stroke-width="2.4"
                    class="poll-duration-chevron"
                  />
                </button>
                <transition name="poll-duration-menu">
                  <div
                    v-if="pollDialog.durationOpen"
                    class="poll-duration-menu"
                    role="listbox"
                  >
                    <button
                      v-for="d in POLL_DURATIONS"
                      :key="d.hours"
                      type="button"
                      class="poll-duration-item"
                      :class="{
                        active: pollDialog.durationHours === d.hours,
                      }"
                      role="option"
                      @click="setPollDuration(d.hours)"
                    >
                      <span>{{ d.label }}</span>
                      <Check
                        v-if="pollDialog.durationHours === d.hours"
                        :size="14"
                        stroke-width="2.8"
                      />
                    </button>
                  </div>
                </transition>
              </div>
            </div>

            <div class="poll-modal-footer">
              <div
                class="poll-switch-row"
                @click="pollDialog.multi = !pollDialog.multi"
              >
                <span class="poll-switch-label">Allow multiple answers</span>
                <button
                  type="button"
                  class="toggle-switch"
                  :class="{ active: pollDialog.multi }"
                  :aria-pressed="pollDialog.multi"
                  aria-label="Allow multiple answers"
                  @click.stop="pollDialog.multi = !pollDialog.multi"
                >
                  <span class="toggle-switch__thumb"></span>
                </button>
              </div>
              <button
                type="button"
                class="poll-post-btn"
                :disabled="!canSubmitPoll || pollSubmitting"
                @click="submitPoll"
              >
                {{ pollSubmitting ? "Posting..." : "Post" }}
              </button>
            </div>
          </div>
        </div>
      </transition>

      <transition name="gif-lightbox-fade">
        <div
          v-if="gifLightbox.show && gifLightbox.gif"
          class="gif-lightbox-overlay"
          @click="closeGifLightbox"
        >
          <img
            :src="gifLightbox.gif.url"
            :alt="gifLightbox.gif.title || 'GIF'"
            class="gif-lightbox-img"
            :style="{
              width: getGifLightboxWidth(gifLightbox.gif) + 'px',
              aspectRatio: `${gifLightbox.gif.width || 1} / ${gifLightbox.gif.height || 1}`,
            }"
            draggable="false"
            @click.stop
          />

          <button
            type="button"
            class="gif-lightbox-close"
            @click="closeGifLightbox"
            aria-label="Close"
          >
            <X :size="20" stroke-width="2.2" />
          </button>
        </div>
      </transition>

      <transition name="reaction-picker">
        <div
          v-if="reactionPickerVisible"
          class="reaction-picker-wrap"
          :style="{
            top: reactionPickerPos.top + 'px',
            right: reactionPickerPos.right + 'px',
            '--rp-origin': reactionPickerPos.origin,
          }"
          ref="reactionPickerEl"
        >
          <div class="reaction-picker-quick">
            <button
              v-for="emoji in QUICK_REACTIONS"
              :key="emoji"
              type="button"
              class="reaction-picker-btn"
              @click="handleQuickReaction(emoji)"
              v-html="twemojify(emoji)"
            ></button>
          </div>
        </div>
      </transition>

      <transition name="modal-fade">
        <div
          v-if="viewVotesDialog.show && viewVotesData"
          class="view-votes-overlay"
          @click="closeViewVotes"
        >
          <div class="view-votes-modal" @click.stop>
            <div class="view-votes-head">
              <div class="view-votes-head-text">
                <h3 class="view-votes-title">{{ viewVotesData.question }}</h3>
                <span class="view-votes-subtitle">
                  {{ viewVotesData.totalVoters }}
                  {{ viewVotesData.totalVoters === 1 ? "voter" : "voters" }}
                </span>
              </div>
              <button
                type="button"
                class="poll-modal-close"
                @click="closeViewVotes"
                aria-label="Close"
              >
                <X :size="18" stroke-width="2.2" />
              </button>
            </div>

            <div class="view-votes-list">
              <div
                v-for="opt in viewVotesData.options"
                :key="opt.key"
                class="view-votes-section"
              >
                <div class="view-votes-section-head">
                  <span class="view-votes-section-label">{{ opt.label }}</span>
                  <span class="view-votes-section-count">
                    {{ opt.votes }}
                    {{ opt.votes === 1 ? "vote" : "votes" }}
                  </span>
                </div>
                <div class="view-votes-bar-track">
                  <div
                    class="view-votes-bar-fill"
                    :style="{ width: opt.percent + '%' }"
                  ></div>
                </div>
                <div v-if="opt.voters.length" class="view-votes-voters">
                  <div
                    v-for="voter in opt.voters"
                    :key="voter.uid"
                    class="view-votes-voter"
                  >
                    <div
                      class="view-votes-voter-avatar"
                      :style="
                        getAvatarStyle(
                          voter.displayName,
                          voter.uid,
                          voter.avatarColor,
                        )
                      "
                    >
                      {{ getAvatarInitial(voter.displayName, voter.uid) }}
                    </div>
                    <span class="view-votes-voter-name">{{
                      voter.displayName
                    }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </teleport>
  </div>
</template>

<script setup>
import {
  ref,
  computed,
  onMounted,
  onUnmounted,
  nextTick,
  watch,
  defineAsyncComponent,
} from "vue";
import { db } from "../firebase";
import {
  Crown,
  Copy,
  Check,
  Pencil,
  Trash2,
  ChevronDown,
  Lock,
  MicOff,
  CornerUpLeft,
  X,
  ShieldAlert,
  Plus,
  ChartBarBig,
  Film,
  SmilePlus,
} from "@lucide/vue";
import { twemojify } from "../twemoji";
const GifPicker = defineAsyncComponent(() => import("./GifPicker.vue"));

import {
  ref as dbRef,
  push,
  query,
  limitToLast,
  onValue,
  onDisconnect,
  serverTimestamp,
  set,
  update,
  remove,
  get,
} from "firebase/database";
import { userIsOnline } from "../presence";
import { sendSystemNotification } from "../notifications";
import MessageComposer from "./MessageComposer.vue";
import { containsSlur } from "../slurFilter";
import {
  OWNER_AVATAR_URL,
  hashAvatarColor,
  getAvatarInitial as sharedGetAvatarInitial,
  getAvatarStyle as sharedGetAvatarStyle,
} from "../avatar";
import {
  recordDmSend,
  markDmRead,
  refreshDmThreadLastMessage,
  partnerUidFromThread,
} from "../dmUtils";

const props = defineProps({
  user: { type: Object, required: true },
  mode: { type: String, default: "channel" },
  threadId: { type: String, default: null },
  partner: { type: Object, default: null },
  ownerUid: { type: String, default: null },
  adminUsers: { type: Object, default: () => new Set() },
  allUsers: { type: Object, default: () => ({}) },
  presenceUsers: { type: Object, default: () => ({}) },
  isMuted: { type: Boolean, default: false },
  allMutedUsers: { type: Object, default: () => new Set() },
  onlinePanelOpen: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
});
const emit = defineEmits(["ready", "unread-count"]);

const isDm = computed(() => props.mode === "dm");
const messagesPath = computed(() =>
  isDm.value ? `dms/threads/${props.threadId}/messages` : "messages",
);
const typingPath = computed(() =>
  isDm.value ? `dms/threads/${props.threadId}/typing` : "typing",
);
const messages = ref([]);
const hasEmittedReady = ref(false);
const showDmIntro = computed(
  () =>
    isDm.value &&
    hasEmittedReady.value &&
    messages.value.length === 0 &&
    !!props.partner,
);
const showJumpButton = ref(false);
const scrollUnread = ref(0);
const isScrollingSmooth = ref(false);
const SHOW_JUMP_THRESHOLD = 300;
const GROUP_TIMEOUT = 5 * 60 * 1000;
const presenceUsers = computed(() => props.presenceUsers || {});
const ownerUid = computed(() => props.ownerUid || null);
const adminUsers = computed(() => props.adminUsers || new Set());

function getAvatarInitial(name, uid = null) {
  return sharedGetAvatarInitial(name, uid, ownerUid.value);
}

function getAvatarColor(name, uid = null, storedColor = null) {
  if (storedColor) return storedColor;
  if (uid) {
    const stored =
      allUsers.value[uid]?.preferences?.avatarColor ||
      presenceUsers.value[uid]?.profile?.avatarColor;
    if (stored) return stored;
  }
  return hashAvatarColor(name);
}

function getAvatarStyle(name, uid = null, storedColor = null) {
  const resolvedColor = getAvatarColor(name, uid, storedColor);
  return sharedGetAvatarStyle(name, uid, resolvedColor, ownerUid.value);
}

function getLatestUser(uid, fallback = {}) {
  return { ...fallback, ...(allUsers.value[uid] || {}) };
}

function resolveDisplayName(uid, fallback = "") {
  if (!uid) return fallback || "Unknown";
  const fromUsers = allUsers.value[uid]?.displayName;
  if (fromUsers) return fromUsers;
  const fromPresence = presenceUsers.value[uid]?.profile?.displayName;
  if (fromPresence) return fromPresence;
  return fallback || "Unknown";
}

function resolveAvatarColor(uid, fallback = null) {
  if (!uid) return fallback;
  const fromUsers = allUsers.value[uid]?.preferences?.avatarColor;
  if (fromUsers) return fromUsers;
  const fromPresence = presenceUsers.value[uid]?.profile?.avatarColor;
  if (fromPresence) return fromPresence;
  return fallback;
}

const onlineUsers = computed(() => {
  return Object.entries(presenceUsers.value)
    .map(([uid, data]) => {
      if (!userIsOnline(data)) return null;
      const profile =
        data?.profile && typeof data.profile === "object" ? data.profile : {};
      const user = getLatestUser(uid, profile);
      return {
        uid,
        displayName: user.displayName || profile.displayName || "?",
        avatarColor:
          user.preferences?.avatarColor || profile.avatarColor || null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (ownerUid.value && a.uid === ownerUid.value) return -1;
      if (ownerUid.value && b.uid === ownerUid.value) return 1;
      const aAdmin = adminUsers.value.has(a.uid);
      const bAdmin = adminUsers.value.has(b.uid);
      if (aAdmin !== bAdmin) return aAdmin ? -1 : 1;
      return (a.displayName || "").localeCompare(b.displayName || "");
    });
});

function formatDateLabel(timestamp) {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

const groupedMessages = computed(() => {
  const list = messages.value;
  const result = [];
  let lastDateKey = null;
  let prev = null;
  let prevDateKey = null;
  for (let i = 0; i < list.length; i++) {
    const msg = list[i];
    const dateKey = msg.timestamp
      ? new Date(msg.timestamp).toDateString()
      : null;
    if (dateKey && dateKey !== lastDateKey) {
      lastDateKey = dateKey;
      result.push({
        type: "date",
        id: `date-${dateKey}`,
        label: formatDateLabel(msg.timestamp),
      });
    }
    const crossedDate =
      prev && prev.timestamp && msg.timestamp && prevDateKey !== dateKey;
    const isGroupStart =
      !prev ||
      prev.uid !== msg.uid ||
      !prev.timestamp ||
      !msg.timestamp ||
      msg.timestamp - prev.timestamp > GROUP_TIMEOUT ||
      crossedDate ||
      !!msg.replyTo;
    result.push({
      ...msg,
      type: msg.type || "message",
      isGroupStart,
    });
    prev = msg;
    prevDateKey = dateKey;
  }
  return result;
});
const newMessage = ref("");
const showTimestamps = computed(
  () => props.user?.preferences?.showTimestamps !== false,
);
const use24HourTime = computed(
  () => props.user?.preferences?.timeFormat === "24h",
);
const messageContainer = ref(null);
const composerRef = ref(null);
const typingAreaRef = ref(null);
const inputRowRef = ref(null);
const typingUsersRaw = ref({});
const hasMore = ref(false);
const isAdmin = computed(
  () =>
    adminUsers.value.has(props.user.uid) || ownerUid.value === props.user.uid,
);
const isLoadingMore = ref(false);
const editingId = ref(null);
const editText = ref("");
const editInputRef = ref(null);
const deleteDialog = ref({ show: false, id: null, name: "" });
const copiedMessageId = ref(null);
const MESSAGE_BATCH_SIZE = 100;
const SCROLL_BOTTOM_THRESHOLD = 24;
let messageLimit = MESSAGE_BATCH_SIZE;
let totalCount = 0;
let unreadCount = 0;
let initialLoadDone = false;
let hasPositionedInitialScroll = false;
let knownIds = new Set();
const allUsers = computed(() => props.allUsers || {});
const EVERYONE_MENTION_UID = "everyone";

const mentionableUsers = computed(() => {
  const onlineUids = new Set(onlineUsers.value.map((u) => u.uid));
  const userEntries = new Map(Object.entries(allUsers.value));
  if (
    props.user?.uid &&
    props.user?.displayName &&
    !userEntries.has(props.user.uid)
  ) {
    userEntries.set(props.user.uid, {
      displayName: props.user.displayName,
      preferences: props.user.preferences || {},
    });
  }

  return Array.from(userEntries.entries())
    .filter(([, data]) => data?.displayName)
    .map(([uid, data]) => ({
      uid,
      displayName: data.displayName,
      avatarColor: data.preferences?.avatarColor || null,
      isOnline: onlineUids.has(uid),
      isSelf: uid === props.user.uid,
      isEveryone: false,
    }))
    .sort((a, b) => {
      if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1;
      if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
      return (a.displayName || "").localeCompare(b.displayName || "");
    });
});

const EVERYONE_MENTION_ENTRY = {
  uid: EVERYONE_MENTION_UID,
  displayName: "everyone",
  avatarColor: null,
  isOnline: true,
  isSelf: false,
  isEveryone: true,
};

const mentionablesByLength = computed(() => {
  const list = mentionableUsers.value
    .filter((u) => u.displayName && !u.isEveryone)
    .map((u) => ({ uid: u.uid, displayName: u.displayName }));
  list.push({ uid: EVERYONE_MENTION_UID, displayName: "everyone" });
  return list.sort((a, b) => b.displayName.length - a.displayName.length);
});

function resolveMentionFromText(rest) {
  if (!rest) return null;
  for (const m of mentionablesByLength.value) {
    if (rest.startsWith(m.displayName)) {
      const after = rest[m.displayName.length];
      if (!after || !/[A-Za-z0-9_-]/.test(after)) {
        return { uid: m.uid, displayName: m.displayName };
      }
    }
  }
  return null;
}

const recentParticipants = computed(() => {
  const map = new Map();
  const limit = 30;
  for (let i = messages.value.length - 1; i >= 0; i--) {
    const uid = messages.value[i]?.uid;
    if (!uid) continue;
    if (uid === props.user.uid) continue;
    if (map.has(uid)) continue;
    map.set(uid, map.size);
    if (map.size >= limit) break;
  }
  return map;
});

let typingTimeout = null;
let myTypingRef = null;
let messagesListener = null;
let typingListener = null;
let lockListener = null;
let copyResetTimer = null;

const chatLocked = ref(false);
const isMuted = computed(() => !!props.isMuted);
const allMutedUsers = computed(() => props.allMutedUsers || new Set());
const slurWarningVisible = ref(false);
let slurWarningTimer = null;
const slurShakeKey = ref(0);
const replyingTo = ref(null);
const highlightedMessageId = ref(null);
let pendingScrollAnchor = null;
let shouldScrollToBottom = false;

const emojiResults = ref([]);
const emojiActiveIndex = ref(0);
const emojiVisible = ref(false);
const emojiPickerRef = ref(null);
let emojiQueryStart = -1;
let emojiSearchIndex = null;
let emojiReady = false;

const mentionResults = ref([]);
const mentionActiveIndex = ref(0);
const mentionVisible = ref(false);
const mentionPickerRef = ref(null);
const activeMentionTarget = ref(null);
const pickerKeyboardActive = ref(false);
let mentionQueryStart = -1;

const attachMenuVisible = ref(false);
const attachWrapRef = ref(null);
const gifPickerVisible = ref(false);
const gifPickerMounted = ref(false);
const gifPickerRef = ref(null);

const GIF_MAX_DISPLAY_WIDTH = 600;
const GIF_MAX_DISPLAY_HEIGHT = 480;
const GIF_LIGHTBOX_SCALE = 1.75;

function getGifDisplayWidth(gif) {
  if (!gif) return GIF_MAX_DISPLAY_WIDTH;
  const w = Number(gif.width) || GIF_MAX_DISPLAY_WIDTH;
  const h = Number(gif.height) || GIF_MAX_DISPLAY_WIDTH;
  if (!w || !h) return GIF_MAX_DISPLAY_WIDTH;
  const widthCap = Math.min(w, GIF_MAX_DISPLAY_WIDTH);
  const heightCappedWidth = (GIF_MAX_DISPLAY_HEIGHT * w) / h;
  return Math.max(120, Math.floor(Math.min(widthCap, heightCappedWidth)));
}

function getGifLightboxWidth(gif) {
  return Math.round(getGifDisplayWidth(gif) * GIF_LIGHTBOX_SCALE);
}

const gifLightbox = ref({ show: false, gif: null, messageId: null });

function openGifLightbox(gif, messageId = null) {
  if (!gif?.url) return;
  gifLightbox.value = { show: true, gif, messageId };
}

function closeGifLightbox() {
  gifLightbox.value = { show: false, gif: null, messageId: null };
}

watch(
  () => messages.value.map((m) => m.id),
  () => {
    if (!gifLightbox.value.show) return;
    const id = gifLightbox.value.messageId;
    if (!id) return;
    const stillExists = messages.value.some((m) => m.id === id);
    if (!stillExists) closeGifLightbox();
  },
);

const GIF_URL_REGEX =
  /^(https?:\/\/[^\s]+?\.(?:gif|gifv|webp)(?:\?[^\s]*)?|https?:\/\/(?:media\d*\.giphy\.com|tenor\.com|c\.tenor\.com|i\.giphy\.com|media\.tenor\.com)\/[^\s]+)$/i;

function parseGifUrlFromText(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return null;
  if (!GIF_URL_REGEX.test(trimmed)) return null;
  return trimmed;
}

function probeGifDimensions(url) {
  return new Promise((resolve) => {
    const img = new Image();
    let settled = false;
    const done = (w, h) => {
      if (settled) return;
      settled = true;
      resolve({ width: w, height: h });
    };
    img.onload = () => done(img.naturalWidth || 0, img.naturalHeight || 0);
    img.onerror = () => done(0, 0);
    setTimeout(() => done(0, 0), 6000);
    img.src = url;
  });
}

const POLL_MAX_OPTIONS = 6;
const POLL_MIN_OPTIONS = 2;
const POLL_DURATIONS = [
  { hours: 1, label: "1 hour" },
  { hours: 4, label: "4 hours" },
  { hours: 8, label: "8 hours" },
  { hours: 24, label: "24 hours" },
  { hours: 72, label: "3 days" },
  { hours: 168, label: "1 week" },
];
const POLL_DEFAULT_DURATION_HOURS = 24;

function makeBlankPollDialog() {
  return {
    show: false,
    question: "",
    options: ["", ""],
    multi: false,
    durationHours: POLL_DEFAULT_DURATION_HOURS,
    durationOpen: false,
  };
}

const pollDialog = ref(makeBlankPollDialog());
const pollSubmitting = ref(false);
const pollQuestionRef = ref(null);
const pollDurationRef = ref(null);

const viewVotesDialog = ref({ show: false, messageId: null });

const viewVotesData = computed(() => {
  if (!viewVotesDialog.value.show || !viewVotesDialog.value.messageId)
    return null;
  const message = messages.value.find(
    (m) => m.id === viewVotesDialog.value.messageId,
  );
  if (!message) return null;

  const options = getPollOptions(message).map((opt) => ({
    key: opt.key,
    label: opt.label,
    votes: opt.votes,
    percent: opt.percent,
    voters: getPollVotersForOption(message, opt.key).map((uid) => ({
      uid,
      displayName: resolveDisplayName(uid, "Unknown"),
      avatarColor: resolveAvatarColor(uid, null),
    })),
  }));

  return {
    question: message.pollQuestion,
    totalVoters: pollTotalVoters(message),
    options,
  };
});

function openViewVotes(message) {
  if (!message?.id) return;
  viewVotesDialog.value = { show: true, messageId: message.id };
}

function closeViewVotes() {
  viewVotesDialog.value = { show: false, messageId: null };
}

const liveNow = ref(Date.now());
let liveNowTimer = null;

function startLiveNowTicker() {
  if (liveNowTimer) return;
  liveNowTimer = setInterval(() => {
    liveNow.value = Date.now();
  }, 30000);
}

function stopLiveNowTicker() {
  if (liveNowTimer) {
    clearInterval(liveNowTimer);
    liveNowTimer = null;
  }
}

function isPollClosed(message) {
  if (!message) return false;
  if (message.pollClosed === true) return true;
  if (message.pollExpiresAt && liveNow.value >= message.pollExpiresAt) {
    return true;
  }
  return false;
}

function formatPollTimeRemaining(message) {
  if (!message?.pollExpiresAt) return "";
  const ms = message.pollExpiresAt - liveNow.value;
  if (ms <= 0) return "Poll ended";
  const totalMin = Math.floor(ms / 60000);
  if (totalMin < 1) return "Closes in <1m";
  if (totalMin < 60) return `Closes in ${totalMin}m`;
  const hours = Math.floor(totalMin / 60);
  if (hours < 24) {
    const min = totalMin - hours * 60;
    return min > 0 ? `Closes in ${hours}h ${min}m` : `Closes in ${hours}h`;
  }
  const days = Math.floor(hours / 24);
  const remHours = hours - days * 24;
  return remHours > 0
    ? `Closes in ${days}d ${remHours}h`
    : `Closes in ${days}d`;
}

function getPollDurationLabel(hours) {
  const found = POLL_DURATIONS.find((d) => d.hours === hours);
  return found ? found.label : `${hours} hours`;
}

function setPollDuration(hours) {
  pollDialog.value.durationHours = hours;
  pollDialog.value.durationOpen = false;
}

function togglePollDurationDropdown() {
  pollDialog.value.durationOpen = !pollDialog.value.durationOpen;
}

const canSubmitPoll = computed(() => {
  if (!pollDialog.value.show) return false;
  const q = pollDialog.value.question.trim();
  if (!q) return false;
  if (containsSlur(q)) return false;
  const validOptions = pollDialog.value.options
    .map((o) => o.trim())
    .filter(Boolean);
  if (validOptions.length < POLL_MIN_OPTIONS) return false;
  if (validOptions.some((o) => containsSlur(o))) return false;
  return true;
});

function toggleAttachMenu() {
  if (isMuted.value || (chatLocked.value && !isAdmin.value)) return;
  if (gifPickerVisible.value) {
    gifPickerVisible.value = false;
    attachMenuVisible.value = false;
    return;
  }
  attachMenuVisible.value = !attachMenuVisible.value;
}

function closeAttachMenu() {
  attachMenuVisible.value = false;
}

function handleCreatePoll() {
  closeAttachMenu();
  if (isMuted.value || (chatLocked.value && !isAdmin.value)) return;
  pollDialog.value = { ...makeBlankPollDialog(), show: true };
  nextTick(() => {
    pollQuestionRef.value?.focus();
  });
}

function handlePickGif() {
  closeAttachMenu();
  if (isMuted.value || (chatLocked.value && !isAdmin.value)) return;
  gifPickerMounted.value = true;
  gifPickerVisible.value = true;
}

function handleGifSelected(gif) {
  if (!gif?.url) return;
  gifPickerVisible.value = false;
  sendGif(gif);
}

async function sendGif(gif) {
  if (!gif?.url) return;
  if (chatLocked.value && !isAdmin.value) return;
  if (isMuted.value) return;

  const replySnapshot = replyingTo.value ? { ...replyingTo.value } : null;
  totalCount++;
  shouldScrollToBottom = true;
  replyingTo.value = null;

  const safeGif = {
    url: String(gif.url).slice(0, 1024),
    previewUrl: gif.previewUrl ? String(gif.previewUrl).slice(0, 1024) : null,
    width: Number(gif.width) || 0,
    height: Number(gif.height) || 0,
    title: gif.title ? String(gif.title).slice(0, 200) : "",
    source: gif.source || "giphy",
    id: gif.id ? String(gif.id).slice(0, 80) : null,
  };

  try {
    await push(dbRef(db, messagesPath.value), {
      type: "gif",
      gif: safeGif,
      displayName: props.user.displayName,
      uid: props.user.uid,
      avatarColor: props.user.preferences?.avatarColor || null,
      timestamp: serverTimestamp(),
      ...(replySnapshot ? { replyTo: replySnapshot } : {}),
    });
    if (isDm.value && props.partner?.uid) {
      await recordDmSend({
        threadId: props.threadId,
        myUid: props.user.uid,
        partnerUid: props.partner.uid,
        message: { type: "gif", gif: safeGif },
      });
    }
  } catch (err) {
    console.error("Failed to send GIF:", err);
    replyingTo.value = replySnapshot;
    totalCount--;
  }
}

async function copyWithFeedback(text, itemId, errorLabel) {
  try {
    await navigator.clipboard.writeText(text);
    copiedMessageId.value = itemId;
    clearTimeout(copyResetTimer);
    copyResetTimer = setTimeout(() => {
      if (copiedMessageId.value === itemId) {
        copiedMessageId.value = null;
      }
    }, 1200);
  } catch (err) {
    console.error(errorLabel, err);
  }
}

function copyGifLink(item) {
  const url = item?.gif?.url;
  if (!url) return;
  return copyWithFeedback(url, item.id, "Failed to copy GIF link:");
}

function cancelPollDialog() {
  if (pollSubmitting.value) return;
  pollDialog.value = makeBlankPollDialog();
}

function addPollOption() {
  if (pollDialog.value.options.length >= POLL_MAX_OPTIONS) return;
  pollDialog.value.options.push("");
}

function removePollOption(idx) {
  if (pollDialog.value.options.length <= POLL_MIN_OPTIONS) return;
  pollDialog.value.options.splice(idx, 1);
}

function handleAnswerEnter(idx) {
  const isLast = idx === pollDialog.value.options.length - 1;
  const canAddMore = pollDialog.value.options.length < POLL_MAX_OPTIONS;
  const current = (pollDialog.value.options[idx] || "").trim();

  if (isLast && current && canAddMore) {
    pollDialog.value.options.push("");
    nextTick(() => {
      const inputs = document.querySelectorAll(
        ".poll-answer-row .poll-text-input--answer",
      );
      const next = inputs[idx + 1];
      if (next && typeof next.focus === "function") next.focus();
    });
    return;
  }

  if (canSubmitPoll.value) submitPoll();
}

async function submitPoll() {
  if (!canSubmitPoll.value || pollSubmitting.value) return;
  if (chatLocked.value && !isAdmin.value) return;
  if (isMuted.value) return;

  const question = pollDialog.value.question.trim().slice(0, 200);
  const options = pollDialog.value.options
    .map((o) => o.trim().slice(0, 80))
    .filter(Boolean)
    .slice(0, POLL_MAX_OPTIONS);

  if (options.length < POLL_MIN_OPTIONS) return;
  if (containsSlur(question) || options.some((o) => containsSlur(o))) {
    flashSlurWarning();
    return;
  }

  const pollOptions = {};
  options.forEach((label, i) => {
    pollOptions[String(i)] = label;
  });

  const multi = !!pollDialog.value.multi;
  const replySnapshot = replyingTo.value ? { ...replyingTo.value } : null;

  pollSubmitting.value = true;
  totalCount++;
  shouldScrollToBottom = true;
  replyingTo.value = null;

  const durationHours =
    pollDialog.value.durationHours || POLL_DEFAULT_DURATION_HOURS;
  const expiresAt = Date.now() + durationHours * 60 * 60 * 1000;

  try {
    await push(dbRef(db, messagesPath.value), {
      type: "poll",
      displayName: props.user.displayName,
      uid: props.user.uid,
      avatarColor: props.user.preferences?.avatarColor || null,
      timestamp: serverTimestamp(),
      pollQuestion: question,
      pollOptions,
      pollMulti: multi,
      pollDurationHours: durationHours,
      pollExpiresAt: expiresAt,
      ...(replySnapshot ? { replyTo: replySnapshot } : {}),
    });
    pollDialog.value = makeBlankPollDialog();
  } catch (err) {
    console.error("Failed to create poll:", err);
    replyingTo.value = replySnapshot;
    totalCount--;
  } finally {
    pollSubmitting.value = false;
  }
}

function getPollVotersForOption(message, optionKey) {
  const votes = message.pollVotes || {};
  const voters = [];
  for (const [voterUid, voteMap] of Object.entries(votes)) {
    if (voteMap && voteMap[optionKey]) {
      voters.push(voterUid);
    }
  }
  return voters;
}

function pollTotalVotes(message) {
  const votes = message.pollVotes || {};
  let total = 0;
  for (const voteMap of Object.values(votes)) {
    if (!voteMap) continue;
    for (const v of Object.values(voteMap)) {
      if (v) total++;
    }
  }
  return total;
}

function pollTotalVoters(message) {
  const votes = message.pollVotes || {};
  let count = 0;
  for (const voteMap of Object.values(votes)) {
    if (voteMap && Object.values(voteMap).some(Boolean)) count++;
  }
  return count;
}

function getPollOptions(message) {
  const raw = message.pollOptions || {};
  const optionKeys = Object.keys(raw).sort((a, b) => {
    const na = Number(a);
    const nb = Number(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return a.localeCompare(b);
  });

  const totalVotes = pollTotalVotes(message);
  const myUid = props.user.uid;
  const myVotes = (message.pollVotes && message.pollVotes[myUid]) || {};

  const optionVoteCounts = optionKeys.map(
    (key) => getPollVotersForOption(message, key).length,
  );
  const maxVotes = optionVoteCounts.length ? Math.max(...optionVoteCounts) : 0;

  return optionKeys.map((key) => {
    const votes = getPollVotersForOption(message, key).length;
    const percent = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
    return {
      key,
      label: raw[key],
      votes,
      percent,
      iVoted: !!myVotes[key],
      isLeading: votes > 0 && votes === maxVotes,
    };
  });
}

async function togglePollVote(message, optionKey) {
  if (!message || isPollClosed(message)) return;
  if (chatLocked.value && !isAdmin.value) return;
  if (isMuted.value) return;

  const myUid = props.user.uid;
  const currentVotes = (message.pollVotes && message.pollVotes[myUid]) || null;
  const alreadyVoted = !!(currentVotes && currentVotes[optionKey]);
  const multi = !!message.pollMulti;

  let nextVotes;
  if (alreadyVoted) {
    nextVotes = { ...(currentVotes || {}) };
    delete nextVotes[optionKey];
    if (Object.keys(nextVotes).length === 0) nextVotes = null;
  } else if (multi) {
    nextVotes = { ...(currentVotes || {}), [optionKey]: true };
  } else {
    nextVotes = { [optionKey]: true };
  }

  try {
    await set(
      dbRef(db, `${messagesPath.value}/${message.id}/pollVotes/${myUid}`),
      nextVotes,
    );
  } catch (err) {
    console.error("Failed to vote on poll:", err);
  }
}

async function ensureEmojiReady() {
  if (emojiReady && emojiSearchIndex) return true;
  try {
    const [{ default: emojiData }, emojiMart] = await Promise.all([
      import("@emoji-mart/data"),
      import("emoji-mart"),
    ]);
    emojiMart.init({ data: emojiData });
    emojiSearchIndex = emojiMart.SearchIndex;
    emojiReady = true;
    return true;
  } catch (err) {
    console.error("Failed to load emoji search:", err);
    return false;
  }
}

const offlineMembers = computed(() => {
  const onlineUids = new Set(onlineUsers.value.map((u) => u.uid));
  return Object.entries(allUsers.value)
    .filter(
      ([uid, data]) =>
        !onlineUids.has(uid) && data.displayName && uid !== props.user.uid,
    )
    .map(([uid, data]) => ({
      uid,
      displayName: data.displayName,
      lastSeen: presenceUsers.value[uid]?.lastSeen || data.lastSeen || null,
      avatarColor: data.preferences?.avatarColor || null,
    }))
    .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
});

function formatLastSeen(ts) {
  if (!ts) return null;
  const diff = Math.max(0, Date.now() - ts);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

const typingUsers = computed(() => {
  return Object.entries(typingUsersRaw.value)
    .filter(([uid]) => uid !== props.user.uid)
    .map(
      ([uid, data]) =>
        getLatestUser(uid, data).displayName || data.displayName || "?",
    );
});

const TYPING_NAME_LIMIT = 2;
const typingSummary = computed(() => {
  const all = typingUsers.value;
  if (all.length <= TYPING_NAME_LIMIT) return { names: all, overflow: 0 };
  return { names: [all[0]], overflow: all.length - 1 };
});

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

  if (isScrollingSmooth.value || near) {
    showJumpButton.value = false;
  } else {
    showJumpButton.value = distFromBottom > SHOW_JUMP_THRESHOLD;
  }

  if (near) {
    scrollUnread.value = 0;
  }
}

function scrollToBottom() {
  const container = messageContainer.value;
  if (!container) return;

  isScrollingSmooth.value = true;
  showJumpButton.value = false;
  container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  scrollUnread.value = 0;

  setTimeout(() => {
    isScrollingSmooth.value = false;
  }, 1200);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getMentionDisplayName(uid, fallback = "") {
  if (uid === EVERYONE_MENTION_UID) return "everyone";
  return resolveDisplayName(uid, fallback);
}

function tokenizeMentions(text) {
  if (!text) return text;
  if (text.indexOf("@") === -1) return text;
  let result = text;

  result = result.replace(
    /(^|[^A-Za-z0-9_/#])@everyone(?=$|[^A-Za-z0-9_-])/g,
    (_, prefix) => `${prefix}<@${EVERYONE_MENTION_UID}>`,
  );

  const candidates = mentionableUsers.value
    .filter((u) => u.displayName && !u.isEveryone)
    .sort((a, b) => b.displayName.length - a.displayName.length);
  for (const user of candidates) {
    const pattern = new RegExp(
      `(^|[^A-Za-z0-9_/#])@${escapeRegExp(user.displayName)}(?=$|[^A-Za-z0-9_-])`,
      "gi",
    );
    result = result.replace(pattern, (_, prefix) => `${prefix}<@${user.uid}>`);
  }
  return result;
}

function detokenizeMentions(text) {
  if (!text) return text;
  return text.replace(/<@([A-Za-z0-9]+)>/g, (_, uid) => {
    if (uid === EVERYONE_MENTION_UID) return "@everyone";
    const name = resolveDisplayName(uid, "");
    return name ? `@${name}` : `<@${uid}>`;
  });
}

function getMentionData(message) {
  if (!message) return [];
  const keyedMentions = message.mentions || {};
  const keyedMentionUids = message.mentionUids || {};
  const byUid = new Map();

  for (const [uid, mention] of Object.entries(keyedMentions)) {
    if (!uid) continue;
    byUid.set(uid, {
      uid,
      displayName: mention?.displayName || getMentionDisplayName(uid),
      avatarColor: mention?.avatarColor || null,
    });
  }

  for (const uid of Object.keys(keyedMentionUids)) {
    if (!uid || byUid.has(uid)) continue;
    byUid.set(uid, {
      uid,
      displayName: getMentionDisplayName(uid),
      avatarColor: allUsers.value[uid]?.preferences?.avatarColor || null,
    });
  }

  if (!byUid.size && message.text) {
    for (const mention of extractMentions(message.text)) {
      byUid.set(mention.uid, mention);
    }
  }

  return Array.from(byUid.values()).sort(
    (a, b) => (b.displayName || "").length - (a.displayName || "").length,
  );
}

function renderMentionHtml(uid, fallbackName) {
  const label = getMentionDisplayName(uid, fallbackName);
  const isMe = uid === props.user.uid;
  let className = "mention";
  if (isMe) className += " mention--me";
  const safeLabel = escapeHtml(`@${label}`);
  const safeTitle = escapeHtml(label).replace(/"/g, "&quot;");
  return `<span class="${className}" title="@${safeTitle}">${safeLabel}</span>`;
}

function applyMentionPlaceholders(html, message) {
  const replacements = [];
  let result = html;

  result = result.replace(/&lt;@([A-Za-z0-9]+)&gt;/g, (_, uid) => {
    const fallback =
      message?.mentions?.[uid]?.displayName || getMentionDisplayName(uid, "");
    const replacementIndex =
      replacements.push(renderMentionHtml(uid, fallback)) - 1;
    return `\x01${replacementIndex}\x01`;
  });

  const mentions = getMentionData(message);
  if (mentions.length) {
    for (const mention of mentions) {
      const latestName = getMentionDisplayName(
        mention.uid,
        mention.displayName,
      );
      const names = Array.from(
        new Set([mention.displayName, latestName].filter(Boolean)),
      ).sort((a, b) => b.length - a.length);

      for (const name of names) {
        const escapedName = escapeHtml(name);
        const pattern = new RegExp(
          `(^|[^A-Za-z0-9_/#])@${escapeRegExp(escapedName)}(?=$|[^A-Za-z0-9_-])`,
          "gi",
        );
        result = result.replace(pattern, (match, prefix) => {
          const replacementIndex =
            replacements.push(
              renderMentionHtml(mention.uid, mention.displayName),
            ) - 1;
          return `${prefix}\x01${replacementIndex}\x01`;
        });
      }
    }
  }

  return { html: result, replacements };
}

function restoreMentionPlaceholders(html, replacements) {
  if (!replacements.length) return html;
  return html.replace(/\x01(\d+)\x01/g, (_, idx) => replacements[Number(idx)]);
}

function formatMessageInternal(messageOrText, { linkify = true } = {}) {
  const message =
    typeof messageOrText === "object" && messageOrText !== null
      ? messageOrText
      : { text: messageOrText };

  if (message && message.type === "poll" && message.pollQuestion) {
    const safeQuestion = escapeHtml(message.pollQuestion);
    return twemojify(
      `<span class="poll-inline"><span class="poll-inline-icon">📊</span><span class="poll-inline-label">Poll:</span> ${safeQuestion}</span>`,
    );
  }

  if (message && message.type === "gif" && message.gif) {
    return `<span class="gif-inline"><span class="gif-inline-label">GIF</span></span>`;
  }

  const text = message.text || "";
  if (!text) return "";
  const escapes = [];
  const withPlaceholders = text.replace(/\\(.)/g, (_, char) => {
    const idx = escapes.length;
    escapes.push(escapeHtml(char));
    return `\x00${idx}\x00`;
  });

  const mentionState = applyMentionPlaceholders(
    escapeHtml(withPlaceholders),
    message,
  );

  let formatted = mentionState.html
    .replace(/\*\*\*(.+?)\*\*\*/gs, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/gs, "<strong>$1</strong>")
    .replace(/__(.+?)__/gs, "<u>$1</u>")
    .replace(/\*(.+?)\*/gs, "<em>$1</em>")
    .replace(/_([^_]+)_/gs, "<em>$1</em>")
    .replace(/~~(.+?)~~/gs, "<s>$1</s>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");

  if (linkify) {
    formatted = formatted.replace(
      /(https?:\/\/[^\s<]+?)([.,!?;:)"']*(?:\s|$))/g,
      (_, url, trail) => {
        const safeUrl = url.replace(/"/g, "&quot;");
        return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${url}</a>${trail}`;
      },
    );
  }

  formatted = formatted.replace(
    /\x00(\d+)\x00/g,
    (_, idx) => escapes[parseInt(idx)],
  );

  const restored = restoreMentionPlaceholders(
    formatted,
    mentionState.replacements,
  );
  return twemojify(restored);
}

function formatMessage(messageOrText) {
  return formatMessageInternal(messageOrText, { linkify: true });
}

function formatReplyPreview(messageOrText) {
  return formatMessageInternal(messageOrText, { linkify: false });
}

function isEmojiOnly(text) {
  if (!text?.trim()) return false;
  const stripped = text.replace(
    /[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F\u200D\u20E3\s]/gu,
    "",
  );
  if (stripped.length > 0) return false;
  const count = (
    text.match(/\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu) || []
  ).length;
  return count >= 1 && count <= 3;
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

function formatTimestamp(timestamp, { short = false } = {}) {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: short ? "numeric" : "2-digit",
    minute: "2-digit",
    hour12: !use24HourTime.value,
  });
}

function formatTimestampShort(timestamp) {
  return formatTimestamp(timestamp, { short: true });
}

function getEditorForTarget(target = activeMentionTarget.value) {
  if (target === "composer") return composerRef.value;
  if (target?.startsWith("edit:")) {
    const refVal = editInputRef.value;
    if (Array.isArray(refVal)) return refVal[0] || null;
    return refVal || null;
  }
  return null;
}
function getCaretForTarget(target = activeMentionTarget.value) {
  const editor = getEditorForTarget(target);
  if (!editor) return 0;
  return editor.getCaretOffset();
}

function getTextForMentionTarget(target = activeMentionTarget.value) {
  if (target === "composer") return newMessage.value;
  if (target?.startsWith("edit:")) return editText.value;
  return "";
}

function setTextForMentionTarget(value, target = activeMentionTarget.value) {
  if (target === "composer") {
    newMessage.value = value;
    return;
  }
  if (target?.startsWith("edit:")) {
    editText.value = value;
  }
}

function closeMentionPicker() {
  mentionVisible.value = false;
  mentionResults.value = [];
  mentionActiveIndex.value = 0;
  mentionQueryStart = -1;
  activeMentionTarget.value = null;
  pickerKeyboardActive.value = false;
}

function closeComposerPickers() {
  closeEmojiPicker();
  closeMentionPicker();
}

function getMentionQuery(text, cursor) {
  const beforeCursor = text.slice(0, cursor);
  const at = beforeCursor.lastIndexOf("@");
  if (at < 0) return null;
  const prefix = at === 0 ? "" : beforeCursor[at - 1];
  if (prefix && /[A-Za-z0-9_/#]/.test(prefix)) return null;

  const query = beforeCursor.slice(at + 1);
  if (query.includes("\n") || query.length > 32) return null;
  if (/\s/.test(query)) return null;
  if (/[:`]/.test(query)) return null;

  return { start: at, query: query.toLowerCase() };
}

function normalizeMentionSearch(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getSequentialMatchScore(haystack, needle) {
  if (!needle) return 0;
  let score = 0;
  let searchFrom = 0;
  let lastIndex = -1;

  for (const char of needle) {
    const foundAt = haystack.indexOf(char, searchFrom);
    if (foundAt === -1) return Infinity;
    score += foundAt - searchFrom;
    if (lastIndex >= 0 && foundAt !== lastIndex + 1) score += 4;
    lastIndex = foundAt;
    searchFrom = foundAt + 1;
  }

  return score;
}

function getMentionSearchScore(user, query) {
  const normalizedQuery = normalizeMentionSearch(query);
  if (!normalizedQuery) {
    if (user.isSelf) return Infinity;
    const recencyIndex = recentParticipants.value.get(user.uid);
    if (recencyIndex !== undefined) return -1000 + recencyIndex;
    return user.isOnline ? -10 : 0;
  }

  const name = normalizeMentionSearch(user.displayName);

  const compactName = name.replace(/\s+/g, "");
  const compactQuery = normalizedQuery.replace(/\s+/g, "");
  if (!name || !compactQuery) return Infinity;

  if (name === normalizedQuery || compactName === compactQuery) return 0;
  if (
    name.startsWith(normalizedQuery) ||
    compactName.startsWith(compactQuery)
  ) {
    return 4;
  }

  const wordIndex = name
    .split(" ")
    .findIndex((word) => word.startsWith(normalizedQuery));
  if (wordIndex >= 0) return 8 + wordIndex;

  const includesAt = name.indexOf(normalizedQuery);
  if (includesAt >= 0) return 16 + includesAt;

  const compactIncludesAt = compactName.indexOf(compactQuery);
  if (compactIncludesAt >= 0) return 18 + compactIncludesAt;

  const fuzzyScore = getSequentialMatchScore(compactName, compactQuery);
  if (fuzzyScore === Infinity) return Infinity;
  return 40 + fuzzyScore;
}

function checkMentionTrigger(target) {
  const editor = getEditorForTarget(target);
  if (!editor) return;

  const text = getTextForMentionTarget(target);
  const trigger = getMentionQuery(text, editor.getCaretOffset());
  if (!trigger) {
    if (activeMentionTarget.value === target) closeMentionPicker();
    return;
  }

  if (editor.isAtomicOffset?.(trigger.start)) {
    if (activeMentionTarget.value === target) closeMentionPicker();
    return;
  }

  const queryText = trigger.query;
  const candidates = mentionableUsers.value
    .map((user) => ({
      user,
      score: getMentionSearchScore(user, queryText),
    }))
    .filter((candidate) => candidate.score < Infinity)
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      if (a.user.isSelf !== b.user.isSelf) return a.user.isSelf ? -1 : 1;
      if (a.user.isOnline !== b.user.isOnline) {
        return a.user.isOnline ? -1 : 1;
      }
      return (a.user.displayName || "").localeCompare(b.user.displayName || "");
    })
    .map((candidate) => candidate.user);

  const normalizedQuery = normalizeMentionSearch(queryText);
  if (normalizedQuery.length > 0 && "everyone".startsWith(normalizedQuery)) {
    candidates.unshift(EVERYONE_MENTION_ENTRY);
  }

  if (!candidates.length) {
    closeMentionPicker();
    return;
  }

  closeEmojiPicker();
  mentionQueryStart = trigger.start;
  activeMentionTarget.value = target;
  mentionResults.value = candidates.slice(0, 8);
  mentionActiveIndex.value = 0;
  mentionVisible.value = true;
}

function handleMentionKeydown(e, target) {
  if (
    !mentionVisible.value ||
    activeMentionTarget.value !== target ||
    !mentionResults.value.length
  ) {
    return false;
  }

  if (e.key === "ArrowDown") {
    e.preventDefault();
    pickerKeyboardActive.value = true;
    mentionActiveIndex.value =
      (mentionActiveIndex.value + 1) % mentionResults.value.length;
    nextTick(scrollMentionItemIntoView);
    return true;
  }
  if (e.key === "ArrowUp") {
    e.preventDefault();
    pickerKeyboardActive.value = true;
    mentionActiveIndex.value =
      (mentionActiveIndex.value - 1 + mentionResults.value.length) %
      mentionResults.value.length;
    nextTick(scrollMentionItemIntoView);
    return true;
  }
  if (e.key === "Enter" || e.key === "Tab") {
    e.preventDefault();
    insertMention(mentionResults.value[mentionActiveIndex.value]);
    return true;
  }
  if (e.key === "Escape") {
    e.preventDefault();
    closeMentionPicker();
    return true;
  }

  return false;
}

function insertMention(mentionUser) {
  const target = activeMentionTarget.value;
  const editor = getEditorForTarget(target);
  if (!editor || mentionQueryStart < 0) return;

  const cursor = editor.getCaretOffset();
  editor.insertMentionAtRange(
    mentionUser.uid,
    mentionUser.displayName,
    mentionQueryStart,
    cursor,
  );
  closeMentionPicker();
  nextTick(() => editor.focus());
}

function scrollMentionItemIntoView() {
  const container = mentionPickerRef.value;
  const picker = Array.isArray(container) ? container[0] : container;
  if (!picker) return;
  const active = picker.querySelector(".mention-item.active");
  if (active) active.scrollIntoView({ block: "nearest" });
}

function handleComposerKeydown(e) {
  if (handleMentionKeydown(e, "composer")) return;
  if (emojiVisible.value && emojiResults.value.length) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      pickerKeyboardActive.value = true;
      emojiActiveIndex.value =
        (emojiActiveIndex.value + 1) % emojiResults.value.length;
      nextTick(scrollEmojiItemIntoView);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      pickerKeyboardActive.value = true;
      emojiActiveIndex.value =
        (emojiActiveIndex.value - 1 + emojiResults.value.length) %
        emojiResults.value.length;
      nextTick(scrollEmojiItemIntoView);
      return;
    }
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      insertEmoji(emojiResults.value[emojiActiveIndex.value]);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      closeEmojiPicker();
      return;
    }
  }
  if (e.key === "Escape" && replyingTo.value) {
    e.preventDefault();
    cancelReply();
    return;
  }
  if (e.key === "ArrowUp" && !newMessage.value.trim()) {
    e.preventDefault();
    const lastOwn = [...messages.value]
      .reverse()
      .find((m) => m.uid === props.user.uid);
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

function handleEditKeydown(e, id) {
  const target = `edit:${id}`;
  if (handleMentionKeydown(e, target)) return;
  if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    saveEdit(id);
    return;
  }
  if (e.key === "Escape") {
    e.preventDefault();
    cancelEdit();
  }
}

function wrapSelection(marker) {
  const editor = composerRef.value;
  if (!editor) return;
  const { start, end } = editor.getSelectionRange();
  const value = editor.getValue();
  const selected = value.slice(start, end);
  editor.replaceRangeWithText(start, end, `${marker}${selected}${marker}`);
  nextTick(() => {
    if (selected) {
      editor.setCaretOffset(end + marker.length * 2);
    } else {
      editor.setCaretOffset(start + marker.length);
    }
    editor.focus();
  });
}

function sanitizeMessage(text) {
  return text.replace(/\r\n/g, "\n").replace(/^\s*\n+|\n+\s*$/g, "");
}

function mentionBoundaryPattern(displayName) {
  return new RegExp(
    `(^|[^A-Za-z0-9_/#])@${escapeRegExp(displayName)}(?=$|[^A-Za-z0-9_-])`,
    "gi",
  );
}

function extractMentions(text) {
  if (!text?.trim()) return [];
  if (text.indexOf("@") === -1 && text.indexOf("<@") === -1) return [];
  const mentioned = new Map();

  const tokenPattern = /<@([A-Za-z0-9]+)>/g;
  let tokenMatch;
  while ((tokenMatch = tokenPattern.exec(text)) !== null) {
    const uid = tokenMatch[1];
    if (mentioned.has(uid)) continue;
    if (uid === EVERYONE_MENTION_UID) {
      mentioned.set(uid, {
        uid,
        displayName: "everyone",
        avatarColor: null,
      });
      continue;
    }
    const user = mentionableUsers.value.find((u) => u.uid === uid);
    mentioned.set(uid, {
      uid,
      displayName: user?.displayName || resolveDisplayName(uid, ""),
      avatarColor:
        user?.avatarColor ||
        allUsers.value[uid]?.preferences?.avatarColor ||
        null,
    });
  }

  const candidates = mentionableUsers.value
    .filter((u) => u.displayName)
    .sort((a, b) => b.displayName.length - a.displayName.length);

  for (const user of candidates) {
    if (mentioned.has(user.uid)) continue;
    const pattern = mentionBoundaryPattern(user.displayName);
    if (!pattern.test(text)) continue;
    mentioned.set(user.uid, {
      uid: user.uid,
      displayName: user.displayName,
      avatarColor: user.avatarColor || null,
    });
  }

  return Array.from(mentioned.values());
}

function buildMentionFields(text) {
  const mentions = extractMentions(text);
  if (!mentions.length) {
    return {
      mentions: null,
      mentionUids: null,
    };
  }

  return {
    mentions: Object.fromEntries(
      mentions.map((mention) => [
        mention.uid,
        {
          displayName: mention.displayName,
          avatarColor: mention.avatarColor || null,
        },
      ]),
    ),
    mentionUids: Object.fromEntries(
      mentions.map((mention) => [mention.uid, true]),
    ),
  };
}

function messageMentionsEveryone(message) {
  if (!message) return false;
  if (message.mentionUids?.[EVERYONE_MENTION_UID] === true) return true;
  if (message.mentions?.[EVERYONE_MENTION_UID]) return true;
  const text = message.text || "";
  if (text.includes(`<@${EVERYONE_MENTION_UID}>`)) return true;
  return false;
}

function messageMentionsCurrentUser(message) {
  if (!message) return false;
  if (message.mentionUids?.[props.user.uid] === true) return true;
  if (message.mentions?.[props.user.uid]) return true;
  const text = message.text || "";
  if (text.includes(`<@${props.user.uid}>`)) return true;
  return extractMentions(text).some(
    (mention) => mention.uid === props.user.uid,
  );
}

function isMessagePing(message) {
  if (!message) return false;
  if (messageMentionsEveryone(message)) return true;
  if (message.uid === props.user.uid) return false;
  if (message.replyTo?.uid === props.user.uid) return true;
  if (messageMentionsCurrentUser(message)) return true;
  return false;
}

function handleClickOutside(e) {
  if (touchActiveMessageId.value) {
    const messageEl = e.target.closest?.(
      `[data-message-id="${touchActiveMessageId.value}"]`,
    );
    if (!messageEl) touchActiveMessageId.value = null;
  }
  if (reactionPickerVisible.value) {
    const pickerDom = reactionPickerEl.value;
    if (!pickerDom || !pickerDom.contains(e.target)) {
      closeReactionPicker();
    }
  }
  if (
    attachMenuVisible.value &&
    attachWrapRef.value &&
    !attachWrapRef.value.contains(e.target)
  ) {
    attachMenuVisible.value = false;
  }
  if (
    pollDialog.value.durationOpen &&
    pollDurationRef.value &&
    !pollDurationRef.value.contains(e.target)
  ) {
    pollDialog.value.durationOpen = false;
  }
  if (gifPickerVisible.value) {
    const pickerEl = gifPickerRef.value?.$el;
    const attachEl = attachWrapRef.value;
    const clickedInsidePicker = pickerEl && pickerEl.contains(e.target);
    const clickedInsideAttach = attachEl && attachEl.contains(e.target);
    if (!clickedInsidePicker && !clickedInsideAttach) {
      gifPickerVisible.value = false;
    }
  }
}

function handleGlobalKeydown(e) {
  if (!props.isActive) return;
  if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const active = document.activeElement;
    const isTypingEl =
      active &&
      (active.tagName === "INPUT" ||
        active.tagName === "TEXTAREA" ||
        active.isContentEditable);
    const isInModal =
      active &&
      active.closest?.(
        ".modal-overlay, .settings-overlay, .admin-overlay, .auth-overlay, .poll-overlay, .view-votes-overlay",
      );

    if (!isTypingEl && !isInModal) {
      e.preventDefault();
      focusComposer();
      return;
    }
  }

  if (e.key !== "Escape") return;

  if (reactionPickerVisible.value) {
    e.preventDefault();
    e.stopPropagation();
    closeReactionPicker();
    return;
  }

  if (gifLightbox.value.show) {
    e.preventDefault();
    e.stopPropagation();
    closeGifLightbox();
    return;
  }

  if (viewVotesDialog.value.show) {
    e.preventDefault();
    e.stopPropagation();
    closeViewVotes();
    return;
  }

  if (pollDialog.value.show) {
    e.preventDefault();
    e.stopPropagation();
    cancelPollDialog();
    return;
  }

  if (deleteDialog.value.show) {
    e.preventDefault();
    e.stopPropagation();
    cancelDelete();
    return;
  }

  if (gifPickerVisible.value) {
    e.preventDefault();
    e.stopPropagation();
    gifPickerVisible.value = false;
    return;
  }

  if (attachMenuVisible.value) {
    e.preventDefault();
    attachMenuVisible.value = false;
    return;
  }
}

let typingDisconnectArmed = false;

function armTypingDisconnect() {
  if (typingDisconnectArmed || !myTypingRef) return;
  typingDisconnectArmed = true;
  onDisconnect(myTypingRef)
    .remove()
    .catch(() => {
      typingDisconnectArmed = false;
    });
}

function clearMyTyping() {
  clearTimeout(typingTimeout);
  if (!myTypingRef) return;
  remove(myTypingRef).catch(() => {});
}

function handleTyping() {
  if (!myTypingRef) return;
  if (chatLocked.value && !isAdmin.value) return;
  if (isMuted.value) return;
  armTypingDisconnect();
  set(myTypingRef, { displayName: props.user.displayName }).catch(() => {});
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    if (myTypingRef) remove(myTypingRef).catch(() => {});
  }, 2000);
}

function handlePageHideTyping() {
  clearMyTyping();
}

function focusComposer() {
  const editor = composerRef.value;
  if (!editor) return;
  editor.focus();
  editor.setSelectionToEnd?.();
  requestAnimationFrame(() => editor.setSelectionToEnd?.());
}

function handleComposerAreaMousedown(e) {
  const target = e.target;
  if (!(target instanceof Element)) return;
  if (
    target.closest(
      "textarea, input, button, a, .composer-editor, [contenteditable=''], [contenteditable='true'], .reply-bar, .gif-picker, .emoji-picker, .mention-picker, .attach-menu",
    )
  ) {
    return;
  }
  e.preventDefault();
  focusComposer();
}

function handleComposerInput() {
  handleTyping();
  checkEmojiTrigger();
  checkMentionTrigger("composer");
}

function handleEditInput(event, id) {
  checkMentionTrigger(`edit:${id}`);
}

async function checkEmojiTrigger() {
  const editor = composerRef.value;
  if (!editor) return;
  const cursor = editor.getCaretOffset();
  const textBefore = newMessage.value.slice(0, cursor);
  const match = textBefore.match(/(^|[\s\n]):([\w]{2,})$/);
  if (match) {
    const ready = await ensureEmojiReady();
    if (!ready || !emojiSearchIndex) {
      closeEmojiPicker();
      return;
    }
    const query = match[2];
    emojiQueryStart = cursor - query.length - 1;
    const results = await emojiSearchIndex.search(query);
    if (results && results.length) {
      closeMentionPicker();
      emojiResults.value = results.slice(0, 8);
      emojiActiveIndex.value = 0;
      emojiVisible.value = true;
    } else {
      closeEmojiPicker();
    }
  } else {
    closeEmojiPicker();
  }
}

function insertEmoji(emoji) {
  const native = emoji.skins[0].native;
  const editor = composerRef.value;
  if (!editor) return;
  const cursor = editor.getCaretOffset();
  editor.replaceRangeWithText(emojiQueryStart, cursor, native);
  closeEmojiPicker();
  nextTick(() => editor.focus());
}

function closeEmojiPicker() {
  emojiVisible.value = false;
  emojiResults.value = [];
  emojiQueryStart = -1;
  pickerKeyboardActive.value = false;
}

function scrollEmojiItemIntoView() {
  const container = emojiPickerRef.value;
  if (!container) return;
  const active = container.querySelector(".emoji-item.active");
  if (active) active.scrollIntoView({ block: "nearest" });
}

function subscribeMessages() {
  if (messagesListener) messagesListener();
  const messagesRef = query(
    dbRef(db, messagesPath.value),
    limitToLast(messageLimit),
  );
  messagesListener = onValue(
    messagesRef,
    (snapshot) => {
      const scrollEl = messageContainer.value;
      const wasNearBottom = isNearBottom(scrollEl);
      const isPagingHistory = isLoadingMore.value;
      const data = snapshot.val();
      const loaded = data
        ? Object.entries(data).map(([id, msg]) => ({ id, ...msg }))
        : [];
      const sorted = loaded.sort(
        (a, b) => (a.timestamp || 0) - (b.timestamp || 0),
      );

      hasMore.value =
        sorted.length === messageLimit && totalCount > messageLimit;

      if (!initialLoadDone) {
        sorted.forEach((msg) => knownIds.add(msg.id));
        initialLoadDone = true;
      } else {
        let dmNeedsRead = false;
        sorted.forEach((msg) => {
          if (!knownIds.has(msg.id)) {
            knownIds.add(msg.id);
            if (!isPagingHistory && msg.uid !== props.user.uid) {
              if (isDm.value && props.isActive && !document.hidden) {
                dmNeedsRead = true;
              }
              if (!isDm.value && (!props.isActive || document.hidden)) {
                unreadCount++;
                emit("unread-count", unreadCount);
              }
              if (!isDm.value) {
                const appBackgrounded = document.hidden || !document.hasFocus();
                if (appBackgrounded) {
                  const notifMode =
                    props.user.preferences?.notificationMode || "ping";
                  const isPing = isMessagePing(msg);
                  const baseOk = !!props.user.preferences?.notificationsEnabled;
                  let shouldNotify = false;
                  if (baseOk) {
                    const isPingNotif = notifMode === "ping" && isPing;
                    shouldNotify = notifMode === "all" || isPingNotif;
                  }
                  if (shouldNotify) {
                    let body = null;
                    if (msg.type === "poll" && msg.pollQuestion) {
                      body = `📊 Poll: ${msg.pollQuestion}`.slice(0, 120);
                    } else if (msg.type === "gif") {
                      body = msg.gif?.title
                        ? `🎞️ GIF · ${msg.gif.title}`.slice(0, 120)
                        : "🎞️ Sent a GIF";
                    } else if (msg.text) {
                      body = detokenizeMentions(msg.text).slice(0, 100);
                    }
                    if (body) {
                      void sendSystemNotification({
                        title: msg.displayName || "Node Chat",
                        body,
                        icon: "/icon.png",
                      });
                    }
                  }
                }
              }
            }
            if (
              !isPagingHistory &&
              !isNearBottom(messageContainer.value) &&
              msg.uid !== props.user.uid
            ) {
              scrollUnread.value++;
            }
          }
        });
        if (dmNeedsRead) markDmRead(props.user.uid, props.threadId);
      }

      messages.value = sorted;

      nextTick(() => {
        const container = messageContainer.value;
        if (!container) return;

        if (restoreScrollAnchor(container)) {
          isLoadingMore.value = false;
          shouldScrollToBottom = false;
          if (!hasEmittedReady.value) {
            hasEmittedReady.value = true;
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

        if (!hasEmittedReady.value) {
          hasEmittedReady.value = true;
          emit("ready");
        }
      });
    },
    () => {
      if (!hasEmittedReady.value) {
        hasEmittedReady.value = true;
        emit("ready");
      }
      isLoadingMore.value = false;
      shouldScrollToBottom = false;
      console.error("Failed to load messages listener");
    },
  );
}

async function loadMore() {
  const scrollEl = messageContainer.value;
  if (!scrollEl || isLoadingMore.value) return;

  isLoadingMore.value = true;
  pendingScrollAnchor = captureScrollAnchor(scrollEl);
  messageLimit += MESSAGE_BATCH_SIZE;
  subscribeMessages();
}

function resetUnread() {
  if (unreadCount !== 0) {
    unreadCount = 0;
    emit("unread-count", 0);
  }
}

watch(
  () => props.isActive,
  (active) => {
    if (active && !document.hidden) {
      resetUnread();
      nextTick(() => {
        const container = messageContainer.value;
        if (container) container.scrollTop = container.scrollHeight;
      });
      nextTick(() => focusComposer());
      if (isDm.value) {
        markDmRead(props.user.uid, props.threadId);
      }
    }
  },
);

function handleVisibility() {
  if (document.hidden) return;
  if (props.isActive) {
    resetUnread();
    if (isDm.value) markDmRead(props.user.uid, props.threadId);
  }
}

async function initMessages() {
  try {
    const countSnap = await get(dbRef(db, messagesPath.value));
    totalCount = countSnap.exists() ? Object.keys(countSnap.val()).length : 0;
  } catch (e) {
    totalCount = 0;
    console.error("Failed to read initial message count", e);
  }
  hasMore.value = totalCount > messageLimit;

  if (typingListener) typingListener();
  typingListener = onValue(dbRef(db, typingPath.value), (snapshot) => {
    const data = snapshot.val();
    typingUsersRaw.value = data || {};
  });

  subscribeMessages();
}

onMounted(async () => {
  document.addEventListener("click", handleClickOutside);
  document.addEventListener("keydown", handleGlobalKeydown);
  document.addEventListener("visibilitychange", handleVisibility);
  window.addEventListener("focus", handleVisibility);
  messageContainer.value?.addEventListener("scroll", handleMessageScroll, {
    passive: true,
  });
  myTypingRef = dbRef(db, `${typingPath.value}/${props.user.uid}`);
  armTypingDisconnect();
  window.addEventListener("pagehide", handlePageHideTyping);
  window.addEventListener("beforeunload", handlePageHideTyping);

  if (!isDm.value) {
    lockListener = onValue(dbRef(db, "settings/chatLocked"), (snap) => {
      chatLocked.value = snap.val() === true;
    });
  }

  await initMessages();
  startLiveNowTicker();

  if (props.isActive && !document.hidden) {
    nextTick(() => focusComposer());
  }

  const warmEmoji = () => {
    ensureEmojiReady().catch(() => {});
  };
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(warmEmoji, { timeout: 4000 });
  } else {
    setTimeout(warmEmoji, 2000);
  }
});

onUnmounted(() => {
  stopLiveNowTicker();
  document.removeEventListener("click", handleClickOutside);
  document.removeEventListener("keydown", handleGlobalKeydown);
  document.removeEventListener("visibilitychange", handleVisibility);
  window.removeEventListener("focus", handleVisibility);
  messageContainer.value?.removeEventListener("scroll", handleMessageScroll);
  clearTimeout(typingTimeout);
  clearTimeout(copyResetTimer);
  clearTimeout(slurWarningTimer);
  if (messagesListener) messagesListener();
  if (typingListener) typingListener();
  if (lockListener) lockListener();
  window.removeEventListener("pagehide", handlePageHideTyping);
  window.removeEventListener("beforeunload", handlePageHideTyping);
  if (myTypingRef) {
    onDisconnect(myTypingRef)
      .cancel()
      .catch(() => {});
    remove(myTypingRef).catch(() => {});
  }
  typingDisconnectArmed = false;
});

function copyMessageText(item) {
  const raw = item?.text || "";
  if (!raw.trim()) return;
  return copyWithFeedback(
    detokenizeMentions(raw),
    item.id,
    "Failed to copy message:",
  );
}

function startReply(item) {
  cancelEdit();
  let replyText = "";
  if (item?.type === "poll") {
    replyText = item.pollQuestion || item.text || "";
  } else if (item?.type === "gif") {
    replyText = "GIF";
  } else {
    replyText = item.text || "";
  }
  const snapshot = {
    id: item.id,
    text: replyText,
    displayName: resolveDisplayName(item.uid, item.displayName),
    uid: item.uid,
    avatarColor: item.avatarColor || null,
  };
  if (item.type) snapshot.type = item.type;
  if (item.type === "gif" && item.gif) {
    snapshot.gif = {
      url: item.gif.url || null,
      previewUrl: item.gif.previewUrl || null,
      width: item.gif.width || 0,
      height: item.gif.height || 0,
      title: item.gif.title || "",
    };
  }
  if (item.mentions) snapshot.mentions = item.mentions;
  if (item.mentionUids) snapshot.mentionUids = item.mentionUids;
  replyingTo.value = snapshot;
  nextTick(() => composerRef.value?.focus());
}

function cancelReply() {
  replyingTo.value = null;
}

async function jumpToMessage(id) {
  const container = messageContainer.value;
  if (!container) return;
  const el = container.querySelector(`[data-message-id="${id}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  highlightedMessageId.value = id;
  setTimeout(() => {
    highlightedMessageId.value = null;
  }, 2000);
}

function startEdit(msg) {
  cancelReply();
  editingId.value = msg.id;
  editText.value = detokenizeMentions(msg.text || "");

  nextTick(() => {
    nextTick(() => {
      const refVal = editInputRef.value;
      const editor = Array.isArray(refVal) ? refVal[0] : refVal;
      if (!editor) return;
      try {
        editor.focus();
        editor.setSelectionToEnd();
      } catch (e) {
        console.error("startEdit focus error:", e);
      }
    });
  });
}

function cancelEdit() {
  editingId.value = null;
  editText.value = "";
}

async function saveEdit(id) {
  const text = sanitizeMessage(editText.value);
  if (!text.trim()) {
    cancelEdit();
    return;
  }
  const original = messages.value.find((m) => m.id === id);
  if (original && sanitizeMessage(original.text) === text) {
    cancelEdit();
    return;
  }
  editingId.value = null;
  editText.value = "";
  try {
    const tokenizedText = isDm.value ? text : tokenizeMentions(text);
    const mentionFields = isDm.value
      ? { mentions: null, mentionUids: null }
      : buildMentionFields(tokenizedText);
    const editPayload = isDm.value
      ? { text: tokenizedText, editedAt: serverTimestamp() }
      : {
          text: tokenizedText,
          editedAt: serverTimestamp(),
          mentions: mentionFields.mentions,
          mentionUids: mentionFields.mentionUids,
        };
    await update(dbRef(db, `${messagesPath.value}/${id}`), editPayload);
    const snap = await get(dbRef(db, messagesPath.value));
    if (snap.exists()) {
      const msgs = snap.val();
      const updates = {};
      for (const [msgId, msg] of Object.entries(msgs)) {
        if (msg.replyTo?.id === id) {
          updates[`${msgId}/replyTo/text`] = tokenizedText;
          if (!isDm.value) {
            updates[`${msgId}/replyTo/mentions`] =
              mentionFields.mentions || null;
            updates[`${msgId}/replyTo/mentionUids`] =
              mentionFields.mentionUids || null;
          }
        }
      }
      if (Object.keys(updates).length > 0)
        await update(dbRef(db, messagesPath.value), updates);
    }
    if (isDm.value) {
      await refreshDmPreviewAfterEdit();
    }
  } catch (err) {
    console.error("Failed to save edit:", err);
  }
}

async function markReplyRefsDeleted(id) {
  const snap = await get(dbRef(db, messagesPath.value));
  if (!snap.exists()) return;
  const msgs = snap.val();
  const updates = {};
  for (const [msgId, msg] of Object.entries(msgs)) {
    if (msg.replyTo?.id === id) updates[`${msgId}/replyTo/deleted`] = true;
  }
  if (Object.keys(updates).length > 0)
    await update(dbRef(db, messagesPath.value), updates);
}

async function refreshDmPreviewAfterDelete() {
  if (!isDm.value || !props.threadId || !props.user?.uid) return;
  const partnerUid =
    props.partner?.uid || partnerUidFromThread(props.threadId, props.user.uid);
  if (!partnerUid) return;
  await refreshDmThreadLastMessage({
    threadId: props.threadId,
    myUid: props.user.uid,
    partnerUid,
  });
}

async function refreshDmPreviewAfterEdit() {
  if (!isDm.value || !props.threadId || !props.user?.uid) return;
  const partnerUid =
    props.partner?.uid || partnerUidFromThread(props.threadId, props.user.uid);
  if (!partnerUid) return;
  await refreshDmThreadLastMessage({
    threadId: props.threadId,
    myUid: props.user.uid,
    partnerUid,
  });
}

async function deleteMessage(id) {
  await markReplyRefsDeleted(id);
  await remove(dbRef(db, `${messagesPath.value}/${id}`));
  await refreshDmPreviewAfterDelete();
}

async function promptDelete(id) {
  const msg = messages.value.find((m) => m.id === id);
  if (msg?.uid === props.user.uid) {
    await deleteMessage(id);
    return;
  }
  deleteDialog.value = {
    show: true,
    id,
    name: resolveDisplayName(msg?.uid, msg?.displayName) || "this message",
  };
}

function cancelDelete() {
  deleteDialog.value = { show: false, id: null, name: "" };
}

async function confirmDelete() {
  const id = deleteDialog.value.id;
  deleteDialog.value = { show: false, id: null, name: "" };
  await deleteMessage(id);
}

function flashSlurWarning() {
  slurShakeKey.value++;
  slurWarningVisible.value = true;
  clearTimeout(slurWarningTimer);
  slurWarningTimer = setTimeout(() => {
    slurWarningVisible.value = false;
  }, 4000);
}

watch(newMessage, (value) => {
  if (!slurWarningVisible.value) return;
  if (!containsSlur(value)) {
    slurWarningVisible.value = false;
    clearTimeout(slurWarningTimer);
  }
});

async function sendMessage() {
  if (emojiVisible.value || mentionVisible.value) return;
  if (chatLocked.value && !isAdmin.value) return;
  if (isMuted.value) return;
  const text = sanitizeMessage(newMessage.value);
  if (!text.trim()) return;
  if (text.length > 10000) return;
  if (containsSlur(text)) {
    flashSlurWarning();
    return;
  }

  const gifUrl = parseGifUrlFromText(text);
  if (gifUrl) {
    newMessage.value = "";
    clearTimeout(typingTimeout);
    if (myTypingRef) remove(myTypingRef).catch(() => {});
    const dims = await probeGifDimensions(gifUrl);
    if (!dims.width || !dims.height) {
      newMessage.value = text;
      return;
    }
    await sendGif({
      url: gifUrl,
      previewUrl: gifUrl,
      width: dims.width,
      height: dims.height,
      title: "",
      source: "url",
      id: null,
    });
    return;
  }

  newMessage.value = "";

  clearTimeout(typingTimeout);
  if (myTypingRef) remove(myTypingRef).catch(() => {});
  totalCount++;
  shouldScrollToBottom = true;
  const replySnapshot = replyingTo.value ? { ...replyingTo.value } : null;
  const tokenizedText = isDm.value ? text : tokenizeMentions(text);
  const mentionFields = isDm.value
    ? { mentions: null, mentionUids: null }
    : buildMentionFields(tokenizedText);
  replyingTo.value = null;
  try {
    await push(dbRef(db, messagesPath.value), {
      text: tokenizedText,
      displayName: props.user.displayName,
      uid: props.user.uid,
      avatarColor: props.user.preferences?.avatarColor || null,
      timestamp: serverTimestamp(),
      ...(mentionFields.mentions
        ? {
            mentions: mentionFields.mentions,
            mentionUids: mentionFields.mentionUids,
          }
        : {}),
      ...(replySnapshot ? { replyTo: replySnapshot } : {}),
    });
    if (isDm.value && props.partner?.uid) {
      await recordDmSend({
        threadId: props.threadId,
        myUid: props.user.uid,
        partnerUid: props.partner.uid,
        message: { type: "text", text: tokenizedText },
      });
    }
  } catch (err) {
    console.error("Failed to send message:", err);
    newMessage.value = text;
    replyingTo.value = replySnapshot;
    totalCount--;
  }
}

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "🎉"];

const LONG_PRESS_MS = 450;
const LONG_PRESS_MOVE_TOLERANCE = 8;

const touchActiveMessageId = ref(null);
const longPress = { timer: null, startX: 0, startY: 0 };

function cancelLongPress() {
  clearTimeout(longPress.timer);
  longPress.timer = null;
}

function handleMessageTouchStart(messageId, e) {
  if (e.touches.length !== 1) return;
  longPress.startX = e.touches[0].clientX;
  longPress.startY = e.touches[0].clientY;
  cancelLongPress();
  longPress.timer = setTimeout(() => {
    touchActiveMessageId.value = messageId;
    if (navigator.vibrate) navigator.vibrate(10);
  }, LONG_PRESS_MS);
}

function handleMessageTouchMove(e) {
  if (!longPress.timer) return;
  const dx = Math.abs(e.touches[0].clientX - longPress.startX);
  const dy = Math.abs(e.touches[0].clientY - longPress.startY);
  if (dx > LONG_PRESS_MOVE_TOLERANCE || dy > LONG_PRESS_MOVE_TOLERANCE) {
    cancelLongPress();
  }
}

function handleMessageTouchEnd() {
  cancelLongPress();
}

const reactionPickerMessageId = ref(null);
const reactionPickerPos = ref({ top: 0, right: 8, origin: "bottom right" });
const reactionPickerVisible = ref(false);
const reactionPickerEl = ref(null);
let reactionPickerAnchorEl = null;
let reactionPickerScrollEl = null;

function getReactionList(message) {
  const reactions = message.reactions;
  if (!reactions || typeof reactions !== "object") return [];
  const myUid = props.user.uid;
  return Object.entries(reactions)
    .map(([emoji, reactors]) => {
      if (!reactors || typeof reactors !== "object") return null;
      const uids = Object.keys(reactors).filter(
        (uid) => reactors[uid] === true,
      );
      if (uids.length === 0) return null;
      const names = uids.map((uid) => resolveDisplayName(uid, "Someone"));
      const iReacted = uids.includes(myUid);
      const tooltip =
        names.length <= 3
          ? names.join(", ")
          : `${names.slice(0, 3).join(", ")} +${names.length - 3} more`;
      return { emoji, count: uids.length, iReacted, tooltip };
    })
    .filter(Boolean)
    .sort((a, b) => b.count - a.count);
}

async function toggleReaction(messageId, emoji) {
  if (!messageId || !emoji) return;
  if (isMuted.value) return;
  const myUid = props.user.uid;
  const msg = messages.value.find((m) => m.id === messageId);
  const currentVal = msg?.reactions?.[emoji]?.[myUid] === true;
  try {
    if (currentVal) {
      await remove(
        dbRef(
          db,
          `${messagesPath.value}/${messageId}/reactions/${emoji}/${myUid}`,
        ),
      );
    } else {
      await set(
        dbRef(
          db,
          `${messagesPath.value}/${messageId}/reactions/${emoji}/${myUid}`,
        ),
        true,
      );
    }
  } catch (err) {
    console.error("Failed to toggle reaction:", err);
  }
  closeReactionPicker();
}

const PICKER_QUICK_W = 322;
const PICKER_QUICK_H = 46;
const PICKER_GAP = 6;

function computePickerPosition(anchorEl) {
  if (!anchorEl) return null;
  const rect = anchorEl.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const RIGHT_NUDGE = 8;
  let right = vw - rect.right - RIGHT_NUDGE;
  let top = rect.top - PICKER_QUICK_H - PICKER_GAP;
  let origin = "bottom right";

  if (top < 8) {
    top = rect.bottom + PICKER_GAP;
    origin = "top right";
    if (top + PICKER_QUICK_H > vh - 8) {
      top = Math.max(8, vh - PICKER_QUICK_H - 8);
    }
  }

  right = Math.max(8, Math.min(right, vw - PICKER_QUICK_W - 8));
  return { top, right, origin };
}

function openReactionPicker(messageId, event) {
  if (isMuted.value) return;

  const btn = event?.currentTarget || event?.target;
  const inlineAddBtn = btn?.closest?.(".reaction-badge--add");
  const messageEl = btn?.closest?.(".message");
  const actionsEl = btn?.closest?.(".msg-actions");
  const anchor =
    inlineAddBtn ||
    actionsEl ||
    messageEl?.querySelector(".msg-actions") ||
    messageEl ||
    btn ||
    null;
  reactionPickerAnchorEl = anchor;

  reactionPickerMessageId.value = messageId;
  reactionPickerVisible.value = true;

  const pos = computePickerPosition(anchor);
  if (pos) reactionPickerPos.value = pos;

  const scrollEl =
    anchor?.closest(".messages") || document.querySelector(".messages");
  if (scrollEl) {
    reactionPickerScrollEl = scrollEl;
    scrollEl.addEventListener("scroll", closeReactionPicker, { passive: true });
  }
  window.addEventListener("resize", closeReactionPicker, { passive: true });
  window.addEventListener("blur", closeReactionPicker);
}

function closeReactionPicker() {
  if (!reactionPickerVisible.value) return;
  reactionPickerVisible.value = false;
  reactionPickerMessageId.value = null;
  reactionPickerAnchorEl = null;
  if (reactionPickerScrollEl) {
    reactionPickerScrollEl.removeEventListener("scroll", closeReactionPicker);
    reactionPickerScrollEl = null;
  }
  window.removeEventListener("resize", closeReactionPicker);
  window.removeEventListener("blur", closeReactionPicker);
}

function handleQuickReaction(emoji) {
  if (!reactionPickerMessageId.value) return;
  toggleReaction(reactionPickerMessageId.value, emoji);
}
</script>

<style scoped>
.chat {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  overflow: hidden;
  min-height: 0;
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

.messages-wrap {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.header {
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

.header-brand {
  display: flex;
  align-items: center;
  gap: 9px;
  flex-shrink: 0;
  pointer-events: none;
  -webkit-user-select: none;
  user-select: none;
}

.header-logo {
  width: 24px;
  height: 24px;
  object-fit: contain;
  flex-shrink: 0;
  pointer-events: none;
  -webkit-user-drag: none;
  -webkit-user-select: none;
  user-select: none;
}

.header-wordmark {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.2px;
  white-space: nowrap;
  pointer-events: none;
  -webkit-user-select: none;
  user-select: none;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
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

.messages {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior-y: contain;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
  padding: 16px 18px 4px;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.dm-intro {
  margin-top: auto;
  padding: 32px 4px 24px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 16px;
}

.dm-intro-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 32px;
  font-weight: 700;
  letter-spacing: 0;
  margin-bottom: 4px;
}

.dm-intro-name {
  font-size: 32px;
  font-weight: 800;
  color: var(--text);
  letter-spacing: -0.6px;
  line-height: 1.1;
}

.dm-intro-text {
  font-size: 14px;
  color: var(--text-muted);
  line-height: 1.5;
  max-width: 520px;
}

.dm-intro-text strong {
  color: var(--text);
  font-weight: 600;
}

.load-more {
  align-self: stretch;
  width: 100%;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 16px;
  font-size: 15px;
  font-family: "Satoshi", sans-serif;
  font-weight: 600;
  color: var(--text);
  cursor: pointer;
  margin-bottom: 12px;
  transition:
    background 160ms ease,
    border-color 160ms ease,
    color 160ms ease,
    transform 160ms var(--ease-out-quint);
  text-align: center;
}

.load-more:hover {
  background: var(--border);
  border-color: var(--text-muted);
  color: var(--text);
}

.load-more:active:not(:disabled) {
  transform: scale(0.99);
  transition-duration: 80ms;
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
  bottom: 20px;
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
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  color: var(--surface);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
  z-index: 20;
}

.jump-to-bottom:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
}

.jump-to-bottom:active {
  transform: translateY(0) scale(0.94);
  transition-duration: 80ms;
}

.jump-unread {
  position: absolute;
  top: -7px;
  right: -4px;
  background: var(--accent);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  font-family: "Satoshi", sans-serif;
  border-radius: 99px;
  min-width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 3px;
  line-height: 1;
  pointer-events: none;
  letter-spacing: 0.01em;
}

.jump-fade-enter-active,
.jump-fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.jump-fade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.jump-fade-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

.message {
  font-size: 15px;
  line-height: 1.55;
  padding: 2px 16px;
  border-radius: 4px;
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.msg-row {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 12px;
}

.message--start {
  margin-top: 16px;
}

.message:first-child,
.message--start:first-child {
  margin-top: 0;
}

.message:hover {
  background: rgba(44, 42, 39, 0.05);
}

.chat.picker-locked {
  pointer-events: none;
}

.chat.picker-locked .message:not(.message--picker-active):hover {
  background: transparent;
}

.chat.picker-locked .message--picker-active,
.chat.picker-locked .message--picker-active:hover {
  background: rgba(44, 42, 39, 0.05);
}

.message--editing {
  background: rgba(90, 90, 240, 0.04);
}

.msg-left {
  width: 38px;
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 2px;
}

.msg-avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  letter-spacing: 0;
  user-select: none;
}

.msg-side-time {
  font-size: 10px;
  color: var(--text-muted);
  opacity: 0;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  margin-top: 6px;
}

.message:hover .msg-side-time,
.message--picker-active .msg-side-time {
  opacity: 1;
}

.msg-right {
  flex: 1;
  min-width: 0;
}

.msg-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 1px;
}

.msg-name {
  font-size: 15px;
  font-weight: 700;
  line-height: 1.4;
}

.msg-time {
  font-size: 11px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.msg-body--emoji .text {
  font-size: 48px;
  line-height: 1.15;
  display: block;
}

.msg-body--emoji .edited-label {
  font-size: 10px;
  vertical-align: middle;
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

.message:hover .msg-actions,
.message--picker-active .msg-actions {
  opacity: 1;
  pointer-events: all;
}

.msg-action-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.msg-action-btn:hover {
  background: var(--surface-2);
  color: var(--text);
}

.msg-action-btn:hover :deep(svg) {
  transform: scale(1.15);
  transition: transform 180ms var(--ease-out-quint);
}

.msg-action-btn :deep(svg) {
  transition: transform 180ms var(--ease-out-quint);
}

.msg-action-btn.active {
  background: rgba(90, 90, 240, 0.12);
  color: var(--accent);
}

.msg-action-btn.danger:hover {
  background: rgba(192, 57, 43, 0.1);
  color: var(--danger);
}

.reply-row {
  display: flex;
  align-items: stretch;
  gap: 12px;
  cursor: pointer;
  user-select: none;
  margin-bottom: 1px;
}

.reply-avatar-small {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 8px;
  font-weight: 700;
  color: white;
  flex-shrink: 0;
}

.reply-connector-cell {
  width: 38px;
  flex-shrink: 0;
  align-self: stretch;
  display: flex;
  align-items: flex-end;
  padding-left: 19px;
  position: relative;
}

.reply-connector {
  position: absolute;
  left: 19px;
  top: 40%;
  bottom: -1px;
  width: 28px;
  border-top: 2px solid rgba(44, 42, 39, 0.22);
  border-left: 2px solid rgba(44, 42, 39, 0.22);
  border-top-left-radius: 5px;
}

.reply-row:hover .reply-connector {
  border-color: rgba(44, 42, 39, 0.5);
}

.reply-content {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 3.5px;
  overflow: hidden;
  padding-bottom: 2px;
}

.reply-name {
  font-size: 12.5px;
  font-weight: 700;
  white-space: nowrap;
  flex-shrink: 0;
  opacity: 0.85;
}

.reply-text {
  font-size: 12.5px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: 0.75;
  transition:
    color 0.1s,
    opacity 0.1s;
}

.reply-row:hover .reply-name {
  opacity: 1;
}

.reply-row:hover .reply-text {
  color: var(--text);
  opacity: 1;
}

.reply-text--deleted {
  opacity: 0.6;
  font-style: italic;
  flex-shrink: 0;
  overflow: visible;
  text-overflow: clip;
  padding-right: 2px;
}

.reply-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 14px;
  border-bottom: 1px solid var(--border);
}

.reply-bar-to {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-muted);
}

.reply-bar-to strong {
  font-weight: 700;
}

.reply-bar-close {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  transition:
    color 140ms ease,
    background 140ms ease,
    transform 140ms var(--ease-out-quint);
}

.reply-bar-close:hover {
  color: var(--text);
  background: var(--surface-2);
}

.reply-bar-close:active {
  transform: scale(0.88);
  transition-duration: 60ms;
}

.message--ping {
  background: rgba(90, 90, 240, 0.08);
  border-left: 3px solid rgba(90, 90, 240, 0.9);
  padding-left: 13px;
}

.message--ping:hover {
  background: rgba(90, 90, 240, 0.12);
}

@keyframes msg-highlight-fade {
  0%,
  40% {
    background: rgba(90, 90, 240, 0.18);
  }
  100% {
    background: transparent;
  }
}

.message--highlighted {
  animation: msg-highlight-fade 2s ease forwards;
}

.delete-overlay {
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
  transition:
    background 160ms ease,
    opacity 160ms ease,
    transform 160ms var(--ease-out-quint),
    box-shadow 160ms ease;
}

.del-cancel-btn {
  background: var(--surface-2);
  color: var(--text);
}

.del-cancel-btn:hover {
  background: var(--border);
}

.del-cancel-btn:active {
  transform: scale(0.98);
  transition-duration: 80ms;
}

.del-confirm-btn {
  background: var(--danger);
  color: #fff;
}

.del-confirm-btn:hover {
  opacity: 0.92;
}

.del-confirm-btn:active {
  opacity: 0.85;
  transform: scale(0.98);
  transition-duration: 80ms;
}

.edited-label {
  font-size: 10px;
  color: var(--text-muted);
  margin-left: 3px;
}

.edit-area {
  min-width: 0;
  padding: 3px 0;
  position: relative;
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
  line-height: 1.4;
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease;
}

.edit-input:focus {
  border-color: var(--accent);
  box-shadow: var(--focus-ring);
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

.text :deep(.mention) {
  display: inline-block;
  color: #3e31bf;
  background: #d3cbff;
  border-radius: 4px;
  padding: 0 4px;
  font-weight: 700;
  line-height: 1.35;
  text-decoration: none;
  cursor: pointer;
  transition:
    background 0.12s ease,
    color 0.12s ease,
    box-shadow 0.12s ease;
}

.text :deep(.mention:hover) {
  color: #4940da;
  background: #ddd5ff;
}

.text :deep(.mention--me) {
  color: #3e31bf;
  background: #d3cbff;
}

.text :deep(.mention--me:hover) {
  color: #4940da;
  background: #ddd5ff;
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
  min-width: 0;
  max-width: 100%;
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
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.typing-name {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: inline-block;
  vertical-align: bottom;
  font-weight: 400;
  color: inherit;
}

.chat-banner-stack {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.chat-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 16px 6px;
  padding: 9px 13px;
  border: 1px solid transparent;
  border-radius: var(--radius);
  font-size: 13px;
  font-weight: 600;
  flex-shrink: 0;
  line-height: 1.35;
  will-change: opacity, transform, margin, padding, max-height;
}

.chat-banner svg {
  flex-shrink: 0;
}

.chat-banner--locked {
  background: rgba(192, 57, 43, 0.06);
  border-color: rgba(192, 57, 43, 0.18);
  color: var(--danger);
}

.chat-banner--muted {
  background: rgba(234, 88, 12, 0.06);
  border-color: rgba(234, 88, 12, 0.22);
  color: #c2410c;
}

.chat-banner--slur {
  background: linear-gradient(
    180deg,
    rgba(220, 38, 38, 0.09),
    rgba(220, 38, 38, 0.05)
  );
  border-color: rgba(220, 38, 38, 0.28);
  color: #b91c1c;
  box-shadow: 0 4px 14px rgba(220, 38, 38, 0.08);
}

.chat-banner--slur svg {
  animation: slurShake 0.45s cubic-bezier(0.36, 0.07, 0.19, 0.97);
}

@keyframes slurShake {
  0%,
  100% {
    transform: translateX(0);
  }
  20% {
    transform: translateX(-2px) rotate(-3deg);
  }
  40% {
    transform: translateX(2px) rotate(3deg);
  }
  60% {
    transform: translateX(-1px) rotate(-2deg);
  }
  80% {
    transform: translateX(1px) rotate(2deg);
  }
}

.chat-banner-enter-active {
  transition:
    opacity 0.22s ease,
    transform 0.28s cubic-bezier(0.22, 1, 0.36, 1),
    max-height 0.28s cubic-bezier(0.22, 1, 0.36, 1),
    margin-bottom 0.28s cubic-bezier(0.22, 1, 0.36, 1),
    padding-top 0.28s cubic-bezier(0.22, 1, 0.36, 1),
    padding-bottom 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}
.chat-banner-leave-active {
  transition:
    opacity 0.16s ease,
    transform 0.22s cubic-bezier(0.4, 0, 1, 1),
    max-height 0.22s cubic-bezier(0.4, 0, 1, 1),
    margin-bottom 0.22s cubic-bezier(0.4, 0, 1, 1),
    padding-top 0.22s cubic-bezier(0.4, 0, 1, 1),
    padding-bottom 0.22s cubic-bezier(0.4, 0, 1, 1);
}
.chat-banner-enter-from,
.chat-banner-leave-to {
  opacity: 0;
  transform: translateY(-6px);
  max-height: 0;
  margin-bottom: 0;
  padding-top: 0;
  padding-bottom: 0;
  overflow: hidden;
}
.chat-banner-enter-to,
.chat-banner-leave-from {
  opacity: 1;
  max-height: 60px;
}

.input-wrap {
  margin: 0 16px 10px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  flex-shrink: 0;
  position: relative;
  z-index: 1;
  box-shadow: 0 4px 12px rgba(20, 20, 20, 0.03);
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}

.input-wrap,
.input-row {
  cursor: text;
}

.input-wrap:focus-within {
  border-color: rgba(44, 42, 39, 0.16);
  box-shadow: 0 8px 18px rgba(20, 20, 20, 0.05);
}

.input-row {
  display: flex;
  align-items: flex-start;
  padding: 10px 12px;
  gap: 8px;
}

.message-composer,
textarea {
  flex: 1;
  display: block;
  border: none;
  outline: none;
  font-size: 16px;
  font-family: "Satoshi", sans-serif;
  background: transparent;
  color: var(--text);
  padding: 4px 0 0;
  line-height: 1.4;
  resize: none;
  min-height: 22px;
  margin: 0;
  min-width: 0;
}

textarea {
  max-height: 160px;
  overflow-y: auto;
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

.attach-wrap {
  position: relative;
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.attach-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  padding: 0;
  flex-shrink: 0;
  transition:
    background 140ms ease,
    color 140ms ease;
}

.attach-btn:hover:not(:disabled) {
  background: var(--surface-2);
  color: var(--text);
}

.attach-btn.open {
  color: var(--text);
}

.attach-btn :deep(svg) {
  transition: transform 400ms var(--ease-out-quint);
}

.attach-btn.open :deep(svg) {
  transform: rotate(135deg);
}

.attach-btn:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.attach-btn:disabled {
  cursor: default;
  opacity: 0.5;
}

.attach-menu {
  position: absolute;
  bottom: calc(100% - 2px);
  left: -6px;
  min-width: 220px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 6px;
  box-shadow:
    0 12px 36px rgba(0, 0, 0, 0.14),
    0 2px 8px rgba(0, 0, 0, 0.06);
  z-index: 70;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.attach-menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  background: none;
  border: none;
  border-radius: 6px;
  padding: 9px 10px;
  color: var(--text);
  font-family: "Satoshi", sans-serif;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
  transition:
    background 140ms ease,
    color 140ms ease;
}

.attach-menu-item:hover,
.attach-menu-item:focus-visible {
  background: var(--surface-2);
  outline: none;
}

.attach-menu-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  transition: color 140ms ease;
}

.attach-menu-item:hover .attach-menu-icon {
  color: var(--text);
}

.attach-menu-label {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.attach-menu-enter-active {
  transition:
    opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  transform-origin: bottom left;
}
.attach-menu-leave-active {
  transition:
    opacity 0.15s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.2s cubic-bezier(0.4, 0, 1, 1);
  transform-origin: bottom left;
}
.attach-menu-enter-from {
  opacity: 0;
  transform: translateY(8px) scale(0.92);
}
.attach-menu-leave-to {
  opacity: 0;
  transform: translateY(4px) scale(0.96);
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
  justify-self: end;
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
  animation: presencePulse 2.4s ease-in-out infinite;
}

.online-btn-count {
  letter-spacing: 0.1px;
}

.online-panel {
  width: 216px;
  flex-shrink: 0;
  background: var(--surface);
  border-left: 1px solid rgba(44, 42, 39, 0.08);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.online-panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 18px 12px;
  flex-shrink: 0;
}

.online-panel-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #3ba55c;
  flex-shrink: 0;
  animation: presencePulse 2.4s ease-in-out infinite;
}

@keyframes presencePulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(59, 165, 92, 0.4);
  }
  50% {
    box-shadow: 0 0 0 5px rgba(59, 165, 92, 0);
  }
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
  background: rgba(44, 42, 39, 0.05);
  border: 1px solid rgba(44, 42, 39, 0.08);
  border-radius: 999px;
  padding: 1px 7px;
  min-width: 22px;
  text-align: center;
}

.online-panel-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px 10px 10px;
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
  from {
    opacity: 0;
    transform: translateX(10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
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

.offline-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.offline-name-row {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.user-muted-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.online-crown {
  color: #c9a84c;
  flex-shrink: 0;
}

.offline-name {
  font-size: 13px;
  flex: none;
}

.offline-last-seen {
  font-size: 11px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.panel-slide-enter-active {
  transition:
    width 0.26s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.2s ease;
  overflow: hidden;
}
.panel-slide-leave-active {
  transition:
    width 0.22s ease-in,
    opacity 0.18s ease-in;
  overflow: hidden;
}
.panel-slide-enter-from,
.panel-slide-leave-to {
  width: 0;
  opacity: 0;
}

.composer-wrap {
  position: relative;
  flex-shrink: 0;
}

.emoji-autocomplete {
  position: absolute;
  bottom: calc(100% + 4px);
  left: 16px;
  right: auto;
  width: 360px;
  max-width: calc(100% - 32px);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 4px;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.13),
    0 2px 8px rgba(0, 0, 0, 0.07);
  z-index: 50;
  max-height: 324px;
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.emoji-autocomplete::-webkit-scrollbar {
  width: 0;
  height: 0;
}

.emoji-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border-radius: 6px;
  cursor: pointer;
}

.emoji-item.active {
  background: var(--surface-2);
}

.emoji-autocomplete:not(.picker--keyboard) .emoji-item:hover {
  background: var(--surface-2);
}

.emoji-native {
  font-size: 20px;
  line-height: 1;
  flex-shrink: 0;
  width: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.emoji-native :deep(img.twemoji) {
  width: 20px;
  height: 20px;
  vertical-align: middle;
}

.emoji-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  text-transform: capitalize;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.emoji-shortcode {
  font-size: 11px;
  color: var(--text-muted);
  font-family: ui-monospace, monospace;
  flex-shrink: 0;
}

.mention-autocomplete {
  position: absolute;
  bottom: calc(100% + 4px);
  left: 16px;
  right: auto;
  width: 360px;
  max-width: calc(100% - 32px);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 4px;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.13),
    0 2px 8px rgba(0, 0, 0, 0.07);
  z-index: 60;
  max-height: 324px;
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.mention-autocomplete--edit {
  bottom: auto;
  top: calc(100% + 4px);
  left: 0;
  max-width: min(320px, 100%);
}

.mention-autocomplete::-webkit-scrollbar {
  width: 0;
  height: 0;
}

.mention-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border-radius: 6px;
  cursor: pointer;
}

.mention-item.active {
  background: var(--surface-2);
}

.mention-autocomplete:not(.picker--keyboard) .mention-item:hover {
  background: var(--surface-2);
}

.mention-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.mention-avatar--everyone {
  background: #d97706;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  padding-bottom: 1px;
}

.mention-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.emoji-fade-enter-active {
  transition:
    opacity 0.12s ease,
    transform 0.12s cubic-bezier(0.16, 1, 0.3, 1);
}
.emoji-fade-leave-active {
  transition:
    opacity 0.08s ease,
    transform 0.08s ease;
}
.emoji-fade-enter-from {
  opacity: 0;
  transform: translateY(6px) scale(0.97);
}
.emoji-fade-leave-to {
  opacity: 0;
  transform: translateY(4px) scale(0.98);
}

.mention-fade-enter-active {
  transition:
    opacity 0.12s ease,
    transform 0.12s cubic-bezier(0.16, 1, 0.3, 1);
}
.mention-fade-leave-active {
  transition:
    opacity 0.08s ease,
    transform 0.08s ease;
}
.mention-fade-enter-from {
  opacity: 0;
  transform: translateY(6px) scale(0.97);
}
.mention-fade-leave-to {
  opacity: 0;
  transform: translateY(4px) scale(0.98);
}

.msg-body--poll {
  padding: 4px 0 2px;
  max-width: 460px;
}

.poll-card {
  background: var(--surface);
  border: 1px solid rgba(44, 42, 39, 0.14);
  border-radius: 14px;
  padding: 14px 14px 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: 0 4px 14px rgba(20, 20, 20, 0.05);
  transition: border-color 160ms ease;
}

.poll-card--closed {
  background: var(--bg);
}

.poll-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.poll-card-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 10.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--accent);
}

.poll-card--closed .poll-card-eyebrow {
  color: var(--text-muted);
}

.poll-card-eyebrow :deep(svg) {
  width: 12px;
  height: 12px;
}

.poll-card-tag {
  font-size: 9.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 2px 8px;
  white-space: nowrap;
}

.poll-question {
  margin: -2px 0 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
  line-height: 1.35;
  word-break: break-word;
}

.poll-options {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.poll-option {
  position: relative;
  display: block;
  width: 100%;
  height: 42px;
  background: var(--bg);
  border: 1px solid rgba(44, 42, 39, 0.1);
  border-radius: 10px;
  padding: 0;
  cursor: pointer;
  text-align: left;
  font-family: "Satoshi", sans-serif;
  color: var(--text);
  overflow: hidden;
  isolation: isolate;
  transition:
    border-color 140ms ease,
    background 140ms ease,
    transform 140ms var(--ease-out-quint);
}

.poll-option:hover:not(:disabled) {
  border-color: rgba(90, 90, 240, 0.4);
  background: var(--surface-2);
}

.poll-option:disabled {
  cursor: default;
}

.poll-option-fill {
  position: absolute;
  inset: 0 auto 0 0;
  width: 0%;
  background: linear-gradient(
    90deg,
    rgba(90, 90, 240, 0.14),
    rgba(90, 90, 240, 0.06)
  );
  z-index: -1;
  transition: width 420ms cubic-bezier(0.22, 1, 0.36, 1);
  pointer-events: none;
}

.poll-option--voted {
  border-color: rgba(90, 90, 240, 0.55);
  background: var(--surface);
}

.poll-option--voted .poll-option-fill {
  background: linear-gradient(
    90deg,
    rgba(90, 90, 240, 0.26),
    rgba(90, 90, 240, 0.12)
  );
}

.poll-option--leading:not(.poll-option--voted) {
  border-color: rgba(90, 90, 240, 0.3);
}

.poll-option--closed {
  opacity: 0.9;
  cursor: default;
}

.poll-option--closed:hover {
  border-color: rgba(44, 42, 39, 0.1);
  background: var(--bg);
}

.poll-option-content {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 100%;
  padding: 0 12px;
  min-width: 0;
}

.poll-option-check {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1.8px solid rgba(44, 42, 39, 0.28);
  background: var(--surface);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
  transition:
    background 160ms ease,
    border-color 160ms ease,
    transform 160ms var(--ease-out-quint);
}

.poll-option:hover:not(:disabled) .poll-option-check {
  border-color: rgba(90, 90, 240, 0.55);
}

.poll-option--voted .poll-option-check {
  background: var(--accent);
  border-color: var(--accent);
  transform: scale(1.05);
}

.poll-option-label {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.poll-option--voted .poll-option-label {
  color: var(--text);
}

.poll-option-stats {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.poll-option-votes {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: 0.01em;
  min-width: 56px;
  text-align: right;
  white-space: nowrap;
}

.poll-option-percent {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-muted);
  min-width: 34px;
  text-align: right;
}

.poll-option--voted .poll-option-percent,
.poll-option--leading .poll-option-percent {
  color: var(--accent);
}

.poll-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
  margin-top: 2px;
}

.poll-total {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--text-muted);
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.poll-total--btn {
  background: none;
  border: none;
  padding: 0;
  font-family: "Satoshi", sans-serif;
  cursor: pointer;
  text-decoration: none;
  text-underline-offset: 3px;
  text-decoration-thickness: 1.5px;
  transition: color 140ms ease;
}

.poll-total--btn:hover {
  color: var(--accent);
  text-decoration: underline;
}

.poll-total--btn:focus-visible {
  outline: none;
  color: var(--accent);
  text-decoration: underline;
}

.poll-time-remaining {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: 0.01em;
  font-variant-numeric: tabular-nums;
}

.poll-time-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #22c55e;
  flex-shrink: 0;
  box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.18);
  animation: presencePulse 2.4s ease-in-out infinite;
}

.poll-time-remaining--ended {
  color: var(--danger);
}

.poll-time-remaining--ended .poll-time-dot {
  background: var(--danger);
  box-shadow: 0 0 0 2px rgba(192, 57, 43, 0.18);
  animation: none;
}

.reply-text :deep(.poll-inline) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.reply-text :deep(.poll-inline-icon) {
  font-size: 11px;
}

.reply-text :deep(.poll-inline-label) {
  font-weight: 700;
}

.reply-text :deep(.gif-inline) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.reply-text :deep(.gif-inline-icon) {
  font-size: 11px;
}

.reply-text :deep(.gif-inline-label) {
  font-weight: 700;
  letter-spacing: 0.04em;
}

.reply-text :deep(.gif-inline-title) {
  color: var(--text-muted);
}

.msg-body--gif {
  padding: 4px 0 2px;
  max-width: 100%;
}

.gif-message {
  position: relative;
  display: block;
  width: 100%;
  border: none;
  outline: none;
  padding: 0;
  margin: 0;
  font: inherit;
  border-radius: 10px;
  overflow: hidden;
  background: transparent;
  cursor: pointer;
  text-decoration: none;
  isolation: isolate;
  content-visibility: auto;
  contain-intrinsic-size: auto 240px;
}

.gif-message:focus,
.gif-message:focus-visible {
  outline: none;
  box-shadow: none;
}

.gif-message-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  background: transparent;
  border: none;
  outline: none;
  pointer-events: none;
}

.gif-lightbox-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.84);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 600;
  padding: 32px;
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
}

.gif-lightbox-img {
  display: block;
  max-width: min(92vw, 1100px);
  max-height: calc(100dvh - 80px);
  height: auto;
  object-fit: contain;
  border: none;
  outline: none;
  border-radius: 12px;
  background: transparent;
  box-shadow: none;
  -webkit-user-drag: none;
  -webkit-user-select: none;
  user-select: none;
}

.gif-lightbox-close {
  position: absolute;
  top: 18px;
  right: 18px;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: rgba(30, 30, 32, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.9);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  transition:
    background 140ms ease,
    transform 140ms var(--ease-out-quint);
}

.gif-lightbox-close:hover {
  background: rgba(50, 50, 54, 0.9);
}

.gif-lightbox-close:active {
  transform: scale(0.92);
}

.gif-lightbox-fade-enter-active {
  transition: opacity 200ms ease;
}
.gif-lightbox-fade-leave-active {
  transition: opacity 160ms ease;
}
.gif-lightbox-fade-enter-from,
.gif-lightbox-fade-leave-to {
  opacity: 0;
}

.gif-lightbox-fade-enter-active .gif-lightbox-img,
.gif-lightbox-fade-enter-active .gif-lightbox-close {
  transition:
    opacity 240ms ease,
    transform 280ms var(--ease-out-quint);
}
.gif-lightbox-fade-leave-active .gif-lightbox-img,
.gif-lightbox-fade-leave-active .gif-lightbox-close {
  transition:
    opacity 140ms ease,
    transform 160ms cubic-bezier(0.4, 0, 1, 1);
}
.gif-lightbox-fade-enter-from .gif-lightbox-img,
.gif-lightbox-fade-enter-from .gif-lightbox-close {
  opacity: 0;
  transform: scale(0.95);
}
.gif-lightbox-fade-leave-to .gif-lightbox-img,
.gif-lightbox-fade-leave-to .gif-lightbox-close {
  opacity: 0;
  transform: scale(0.97);
}

.poll-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 510;
  -webkit-backdrop-filter: blur(3px);
  backdrop-filter: blur(3px);
  padding: 20px;
}

.poll-modal {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 22px 24px 20px;
  width: 100%;
  max-width: 460px;
  max-height: calc(100dvh - 40px);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.22);
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.poll-modal::-webkit-scrollbar {
  width: 0;
  height: 0;
}

.poll-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: -4px;
}

.poll-modal-title {
  margin: 0;
  font-size: 20px;
  font-weight: 800;
  color: var(--text);
  letter-spacing: -0.3px;
  line-height: 1.2;
}

.poll-modal-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  flex-shrink: 0;
  transition:
    background 140ms ease,
    color 140ms ease,
    transform 140ms var(--ease-out-quint);
}

.poll-modal-close:hover {
  background: var(--surface-2);
  color: var(--text);
}

.poll-modal-close:active {
  transform: scale(0.92);
}

.poll-section {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.poll-section-label {
  font-size: 14px;
  font-weight: 800;
  color: var(--text);
  letter-spacing: -0.1px;
}

.poll-input-wrap {
  position: relative;
  width: 100%;
}

.poll-text-input {
  width: 100%;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 11px 14px;
  color: var(--text);
  font-size: 14.5px;
  font-family: "Satoshi", sans-serif;
  font-weight: 500;
  outline: none;
  line-height: 1.4;
  transition:
    border-color 160ms ease,
    background 160ms ease;
}

.poll-text-input::placeholder {
  color: var(--text-muted);
  opacity: 0.7;
}

.poll-text-input:focus {
  border-color: var(--accent);
  background: var(--surface);
}

.poll-char-count {
  align-self: flex-end;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  margin-top: -2px;
}

.poll-answer-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.poll-answer-row {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 3px 4px 3px 12px;
  transition:
    border-color 160ms ease,
    background 160ms ease;
}

.poll-answer-row:focus-within {
  border-color: var(--accent);
  background: var(--surface);
}

.poll-text-input--answer {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  padding: 7px 4px;
  border-radius: 0;
}

.poll-text-input--answer:focus {
  background: transparent;
}

.poll-answer-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  flex-shrink: 0;
  transition:
    background 140ms ease,
    color 140ms ease,
    transform 140ms var(--ease-out-quint);
}

.poll-answer-remove :deep(svg) {
  width: 18px;
  height: 18px;
}

.poll-answer-remove:hover {
  background: rgba(192, 57, 43, 0.1);
  color: var(--danger);
}

.poll-answer-remove:active {
  transform: scale(0.9);
}

.poll-add-answer-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: 2px;
}

.poll-add-answer-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 8px 14px 8px 12px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
  font-family: "Satoshi", sans-serif;
  cursor: pointer;
  transition:
    color 140ms ease,
    border-color 140ms ease,
    background 140ms ease,
    transform 140ms var(--ease-out-quint);
}

.poll-add-answer-btn:hover {
  border-color: rgba(90, 90, 240, 0.55);
  color: var(--accent);
  background: rgba(90, 90, 240, 0.06);
}

.poll-add-answer-btn:active {
  transform: scale(0.97);
}

.poll-duration-wrap {
  position: relative;
  width: 100%;
}

.poll-duration-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 11px 14px;
  color: var(--text);
  font-size: 14px;
  font-weight: 600;
  font-family: "Satoshi", sans-serif;
  cursor: pointer;
  outline: none;
  text-align: left;
  transition:
    border-color 160ms ease,
    background 160ms ease;
}

.poll-duration-btn:hover {
  background: var(--surface);
}

.poll-duration-btn.open {
  border-color: var(--accent);
  background: var(--surface);
}

.poll-duration-chevron {
  color: var(--text-muted);
  flex-shrink: 0;
  transition: transform 200ms var(--ease-out-quint);
}

.poll-duration-btn.open .poll-duration-chevron {
  transform: rotate(180deg);
  color: var(--accent);
}

.poll-duration-menu {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 0;
  right: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 6px;
  box-shadow:
    0 12px 36px rgba(0, 0, 0, 0.14),
    0 2px 8px rgba(0, 0, 0, 0.06);
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 260px;
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.poll-duration-menu::-webkit-scrollbar {
  width: 0;
  height: 0;
}

.poll-duration-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  background: transparent;
  border: none;
  border-radius: 6px;
  padding: 9px 12px;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text);
  font-family: "Satoshi", sans-serif;
  cursor: pointer;
  text-align: left;
  transition:
    background 120ms ease,
    color 120ms ease;
}

.poll-duration-item:hover {
  background: var(--surface-2);
}

.poll-duration-item.active {
  color: var(--accent);
}

.poll-duration-item.active:hover {
  background: rgba(90, 90, 240, 0.08);
}

.poll-duration-menu-enter-active {
  transition:
    opacity 0.14s ease,
    transform 0.18s cubic-bezier(0.16, 1, 0.3, 1);
  transform-origin: bottom center;
}
.poll-duration-menu-leave-active {
  transition:
    opacity 0.1s ease,
    transform 0.1s ease;
  transform-origin: bottom center;
}
.poll-duration-menu-enter-from,
.poll-duration-menu-leave-to {
  opacity: 0;
  transform: translateY(4px) scale(0.97);
}

.poll-modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding-top: 4px;
  margin-top: 2px;
}

.poll-switch-row {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
  -webkit-user-select: none;
  user-select: none;
  flex: 1;
  min-width: 0;
}

.poll-switch-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  line-height: 1.3;
}

.poll-post-btn {
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 10px 26px;
  font-size: 14.5px;
  font-weight: 700;
  font-family: "Satoshi", sans-serif;
  cursor: pointer;
  flex-shrink: 0;
  transition:
    background 160ms ease,
    opacity 160ms ease,
    transform 160ms var(--ease-out-quint);
}

.poll-post-btn:hover:not(:disabled) {
  background: var(--accent-hover);
}

.poll-post-btn:active:not(:disabled) {
  transform: scale(0.97);
  transition-duration: 80ms;
}

.poll-post-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.modal-fade-enter-active {
  transition:
    opacity 200ms ease,
    backdrop-filter 200ms ease;
}
.modal-fade-leave-active {
  transition:
    opacity 160ms ease,
    backdrop-filter 160ms ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
  -webkit-backdrop-filter: blur(0.001px);
  backdrop-filter: blur(0.001px);
}

.modal-fade-enter-active .delete-box,
.modal-fade-enter-active .poll-modal,
.modal-fade-enter-active .view-votes-modal {
  transition:
    opacity 220ms ease,
    transform 240ms var(--ease-out-quint);
}
.modal-fade-leave-active .delete-box,
.modal-fade-leave-active .poll-modal,
.modal-fade-leave-active .view-votes-modal {
  transition:
    opacity 140ms ease,
    transform 160ms cubic-bezier(0.4, 0, 1, 1);
}
.modal-fade-enter-from .delete-box,
.modal-fade-enter-from .poll-modal,
.modal-fade-enter-from .view-votes-modal {
  opacity: 0;
  transform: translateY(10px) scale(0.96);
}
.modal-fade-leave-to .delete-box,
.modal-fade-leave-to .poll-modal,
.modal-fade-leave-to .view-votes-modal {
  opacity: 0;
  transform: translateY(6px) scale(0.97);
}

.view-votes-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 520;
  -webkit-backdrop-filter: blur(3px);
  backdrop-filter: blur(3px);
  padding: 20px;
}

.view-votes-modal {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 22px 24px 18px;
  width: 100%;
  max-width: 440px;
  max-height: calc(100dvh - 40px);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 18px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.22);
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.view-votes-modal::-webkit-scrollbar {
  width: 0;
  height: 0;
}

.view-votes-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.view-votes-head-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1;
  padding-top: 2px;
}

.view-votes-title {
  margin: 0;
  font-size: 17px;
  font-weight: 800;
  color: var(--text);
  line-height: 1.3;
  letter-spacing: -0.2px;
  word-break: break-word;
}

.view-votes-subtitle {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: 0.01em;
}

.view-votes-list {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.view-votes-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.view-votes-section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.view-votes-section-label {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
  line-height: 1.3;
  word-break: break-word;
  flex: 1;
  min-width: 0;
}

.view-votes-section-count {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: 0.01em;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.view-votes-bar-track {
  position: relative;
  width: 100%;
  height: 4px;
  background: rgba(44, 42, 39, 0.08);
  border-radius: 999px;
  overflow: hidden;
}

.view-votes-bar-fill {
  position: absolute;
  inset: 0 auto 0 0;
  background: var(--accent);
  opacity: 0.85;
  border-radius: 999px;
  transition: width 480ms cubic-bezier(0.22, 1, 0.36, 1);
}

.view-votes-voters {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding-top: 4px;
}

.view-votes-voter {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
  min-width: 0;
}

.view-votes-voter-avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
  letter-spacing: 0;
}

.view-votes-voter-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reactions-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 4px 0 2px;
  position: relative;
}

.reaction-badge {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 6px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: rgba(44, 42, 39, 0.06);
  cursor: pointer;
  font-family: "Satoshi", sans-serif;
  transition:
    background-color 120ms ease,
    border-color 120ms ease,
    transform 80ms var(--ease-out-quint);
  will-change: transform;
}

.reaction-badge:hover {
  background: rgba(44, 42, 39, 0.1);
  border-color: rgba(44, 42, 39, 0.1);
}

.reaction-badge:active:not(:disabled) {
  transform: scale(0.92);
  transition-duration: 50ms;
}

.reaction-badge:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.reaction-badge--me {
  background: rgba(90, 90, 240, 0.16);
  border-color: rgba(90, 90, 240, 0.55);
}

.reaction-badge--me:hover {
  background: rgba(90, 90, 240, 0.22);
  border-color: rgba(90, 90, 240, 0.75);
}

.reaction-badge--add {
  color: var(--text-muted);
  padding: 0 6px;
  gap: 0;
  opacity: 0;
  pointer-events: none;
  transition:
    opacity 120ms ease,
    background-color 120ms ease,
    color 120ms ease,
    border-color 120ms ease;
}

.message:hover .reaction-badge--add,
.message--picker-active .reaction-badge--add,
.reaction-badge--add:focus-visible {
  opacity: 1;
  pointer-events: auto;
}

@media (hover: none) {
  .reaction-badge--add {
    opacity: 1;
    pointer-events: auto;
  }
}

.reaction-badge--add:hover {
  color: var(--text);
  background: rgba(44, 42, 39, 0.1);
}

.reaction-emoji {
  display: inline-flex;
  align-items: center;
  font-size: 20px;
  line-height: 1;
}

.reaction-count {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.reaction-badge--me .reaction-count {
  color: var(--accent);
  font-weight: 700;
}

.reaction-tooltip {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  background: #2c2a27;
  color: #f7f2e6;
  font-size: 12px;
  font-weight: 600;
  padding: 5px 9px;
  border-radius: 5px;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transform: translateX(-50%) translateY(4px);
  transition:
    opacity 140ms ease,
    transform 140ms ease;
  z-index: 100;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
}

.reaction-badge:hover .reaction-tooltip {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

.reaction-pop-enter-active {
  transition:
    transform 260ms var(--ease-spring),
    opacity 160ms ease;
}
.reaction-pop-leave-active {
  transition:
    transform 160ms var(--ease-out-quint),
    opacity 120ms ease;
  position: absolute;
}
.reaction-pop-enter-from {
  transform: scale(0.4);
  opacity: 0;
}
.reaction-pop-leave-to {
  transform: scale(0.6);
  opacity: 0;
}

.reaction-picker-wrap {
  position: fixed;
  z-index: 540;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow:
    0 18px 50px rgba(0, 0, 0, 0.22),
    0 4px 14px rgba(0, 0, 0, 0.08);
  transform-origin: var(--rp-origin, bottom right);
  overflow: hidden;
}

.reaction-picker-quick {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 5px 6px;
}

.reaction-picker-btn {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  transition:
    background-color 100ms ease,
    transform 100ms var(--ease-out-quint);
  line-height: 1;
  color: var(--text-muted);
}

.reaction-picker-btn:hover {
  background: rgba(44, 42, 39, 0.08);
}

.reaction-picker-btn:active {
  transform: scale(0.92);
  transition-duration: 50ms;
}

.reaction-picker-enter-active {
  transition:
    opacity 180ms ease,
    transform 220ms var(--ease-spring);
}
.reaction-picker-leave-active {
  transition:
    opacity 120ms ease,
    transform 120ms var(--ease-out-quint);
}
.reaction-picker-enter-from {
  opacity: 0;
  transform: scale(0.85) translateY(4px);
}
.reaction-picker-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(2px);
}

.message--touch-active {
  background: rgba(44, 42, 39, 0.05);
}
.message--touch-active .msg-actions {
  opacity: 1;
  pointer-events: all;
}

@media (max-width: 640px) {
  .messages {
    padding: 12px 10px 4px;
  }
  .message {
    padding: 2px 10px;
  }
  .msg-row {
    gap: 10px;
  }
  .msg-actions {
    right: 4px;
  }
  .input-wrap {
    margin: 0 8px 8px;
    border-radius: 12px;
  }
  .input-row {
    align-items: center;
    padding: 6px 8px;
    gap: 6px;
  }
  .input-row .message-composer {
    padding: 0;
  }
  .attach-btn {
    width: 36px;
    height: 36px;
  }
  .online-panel {
    display: none;
  }
  .jump-to-bottom {
    bottom: 12px;
    right: 12px;
  }
  .header {
    padding: 0 6px;
  }
}
</style>
