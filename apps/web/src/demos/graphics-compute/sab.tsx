import { Out } from '../_shared/ui';

export default function SABDemo() {
  const iso = (window as Window & { crossOriginIsolated?: boolean }).crossOriginIsolated;
  if (!('SharedArrayBuffer' in window)) return <Out tone="err">unsupported</Out>;
  if (!iso) return <Out tone="err">crossOriginIsolated is false — set COOP/COEP headers to enable.</Out>;
  return <Out tone="ok">crossOriginIsolated; SharedArrayBuffer available.</Out>;
}
