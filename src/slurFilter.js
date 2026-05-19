import {
  RegExpMatcher,
  pattern,
  collapseDuplicatesTransformer,
  resolveConfusablesTransformer,
  resolveLeetSpeakTransformer,
  skipNonAlphabeticTransformer,
  toAsciiLowerCaseTransformer,
} from "obscenity";

const SLUR_WORDS = [
  "beaner",
  "boong",
  "chink",
  "cunt",
  "dyke",
  "fag",
  "faggot",
  "gook",
  "jap",
  "kike",
  "negro",
  "nigga",
  "nigger",
  "paki",
  "poofter",
  "raghead",
  "redskin",
  "slag",
  "slut",
  "spic",
  "thot",
  "towelhead",
  "tranny",
  "wetback",
  "whore",
  "wog",
];

const collapse = (w) => w.replace(/(.)\1+/g, "$1");

const SLUR_PATTERNS = SLUR_WORDS.map((word, i) => {
  const collapsed = collapse(word);
  const strings = Object.assign([collapsed], { raw: [collapsed] });
  return { id: i + 1, pattern: pattern(strings) };
});

const matcher = new RegExpMatcher({
  blacklistedTerms: SLUR_PATTERNS,
  blacklistMatcherTransformers: [
    resolveConfusablesTransformer(),
    resolveLeetSpeakTransformer(),
    toAsciiLowerCaseTransformer(),
    skipNonAlphabeticTransformer(),
    collapseDuplicatesTransformer(),
  ],
});

export function containsSlur(text) {
  if (!text) return false;
  return matcher.hasMatch(text);
}
