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
  "abo",
  "battyboy",
  "beaner",
  "boong",
  "bulldyke",
  "chingchong",
  "chink",
  "coon",
  "coolie",
  "cripple",
  "currymuncher",
  "darkie",
  "darky",
  "dothead",
  "dyke",
  "fag",
  "faggot",
  "gook",
  "groid",
  "gypsy",
  "heeb",
  "hymie",
  "injun",
  "jewboy",
  "jigaboo",
  "junglebunny",
  "kike",
  "ladyboy",
  "midget",
  "mongoloid",
  "mooslim",
  "mulignan",
  "negro",
  "nigga",
  "nigger",
  "niglet",
  "nigr",
  "nip",
  "paki",
  "pickaninny",
  "poof",
  "poofter",
  "porchmonkey",
  "raghead",
  "redskin",
  "retard",
  "retarded",
  "sambo",
  "sandnigger",
  "shylock",
  "slanteye",
  "spastic",
  "spic",
  "tarbaby",
  "towelhead",
  "tranny",
  "wetback",
  "wog",
  "zionazi",
  "zipperhead",
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
