import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Share / copy-link button for a demo's deep link. Mirrors StarButton's chrome
 * styling so it sits cleanly beside it in the modal/page header.
 *
 * Behaviour, in order of preference:
 *   1. Web Share API (`navigator.share`) — the native OS share sheet, the same
 *      capability the web-share demo exercises. Present on mobile + installed
 *      PWAs. A user-dismissed sheet (AbortError) is a no-op.
 *   2. Clipboard (`navigator.clipboard.writeText`) — desktop fallback, with a
 *      transient "Copied!" tick so the click has visible feedback.
 *   3. `window.prompt` — last-ditch so there is always *some* way to grab the
 *      URL (e.g. clipboard blocked by permissions policy).
 *
 * Stateless about *what* to share — the parent passes the absolute deep link
 * (build it with `deepLinkFor`) and a human title for the share sheet.
 */
export function ShareButton({
  url,
  title,
  size = 'md',
  className = '',
}: {
  url: string;
  title: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Clear the "Copied!" timeout if we unmount mid-flash.
  useEffect(() => () => clearTimeout(timer.current), []);

  const flash = useCallback(() => {
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  }, []);

  const onClick = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (navigator.share) {
        try {
          await navigator.share({ title, url });
          return;
        } catch (err) {
          // User dismissed the sheet — stop. Other failures fall through to
          // the clipboard path so the click still does something useful.
          if ((err as Error)?.name === 'AbortError') return;
        }
      }
      try {
        await navigator.clipboard.writeText(url);
        flash();
      } catch {
        window.prompt('Copy this link', url);
      }
    },
    [title, url, flash],
  );

  const dims = size === 'sm' ? 'w-5 h-5' : 'w-7 h-7';
  const icon = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  return (
    <button
      type="button"
      onClick={onClick}
      title={copied ? 'Link copied!' : 'Share / copy link to this demo'}
      aria-label={copied ? 'Link copied' : 'Share or copy link to this demo'}
      className={`shrink-0 inline-flex items-center justify-center rounded transition ${dims} ${
        copied ? 'text-emerald-300' : 'text-slate-600 hover:text-sky-300'
      } ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={icon}
        aria-hidden="true"
      >
        {copied ? (
          <path d="M4.5 12.75l6 6 9-13.5" />
        ) : (
          <path d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
        )}
      </svg>
    </button>
  );
}
