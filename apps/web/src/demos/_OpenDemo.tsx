import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { pagePathFor, type DemoSpec } from './_types';

/**
 * Generic "open this demo" link. Picks the right destination based on the
 * demo's type:
 *   - modal: adds `?demo=<id>` to the current location (preserves path)
 *   - page / multi-page: navigates to `/d/<id>`
 *
 * Use this everywhere a user can launch a demo so the UI stays consistent
 * and so the link's href is meaningful (right-click → open in new tab still
 * works for both modals and pages).
 */
export function OpenDemoLink({
  demo,
  children,
  className,
  onClick,
}: {
  demo: DemoSpec;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const location = useLocation();
  if (demo.type === 'modal') {
    const sp = new URLSearchParams(location.search);
    sp.set('demo', demo.id);
    return (
      <Link
        to={{ pathname: location.pathname, search: `?${sp.toString()}`, hash: location.hash }}
        className={className}
        onClick={onClick}
      >
        {children}
      </Link>
    );
  }
  return (
    <Link to={pagePathFor(demo.id)} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}

/** Returns true if the given demo is currently open (modal or page). */
export function useIsDemoActive(demo: DemoSpec): boolean {
  const location = useLocation();
  if (demo.type === 'modal') {
    return new URLSearchParams(location.search).get('demo') === demo.id;
  }
  return location.pathname === pagePathFor(demo.id) ||
    location.pathname.startsWith(`${pagePathFor(demo.id)}/`);
}
