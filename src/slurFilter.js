import {
  RegExpMatcher,
  pattern,
  collapseDuplicatesTransformer,
  resolveConfusablesTransformer,
  resolveLeetSpeakTransformer,
  skipNonAlphabeticTransformer,
  toAsciiLowerCaseTransformer,
} from "obscenity";

const SLUR_PATTERNS = [
  { id: 1, pattern: pattern`nigger` },
  { id: 2, pattern: pattern`nigga` },
  { id: 3, pattern: pattern`niglet` },
  { id: 4, pattern: pattern`nig` },
  { id: 5, pattern: pattern`faggot` },
  { id: 6, pattern: pattern`fag` },
  { id: 7, pattern: pattern`tranny` },
  { id: 8, pattern: pattern`retard` },
  { id: 9, pattern: pattern`retarded` },
  { id: 10, pattern: pattern`kike` },
  { id: 11, pattern: pattern`chink` },
  { id: 12, pattern: pattern`gook` },
  { id: 13, pattern: pattern`spic` },
  { id: 14, pattern: pattern`wetback` },
  { id: 15, pattern: pattern`beaner` },
  { id: 16, pattern: pattern`wop` },
  { id: 17, pattern: pattern`dyke` },
  { id: 18, pattern: pattern`coon` },
  { id: 19, pattern: pattern`raghead` },
  { id: 20, pattern: pattern`towelhead` },
  { id: 21, pattern: pattern`sandnigger` },
  { id: 22, pattern: pattern`paki` },
  { id: 23, pattern: pattern`jigaboo` },
  { id: 24, pattern: pattern`negro` },
  { id: 25, pattern: pattern`nigr` },
  { id: 26, pattern: pattern`groid` },
  { id: 27, pattern: pattern`shemale` },
  { id: 28, pattern: pattern`heeb` },
  { id: 29, pattern: pattern`zipperhead` },
  { id: 30, pattern: pattern`gypsy` },
];

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
