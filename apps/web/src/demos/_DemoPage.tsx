import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { deepLinkFor } from './_types';
import { useFavorites } from './_favorites';
import { StarButton } from './_StarButton';
import { ShareButton } from './_ShareButton';

/**
 * Standard chrome for page/multi-page demos. Provides:
 *   - back link to overview
 *   - title + blurb header
 *   - star (favorite) button
 *   - max-width content area
 *
 * Use it as the outermost wrapper inside the demo component. Demos that
 * want to break out of the chrome (e.g. fullscreen 3D scenes like Islands
 * or Tower Climb) skip <DemoPage> entirely.
 */
export function DemoPage({
  id,
  title,
  blurb,
  children,
  maxWidth = '3xl',
  hideChrome = false,
}: {
  id: string;
  title: string;
  blurb?: string;
  children: ReactNode;
  maxWidth?: 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl';
  hideChrome?: boolean;
}) {
  const navigate = useNavigate();
  const { isFavorite, toggle } = useFavorites();

  function goBack() {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  }

  if (hideChrome) return <>{children}</>;

  const widthClass = {
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
  }[maxWidth];

  return (
    <div className={`p-6 md:p-8 ${widthClass} mx-auto`}>
      <div className="mb-2 text-xs flex items-center gap-3">
        <button onClick={goBack} className="text-slate-400 hover:text-slate-200">← Back</button>
        <Link to="/" className="text-slate-500 hover:text-slate-300">Overview</Link>
      </div>
      <div className="flex items-start gap-3 mb-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl md:text-3xl font-bold">{title}</h1>
          {blurb && <p className="text-slate-400 mt-1 text-sm">{blurb}</p>}
        </div>
        <ShareButton url={deepLinkFor({ id, type: 'page' })} title={title} />
        <StarButton on={isFavorite(id)} onClick={() => toggle(id)} />
      </div>
      {children}
    </div>
  );
}
