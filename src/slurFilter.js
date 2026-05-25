const SLUR_WORDS = [
  "chink",
  "cunt",
  "fag",
  "faggot",
  "negro",
  "nigga",
  "nigger",
  "redskin",
  "slag",
  "slut",
  "thot",
  "tranny",
  "whore",
  "wog",
];

const ALLOWLIST = new Set([
  "about",
  "abound",
  "abouts",
  "abut",
  "abuts",
  "abutted",
  "abutting",
  "scunthorpe",
  "assassin",
  "classic",
  "classics",
  "classical",
  "cockburn",
  "analysis",
  "analyse",
  "analyze",
  "analytical",
  "therapist",
  "specialist",
  "specialists",
  "shitake",
  "shiitake",
  "magna",
  "cumulative",
  "circumstance",
  "circumstances",
  "wholesale",
  "wholesome",
  "whose",
  "whom",
  "whoever",
  "whomever",
  "whomst",
  "who",
  "wholly",
  "facade",
  "thought",
  "thoughts",
  "though",
  "throughout",
  "throat",
  "throats",
  "throne",
  "thrones",
  "threat",
  "threats",
  "those",
  "thousand",
  "thousands",
  "throw",
  "throws",
  "thrown",
  "threw",
  "through",
  "thorough",
  "thoroughly",
  "thro",
]);

const CONFUSABLES = {
  а: "a",
  ɑ: "a",
  α: "a",
  "@": "a",
  4: "a",
  ḅ: "b",
  Ь: "b",
  β: "b",
  8: "b",
  с: "c",
  ϲ: "c",
  ç: "c",
  ԁ: "d",
  е: "e",
  ε: "e",
  3: "e",
  ƒ: "f",
  ɡ: "g",
  9: "g",
  һ: "h",
  і: "i",
  ı: "i",
  ι: "i",
  1: "i",
  "!": "i",
  "|": "i",
  ɩ: "i",
  ј: "j",
  к: "k",
  κ: "k",
  ʟ: "l",
  ɭ: "l",
  м: "m",
  ո: "n",
  η: "n",
  о: "o",
  ο: "o",
  ø: "o",
  0: "o",
  р: "p",
  ρ: "p",
  ԛ: "q",
  г: "r",
  ɾ: "r",
  ѕ: "s",
  ʂ: "s",
  5: "s",
  $: "s",
  т: "t",
  τ: "t",
  7: "t",
  "+": "t",
  υ: "u",
  ц: "u",
  ν: "v",
  ѵ: "v",
  ω: "w",
  ѡ: "w",
  х: "x",
  χ: "x",
  у: "y",
  γ: "y",
  ʐ: "z",
  2: "z",
};

function normalise(text) {
  const lowered = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
  let out = "";
  for (const ch of lowered) out += CONFUSABLES[ch] ?? ch;
  return out.replace(/[^a-z]/g, "");
}

function collapse(s) {
  let prev;
  let cur = s.replace(/(.)\1+/g, "$1");
  do {
    prev = cur;
    cur = cur.replace(/(.{2,3}?)\1+/g, "$1");
  } while (cur !== prev);
  return cur;
}

function buildRegex(word) {
  const collapsed = word.replace(/(.)\1+/g, "$1");
  const variants = [collapsed];
  if (collapsed.length >= 5) {
    for (let i = 1; i < collapsed.length; i++) {
      variants.push(collapsed.slice(0, i) + "[a-z]" + collapsed.slice(i));
    }
  }
  return {
    word: collapsed,
    exact: new RegExp("^(?:" + variants.join("|") + ")$"),
    embedded: new RegExp("(?:" + variants.join("|") + ")"),
  };
}

const SLUR_REGEXES = SLUR_WORDS.map(buildRegex);
const EMBEDDED_REGEXES = SLUR_REGEXES.filter((s) => s.word.length >= 5);

function tokenIsSlur(token) {
  const normalised = normalise(token);
  if (!normalised || ALLOWLIST.has(normalised)) return false;
  const collapsed = collapse(normalised);
  if (!collapsed || ALLOWLIST.has(collapsed)) return false;
  for (const { exact } of SLUR_REGEXES) {
    if (exact.test(collapsed)) return true;
  }
  for (const { embedded } of EMBEDDED_REGEXES) {
    if (embedded.test(collapsed)) return true;
  }
  return false;
}

export function containsSlur(text) {
  if (!text) return false;
  const tokens = text.split(
    /[^A-Za-z0-9@!$+\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF]+/,
  );
  for (const tok of tokens) {
    if (tok && tokenIsSlur(tok)) return true;
  }
  const whole = collapse(normalise(text));
  if (whole) {
    for (const { embedded } of EMBEDDED_REGEXES) {
      if (embedded.test(whole)) return true;
    }
  }
  return false;
}
