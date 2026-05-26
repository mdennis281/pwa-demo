/**
 * Star toggle. Solid yellow when on, outlined when off. Used by ModalHost,
 * DemoPage, and the compact chip lists. Stateless — the parent owns the
 * favorite set and tells us what to render.
 */
export function StarButton({
  on,
  size = 'md',
  onClick,
  className = '',
  ...rest
}: {
  on: boolean;
  size?: 'sm' | 'md';
  onClick: () => void;
  className?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'>) {
  const dims = size === 'sm' ? 'w-5 h-5 text-[11px]' : 'w-7 h-7 text-sm';
  return (
    <button
      type="button"
      {...rest}
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); onClick(); }}
      className={`shrink-0 inline-flex items-center justify-center rounded transition ${dims} ${
        on
          ? 'text-amber-300 hover:text-amber-200'
          : 'text-slate-600 hover:text-amber-300'
      } ${className}`}
      title={on ? 'Remove favorite' : 'Add favorite'}
    >
      {on ? '★' : '☆'}
    </button>
  );
}
