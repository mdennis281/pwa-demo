import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import Layout from './components/Layout';
import { DEMOS } from './demos/_registry';
import { pagePathFor } from './demos/_types';
import { holdSplashForRoute } from './lib/splash';
import { useProtocolLaunch } from './lib/protocolLaunch';

const Home = lazy(() => import('./routes/Home'));
const Category = lazy(() => import('./routes/Category'));

/**
 * Routes are generated from the demo registry. Every page/multi-page demo
 * gets a `/d/<id>` route automatically. Modal demos are mounted by ModalHost
 * via the `?demo=<id>` query param and don't need a route.
 *
 * Legacy paths (`/push`, `/wco`, `/passkeys`, etc.) redirect to the new
 * `/d/<id>` path so existing bookmarks and external links still work.
 */
const LEGACY_REDIRECTS: Record<string, string> = {
  '/push': '/d/push',
  '/wco': '/d/wco',
  '/passkeys': '/d/passkeys',
  '/islands': '/d/islands',
  '/speech-echo': '/d/speech-echo',
  '/indexed-db': '/d/indexed-db',
  '/manifest': '/d/manifest',
  '/status': '/d/status',
  '/worker': '/d/worker',
  '/game': '/d/tower-climb',
};

export default function App() {
  // Forward `web+yesweb:` protocol launches to their in-app destination.
  useProtocolLaunch();
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Suspense fallback={<Loading />}><Home /></Suspense>} />
        <Route
          path="/category/:cat"
          element={<Suspense fallback={<Loading />}><Category /></Suspense>}
        />

        {/* Demo routes generated from the registry. Multi-page demos get a
            wildcard child so their internal sub-routing doesn't 404. */}
        {DEMOS
          .filter((d) => d.type === 'page' || d.type === 'multi-page')
          .map((d) => {
            const Body = d.component;
            const path = pagePathFor(d.id);
            const element = (
              <Suspense fallback={<Loading />}>
                <Body />
              </Suspense>
            );
            return d.type === 'multi-page' ? (
              <Route key={d.id} path={`${path}/*`} element={element} />
            ) : (
              <Route key={d.id} path={path} element={element} />
            );
          })}

        {Object.entries(LEGACY_REDIRECTS).map(([from, to]) => (
          <Route key={from} path={from} element={<Navigate to={to} replace />} />
        ))}

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

function Loading() {
  // Hold the inline splash (index.html) up while this lazy chunk resolves, so
  // its fade-out reveals real content instead of this bare fallback. Only the
  // initial load does anything — later navigations are a no-op (splash gone).
  useEffect(() => holdSplashForRoute(), []);
  return <div className="p-8 text-slate-400">loading…</div>;
}

function NotFound() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-2">Not found</h1>
      <p className="text-slate-400">no demo at this route — yet.</p>
    </div>
  );
}
