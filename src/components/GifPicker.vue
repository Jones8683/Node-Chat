<template>
  <transition name="gif-picker-fade">
    <div
      v-if="isOpen"
      class="gif-picker"
      ref="rootRef"
      role="dialog"
      aria-label="GIF picker"
    >
      <div class="gif-picker-head">
        <div class="gif-search-wrap">
          <Search :size="14" stroke-width="2.4" class="gif-search-icon" />
          <input
            ref="inputRef"
            v-model="query"
            id="gif-search"
            name="gif-search"
            type="text"
            class="gif-search-input"
            placeholder="Search Giphy"
            maxlength="80"
            @keydown.escape.prevent="handleEscape"
            @keydown.enter.prevent="submitSearch"
          />
          <button
            v-if="query"
            type="button"
            class="gif-search-clear"
            @click.stop="clearQuery"
            aria-label="Clear search"
          >
            <X :size="11" stroke-width="2.6" />
          </button>
        </div>
      </div>

      <div
        v-if="!committedQuery.trim() && recents.length"
        class="gif-recents"
        aria-label="Recently used GIFs"
      >
        <div class="gif-recents-head">
          <Clock :size="11" stroke-width="2.6" />
          <span>Recently Used</span>
          <button
            type="button"
            class="gif-recents-clear"
            @click.stop="clearRecents"
            title="Clear recent GIFs"
          >
            Clear
          </button>
        </div>
        <div class="gif-recents-row">
          <button
            v-for="gif in recents"
            :key="'r-' + gif.id"
            type="button"
            class="gif-recent-tile"
            @click.stop="selectGif(gif)"
            :title="gif.title || 'GIF'"
          >
            <img
              :src="gif.previewUrl"
              :alt="gif.title || 'GIF'"
              class="gif-recent-img"
              loading="lazy"
              draggable="false"
            />
          </button>
        </div>
      </div>

      <div
        v-else-if="!committedQuery.trim() && categories.length"
        class="gif-categories"
      >
        <button
          v-for="cat in categories"
          :key="cat.name"
          type="button"
          class="gif-category"
          @click.stop="useCategory(cat)"
        >
          <img
            v-if="cat.image"
            :src="cat.image"
            :alt="cat.name"
            class="gif-category-img"
            loading="lazy"
          />
          <span class="gif-category-label">{{ cat.name }}</span>
        </button>
      </div>

      <div class="gif-results" ref="resultsRef" @scroll.passive="handleScroll">
        <div v-if="loadError" class="gif-empty">
          <span>Couldn't load GIFs. Try again.</span>
          <button type="button" class="gif-retry-btn" @click.stop="retry">
            Retry
          </button>
        </div>
        <div
          v-else-if="!gifs.length && isLoading"
          class="gif-empty gif-empty--loading"
        >
          <span class="gif-spinner" aria-hidden="true"></span>
        </div>
        <div v-else-if="!gifs.length" class="gif-empty">
          <span v-if="query.trim()">No GIFs found for "{{ query }}"</span>
          <span v-else>No GIFs to show</span>
        </div>

        <template v-else>
          <div class="gif-grid">
            <div v-for="(col, ci) in columns" :key="ci" class="gif-col">
              <button
                v-for="gif in col"
                :key="gif.id"
                type="button"
                class="gif-tile"
                :style="{ aspectRatio: `${gif.width} / ${gif.height}` }"
                @click="selectGif(gif)"
                :title="gif.title || 'GIF'"
              >
                <img
                  :src="gif.previewUrl"
                  :alt="gif.title || 'GIF'"
                  class="gif-tile-img"
                  loading="lazy"
                  draggable="false"
                />
              </button>
            </div>
          </div>

          <div v-if="isLoading" class="gif-loading">
            <span class="gif-spinner" aria-hidden="true"></span>
          </div>
        </template>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from "vue";
import { Search, X, Clock } from "lucide-vue-next";

const props = defineProps({
  isOpen: { type: Boolean, default: false },
});
const emit = defineEmits(["close", "select"]);

const GIPHY_KEY = import.meta.env.VITE_GIPHY_KEY;
const SEARCH_LIMIT = 30;
const TRENDING_LIMIT = 30;
const COLUMN_COUNT = 2;
const CACHE_TTL = 30 * 60 * 1000;
const RECENTS_KEY = "node-chat:gif-recents";
const RECENTS_MAX = 12;

const query = ref("");
const committedQuery = ref("");
const gifs = ref([]);
const isLoading = ref(false);
const loadError = ref(false);
const offset = ref(0);
const hasMore = ref(true);
const categories = ref([]);
const recents = ref(loadRecents());

const inputRef = ref(null);
const resultsRef = ref(null);
const rootRef = ref(null);

let activeRequestId = 0;

const cache = new Map();
let lastCacheKey = null;
let columnsCache = {
  cols: null,
  heights: null,
  builtFrom: null,
  builtLength: 0,
};

function loadRecents() {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (r) =>
          r &&
          typeof r.url === "string" &&
          typeof r.previewUrl === "string" &&
          typeof r.id === "string",
      )
      .slice(0, RECENTS_MAX);
  } catch {
    return [];
  }
}

function saveRecents() {
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(recents.value));
  } catch {
    return;
  }
}

function pushRecent(gif) {
  const entry = {
    id: gif.id,
    title: gif.title || "",
    url: gif.url,
    previewUrl: gif.previewUrl,
    width: gif.width,
    height: gif.height,
  };
  const filtered = recents.value.filter((r) => r.id !== entry.id);
  filtered.unshift(entry);
  recents.value = filtered.slice(0, RECENTS_MAX);
  saveRecents();
}

function clearRecents() {
  recents.value = [];
  saveRecents();
}

function getCurrentKey() {
  const q = committedQuery.value.trim().toLowerCase();
  return q ? `search:${q}` : "trending";
}

const columns = computed(() => {
  const list = gifs.value;
  const canResume =
    columnsCache.builtFrom === list &&
    columnsCache.cols &&
    columnsCache.heights &&
    columnsCache.builtLength <= list.length;

  let cols;
  let heights;
  let startIndex;

  if (canResume) {
    cols = columnsCache.cols.map((c) => c.slice());
    heights = columnsCache.heights.slice();
    startIndex = columnsCache.builtLength;
  } else {
    cols = Array.from({ length: COLUMN_COUNT }, () => []);
    heights = new Array(COLUMN_COUNT).fill(0);
    startIndex = 0;
  }

  for (let i = startIndex; i < list.length; i++) {
    const g = list[i];
    let idx = 0;
    for (let c = 1; c < COLUMN_COUNT; c++) {
      if (heights[c] < heights[idx]) idx = c;
    }
    cols[idx].push(g);
    const ratio = g.height / Math.max(g.width, 1);
    heights[idx] += ratio;
  }

  columnsCache = {
    cols,
    heights,
    builtFrom: list,
    builtLength: list.length,
  };

  return cols;
});

function normalizeGifs(rawList) {
  if (!Array.isArray(rawList)) return [];
  return rawList
    .map((item) => {
      const images = item?.images || {};
      const preview =
        images.fixed_width ||
        images.fixed_width_small ||
        images.downsized ||
        images.original;
      const full =
        images.fixed_width ||
        images.downsized_medium ||
        images.downsized ||
        images.original;
      if (!preview?.url || !full?.url) return null;
      const width = Number(full.width || preview.width) || 200;
      const height = Number(full.height || preview.height) || 200;
      return {
        id: item.id,
        title: item.title || "",
        previewUrl: preview.url,
        url: full.url,
        width,
        height,
      };
    })
    .filter(Boolean);
}

function loadFromCache(key) {
  const entry = cache.get(key);
  if (!entry) return false;
  if (Date.now() - entry.ts > CACHE_TTL) {
    cache.delete(key);
    return false;
  }
  gifs.value = entry.gifs;
  offset.value = entry.offset;
  hasMore.value = entry.hasMore;
  loadError.value = false;
  isLoading.value = false;
  nextTick(() => {
    if (resultsRef.value) resultsRef.value.scrollTop = entry.scrollTop || 0;
  });
  return true;
}

function saveToCache(key) {
  cache.set(key, {
    gifs: gifs.value.slice(),
    offset: offset.value,
    hasMore: hasMore.value,
    scrollTop: resultsRef.value?.scrollTop || 0,
    ts: Date.now(),
  });
}

function persistScroll() {
  if (!lastCacheKey) return;
  const entry = cache.get(lastCacheKey);
  if (entry) entry.scrollTop = resultsRef.value?.scrollTop || 0;
}

async function fetchGifs({ key, reset }) {
  if (!GIPHY_KEY) {
    loadError.value = true;
    return;
  }
  const reqId = ++activeRequestId;

  if (reset) {
    isLoading.value = true;
    loadError.value = false;
    offset.value = 0;
    hasMore.value = true;
    gifs.value = [];
  } else {
    if (!hasMore.value || isLoading.value) return;
    isLoading.value = true;
  }

  try {
    let url;
    if (key === "trending") {
      url = `https://api.giphy.com/v1/gifs/trending?api_key=${encodeURIComponent(GIPHY_KEY)}&limit=${TRENDING_LIMIT}&offset=${offset.value}&rating=pg-13&bundle=messaging_non_clips`;
    } else {
      const q = key.slice(7);
      url = `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(GIPHY_KEY)}&q=${encodeURIComponent(q)}&limit=${SEARCH_LIMIT}&offset=${offset.value}&rating=pg-13&lang=en&bundle=messaging_non_clips`;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Giphy ${res.status}`);
    const json = await res.json();
    if (reqId !== activeRequestId) return;
    const items = normalizeGifs(json.data);
    gifs.value = reset ? items : gifs.value.concat(items);
    offset.value += items.length;
    const totalCount = json?.pagination?.total_count ?? 0;
    hasMore.value = items.length > 0 && offset.value < totalCount;
    saveToCache(key);
  } catch (err) {
    if (reqId !== activeRequestId) return;
    console.error("Failed to load GIFs:", err);
    loadError.value = true;
  } finally {
    if (reqId === activeRequestId) isLoading.value = false;
  }
}

function loadForCurrentQuery({ force = false } = {}) {
  const key = getCurrentKey();
  if (lastCacheKey && lastCacheKey !== key) persistScroll();
  lastCacheKey = key;
  if (!force && loadFromCache(key)) return;
  fetchGifs({ key, reset: true });
}

async function fetchCategories() {
  if (!GIPHY_KEY || categories.value.length) return;
  try {
    const url = `https://api.giphy.com/v1/gifs/categories?api_key=${encodeURIComponent(GIPHY_KEY)}`;
    const res = await fetch(url);
    if (!res.ok) return;
    const json = await res.json();
    const list = (json?.data || [])
      .map((c) => ({
        name: c.name,
        image:
          c?.gif?.images?.fixed_width_small?.url ||
          c?.gif?.images?.fixed_width_downsampled?.url ||
          c?.gif?.images?.preview_gif?.url ||
          null,
      }))
      .filter((c) => c.name);
    categories.value = list;
  } catch {
    return;
  }
}

function selectGif(gif) {
  persistScroll();
  pushRecent(gif);
  emit("select", {
    url: gif.url,
    previewUrl: gif.previewUrl,
    width: gif.width,
    height: gif.height,
    title: gif.title || "",
    source: "giphy",
    id: gif.id,
  });
}

function useCategory(cat) {
  query.value = cat.name;
  committedQuery.value = cat.name;
  loadForCurrentQuery();
}

function clearQuery() {
  query.value = "";
  if (committedQuery.value !== "") {
    committedQuery.value = "";
    loadForCurrentQuery();
  }
  inputRef.value?.focus();
}

function submitSearch() {
  const trimmed = query.value.trim();
  if (trimmed === committedQuery.value.trim()) return;
  committedQuery.value = trimmed;
  loadForCurrentQuery();
}

function handleEscape() {
  if (query.value) {
    query.value = "";
    return;
  }
  emit("close");
}

function retry() {
  loadError.value = false;
  loadForCurrentQuery({ force: true });
}

let scrollRafId = 0;
function handleScroll() {
  if (scrollRafId) return;
  scrollRafId = requestAnimationFrame(() => {
    scrollRafId = 0;
    const el = resultsRef.value;
    if (!el) return;
    if (lastCacheKey) {
      const entry = cache.get(lastCacheKey);
      if (entry) entry.scrollTop = el.scrollTop;
    }
    if (isLoading.value || !hasMore.value) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distFromBottom < 320) {
      fetchGifs({ key: getCurrentKey(), reset: false });
    }
  });
}

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      nextTick(() => inputRef.value?.focus());
      fetchCategories();
      loadForCurrentQuery();
    } else {
      persistScroll();
      query.value = "";
      committedQuery.value = "";
      lastCacheKey = null;
      if (resultsRef.value) resultsRef.value.scrollTop = 0;
    }
  },
);

onMounted(() => {
  if (props.isOpen) {
    fetchCategories();
    loadForCurrentQuery();
    nextTick(() => inputRef.value?.focus());
  }
});

onUnmounted(() => {
  activeRequestId++;
});
</script>

<style scoped>
.gif-picker {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 16px;
  right: 16px;
  max-width: 420px;
  width: auto;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 8px 8px 6px;
  box-shadow:
    0 18px 48px rgba(0, 0, 0, 0.16),
    0 4px 14px rgba(0, 0, 0, 0.07);
  z-index: 65;
  display: flex;
  flex-direction: column;
  height: 440px;
  max-height: calc(100dvh - 120px);
  overflow: hidden;
}

.gif-picker-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 2px 8px;
  flex-shrink: 0;
}

.gif-search-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 6px 10px;
  transition:
    border-color 140ms ease,
    background 140ms ease;
}

.gif-search-wrap:focus-within {
  border-color: rgba(44, 42, 39, 0.18);
  background: var(--surface);
}

.gif-search-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.gif-search-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-family: "Satoshi", sans-serif;
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  min-width: 0;
  padding: 2px 0;
  height: 20px;
}

.gif-search-input::placeholder {
  color: var(--text-muted);
  font-weight: 500;
}

.gif-search-clear {
  background: rgba(44, 42, 39, 0.08);
  border: none;
  border-radius: 999px;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 120ms ease;
  padding: 0;
}

.gif-search-clear:hover {
  background: rgba(44, 42, 39, 0.16);
}

.gif-recents {
  flex-shrink: 0;
  padding: 0 2px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.gif-recents-head {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--text-muted);
  padding: 0 2px;
}

.gif-recents-head > span {
  flex: 1;
}

.gif-recents-clear {
  background: none;
  border: none;
  padding: 0;
  font-family: "Satoshi", sans-serif;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--text-muted);
  cursor: pointer;
  transition: color 120ms ease;
}

.gif-recents-clear:hover {
  color: var(--text);
}

.gif-recents-row {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.gif-recents-row::-webkit-scrollbar {
  display: none;
}

.gif-recent-tile {
  position: relative;
  flex: 0 0 auto;
  width: 64px;
  height: 64px;
  border-radius: 8px;
  border: none;
  background: var(--surface-2);
  overflow: hidden;
  padding: 0;
  cursor: pointer;
  outline: none;
}

.gif-recent-tile::after {
  content: "";
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.14);
  opacity: 0;
  pointer-events: none;
  transition: opacity 140ms ease;
}

.gif-recent-tile:hover::after {
  opacity: 1;
}

.gif-recent-tile:active::after {
  background: rgba(255, 255, 255, 0.22);
  opacity: 1;
}

.gif-recent-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.gif-categories {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding: 0 2px 8px;
  flex-shrink: 0;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.gif-categories::-webkit-scrollbar {
  display: none;
}

.gif-category {
  position: relative;
  flex-shrink: 0;
  width: 90px;
  height: 56px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  overflow: hidden;
  cursor: pointer;
  padding: 0;
  transition: border-color 120ms ease;
}

.gif-category:hover {
  border-color: rgba(44, 42, 39, 0.18);
}

.gif-category-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: brightness(0.78);
  pointer-events: none;
}

.gif-category-label {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 800;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);
  text-transform: capitalize;
  letter-spacing: 0.2px;
  padding: 0 6px;
  text-align: center;
}

.gif-results {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 2px 2px 6px;
  min-height: 0;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.gif-results::-webkit-scrollbar {
  width: 0;
  height: 0;
  display: none;
}

.gif-grid {
  display: flex;
  gap: 6px;
  align-items: flex-start;
}

.gif-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.gif-tile {
  position: relative;
  width: 100%;
  background: var(--surface-2);
  border: none;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  padding: 0;
  display: block;
  outline: none;
}

.gif-tile::after {
  content: "";
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.14);
  opacity: 0;
  pointer-events: none;
  transition: opacity 140ms ease;
}

.gif-tile:hover::after {
  opacity: 1;
}

.gif-tile:active::after {
  background: rgba(255, 255, 255, 0.22);
  opacity: 1;
}

.gif-tile-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  background: var(--surface-2);
}

.gif-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 100%;
  padding: 40px 20px;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 600;
  text-align: center;
}

.gif-retry-btn {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 6px 14px;
  font-family: "Satoshi", sans-serif;
  font-size: 12px;
  font-weight: 700;
  color: var(--text);
  cursor: pointer;
  transition:
    background 140ms ease,
    border-color 140ms ease;
}

.gif-retry-btn:hover {
  background: var(--border);
  border-color: rgba(44, 42, 39, 0.18);
}

.gif-loading {
  display: flex;
  justify-content: center;
  padding: 14px 0 8px;
}

.gif-spinner {
  width: 16px;
  height: 16px;
  border-radius: 999px;
  border: 2px solid rgba(44, 42, 39, 0.12);
  border-top-color: rgba(44, 42, 39, 0.7);
  animation: gifSpin 0.8s linear infinite;
}

.gif-empty--loading .gif-spinner {
  width: 22px;
  height: 22px;
  border-width: 2.5px;
}

@keyframes gifSpin {
  to {
    transform: rotate(360deg);
  }
}

.gif-picker-fade-enter-active {
  transition:
    opacity 0.22s ease,
    transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
  transform-origin: bottom left;
}
.gif-picker-fade-leave-active {
  transition:
    opacity 0.16s ease,
    transform 0.18s cubic-bezier(0.4, 0, 1, 1);
  transform-origin: bottom left;
}
.gif-picker-fade-enter-from {
  opacity: 0;
  transform: translateY(10px) scale(0.94);
}
.gif-picker-fade-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.96);
}

@media (max-width: 520px) {
  .gif-picker {
    left: 8px;
    right: 8px;
    max-width: none;
    height: 60dvh;
    max-height: 60dvh;
  }
}
</style>
