import type { ReactNode } from 'react';

export const btn =
  'px-3 py-1.5 rounded-md bg-brand-500 hover:bg-brand-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-medium text-xs transition';

export const btnGhost =
  'px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs transition';

export function Btn(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' },
) {
  const { variant = 'primary', className = '', ...rest } = props;
  return <button {...rest} className={`${variant === 'ghost' ? btnGhost : btn} ${className}`} />;
}

/** Standard small readout line under demo buttons. */
export function Out({
  children,
  mono = true,
  tone = 'default',
}: {
  children: ReactNode;
  mono?: boolean;
  tone?: 'default' | 'err' | 'ok';
}) {
  const color =
    tone === 'err' ? 'text-rose-300' : tone === 'ok' ? 'text-emerald-300' : 'text-slate-300';
  return (
    <div className={`text-xs ${mono ? 'font-mono' : ''} ${color} mt-2 break-all`}>{children}</div>
  );
}

/** Small inline field for showing key/value pairs in demo bodies. */
export function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-slate-800 last:border-b-0 py-1 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-200 font-mono text-right truncate">{value}</span>
    </div>
  );
}
