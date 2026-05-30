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

function buildPattern(word) {
  const letters = word.split("");
  const parts = letters.map(
    (ch, i) => (i === 0 ? ch : `[^a-z]{0,2}${ch}`) + "+",
  );
  return new RegExp(`(?:^|[^a-z])${parts.join("")}(?=[^a-z]|$)`, "i");
}

const SLUR_PATTERNS = SLUR_WORDS.map(buildPattern);
const COMBINING_MARKS = /[̀-ͯ]/g;

export function containsSlur(text) {
  if (!text) return false;
  const normalized = text.normalize("NFKD").replace(COMBINING_MARKS, "");
  for (const pattern of SLUR_PATTERNS) {
    if (pattern.test(normalized)) return true;
  }
  return false;
}
