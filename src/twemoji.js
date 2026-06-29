import twemoji from "twemoji";

const EMOJI_TEST = /\p{Extended_Pictographic}/u;
const cache = new Map();
const MAX_CACHE = 4000;

const BASE = {
  folder: "svg",
  ext: ".svg",
  className: "twemoji",
  base: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/",
};

const STRING_OPTIONS = {
  ...BASE,
  attributes: () => ({ draggable: "false", decoding: "async" }),
};

const NODE_OPTIONS = {
  ...BASE,
  attributes: () => ({
    draggable: "false",
    contenteditable: "false",
    decoding: "async",
  }),
};

export function twemojify(input) {
  if (input == null) return "";
  const str = typeof input === "string" ? input : String(input);
  if (!str || !EMOJI_TEST.test(str)) return str;

  const cached = cache.get(str);
  if (cached !== undefined) return cached;

  const parsed = twemoji.parse(str, STRING_OPTIONS);

  if (cache.size >= MAX_CACHE) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
  cache.set(str, parsed);
  return parsed;
}

export function twemojifyNode(node) {
  if (!node) return;
  twemoji.parse(node, NODE_OPTIONS);
}

export function isTwemojiImg(node) {
  return (
    node &&
    node.nodeType === 1 &&
    node.tagName === "IMG" &&
    node.classList &&
    node.classList.contains("twemoji")
  );
}
