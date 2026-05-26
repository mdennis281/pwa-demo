import { useState } from 'react';
import { Btn, Out } from '../_shared/ui';

export default function WebRTCDemo() {
  const [out, setOut] = useState('—');
  async function go() {
    const pc = new RTCPeerConnection();
    pc.createDataChannel('demo');
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    setOut(`local SDP created (${offer.sdp?.length} bytes) — full P2P needs a signaling channel.`);
    pc.close();
  }
  return (
    <div>
      <Btn onClick={go}>Create offer</Btn>
      <Out>{out}</Out>
    </div>
  );
}
