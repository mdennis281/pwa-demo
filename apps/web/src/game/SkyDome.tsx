import { useMemo } from 'react';
import * as THREE from 'three';

/**
 * A big inverted sphere with a custom gradient shader. Renders behind
 * everything (renderOrder = -10, depthWrite = false, fog disabled).
 * Always visible — does not depend on drei/three Sky which had quirks
 * in our config.
 */
export default function SkyDome({
  topColor = '#3576bf',
  midColor = '#a8d2ee',
  horizonColor = '#fcdcb1',
  groundColor = '#cda77f',
  sunDirection = [0.35, 0.5, 0.8] as [number, number, number],
  sunColor = '#ffe2b0',
}: {
  topColor?: string;
  midColor?: string;
  horizonColor?: string;
  groundColor?: string;
  sunDirection?: [number, number, number];
  sunColor?: string;
} = {}) {
  const uniforms = useMemo(() => {
    const sd = new THREE.Vector3(...sunDirection).normalize();
    return {
      topColor:     { value: new THREE.Color(topColor) },
      midColor:     { value: new THREE.Color(midColor) },
      horizonColor: { value: new THREE.Color(horizonColor) },
      groundColor:  { value: new THREE.Color(groundColor) },
      sunDirection: { value: sd },
      sunColor:     { value: new THREE.Color(sunColor) },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <mesh renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[1500, 32, 24]} />
      <shaderMaterial
        attach="material"
        side={THREE.BackSide}
        depthWrite={false}
        fog={false}
        uniforms={uniforms}
        vertexShader={`
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform vec3 topColor;
          uniform vec3 midColor;
          uniform vec3 horizonColor;
          uniform vec3 groundColor;
          uniform vec3 sunDirection;
          uniform vec3 sunColor;
          varying vec3 vDir;

          void main() {
            float h = vDir.y;
            vec3 col;
            if (h >= 0.0) {
              // sky: horizon → mid → top
              float a = smoothstep(0.0, 0.18, h);
              float b = smoothstep(0.18, 0.55, h);
              col = mix(horizonColor, midColor, a);
              col = mix(col, topColor, b);
            } else {
              // below-horizon: fade to ground tone
              float t = smoothstep(0.0, -0.4, h);
              col = mix(horizonColor, groundColor, t);
            }

            // Soft sun disc + halo
            float sunDot = max(dot(vDir, sunDirection), 0.0);
            col += sunColor * pow(sunDot, 64.0) * 1.4;     // tight bright disc
            col += sunColor * pow(sunDot, 6.0)  * 0.15;    // wide halo

            gl_FragColor = vec4(col, 1.0);
          }
        `}
      />
    </mesh>
  );
}
