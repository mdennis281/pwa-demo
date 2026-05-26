import { Out } from '../_shared/ui';

export default function LaunchQueueDemo() {
  const lq = (window as Window & { launchQueue?: { setConsumer: (cb: (p: unknown) => void) => void } }).launchQueue;
  if (!lq) return <Out tone="err">unsupported</Out>;
  return <Out>launchQueue present. Launch the installed PWA with a file or URL to deliver a LaunchParams to it.</Out>;
}
