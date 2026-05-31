// Graphics settings: shadow preference persistence + GPU-acceleration detection.
// The shadow toggle defaults OFF on software renderers (no real GPU — the
// 20-30fps WARP/SwiftShader case) and ON otherwise, but a saved user choice and
// the `?noshadows` debug flag take precedence.

const SHADOW_KEY = 'towerclimb.shadows';

// Substrings (lower-cased) that mark a software WebGL backend across browsers.
const SOFTWARE_SIGNATURES = [
  'swiftshader',          // Chrome's software GL fallback
  'basic render driver',  // Windows WARP — "Microsoft Basic Render Driver"
  'llvmpipe',             // Mesa software (Linux)
  'softpipe',             // Mesa software
  'software',             // generic
  'microsoft gdi',        // ancient Windows GDI
  'apple software renderer',
];

/** Heuristic: is this WebGL context backed by a software rasterizer (no GPU)?
 *  Reads the unmasked renderer string and matches known software names. An
 *  unknown / masked renderer is treated as hardware so the common case keeps
 *  shadows (the user can still toggle them off). */
export function isLikelySoftwareRenderer(gl: WebGLRenderingContext | WebGL2RenderingContext): boolean {
  try {
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const raw = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    if (!raw || typeof raw !== 'string') return false;
    const s = raw.toLowerCase();
    return SOFTWARE_SIGNATURES.some((sig) => s.includes(sig));
  } catch {
    return false;
  }
}

/** Probe a throwaway context once to guess whether the machine has real GPU
 *  acceleration — used only to pick the default for the shadows toggle. */
function autoShadowDefault(): boolean {
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') ||
      c.getContext('webgl') ||
      c.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return false; // no WebGL → software/none → shadows off
    const soft = isLikelySoftwareRenderer(gl);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return !soft;
  } catch {
    return true; // probe failed → assume hardware
  }
}

/** Resolve the initial shadow state. Precedence:
 *  `?noshadows` (force-off, for testing) > saved user pref > GPU auto-default. */
export function resolveInitialShadows(): boolean {
  try {
    if (new URLSearchParams(window.location.search).has('noshadows')) return false;
  } catch { /* ignore */ }
  try {
    const v = localStorage.getItem(SHADOW_KEY);
    if (v === '1') return true;
    if (v === '0') return false;
  } catch { /* ignore */ }
  return autoShadowDefault();
}

export function saveShadowPref(on: boolean): void {
  try { localStorage.setItem(SHADOW_KEY, on ? '1' : '0'); } catch { /* ignore */ }
}

/** Optional shadow-map resolution override via `?shadowres=1024`. */
export function resolveShadowRes(): number {
  try {
    const n = Number(new URLSearchParams(window.location.search).get('shadowres'));
    if (Number.isFinite(n) && n > 0) return n;
  } catch { /* ignore */ }
  return 2048;
}
