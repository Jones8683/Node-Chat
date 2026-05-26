<template>
  <div
    ref="rootRef"
    class="composer-editor"
    :class="{
      'composer-editor--disabled': disabled,
      'composer-editor--empty': isEmpty,
    }"
    :data-placeholder="placeholder"
    :contenteditable="disabled ? 'false' : 'true'"
    spellcheck="true"
    autocorrect="off"
    autocapitalize="sentences"
    enterkeyhint="send"
    role="textbox"
    aria-multiline="true"
    @input="onInput"
    @keydown="onKeydown"
    @beforeinput="onBeforeInput"
    @paste="onPaste"
    @mousedown="onMousedown"
    @drop.prevent
    @blur="$emit('blur', $event)"
    @focus="$emit('focus', $event)"
    @compositionstart="composing = true"
    @compositionend="onCompositionEnd"
  ></div>
</template>

<script setup>
import { ref, watch, onMounted, nextTick } from "vue";

const props = defineProps({
  modelValue: { type: String, default: "" },
  placeholder: { type: String, default: "" },
  disabled: { type: Boolean, default: false },
  maxLength: { type: Number, default: 10000 },
  resolveMention: { type: Function, required: true },
  currentUserUid: { type: String, default: "" },
});

const emit = defineEmits([
  "update:modelValue",
  "input",
  "keydown",
  "submit",
  "blur",
  "focus",
]);

const rootRef = ref(null);
const isEmpty = ref(true);
let composing = false;
let suppressNextEmit = false;

const PILL_ATTR = "data-mention-uid";
const PILL_NAME_ATTR = "data-mention-name";

function isPill(node) {
  return (
    node &&
    node.nodeType === 1 &&
    node.hasAttribute &&
    node.hasAttribute(PILL_ATTR)
  );
}

function createPillElement(uid, displayName) {
  const span = document.createElement("span");
  span.className = "mention";
  if (uid === props.currentUserUid) span.className += " mention--me";
  span.setAttribute(PILL_ATTR, uid);
  span.setAttribute(PILL_NAME_ATTR, displayName);
  span.setAttribute("contenteditable", "false");
  span.setAttribute("title", `@${displayName}`);
  span.textContent = `@${displayName}`;
  return span;
}

function serialize() {
  const root = rootRef.value;
  if (!root) return "";
  let out = "";
  for (const node of root.childNodes) {
    out += serializeNode(node);
  }
  return out.replace(/ /g, " ");
}

function serializeNode(node) {
  if (node.nodeType === 3) return node.textContent || "";
  if (node.nodeType !== 1) return "";
  if (isPill(node)) {
    const name = node.getAttribute(PILL_NAME_ATTR) || "";
    return `@${name}`;
  }
  if (node.tagName === "BR") return "\n";
  if (node.tagName === "DIV" || node.tagName === "P") {
    let inner = "";
    for (const child of node.childNodes) inner += serializeNode(child);
    return (inner ? `\n${inner}` : "\n").replace(/^\n\n/, "\n");
  }
  let inner = "";
  for (const child of node.childNodes) inner += serializeNode(child);
  return inner;
}

function getCaretOffset() {
  const root = rootRef.value;
  if (!root) return 0;
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return serialize().length;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.endContainer)) return serialize().length;
  return offsetOfPoint(root, range.endContainer, range.endOffset);
}

function getSelectionRange() {
  const root = rootRef.value;
  if (!root) return { start: 0, end: 0 };
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) {
    const len = serialize().length;
    return { start: len, end: len };
  }
  const range = sel.getRangeAt(0);
  if (
    !root.contains(range.startContainer) ||
    !root.contains(range.endContainer)
  ) {
    const len = serialize().length;
    return { start: len, end: len };
  }
  const start = offsetOfPoint(root, range.startContainer, range.startOffset);
  const end = offsetOfPoint(root, range.endContainer, range.endOffset);
  return start <= end ? { start, end } : { start: end, end: start };
}

function offsetOfPoint(root, container, offset) {
  let total = 0;
  function walk(node) {
    if (node === container && node.nodeType === 3) {
      total += offset;
      return true;
    }
    if (node.nodeType === 3) {
      total += (node.textContent || "").length;
      return false;
    }
    if (node.nodeType === 1) {
      if (isPill(node)) {
        if (node === container) {
          if (offset === 0) return true;
          const name = node.getAttribute(PILL_NAME_ATTR) || "";
          total += `@${name}`.length;
          return true;
        }
        const name = node.getAttribute(PILL_NAME_ATTR) || "";
        total += `@${name}`.length;
        return false;
      }
      if (node.tagName === "BR") {
        if (node === container) return true;
        total += 1;
        return false;
      }
      if (node === container) {
        for (let i = 0; i < offset; i++) {
          if (walk(node.childNodes[i])) return true;
        }
        return true;
      }
      for (const child of node.childNodes) {
        if (walk(child)) return true;
      }
    }
    return false;
  }
  walk(root);
  return total;
}

function setCaretOffset(target) {
  const root = rootRef.value;
  if (!root) return;
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  let remaining = target;
  let placed = false;

  function place(node, off) {
    range.setStart(node, off);
    range.setEnd(node, off);
    placed = true;
  }

  function walk(node) {
    if (placed) return;
    if (node.nodeType === 3) {
      const len = (node.textContent || "").length;
      if (remaining <= len) {
        place(node, remaining);
        return;
      }
      remaining -= len;
      return;
    }
    if (node.nodeType === 1) {
      if (isPill(node)) {
        const name = node.getAttribute(PILL_NAME_ATTR) || "";
        const len = `@${name}`.length;
        if (remaining <= 0) {
          const parent = node.parentNode;
          const idx = Array.prototype.indexOf.call(parent.childNodes, node);
          place(parent, idx);
          return;
        }
        if (remaining < len) {
          const parent = node.parentNode;
          const idx = Array.prototype.indexOf.call(parent.childNodes, node);
          place(parent, idx + 1);
          return;
        }
        remaining -= len;
        return;
      }
      if (node.tagName === "BR") {
        if (remaining <= 0) {
          const parent = node.parentNode;
          const idx = Array.prototype.indexOf.call(parent.childNodes, node);
          place(parent, idx);
          return;
        }
        remaining -= 1;
        return;
      }
      for (const child of Array.from(node.childNodes)) {
        if (placed) return;
        walk(child);
      }
    }
  }

  walk(root);
  if (!placed) {
    range.selectNodeContents(root);
    range.collapse(false);
  }
  sel.removeAllRanges();
  sel.addRange(range);
}

function buildFromString(text) {
  const root = rootRef.value;
  if (!root) return;
  while (root.firstChild) root.removeChild(root.firstChild);
  if (!text) {
    isEmpty.value = true;
    return;
  }

  const segments = parseSegments(text);
  const frag = document.createDocumentFragment();
  for (const seg of segments) {
    if (seg.type === "pill") {
      frag.appendChild(createPillElement(seg.uid, seg.displayName));
    } else if (seg.type === "br") {
      frag.appendChild(document.createElement("br"));
    } else {
      frag.appendChild(document.createTextNode(seg.text));
    }
  }
  root.appendChild(frag);
  updateEmpty();
}

function parseSegments(text) {
  const segments = [];
  let buffer = "";
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "\n") {
      if (buffer) {
        segments.push({ type: "text", text: buffer });
        buffer = "";
      }
      segments.push({ type: "br" });
      i++;
      continue;
    }
    if (ch === "@") {
      const before = i === 0 ? "" : text[i - 1];
      if (!before || !/[A-Za-z0-9_/#]/.test(before)) {
        const rest = text.slice(i + 1);
        const match = matchMentionName(rest);
        if (match) {
          if (buffer) {
            segments.push({ type: "text", text: buffer });
            buffer = "";
          }
          segments.push({
            type: "pill",
            uid: match.uid,
            displayName: match.displayName,
          });
          i += 1 + match.displayName.length;
          continue;
        }
      }
    }
    buffer += ch;
    i++;
  }
  if (buffer) segments.push({ type: "text", text: buffer });
  return segments;
}

function matchMentionName(rest) {
  return props.resolveMention(rest);
}

function updateEmpty() {
  const root = rootRef.value;
  if (!root) return;
  const empty = !root.textContent && !root.querySelector("[data-mention-uid]");
  isEmpty.value = empty;
  if (empty && root.firstChild) {
    while (root.firstChild) root.removeChild(root.firstChild);
  }
}

function emitValue() {
  const value = serialize();
  if (value === props.modelValue) {
    updateEmpty();
    return;
  }
  suppressNextEmit = true;
  emit("update:modelValue", value);
  updateEmpty();
}

function onInput(event) {
  if (composing) {
    emit("input", event);
    return;
  }
  enforceMaxLength();
  emitValue();
  emit("input", event);
}

function onCompositionEnd(event) {
  composing = false;
  enforceMaxLength();
  emitValue();
  emit("input", event);
}

function enforceMaxLength() {
  const text = serialize();
  if (text.length <= props.maxLength) return;
  const caret = getCaretOffset();
  const trimmed = text.slice(0, props.maxLength);
  buildFromString(trimmed);
  setCaretOffset(Math.min(caret, trimmed.length));
}

function onKeydown(event) {
  emit("keydown", event);
  if (event.defaultPrevented) return;

  if (
    event.key === "Enter" &&
    !event.shiftKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !composing
  ) {
    event.preventDefault();
    emit("submit", event);
    return;
  }

  if (event.key === "Backspace" && !composing) {
    if (handlePillDelete("backward")) {
      event.preventDefault();
      emitValue();
    }
  } else if (event.key === "Delete" && !composing) {
    if (handlePillDelete("forward")) {
      event.preventDefault();
      emitValue();
    }
  }
}

function onBeforeInput(event) {
  if (
    event.inputType === "deleteContentBackward" ||
    event.inputType === "deleteContentForward"
  ) {
    const direction =
      event.inputType === "deleteContentBackward" ? "backward" : "forward";
    if (handlePillDelete(direction)) {
      event.preventDefault();
      nextTick(emitValue);
    }
  }
}

function handlePillDelete(direction) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return false;
  const range = sel.getRangeAt(0);
  if (!range.collapsed) return false;
  const root = rootRef.value;
  if (!root || !root.contains(range.startContainer)) return false;

  const pill = findAdjacentPill(range, direction);
  if (!pill) return false;
  const parent = pill.parentNode;
  const idx = Array.prototype.indexOf.call(parent.childNodes, pill);
  pill.remove();
  const newRange = document.createRange();
  newRange.setStart(parent, idx);
  newRange.collapse(true);
  sel.removeAllRanges();
  sel.addRange(newRange);
  return true;
}

function findAdjacentPill(range, direction) {
  const container = range.startContainer;
  const offset = range.startOffset;

  if (container.nodeType === 3) {
    if (direction === "backward" && offset === 0) {
      const prev = container.previousSibling;
      if (isPill(prev)) return prev;
    }
    if (
      direction === "forward" &&
      offset === (container.textContent || "").length
    ) {
      const next = container.nextSibling;
      if (isPill(next)) return next;
    }
    return null;
  }

  if (container.nodeType === 1) {
    if (direction === "backward") {
      const target = container.childNodes[offset - 1];
      if (isPill(target)) return target;
    } else {
      const target = container.childNodes[offset];
      if (isPill(target)) return target;
    }
  }
  return null;
}

function onMousedown(event) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const pill = target.closest("[data-mention-uid]");
  if (!pill || !rootRef.value?.contains(pill)) return;
  event.preventDefault();
  rootRef.value?.focus();
}

function onPaste(event) {
  event.preventDefault();
  const text = event.clipboardData?.getData("text/plain") || "";
  if (!text) return;
  insertTextAtCaret(text);
  emitValue();
}

function insertTextAtCaret(text) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) {
    rootRef.value?.appendChild(document.createTextNode(text));
    return;
  }
  const range = sel.getRangeAt(0);
  range.deleteContents();
  const segments = parseSegments(text);
  const frag = document.createDocumentFragment();
  let lastNode = null;
  for (const seg of segments) {
    if (seg.type === "pill") {
      lastNode = createPillElement(seg.uid, seg.displayName);
    } else if (seg.type === "br") {
      lastNode = document.createElement("br");
    } else {
      lastNode = document.createTextNode(seg.text);
    }
    frag.appendChild(lastNode);
  }
  range.insertNode(frag);
  if (lastNode) {
    const r = document.createRange();
    if (lastNode.nodeType === 3) {
      r.setStart(lastNode, (lastNode.textContent || "").length);
    } else {
      const parent = lastNode.parentNode;
      const idx = Array.prototype.indexOf.call(parent.childNodes, lastNode);
      r.setStart(parent, idx + 1);
    }
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
  }
  enforceMaxLength();
}

function insertMentionAtRange(uid, displayName, start, end) {
  const value = serialize();
  const before = value.slice(0, start);
  const after = value.slice(end);
  const trimmedAfter = after.startsWith(" ") ? after : ` ${after}`;
  const caret = before.length + `@${displayName} `.length;
  buildFromString(`${before}@${displayName}${trimmedAfter}`);
  setCaretOffset(caret);
  emitValue();
}

function replaceRangeWithText(start, end, text) {
  const value = serialize();
  const next = value.slice(0, start) + text + value.slice(end);
  buildFromString(next);
  setCaretOffset(start + text.length);
  emitValue();
}

function focusEditor() {
  const root = rootRef.value;
  if (!root) return;
  root.focus();
  const sel = window.getSelection();
  if (sel && (!sel.rangeCount || !root.contains(sel.anchorNode))) {
    const range = document.createRange();
    range.selectNodeContents(root);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

function setSelectionToEnd() {
  const root = rootRef.value;
  if (!root) return;
  setCaretOffset(serialize().length);
}

watch(
  () => props.modelValue,
  (value) => {
    if (suppressNextEmit) {
      suppressNextEmit = false;
      return;
    }
    const current = serialize();
    if (value === current) return;
    buildFromString(value || "");
  },
);

onMounted(() => {
  buildFromString(props.modelValue || "");
});

defineExpose({
  focus: focusEditor,
  blur: () => rootRef.value?.blur(),
  getValue: serialize,
  getCaretOffset,
  getSelectionRange,
  setCaretOffset,
  setSelectionToEnd,
  insertMentionAtRange,
  replaceRangeWithText,
  insertTextAtCaret: (text) => {
    insertTextAtCaret(text);
    emitValue();
  },
  el: () => rootRef.value,
});
</script>

<style scoped>
.composer-editor {
  position: relative;
  width: 100%;
  min-height: 1.5em;
  max-height: 160px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
  outline: none;
  font: inherit;
  color: inherit;
  line-height: 1.5;
  cursor: text;
}

.composer-editor--disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.composer-editor--empty::before {
  content: attr(data-placeholder);
  color: var(--text-muted, #888);
  pointer-events: none;
}

.composer-editor :deep(.mention) {
  display: inline-block;
  color: #3e31bf;
  background: #d3cbff;
  border-radius: 4px;
  padding: 0 4px;
  font-weight: 700;
  line-height: 1.35;
  text-decoration: none;
  cursor: pointer;
  vertical-align: baseline;
  user-select: none;
  -webkit-user-select: none;
  transition:
    background 0.12s ease,
    color 0.12s ease;
}

.composer-editor :deep(.mention:hover) {
  color: #4940da;
  background: #ddd5ff;
}

.composer-editor :deep(.mention--me) {
  color: #3e31bf;
  background: #d3cbff;
}

.composer-editor :deep(.mention--me:hover) {
  color: #4940da;
  background: #ddd5ff;
}
</style>
