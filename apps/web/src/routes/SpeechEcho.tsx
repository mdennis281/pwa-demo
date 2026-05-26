import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

type RecCls = new () => RecInstance;
type RecInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: RecEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecEvent = {
  resultIndex: number;
  results: { length: number; [i: number]: { isFinal: boolean; 0: { transcript: string } } };
};

function getRec(): RecCls | null {
  const W = window as Window & { SpeechRecognition?: RecCls; webkitSpeechRecognition?: RecCls };
  return W.SpeechRecognition ?? W.webkitSpeechRecognition ?? null;
}

type FinalLine = { id: number; text: string; time: string };
type EchoEntry = { id: number; text: string; voice: string; time: string };

function now(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function SpeechEcho() {
  const [listening, setListening] = useState(false);
  const [recErr, setRecErr] = useState<string | null>(null);
  const [finalLines, setFinalLines] = useState<FinalLine[]>([]);
  const [interim, setInterim] = useState('');
  const recRef = useRef<RecInstance | null>(null);
  const lineIdRef = useRef(0);

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceIdx, setVoiceIdx] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [echoLog, setEchoLog] = useState<EchoEntry[]>([]);
  const echoIdRef = useRef(0);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const voiceIdxRef = useRef(0);
  voicesRef.current = voices;
  voiceIdxRef.current = voiceIdx;

  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const echoEndRef = useRef<HTMLDivElement>(null);

  const recSupported = !!getRec();
  const ttsSupported = 'speechSynthesis' in window;

  useEffect(() => {
    if (!ttsSupported) return;
    const load = () => {
      const vs = speechSynthesis.getVoices();
      if (vs.length > 0) setVoices(vs);
    };
    load();
    speechSynthesis.addEventListener('voiceschanged', load);
    return () => speechSynthesis.removeEventListener('voiceschanged', load);
  }, [ttsSupported]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [finalLines, interim]);

  useEffect(() => {
    echoEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [echoLog]);

  function speak(text: string) {
    if (!ttsSupported || !text.trim()) return;
    speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    const voice = voicesRef.current[voiceIdxRef.current];
    if (voice) utt.voice = voice;
    utt.onstart = () => setSpeaking(true);
    utt.onend = () => setSpeaking(false);
    utt.onerror = () => setSpeaking(false);
    speechSynthesis.speak(utt);

    const id = ++echoIdRef.current;
    setEchoLog((l) => [...l.slice(-49), { id, text, voice: voice?.name ?? 'default', time: now() }]);
  }

  function startListening() {
    const RC = getRec();
    if (!RC) return;
    setRecErr(null);

    const r = new RC();
    r.continuous = true;
    r.interimResults = true;
    r.lang = 'en-US';

    r.onresult = (e) => {
      let newInterim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) {
          const text = result[0].transcript.trim();
          if (text) {
            const id = ++lineIdRef.current;
            setFinalLines((ls) => [...ls.slice(-99), { id, text, time: now() }]);
            setInterim('');
            speak(text);
          }
        } else {
          newInterim += result[0].transcript;
        }
      }
      if (newInterim) setInterim(newInterim);
    };

    r.onerror = (e) => {
      setRecErr(e.error);
      setListening(false);
    };

    r.onend = () => {
      setListening(false);
      setInterim('');
    };

    r.start();
    recRef.current = r;
    setListening(true);
  }

  function stopListening() {
    recRef.current?.stop();
    recRef.current = null;
    setListening(false);
    setInterim('');
  }

  function clearAll() {
    setFinalLines([]);
    setEchoLog([]);
    setInterim('');
    setRecErr(null);
  }

  useEffect(() => () => { recRef.current?.abort(); speechSynthesis.cancel(); }, []);

  const btnPrimary = 'px-4 py-1.5 rounded-lg font-medium text-sm transition disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <div className="border-b border-slate-800 px-6 py-3 flex items-center gap-4">
        <Link to="/" className="text-slate-500 hover:text-slate-300 text-sm transition">← back</Link>
        <h1 className="text-base font-semibold">Speech Echo Loop</h1>
        <span className="hidden sm:block text-xs text-slate-500">Speak → transcribe → echo back via TTS</span>
        <div className="ml-auto">
          <button
            onClick={clearAll}
            className="px-3 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        {/* Left: transcription */}
        <div className="flex-1 flex flex-col border-r border-slate-800" style={{ minWidth: 0 }}>
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-800">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {listening && (
                <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
                </span>
              )}
              <span className="text-sm font-medium">Transcription</span>
              {!recSupported && <span className="text-[10px] text-rose-400 ml-1">unsupported</span>}
            </div>
            <button
              onClick={listening ? stopListening : startListening}
              disabled={!recSupported}
              className={`${btnPrimary} ${listening
                ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/50'
                : 'bg-brand-500 hover:bg-brand-400 text-slate-950'
              }`}
            >
              {listening ? 'Stop' : 'Start listening'}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 font-mono text-sm space-y-1">
            {finalLines.length === 0 && !interim ? (
              <p className="text-slate-600 italic text-xs">
                {recSupported ? 'Click "Start listening" and speak…' : 'SpeechRecognition is not supported in this browser.'}
              </p>
            ) : (
              <>
                {finalLines.map((line) => (
                  <div key={line.id} className="leading-relaxed">
                    <span className="text-slate-600 text-[10px] mr-2 select-none">{line.time}</span>
                    <span className="text-slate-100">{line.text}</span>
                  </div>
                ))}
                {interim && (
                  <div className="leading-relaxed text-slate-500 italic">
                    <span className="text-slate-700 text-[10px] mr-2 select-none">…</span>
                    {interim}
                  </div>
                )}
              </>
            )}
            <div ref={transcriptEndRef} />
          </div>

          {recErr && (
            <div className="px-4 py-2 text-xs text-rose-400 border-t border-slate-800">
              error: {recErr}
            </div>
          )}
        </div>

        {/* Right: echo + voice picker */}
        <div className="flex-1 flex flex-col" style={{ minWidth: 0 }}>
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-800">
            <div className="flex items-center gap-2">
              {speaking && (
                <div className="flex items-end gap-[2px] h-4">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="w-[3px] bg-brand-400 rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 0.12}s`, height: `${6 + (i % 3) * 4}px` }}
                    />
                  ))}
                </div>
              )}
              <span className="text-sm font-medium">Echo</span>
              {!ttsSupported && <span className="text-[10px] text-rose-400 ml-1">unsupported</span>}
            </div>
          </div>

          <div className="px-4 py-3 border-b border-slate-800">
            <label className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1.5">Voice</label>
            {!ttsSupported ? (
              <p className="text-xs text-slate-600">SpeechSynthesis not supported</p>
            ) : voices.length === 0 ? (
              <p className="text-xs text-slate-600">Loading voices…</p>
            ) : (
              <select
                value={voiceIdx}
                onChange={(e) => setVoiceIdx(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {voices.map((v, i) => (
                  <option key={`${v.name}-${i}`} value={i}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {echoLog.length === 0 ? (
              <p className="text-slate-600 italic text-xs font-mono">
                {ttsSupported ? 'Echoes will appear here after each final transcript.' : 'SpeechSynthesis not supported.'}
              </p>
            ) : (
              echoLog.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-lg bg-slate-900 border border-slate-800 px-3 py-2.5"
                >
                  <div className="text-sm text-slate-100 leading-relaxed">{entry.text}</div>
                  <div className="mt-1 flex gap-3 text-[10px] text-slate-600 font-mono">
                    <span>{entry.time}</span>
                    <span>via {entry.voice}</span>
                  </div>
                </div>
              ))
            )}
            <div ref={echoEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
