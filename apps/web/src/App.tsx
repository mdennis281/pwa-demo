import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import Layout from './components/Layout';

const Home = lazy(() => import('./routes/Home'));
const Category = lazy(() => import('./routes/Category'));
const WebWorker = lazy(() => import('./routes/WebWorker'));
const Status = lazy(() => import('./routes/Status'));
const Push = lazy(() => import('./routes/Push'));
const Manifest = lazy(() => import('./routes/Manifest'));
const Game = lazy(() => import('./routes/Game'));
const Islands = lazy(() => import('./routes/Islands'));
const WCO = lazy(() => import('./routes/WCO'));
const IndexedDBDemo = lazy(() => import('./routes/IndexedDB'));
const Passkeys = lazy(() => import('./routes/Passkeys'));
const SpeechEcho = lazy(() => import('./routes/SpeechEcho'));

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route
          path="/"
          element={
            <Suspense fallback={<Loading />}>
              <Home />
            </Suspense>
          }
        />
        <Route
          path="/worker"
          element={
            <Suspense fallback={<Loading />}>
              <WebWorker />
            </Suspense>
          }
        />
        <Route
          path="/status"
          element={
            <Suspense fallback={<Loading />}>
              <Status />
            </Suspense>
          }
        />
        <Route
          path="/push"
          element={
            <Suspense fallback={<Loading />}>
              <Push />
            </Suspense>
          }
        />
        <Route
          path="/manifest"
          element={
            <Suspense fallback={<Loading />}>
              <Manifest />
            </Suspense>
          }
        />
        <Route
          path="/game"
          element={
            <Suspense fallback={<Loading />}>
              <Game />
            </Suspense>
          }
        />
        <Route
          path="/indexed-db"
          element={
            <Suspense fallback={<Loading />}>
              <IndexedDBDemo />
            </Suspense>
          }
        />
        <Route
          path="/islands"
          element={
            <Suspense fallback={<Loading />}>
              <Islands />
            </Suspense>
          }
        />
        <Route
          path="/wco"
          element={
            <Suspense fallback={<Loading />}>
              <WCO />
            </Suspense>
          }
        />
        <Route
          path="/speech-echo"
          element={
            <Suspense fallback={<Loading />}>
              <SpeechEcho />
            </Suspense>
          }
        />
        <Route
          path="/passkeys"
          element={
            <Suspense fallback={<Loading />}>
              <Passkeys />
            </Suspense>
          }
        />
        <Route
          path="/category/:cat"
          element={
            <Suspense fallback={<Loading />}>
              <Category />
            </Suspense>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

function Loading() {
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
