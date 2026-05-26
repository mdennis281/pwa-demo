import { useState } from 'react';
import { Btn, Out } from '../_shared/ui';

export default function PaymentDemo() {
  // basic-card was removed from Chromium in 2023, which is why the old probe
  // returned false on a working browser. Probe the modern URL-based methods
  // (Google Pay test env + Apple Pay) plus the legacy probe so users see
  // exactly what their browser does and doesn't accept. The Show sheet
  // button opens the real OS payment UI with a $0.01 placeholder — cancel
  // it; the demo never settles a charge.
  type ProbeResult = { method: string; canMake: boolean | null; err?: string };
  const [probes, setProbes] = useState<ProbeResult[]>([]);
  const [out, setOut] = useState<{ tone: 'default' | 'ok' | 'err'; msg: string }>({
    tone: 'default', msg: '—',
  });
  const supported = typeof window !== 'undefined' && 'PaymentRequest' in window;

  // Methods covering the three realistic Chromium paths today plus the
  // legacy one so the probe shows the deprecation transparently.
  const methods: PaymentMethodData[] = [
    {
      supportedMethods: 'https://google.com/pay',
      data: {
        apiVersion: 2,
        apiVersionMinor: 0,
        merchantInfo: { merchantName: 'PWA Demo' },
        allowedPaymentMethods: [{
          type: 'CARD',
          parameters: {
            allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
            allowedCardNetworks: ['VISA', 'MASTERCARD'],
          },
          tokenizationSpecification: {
            type: 'PAYMENT_GATEWAY',
            parameters: { gateway: 'example', gatewayMerchantId: 'exampleGatewayMerchantId' },
          },
        }],
      },
    },
    { supportedMethods: 'https://apple.com/apple-pay' },
    { supportedMethods: 'basic-card' },
  ];

  const details: PaymentDetailsInit = {
    total: { label: 'PWA Demo (test)', amount: { currency: 'USD', value: '0.01' } },
    displayItems: [
      { label: 'Demo line item', amount: { currency: 'USD', value: '0.01' } },
    ],
  };

  async function probe() {
    if (!supported) return setOut({ tone: 'err', msg: 'unsupported' });
    const results: ProbeResult[] = [];
    for (const m of methods) {
      try {
        const pr = new PaymentRequest([m], details);
        const can = await pr.canMakePayment();
        results.push({ method: m.supportedMethods, canMake: can });
      } catch (e) {
        results.push({ method: m.supportedMethods, canMake: null, err: (e as Error).message });
      }
    }
    setProbes(results);
    const anyOk = results.some((r) => r.canMake === true);
    setOut({
      tone: anyOk ? 'ok' : 'err',
      msg: anyOk ? 'at least one method is usable — try Show sheet' : 'no payment method available on this browser/OS',
    });
  }

  async function showSheet() {
    if (!supported) return setOut({ tone: 'err', msg: 'unsupported' });
    try {
      const pr = new PaymentRequest(methods, details, { requestPayerEmail: true });
      const response = await pr.show();
      // Demo only — never settle a real charge. We acknowledge the response
      // so the browser dismisses the sheet cleanly.
      await response.complete('success');
      setOut({ tone: 'ok', msg: `paid via ${response.methodName} (demo — no real charge)` });
    } catch (e) {
      const msg = (e as Error).message;
      const cancelled = /cancel|aborterror|the request has been cancelled/i.test(msg);
      setOut({ tone: cancelled ? 'default' : 'err', msg: cancelled ? 'sheet cancelled' : msg });
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Btn onClick={probe} disabled={!supported}>Probe methods</Btn>
        <Btn variant="ghost" onClick={showSheet} disabled={!supported}>Show sheet ($0.01 test)</Btn>
      </div>
      {probes.length > 0 && (
        <div className="text-[10px] font-mono text-slate-400 space-y-0.5 bg-slate-950/60 border border-slate-800 rounded p-2">
          {probes.map((p) => (
            <div key={p.method} className="flex gap-2">
              <span className={p.canMake ? 'text-emerald-300' : p.canMake === false ? 'text-rose-300' : 'text-amber-300'}>
                {p.canMake === true ? '✓' : p.canMake === false ? '✗' : '!'}
              </span>
              <span className="truncate">{p.method}</span>
              <span className="text-slate-500">{p.err ? `(${p.err})` : ''}</span>
            </div>
          ))}
        </div>
      )}
      <Out tone={out.tone}>{out.msg}</Out>
    </div>
  );
}
