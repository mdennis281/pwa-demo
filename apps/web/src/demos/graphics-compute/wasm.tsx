import { useState } from 'react';
import { Btn, Out } from '../_shared/ui';

export default function WasmDemo() {
  const [out, setOut] = useState('—');
  async function go() {
    if (!('WebAssembly' in window)) return setOut('unsupported');
    // tiny wasm: a function `add(i32, i32) -> i32`. Hand-built bytes.
    const bytes = new Uint8Array([
      0x00,0x61,0x73,0x6d,0x01,0x00,0x00,0x00,
      0x01,0x07,0x01,0x60,0x02,0x7f,0x7f,0x01,0x7f,
      0x03,0x02,0x01,0x00,
      0x07,0x07,0x01,0x03,0x61,0x64,0x64,0x00,0x00,
      0x0a,0x09,0x01,0x07,0x00,0x20,0x00,0x20,0x01,0x6a,0x0b,
    ]);
    const { instance } = await WebAssembly.instantiate(bytes);
    const add = (instance.exports.add as (a: number, b: number) => number);
    setOut(`add(40, 2) = ${add(40, 2)}`);
  }
  return (
    <div>
      <Btn onClick={go}>Run wasm</Btn>
      <Out>{out}</Out>
    </div>
  );
}
