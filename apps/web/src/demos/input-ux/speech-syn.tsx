import { useState } from 'react';
import { Btn } from '../_shared/ui';

export default function SpeechSynDemo() {
  const [text, setText] = useState('Progressive web apps are surprisingly capable.');
  function speak() {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }
  return (
    <div className="flex flex-col gap-2">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs"
      />
      <div><Btn onClick={speak}>Speak</Btn></div>
    </div>
  );
}
