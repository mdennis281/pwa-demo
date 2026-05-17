import { Link } from 'react-router';

const CARDS = [
  { to: '/worker',   title: 'Web Worker',         body: 'Run heavy compute off the main thread. Side-by-side comparison.' },
  { to: '/status',   title: 'Live status page',   body: 'Real-time list of every connected client, via socket.io.' },
  { to: '/push',     title: 'Web Push',           body: 'Subscribe to push and receive a notification — even with the tab closed.' },
  { to: '/manifest', title: 'Install playground', body: 'Inspect the manifest, install state, and display mode in real time.' },
];

export default function Home() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">PWA Demo</h1>
      <p className="text-slate-400 mb-8">
        A growing collection of sub-modules that show off what Progressive Web Apps can do today.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CARDS.map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className="block bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg p-4 transition"
          >
            <div className="font-medium mb-1">{c.title}</div>
            <div className="text-sm text-slate-400">{c.body}</div>
          </Link>
        ))}
      </div>
      <div className="mt-12 text-xs text-slate-500">
        Tip: install the app from your browser (Chrome: address bar install icon) to unlock OS integration.
      </div>
    </div>
  );
}
