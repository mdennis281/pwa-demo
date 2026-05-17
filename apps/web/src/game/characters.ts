export type BodyShape = 'cube' | 'capsule' | 'sphere' | 'cylinder' | 'box-tall';
export type HeadShape = 'sphere' | 'cube' | 'cone';
export type Accessory = 'none' | 'top-hat' | 'antenna' | 'horns' | 'cap';

export type CharacterVariant = {
  id: number;
  name: string;
  body: BodyShape;
  head: HeadShape;
  bodyColor: string;
  headColor: string;
  accessory: Accessory;
  accessoryColor: string;
};

export const CHARACTERS: CharacterVariant[] = [
  { id: 0, name: 'Spark',   body: 'capsule', head: 'sphere', bodyColor: '#0ea5e9', headColor: '#38bdf8', accessory: 'antenna', accessoryColor: '#facc15' },
  { id: 1, name: 'Brick',   body: 'cube',    head: 'cube',   bodyColor: '#ef4444', headColor: '#f87171', accessory: 'top-hat', accessoryColor: '#1e293b' },
  { id: 2, name: 'Bloom',   body: 'sphere',  head: 'sphere', bodyColor: '#ec4899', headColor: '#f472b6', accessory: 'cap',     accessoryColor: '#a855f7' },
  { id: 3, name: 'Toot',    body: 'cylinder',head: 'cone',   bodyColor: '#22c55e', headColor: '#86efac', accessory: 'none',    accessoryColor: '#000000' },
  { id: 4, name: 'Vert',    body: 'box-tall',head: 'sphere', bodyColor: '#f59e0b', headColor: '#fbbf24', accessory: 'horns',   accessoryColor: '#fef3c7' },
  { id: 5, name: 'Glitch',  body: 'capsule', head: 'cube',   bodyColor: '#a855f7', headColor: '#c084fc', accessory: 'antenna', accessoryColor: '#22d3ee' },
  { id: 6, name: 'Marble',  body: 'sphere',  head: 'cube',   bodyColor: '#f8fafc', headColor: '#cbd5e1', accessory: 'top-hat', accessoryColor: '#1e293b' },
  { id: 7, name: 'Goblin',  body: 'cube',    head: 'sphere', bodyColor: '#15803d', headColor: '#65a30d', accessory: 'horns',   accessoryColor: '#fef3c7' },
];

export function getCharacter(id: number): CharacterVariant {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}
