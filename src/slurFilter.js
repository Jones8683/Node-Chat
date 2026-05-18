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
  "cameljockey",
  "chinaman",
  "chingchong",
  "chink",
  "currymuncher",
  "dago",
  "darkie",
  "darky",
  "dothead",
  "dyke",
  "fag",
  "faggot",
  "golliwog",
  "gook",
  "gypsy",
  "halfbreed",
  "heeb",
  "injun",
  "jap",
  "jewboy",
  "jigaboo",
  "junglebunny",
  "kike",
  "ladyboy",
  "lubra",
  "mooslim",
  "mulatto",
  "negro",
  "nigga",
  "nigger",
  "niglet",
  "nip",
  "paki",
  "pickaninny",
  "polack",
  "poof",
  "poofter",
  "porchmonkey",
  "raghead",
  "redskin",
  "sambo",
  "sandnigger",
  "skank",
  "slag",
  "slanteye",
  "slope",
  "slut",
  "spade",
  "spic",
  "tarbaby",
  "thot",
  "towelhead",
  "tranny",
  "wetback",
  "whore",
  "wog",
  "wop",
  "yid",
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
