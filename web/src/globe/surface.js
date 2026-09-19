// Depth for the dots style: a view-dependent falloff shared by the sphere and the land dots.
//
// Everything on this globe is unlit on purpose (a lit sphere would shade the dot matrix by
// where the light happens to be), which is exactly why the old sphere read as a flat disc.
// Instead of light, both surfaces use the one quantity that is honest about a sphere seen
// from a camera: `f = dot(surface normal, view direction)`, 1 where the surface faces you
// and 0 at the limb. The centre is lifted a little, the limb is pushed below the page
// background so the disc dissolves into it instead of ending on a hard circle, and a very
// low-alpha white rim is added in the last few degrees before the horizon.
import * as THREE from 'three'

export const SURFACE_DEFAULTS = {
  centre: 1.35, // sphere brightness at the sub-camera point, relative to its base colour
  limb: 0.5, // ... and at the horizon
  rim: 0.06, // white added at the very edge (alpha, effectively)
  rimWidth: 9, // falloff exponent: higher is a thinner rim line
  dotLimb: 0.42, // dot brightness at the horizon, relative to its own colour
}

const VERT = /* glsl */ `
varying float vFres;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vec3 n = normalize(normalMatrix * normal);
  vFres = clamp(dot(n, normalize(-mv.xyz)), 0.0, 1.0);
  gl_Position = projectionMatrix * mv;
}`

const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uRimColor;
uniform float uCentre;
uniform float uLimb;
uniform float uRim;
uniform float uRimWidth;
varying float vFres;
void main() {
  float f = smoothstep(0.0, 1.0, vFres);
  vec3 c = uColor * mix(uLimb, uCentre, f);
  c += uRimColor * (uRim * pow(1.0 - vFres, uRimWidth));
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`

/**
 * The dots-style globe material: an opaque sphere in `color` with a radial falloff towards
 * the limb and a thin rim light. Recolour in place with `setSphereColor` rather than
 * rebuilding it.
 * @param {string|number} color base colour (hex number or '#rrggbb')
 * @param {{ centre?: number, limb?: number, rim?: number, rimWidth?: number, rimColor?: string }} [opts]
 * @returns {THREE.ShaderMaterial}
 */
export function makeSphereMaterial(color, opts = {}) {
  const o = { ...SURFACE_DEFAULTS, ...opts }
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uRimColor: { value: new THREE.Color(o.rimColor || 0xffffff) },
      uCentre: { value: o.centre },
      uLimb: { value: o.limb },
      uRim: { value: o.rim },
      uRimWidth: { value: o.rimWidth },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
  })
}

/** Set the sphere material's base colour in place (no rebuild, no reallocation). */
export function setSphereColor(material, hex) {
  if (material && material.uniforms && material.uniforms.uColor) material.uniforms.uColor.value.setHex(hex)
}

/**
 * Give an instanced MeshBasicMaterial the same limb falloff as the sphere, so the dot matrix
 * has depth instead of reading as a uniform stipple pasted over a ball. Patched through
 * onBeforeCompile so three keeps handling instancing, instance colours and colour management.
 * @param {THREE.Material} material
 * @param {number} [limb] dot brightness at the horizon
 */
export function patchDotFalloff(material, limb = SURFACE_DEFAULTS.dotLimb) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uDotLimb = { value: limb }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vFres;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec4 wFres = modelViewMatrix * instanceMatrix * vec4(transformed, 1.0);
          vec3 nFres = normalize(normalMatrix * mat3(instanceMatrix) * normal);
        #else
          vec4 wFres = modelViewMatrix * vec4(transformed, 1.0);
          vec3 nFres = normalize(normalMatrix * normal);
        #endif
        vFres = clamp(dot(nFres, normalize(-wFres.xyz)), 0.0, 1.0);`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uDotLimb;\nvarying float vFres;')
      .replace(
        '#include <colorspace_fragment>',
        'gl_FragColor.rgb *= mix(uDotLimb, 1.0, smoothstep(0.0, 1.0, vFres));\n#include <colorspace_fragment>',
      )
  }
  material.customProgramCacheKey = () => `wattson-dot-falloff-${limb}`
  return material
}
