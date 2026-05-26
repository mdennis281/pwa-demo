import type { LazyExoticComponent, ComponentType } from 'react';
import type { Category } from '../lib/capabilities';

/**
 * Three shapes a demo can take. Pick one per demo:
 *
 *   modal      — small, single screen, opens in an overlay (`?demo=<id>`)
 *   page       — full route, one screen
 *   multi-page — full route, internal sub-screens (state-driven or nested routes)
 *
 * Modal demos render *only their body* (no header, no padding) — ModalHost
 * provides the chrome. Page/multi-page demos render their full layout, but
 * should wrap the page in <DemoPage> for the standard title + star + back.
 */
export type DemoType = 'modal' | 'page' | 'multi-page';

export type DemoSpec = {
  /** Stable id. Used in URLs (`?demo=<id>`, `/d/<id>`) and favorites. */
  id: string;
  /** Display title. */
  title: string;
  /** One-line blurb shown in cards/chips. */
  blurb: string;
  /** Demo shape — controls how it's mounted. */
  type: DemoType;
  /** Primary category (used for sidebar grouping). */
  category: Category;
  /**
   * Capability ids this demo exercises (M:N).
   * One demo can cover multiple caps (e.g. `islands` covers motion + orientation).
   * One cap can have multiple demos (e.g. `webauthn` has both a modal and a /passkeys page).
   */
  capabilities: string[];
  /**
   * Lazy-loaded React component.
   *   - For `modal`: renders inside the modal body.
   *   - For `page` / `multi-page`: renders the full route (wrap in <DemoPage> internally).
   */
  component: LazyExoticComponent<ComponentType>;
};

/** Build the route path for a non-modal demo. All page/multi-page demos live under /d/. */
export function pagePathFor(id: string): string {
  return `/d/${id}`;
}

/** Build the search-string fragment that opens a modal demo (preserves other params). */
export function modalQueryFor(id: string, existing?: URLSearchParams): string {
  const sp = new URLSearchParams(existing);
  sp.set('demo', id);
  return `?${sp.toString()}`;
}
