import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import Layout from './components/Layout';

const Home = lazy(() => import('./routes/Home'));
const WebWorker = lazy(() => import('./routes/WebWorker'));
const Status = lazy(() => import('./routes/Status'));
const Push = lazy(() => import('./routes/Push'));
const Manifest = lazy(() => import('./routes/Manifest'));

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
