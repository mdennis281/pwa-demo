import { useState } from 'react';
import { Btn, Out } from '../_shared/ui';

export default function ContactsDemo() {
  const [out, setOut] = useState('—');
  async function pick() {
    type Picker = { select: (props: string[], opts: { multiple: boolean }) => Promise<{ name?: string[]; tel?: string[] }[]> };
    const c = (navigator as Navigator & { contacts?: Picker }).contacts;
    if (!c?.select) return setOut('unsupported');
    try {
      const picks = await c.select(['name', 'tel'], { multiple: true });
      setOut(`${picks.length} picked: ${picks.map((p) => p.name?.[0] ?? '?').join(', ')}`);
    } catch (e) { setOut((e as Error).message); }
  }
  return (
    <div>
      <Btn onClick={pick}>Pick contacts</Btn>
      <Out>{out}</Out>
    </div>
  );
}
