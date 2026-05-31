// ════════════════════════════════════════════════════════════════════════
//  PROFANITY FILTER — obfuscation-resistant content check for the two
//  public-facing free-text fields: a player's display name and a lobby /
//  server name. Both flow through sanitize() in lobby.ts, so this is the one
//  authoritative gate; a profane value is replaced with the field's fallback
//  and never reaches another player's screen or the persisted leaderboard.
//
//  ⚠ KEEP IN SYNC — this file is intentionally DUPLICATED, byte-for-byte, at:
//        apps/server/src/game/profanity.ts   ← authoritative (server-side)
//        packages/shared/src/profanity.ts      ← client-side UX warning
//    The compiled Node server can't import @pwa-demo/shared at runtime (it's a
//    raw-TS package — see the note atop lobby.ts), so the logic is copied
//    rather than shared. Edit one, edit BOTH.
//
//  HOW IT RESISTS EVASION
//   1. fold(): Unicode-normalize (NFKD folds full-width ｆ, circled ⓕ, accents),
//      lowercase, then map leetspeak + homoglyphs down to plain a–z
//      (0→o, 1→i, 3→e, 4→a, 5→s, @→a, $→s, Cyrillic а→a, Greek ο→o …) and DROP
//      every separator/decoration (spaces, dots, underscores, zero-width).
//      So "ƒ_û.c​k", "Ｆ Ｕ Ｃ Ｋ", "f0ck", "phu…" all collapse toward "fuck".
//   2. Each banned word becomes a regex where every letter may repeat
//      (f+u+c+k+) — so "fuuuuck", "ffuck", "f​u​c​k" all still match.
//   3. An allow-list of innocent words that merely CONTAIN a banned run
//      (class→ass, scunthorpe→cunt, cockpit→cock, analysis→anal …) suppresses
//      false positives: a hit is ignored when an allow-listed word covers it.
// ════════════════════════════════════════════════════════════════════════

/** Map one character to a base latin letter (leetspeak + homoglyph folding),
 *  or to '' to drop it. Anything not listed and not a–z is dropped by fold(). */
const CHAR_MAP: Record<string, string> = {
  // leetspeak digits / symbols
  '0': 'o', '1': 'i', '2': 'z', '3': 'e', '4': 'a', '5': 's', '6': 'g', '7': 't', '8': 'b', '9': 'g',
  '@': 'a', '$': 's', '!': 'i', '|': 'l', '¡': 'i', '+': 't', '(': 'c', '<': 'c', '{': 'c', '[': 'c',
  '©': 'c', '¢': 'c', '£': 'e', '€': 'e', 'µ': 'u', '×': 'x', 'ø': 'o', 'œ': 'o', 'æ': 'a', 'ß': 'b',
  // letter homoglyphs NFKD leaves alone (dotless i, stroked l/d/o, eth/thorn)
  'ı': 'i', 'ł': 'l', 'ɫ': 'l', 'đ': 'd', 'ð': 'd', 'þ': 'p', 'ĸ': 'k',
  // Cyrillic look-alikes
  'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x', 'к': 'k', 'м': 'm', 'н': 'h',
  'т': 't', 'в': 'b', 'ѕ': 's', 'і': 'i', 'ј': 'j', 'ԁ': 'd', 'ո': 'n', 'г': 'r', 'л': 'l', 'и': 'u',
  // Greek look-alikes
  'α': 'a', 'β': 'b', 'ε': 'e', 'ι': 'i', 'κ': 'k', 'ο': 'o', 'ρ': 'p', 'τ': 't', 'υ': 'u', 'χ': 'x',
  'ν': 'v', 'γ': 'y', 'σ': 'o', 'ϲ': 'c', 'ωϊ': 'w',
};

/** Collapse any string to bare a–z: NFKD + lowercase, leet/homoglyph folding,
 *  combining-mark + separator + decoration removal. */
function fold(raw: string): string {
  let s: string;
  try { s = raw.normalize('NFKD'); } catch { s = raw; }
  s = s.toLowerCase();
  let out = '';
  for (const ch of s) {
    if (ch >= 'a' && ch <= 'z') { out += ch; continue; }
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 0x300 && code <= 0x36f) continue; // combining diacritical marks
    const mapped = CHAR_MAP[ch];
    if (mapped !== undefined) out += mapped;
    // else: drop (space, punctuation, emoji, unhandled symbol)
  }
  return out;
}

/** Banned word → regex allowing each letter to repeat (stretch-proof). */
function repeatPattern(word: string): RegExp {
  return new RegExp(word.split('').map((c) => `${c}+`).join(''), 'g');
}

// ── word lists ──────────────────────────────────────────────────────────
// BANNED holds folded base spellings (plus the phonetic variants folding can't
// reach, e.g. "phuck", "azz"). Matching is repeat-tolerant, so only the base
// form is needed for stretched/leeted inputs.
const BANNED_WORDS: string[] = [
  // general obscenity
  'fuck', 'fuk', 'fuq', 'fck', 'fcuk', 'fux', 'phuck', 'fucker', 'motherfucker', 'mofo', 'fuckface', 'clusterfuck',
  'shit', 'shite', 'bullshit', 'shitface', 'dipshit', 'shithead',
  'bitch', 'biatch', 'beotch', 'sonofabitch',
  'cunt', 'kunt',
  'pussy', 'pussie',
  'cock', 'kock', 'cockhead', 'cocksucker',
  'dick', 'dik', 'dickhead', 'dickwad',
  'penis', 'vagina', 'boob', 'tits', 'titty', 'titties', 'nipple',
  'ass', 'azz', 'asshole', 'asshat', 'arse', 'arsehole', 'jackass', 'dumbass',
  'anal', 'anus', 'butthole', 'rectum',
  'cum', 'jizz', 'jism', 'spunk', 'semen',
  'sex', 'sexy', 'creampie', 'blowjob', 'handjob', 'rimjob', 'deepthroat',
  'slut', 'whore', 'skank', 'thot',
  'bastard', 'piss', 'pissed', 'wank', 'wanker', 'tosser', 'bollock', 'bollocks', 'bugger',
  'dildo', 'boner', 'horny', 'milf', 'gilf', 'bukkake', 'hentai', 'fap',
  'douche', 'douchebag', 'prick', 'twat', 'minge', 'fanny', 'knob',
  'porn', 'pornhub', 'xxx', 'nsfw', 'masturbate', 'orgasm', 'ejaculate',
  'rape', 'rapist', 'molest', 'pedo', 'pedophile', 'paedophile',
  // slurs — racial / ethnic / religious
  'nigger', 'nigga', 'nigg', 'niglet', 'chink', 'gook', 'kike', 'spic', 'spick',
  'wetback', 'beaner', 'coon', 'wop', 'towelhead', 'raghead', 'sandnigger',
  'paki', 'jap', 'gyppo',
  // slurs — homophobic / transphobic
  'faggot', 'fag', 'faggit', 'dyke', 'tranny', 'shemale', 'homo', 'queer',
  // slurs — ableist
  'retard', 'retarded', 'spastic', 'mongoloid', 'cripple',
  // hate / extremism
  'nazi', 'kkk', 'heil', 'whitepower',
];

// ALLOW holds innocent words that contain a banned run; a banned hit is ignored
// when one of these covers it. (Scunthorpe-problem guard.)
const ALLOW_WORDS: string[] = [
  // …ass / arse
  'class', 'classic', 'classy', 'pass', 'passed', 'passes', 'passage', 'passenger', 'passion',
  'passionate', 'passport', 'password', 'passive', 'bypass', 'surpass', 'overpass', 'trespass',
  'compass', 'embassy', 'ambassador', 'grass', 'grasses', 'bass', 'brass', 'glass', 'glasses',
  'lass', 'mass', 'massive', 'massachusetts', 'crass', 'amass', 'molasses', 'potassium', 'carcass',
  'cutlass', 'cassette', 'casserole', 'assist', 'assistant', 'assassin', 'assess', 'assessment',
  'asset', 'assign', 'assignment', 'assemble', 'assembly', 'associate', 'association', 'assume',
  'assumption', 'assure', 'assorted', 'embarrass', 'embarrassed', 'harass', 'harassment',
  'canvass', 'sass', 'sassy', 'cassidy', 'cassandra', 'cassius', 'cassie', 'cassia',
  // …arse
  'coarse', 'hoarse', 'sparse', 'parse', 'parsed', 'arsenal', 'arsenic',
  // …anal / anus
  'analysis', 'analyze', 'analyse', 'analyst', 'analytic', 'analytical', 'analog', 'analogue',
  'analogy', 'canal', 'banal', 'banana', 'manual', 'janitor',
  // …cum
  'cucumber', 'document', 'documentary', 'circumstance', 'circumstances', 'accumulate', 'cumulative',
  'cumulus', 'incumbent', 'cumin', 'succumb', 'cumbersome', 'cumberland', 'scum',
  // …cunt
  'scunthorpe',
  // …sex
  'sussex', 'essex', 'middlesex', 'unisex', 'sextet', 'sextant', 'sexton', 'sexagenarian',
  // …cock / kock
  'cockpit', 'cockroach', 'cocktail', 'cockney', 'cockle', 'cockerel', 'peacock', 'shuttlecock',
  'woodcock', 'hancock', 'babcock', 'haycock', 'shellac', 'cockburn',
  // …dick / dik
  'dickens', 'dickinson', 'dickson', 'benedict', 'dike', 'dikes',
  // …penis
  'penistone',
  // …shit
  'shiitake',
  // …rape / rapist
  'grape', 'grapes', 'grapefruit', 'drape', 'drapes', 'scrape', 'scraped', 'scrapes', 'scraping',
  'therapist', 'therapists', 'therapy', 'rapeseed', 'parapet',
  // …pedo
  'torpedo', 'torpedoes', 'pedometer',
  // …spic
  'spice', 'spicy', 'spices', 'spicier', 'despicable', 'auspicious', 'suspicious', 'conspicuous',
  'episcopal',
  // …coon
  'raccoon', 'cocoon', 'tycoon', 'lampoon',
  // …gook
  'gobbledygook',
  // …nigg
  'niggard', 'niggardly', 'snigger', 'sniggered', 'sniggering',
  // …paki / jap
  'pakistan', 'pakistani', 'japan', 'japanese', 'jape', 'jalapeno',
  // …homo
  'homosexual', 'homogeneous', 'homogenize', 'homogenous', 'homonym', 'homophone', 'homosapien',
  'homestead', 'homage',
  // …tit
  'titan', 'titanic', 'titanium', 'title', 'titles', 'competition', 'constitution', 'institution',
  'latitude', 'altitude', 'multitude', 'appetite', 'entity', 'identity',
  // …prick
  'prickle', 'prickly', 'prickles',
  // …knob / boner / wank / bugger
  'doorknob', 'boner', 'debugger',
  // …porn / horn
  'horny',
  // …crack / honky
  'cracker', 'crackers', 'firecracker', 'nutcracker', 'honk', 'honked', 'donkey', 'monkey',
];

// Pre-compile. ALLOW excludes any word that is ITSELF banned (e.g. 'scum',
// 'jackass', 'cracker', 'horny') so it can't whitelist its own banned token —
// such entries are dropped here and stay blocked.
const BANNED_SET = new Set(BANNED_WORDS);
const BANNED = BANNED_WORDS.map((w) => ({ w, re: repeatPattern(w) }));
const ALLOW = ALLOW_WORDS.filter((w) => !BANNED_SET.has(w)).map((w) => ({ w, re: repeatPattern(w) }));

/** True if some allow-listed innocent word covers the span [s, e) in `compact`. */
function coveredByAllowList(compact: string, s: number, e: number): boolean {
  for (const { re } of ALLOW) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(compact)) !== null) {
      if (m.index <= s && m.index + m[0].length >= e) return true;
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  }
  return false;
}

/**
 * Returns true when `raw` contains profanity after de-obfuscation. Tuned to
 * catch leetspeak / spacing / homoglyph evasion while leaving innocent names
 * (Classy, Scunthorpe, Cockpit, Analyst, Therapist…) alone.
 */
export function containsProfanity(raw: string): boolean {
  const compact = fold(raw ?? '');
  if (compact.length < 3) return false; // shortest banned token is 3 chars
  for (const { re } of BANNED) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(compact)) !== null) {
      const s = m.index, e = m.index + m[0].length;
      if (!coveredByAllowList(compact, s, e)) return true;
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  }
  return false;
}
