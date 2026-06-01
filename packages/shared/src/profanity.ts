// ════════════════════════════════════════════════════════════════════════
//  PROFANITY FILTER — obfuscation-resistant content check for the two
//  public-facing free-text fields: a player's display name and a lobby /
//  server name. Both are validated via nameError() in lobby.ts, so this is the
//  one authoritative gate; a profane value BLOCKS the create/join/rename as an
//  input-validation error and so never reaches another player's screen or the
//  persisted leaderboard.
//
//  ⚠ KEEP IN SYNC — this file is intentionally DUPLICATED, byte-for-byte, at:
//        apps/server/src/game/profanity.ts    ← authoritative (server-side)
//        packages/shared/src/profanity.ts     ← client-side live UX warning
//    The compiled Node server can't import @pwa-demo/shared at runtime (it's a
//    raw-TS package — see the note atop lobby.ts), so the logic is copied
//    rather than shared. Edit one, edit BOTH.
//
//  PHILOSOPHY — CORPORATE-SAFE, deliberately OVER-blocks. There is NO
//  allow-list / Scunthorpe guard: a banned run anywhere in the de-obfuscated
//  text is enough, so "adjacent" words that merely CONTAIN a banned run are
//  rejected too — hancock, niggard, gamecock, sexmoan, niggle, class, analysis,
//  document, Essex, Cassidy … all trip. False positives are an accepted cost of
//  keeping names client-appropriate; we are NOT maintaining a dictionary of
//  exceptions. If a specific clean word must be allowed, that's a deliberate,
//  reviewed addition — not the default.
//
//  HOW IT RESISTS EVASION
//   1. fold(): Unicode-normalize (NFKD folds full-width ｆ, circled ⓕ, accents),
//      lowercase, then map leetspeak + homoglyphs down to plain a–z
//      (0→o, 1→i, 3→e, 4→a, 5→s, @→a, $→s, Cyrillic а→a, Greek ο→o …) and DROP
//      every separator/decoration (spaces, dots, underscores, zero-width).
//      So "ƒ_û.c​k", "Ｆ Ｕ Ｃ Ｋ", "f0ck", "phu…" all collapse toward "fuck",
//      and "Bill B" / "Mike W" collapse to "billb" / "mikew".
//   2. Each banned word becomes a regex where every letter may repeat
//      (f+u+c+k+) — so "fuuuuck", "ffuck", "f​u​c​k" all still match.
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
  'ν': 'v', 'γ': 'y', 'σ': 'o', 'ϲ': 'c',
  // small-capital letters (Latin SC + IPA block) — NFKD leaves these unfolded
  'ᴀ': 'a', 'ʙ': 'b', 'ᴄ': 'c', 'ᴅ': 'd', 'ᴇ': 'e', 'ꜰ': 'f', 'ɢ': 'g', 'ʜ': 'h', 'ɪ': 'i',
  'ᴊ': 'j', 'ᴋ': 'k', 'ʟ': 'l', 'ᴍ': 'm', 'ɴ': 'n', 'ᴏ': 'o', 'ᴘ': 'p', 'ꞯ': 'q', 'ʀ': 'r',
  'ꜱ': 's', 'ᴛ': 't', 'ᴜ': 'u', 'ᴠ': 'v', 'ᴡ': 'w', 'ʏ': 'y', 'ᴢ': 'z',
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

// ── banned word list ──────────────────────────────────────────────────────
// Folded base spellings (plus phonetic variants folding can't reach, e.g.
// "phuck", "azz"). Matching is repeat-tolerant AND substring (no allow-list),
// so any name CONTAINING one of these — anywhere — is rejected.
const BANNED_WORDS: string[] = [
  // general obscenity
  'fuck', 'fuk', 'fuq', 'fck', 'fcuk', 'fux', 'fvck', 'fock', 'fok', 'fawk',
  'phuck', 'phuk', 'fucker', 'motherfucker', 'mofo', 'fuckface', 'clusterfuck',
  'shit', 'shyt', 'shite', 'bullshit', 'shitface', 'dipshit', 'shithead',
  'bitch', 'biatch', 'biotch', 'beotch', 'btch', 'sonofabitch',
  'cunt', 'kunt', 'cnut', 'kvnt', 'cvnt',
  'pussy', 'pussie', 'pussi',
  'cock', 'kock', 'cockhead', 'cocksucker',
  'dick', 'dik', 'dickhead', 'dickwad',
  'penis', 'vagina', 'boob', 'tits', 'titty', 'titties', 'nipple',
  'ass', 'azz', 'asshole', 'asshat', 'arse', 'arsehole', 'jackass', 'dumbass',
  'anal', 'butthole', 'rectum',
  'cum', 'jizz', 'jism', 'spunk', 'semen',
  'sex', 'sexy', 'secks', 'creampie', 'blowjob', 'handjob', 'rimjob', 'deepthroat',
  'slut', 'slvt', 'sloot', 'whore', 'skank', 'thot',
  'bastard', 'bastid', 'basterd', 'piss', 'pissed', 'wank', 'wanker', 'tosser', 'bollock', 'bollocks', 'bugger',
  'dildo', 'boner', 'horny', 'milf', 'gilf', 'bukkake', 'hentai', 'fap',
  'douche', 'douchebag', 'prick', 'twat', 'minge', 'fanny', 'knob',
  'porn', 'pornhub', 'masturbate', 'orgasm', 'ejaculate',
  'rape', 'raep', 'raype', 'rapist', 'molest', 'pedo', 'pedophile', 'paedophile',
  // slurs — racial / ethnic / religious
  'nigger', 'nigga', 'niqqa', 'niqqer', 'nigg', 'niglet', 'chink', 'gook', 'kike', 'spic', 'spick',
  'wetback', 'beaner', 'coon', 'wop', 'towelhead', 'raghead', 'sandnigger',
  'paki', 'jap', 'gyppo',
  // slurs — homophobic / transphobic
  'faggot', 'phaggot', 'fag', 'faggit', 'dyke', 'tranny', 'shemale', 'homo', 'queer',
  // slurs — ableist
  'retard', 'retarded', 'spastic', 'mongoloid', 'cripple',
  // hate / extremism
  'nazi', 'kkk', 'heil', 'whitepower',
  // Chevron execs — "first name + last initial". Stored in FOLDED form
  // (lowercased, spaces stripped) because matching runs on the fold()-ed text;
  // 'Bill B' / 'Les C' as typed can never match. Substring + repeat matching
  // means "Bill B", "BillB", "Bill Brown", "b i l l b", "8illB" … all trip.
  'billb', 'mikew', 'laurenf', 'lesc',
];

const BANNED = BANNED_WORDS.map((w) => ({ w, re: repeatPattern(w) }));

/**
 * Returns true when `raw` contains profanity after de-obfuscation. Corporate-
 * safe and deliberately broad: a banned run ANYWHERE in the folded text trips
 * it — there is no allow-list, so words that merely CONTAIN a banned run
 * (hancock, niggard, gamecock, sexmoan, niggle, class, analysis, document …)
 * are rejected too. That over-blocking is intentional.
 */
export function containsProfanity(raw: string): boolean {
  const compact = fold(raw ?? '');
  if (compact.length < 3) return false; // shortest banned token is 3 chars
  for (const { re } of BANNED) {
    re.lastIndex = 0;
    if (re.test(compact)) return true;
  }
  return false;
}
