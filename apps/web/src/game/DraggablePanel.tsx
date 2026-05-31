import { useEffect, useRef, useState } from 'react';

/** The shared chrome behind every floating in-game overlay (settings, render
 *  perf, network perf). Owns the drag (grab the header), the close button, and
 *  the panel styling — so none of that logic is duplicated per menu.
 *
 *  Lives at z-50: that clears the HUD (z-10), touch controls (z-20) and the
 *  banners (z-30), which is why the debug button's old z-10 home was untappable
 *  on mobile (TouchControls stole the tap). `touch-none` on the header keeps a
 *  mobile drag from scrolling/zooming the page instead of moving the panel. */
export function DraggablePanel({
  title,
  icon,
  accent = 'border-sky-500/40',
  titleColor = 'text-sky-300',
  width = 'w-64',
  defaultPos = { x: 16, y: 80 },
  onClose,
  children,
}: {
  title: string;
  icon?: string;
  /** border color class */
  accent?: string;
  /** title text color class */
  titleColor?: string;
  /** width class, e.g. 'w-64' / 'w-72' */
  width?: string;
  defaultPos?: { x: number; y: number };
  onClose?: () => void;
  children: React.ReactNode;
}) {
  const [pos, setPos] = useState(defaultPos);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!drag.current) return;
      setPos({
        x: Math.max(0, e.clientX - drag.current.dx),
        y: Math.max(0, e.clientY - drag.current.dy),
      });
    };
    const onUp = () => { drag.current = null; };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);

  const startDrag = (e: React.PointerEvent) => {
    e.stopPropagation();
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
  };

  return (
    <div
      className={`fixed z-50 ${width} bg-slate-950/95 backdrop-blur border ${accent} rounded-lg text-xs font-mono text-slate-200 shadow-2xl select-none`}
      style={{ left: pos.x, top: pos.y }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-700 cursor-move touch-none"
        onPointerDown={startDrag}
      >
        <span className={`font-semibold ${titleColor}`}>{icon ? `${icon} ` : ''}{title}</span>
        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-slate-100 px-1 cursor-pointer">✕</button>
        )}
      </div>
      <div className="p-3 space-y-1.5">{children}</div>
    </div>
  );
}
