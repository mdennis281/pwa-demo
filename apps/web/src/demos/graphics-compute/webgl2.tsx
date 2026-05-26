/**
 * MODAL DEMO — WebGL 2.
 *
 * Instanced rendering: 200 little rotating quads drawn in a single
 * gl.drawArraysInstanced call. The vertex shader picks each instance's
 * offset + color from per-instance attribute buffers (vertexAttribDivisor=1).
 *
 * Instancing is the headline feature WebGL 2 adds over v1 — you can do this
 * in v1 only via the ANGLE_instanced_arrays extension. Here it's a core API.
 */
import { useEffect, useRef, useState } from 'react';
import { Out } from '../_shared/ui';

const INSTANCES = 200;

const VS = `#version 300 es
in vec2 a_pos;
in vec2 a_offset;
in vec3 a_color;
uniform float u_t;
out vec3 v_color;
void main() {
  float a = u_t * 0.7 + a_offset.x * 6.0 + a_offset.y * 4.0;
  mat2 rot = mat2(cos(a), -sin(a), sin(a), cos(a));
  float scale = 0.06 + 0.02 * sin(u_t * 1.5 + a_offset.x * 3.0);
  vec2 p = rot * a_pos * scale + a_offset * (0.85 + 0.15 * sin(u_t * 0.6 + a_offset.y * 5.0));
  gl_Position = vec4(p, 0.0, 1.0);
  v_color = a_color;
}
`;

const FS = `#version 300 es
precision mediump float;
in vec3 v_color;
out vec4 fragColor;
void main() { fragColor = vec4(v_color, 1.0); }
`;

export default function WebGL2Demo() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [info, setInfo] = useState('—');

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl2');
    if (!gl) { setInfo('context unavailable'); return; }

    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type);
      if (!sh) throw new Error('createShader returned null');
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(sh) ?? 'shader compile failed');
      }
      return sh;
    };

    let prog: WebGLProgram | null = null;
    try {
      prog = gl.createProgram();
      if (!prog) throw new Error('createProgram returned null');
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(prog) ?? 'link failed');
      }
    } catch (e) {
      setInfo((e as Error).message);
      return;
    }
    gl.useProgram(prog);

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    // Per-vertex quad (two triangles).
    const quad = new Float32Array([
      -1, -1,  1, -1,  1, 1,
      -1, -1,  1,  1, -1, 1,
    ]);
    const quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    // Per-instance offset (xy) + color (rgb) — 5 floats each.
    const inst = new Float32Array(INSTANCES * 5);
    for (let i = 0; i < INSTANCES; i++) {
      // Spread points across the viewport in [-1.4, 1.4] × [-0.85, 0.85].
      inst[i * 5 + 0] = (Math.random() - 0.5) * 1.7;
      inst[i * 5 + 1] = (Math.random() - 0.5) * 1.0;
      // Cyan→magenta palette so it reads as one coherent swarm.
      const hueT = Math.random();
      inst[i * 5 + 2] = 0.40 + hueT * 0.55;
      inst[i * 5 + 3] = 0.50 + (1 - hueT) * 0.45;
      inst[i * 5 + 4] = 0.85;
    }
    const instBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
    gl.bufferData(gl.ARRAY_BUFFER, inst, gl.STATIC_DRAW);
    const aOffset = gl.getAttribLocation(prog, 'a_offset');
    const aColor = gl.getAttribLocation(prog, 'a_color');
    gl.enableVertexAttribArray(aOffset);
    gl.vertexAttribPointer(aOffset, 2, gl.FLOAT, false, 20, 0);
    gl.vertexAttribDivisor(aOffset, 1);
    gl.enableVertexAttribArray(aColor);
    gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, 20, 8);
    gl.vertexAttribDivisor(aColor, 1);

    const uT = gl.getUniformLocation(prog, 'u_t');
    setInfo(`${gl.getParameter(gl.VERSION)} · ${INSTANCES} instances, 1 draw call`);

    const t0 = performance.now();
    let raf = 0;
    const tick = () => {
      const t = (performance.now() - t0) / 1000;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0.04, 0.06, 0.10, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uT, t);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, INSTANCES);
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div>
      <canvas
        ref={ref}
        width={360}
        height={200}
        className="w-full max-w-sm rounded border border-slate-700 bg-slate-950"
      />
      <Out>{info}</Out>
      <div className="mt-2 text-[10px] text-slate-500">
        drawArraysInstanced + vertexAttribDivisor — the v2 feature that lets you draw N copies in one call.
      </div>
    </div>
  );
}
