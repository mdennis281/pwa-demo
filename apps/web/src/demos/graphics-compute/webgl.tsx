/**
 * MODAL DEMO — WebGL 1.
 *
 * Animated colored triangle with custom vertex + fragment shaders. Exercises:
 *   - shader compile + link
 *   - vertex buffer + interleaved attributes (position, color)
 *   - uniform binding (time)
 *   - the render loop
 *
 * Kept compact so the whole pipeline reads in one screen. The WebGL 2 demo
 * shows off what v2 actually adds (instanced rendering).
 */
import { useEffect, useRef, useState } from 'react';
import { Out } from '../_shared/ui';

// `precision mediump float;` must match the fragment shader — otherwise
// shared uniforms like `u_t` get mismatched precisions and the program
// fails to link. (Vertex defaults to highp; fragment has no default.)
const VS = `
precision mediump float;
attribute vec2 a_pos;
attribute vec3 a_color;
uniform float u_t;
varying vec3 v_color;
void main() {
  float c = cos(u_t), s = sin(u_t);
  mat2 rot = mat2(c, -s, s, c);
  gl_Position = vec4(rot * a_pos, 0.0, 1.0);
  v_color = a_color;
}
`;

const FS = `
precision mediump float;
varying vec3 v_color;
uniform float u_t;
void main() {
  float pulse = 0.65 + 0.35 * sin(u_t * 2.0);
  gl_FragColor = vec4(v_color * pulse, 1.0);
}
`;

export default function WebGLDemo() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [info, setInfo] = useState('—');

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl');
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

    // Interleaved: [x, y, r, g, b] per vertex, 3 verts.
    const verts = new Float32Array([
       0.0,  0.75,  0.95, 0.25, 0.45,
      -0.70, -0.55,  0.25, 0.90, 0.55,
       0.70, -0.55,  0.30, 0.55, 0.95,
    ]);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

    const stride = 5 * 4;
    const aPos = gl.getAttribLocation(prog, 'a_pos');
    const aColor = gl.getAttribLocation(prog, 'a_color');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(aColor);
    gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, stride, 8);

    const uT = gl.getUniformLocation(prog, 'u_t');
    setInfo(String(gl.getParameter(gl.VERSION)));

    const t0 = performance.now();
    let raf = 0;
    const tick = () => {
      const t = (performance.now() - t0) / 1000;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0.04, 0.06, 0.10, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uT, t);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
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
        Vertex + fragment shaders, rotating triangle with time-pulsed color.
      </div>
    </div>
  );
}
