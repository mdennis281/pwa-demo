import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';

const SCHEME = 'web+yesweb:';

/**
 * Handles launches that arrive via the `web+yesweb:` protocol handler declared
 * in the manifest (vite.config.ts → `protocol_handlers`). The OS routes
 * `web+yesweb:<target>` to `/?proto=<percent-encoded>`; this reads that param,
 * forwards to the in-app destination, then strips the param so it doesn't
 * linger in the address bar or re-fire on the next render.
 *
 *   web+yesweb:/d/tower-climb     → navigate to /d/tower-climb
 *   web+yesweb:/?demo=vibration   → open the vibration modal
 *   web+yesweb:open               → just focus the app at home
 *
 * Why this exists alongside `handle_links`: https link capturing is a *request*
 * the OS/user can decline, so a shared https link may still open in a tab. A
 * custom-scheme link ALWAYS opens the installed app once its handler is
 * approved — so this is the reliable "open in the app" path. Fire it with
 * lib/install.ts → `openInstalledApp(target)`.
 */
export function useProtocolLaunch(): void {
  const navigate = useNavigate();
  const proto = new URLSearchParams(useLocation().search).get('proto');

  useEffect(() => {
    if (!proto) return;
    // The spec hands the handler the full scheme URL, percent-encoded; after
    // URLSearchParams decodes it we still have the `web+yesweb:` prefix to peel.
    const target = proto.startsWith(SCHEME) ? proto.slice(SCHEME.length) : proto;
    // Only forward same-origin relative paths. Reject `//host` (protocol-
    // relative) and absolute URLs so the param can't be abused as an open
    // redirect; anything else (incl. the `open` sentinel) just lands on home.
    const safe = target.startsWith('/') && !target.startsWith('//');
    navigate(safe ? target : '/', { replace: true });
  }, [proto, navigate]);
}
