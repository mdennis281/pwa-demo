import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { demoById } from '../demos/_registry';
import type { DemoSpec } from '../demos/_types';
import { pwaEnv } from './env';

/**
 * Keeps `document.title` in sync with the active demo: `YesWeb • <Demo>` while
 * a demo is open, and the bare brand name otherwise. The brand prefix is the
 * per-env name (`pwaEnv.name`), so prod reads "YesWeb • Tower Climb" while
 * dev/test read "YesWeb Dev • …" / "YesWeb Test • …" — matching the rest of the
 * per-env identity (lib/env.ts).
 *
 * Centralised (one hook in App) rather than per-demo so it covers every demo
 * shape from a single place — including fullscreen demos like Tower Climb that
 * skip <DemoPage> and so have no chrome of their own to hang a title on.
 */
export function useDocumentTitle(): void {
  const { pathname, search } = useLocation();

  useEffect(() => {
    const demo = activeDemo(pathname, search);
    document.title = demo ? `${pwaEnv.name} • ${demo.title}` : pwaEnv.name;
  }, [pathname, search]);
}

/**
 * Resolve the demo the user is currently looking at, or undefined for
 * home/category/not-found. A modal (`?demo=<id>`) can overlay a page, so it
 * wins when both are present — it's the foreground thing.
 */
function activeDemo(pathname: string, search: string): DemoSpec | undefined {
  const modalId = new URLSearchParams(search).get('demo');
  if (modalId) {
    const d = demoById(modalId);
    if (d?.type === 'modal') return d;
  }
  if (pathname.startsWith('/d/')) {
    // First path segment after /d/ — handles multi-page sub-routes like
    // /d/tower-climb/lobby, which still title as "Tower Climb".
    const id = pathname.slice('/d/'.length).split('/')[0];
    const d = demoById(id);
    if (d?.type === 'page' || d?.type === 'multi-page') return d;
  }
  return undefined;
}
