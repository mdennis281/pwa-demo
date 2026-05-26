import { useState } from 'react';
import { Btn, Out } from '../_shared/ui';

export default function RelatedAppsDemo() {
  const [out, setOut] = useState('not yet checked');
  async function run() {
    const nav = navigator as Navigator & { getInstalledRelatedApps?: () => Promise<unknown[]> };
    if (typeof nav.getInstalledRelatedApps !== 'function') { setOut('unsupported'); return; }
    try {
      const apps = await nav.getInstalledRelatedApps();
      setOut(`${apps.length} match(es): ${JSON.stringify(apps)}`);
    } catch (e) { setOut(`error: ${(e as Error).message}`); }
  }
  return (
    <div>
      <Btn onClick={run}>Check related apps</Btn>
      <Out>{out}</Out>
    </div>
  );
}
