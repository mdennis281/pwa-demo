import { useState } from 'react';
import { Btn, Out } from '../_shared/ui';

export default function ClipboardDemo() {
  const [text, setText] = useState('Hello from YesWeb · ' + new Date().toLocaleTimeString());
  const [read, setRead] = useState<string>('');
  const [out, setOut] = useState('—');
  async function write() {
    try { await navigator.clipboard.writeText(text); setOut('copied'); }
    catch (e) { setOut((e as Error).message); }
  }
  async function readIt() {
    try { setRead(await navigator.clipboard.readText()); setOut('read'); }
    catch (e) { setOut((e as Error).message); }
  }
  return (
    <div className="flex flex-col gap-2">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs"
      />
      <div className="flex gap-2">
        <Btn onClick={write}>Copy</Btn>
        <Btn variant="ghost" onClick={readIt}>Paste</Btn>
      </div>
      {read && <div className="text-xs font-mono text-slate-300">paste: {read}</div>}
      <Out>{out}</Out>
    </div>
  );
}
