export type BodyShape = 'cube' | 'capsule' | 'sphere' | 'cylinder' | 'box-tall';
export type HeadShape = 'sphere' | 'cube' | 'cone';
export type Accessory = 'none' | 'top-hat' | 'antenna' | 'horns' | 'cap';

/** A per-variant idle quirk — a little personality animation that plays
 *  occasionally while the character is standing still. */
export type Quirk =
  | 'antenna-pulse'   // antenna bulb blooms bright
  | 'tip-hat'         // head tips back, hat lifts
  | 'twirl'           // spins in place
  | 'tip-wobble'      // pointy head wobbles
  | 'head-shake'      // "no, no"
  | 'glitch-step'     // brief horizontal teleport flicker
  | 'roll-side'       // tilts left-right like a wobbling marble
  | 'nod';            // "yes, yes"

export type CharacterVariant = {
  id: number;
  name: string;
  tagline: string;
  body: BodyShape;
  head: HeadShape;
  bodyColor: string;
  headColor: string;
  legColor: string;
  accessory: Accessory;
  accessoryColor: string;
  /** mouth shape — affects the smile arc */
  mouth: 'smile' | 'smirk' | 'oh' | 'grin' | 'none';
  quirk: Quirk;
};

export const CHARACTERS: CharacterVariant[] = [
  {
    id: 0, name: 'Sparky',  tagline: 'beep-boop friend',
    body: 'capsule', head: 'sphere',
    bodyColor: '#0ea5e9', headColor: '#38bdf8', legColor: '#0369a1',
    accessory: 'antenna', accessoryColor: '#facc15',
    mouth: 'smile', quirk: 'antenna-pulse',
  },
  {
    id: 1, name: 'Bricky', tagline: 'gentleman of stone',
    body: 'cube', head: 'cube',
    bodyColor: '#ef4444', headColor: '#f87171', legColor: '#7f1d1d',
    accessory: 'top-hat', accessoryColor: '#1e293b',
    mouth: 'smirk', quirk: 'tip-hat',
  },
  {
    id: 2, name: 'Petal', tagline: 'soft, very soft',
    body: 'sphere', head: 'sphere',
    bodyColor: '#ec4899', headColor: '#f472b6', legColor: '#9d174d',
    accessory: 'cap', accessoryColor: '#a855f7',
    mouth: 'grin', quirk: 'twirl',
  },
  {
    id: 3, name: 'Pip', tagline: 'apprentice wizard',
    body: 'cylinder', head: 'cone',
    bodyColor: '#22c55e', headColor: '#86efac', legColor: '#14532d',
    accessory: 'none', accessoryColor: '#000000',
    mouth: 'oh', quirk: 'tip-wobble',
  },
  {
    id: 4, name: 'Goldie', tagline: 'all that glitters',
    body: 'box-tall', head: 'sphere',
    bodyColor: '#f59e0b', headColor: '#fbbf24', legColor: '#78350f',
    accessory: 'horns', accessoryColor: '#fef3c7',
    mouth: 'smirk', quirk: 'head-shake',
  },
  {
    id: 5, name: 'Glitchy', tagline: 'feature, not a bug',
    body: 'capsule', head: 'cube',
    bodyColor: '#a855f7', headColor: '#c084fc', legColor: '#581c87',
    accessory: 'antenna', accessoryColor: '#22d3ee',
    mouth: 'oh', quirk: 'glitch-step',
  },
  {
    id: 6, name: 'Mochi', tagline: 'rolls with it',
    body: 'sphere', head: 'cube',
    bodyColor: '#f8fafc', headColor: '#cbd5e1', legColor: '#334155',
    accessory: 'top-hat', accessoryColor: '#1e293b',
    mouth: 'smile', quirk: 'roll-side',
  },
  {
    id: 7, name: 'Sprout', tagline: 'tiny menace',
    body: 'cube', head: 'sphere',
    bodyColor: '#15803d', headColor: '#65a30d', legColor: '#052e16',
    accessory: 'horns', accessoryColor: '#fef3c7',
    mouth: 'grin', quirk: 'nod',
  },
];

export function getCharacter(id: number): CharacterVariant {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}
