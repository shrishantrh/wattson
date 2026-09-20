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
  // The land is quiet when the camera is far out (on the landing the globe sits behind the
  // headline and the search box) and comes up as it moves in, where the map is the subject.
  farTone: 0.36, // dot brightness at `farAlt` and beyond
  farContrast: 0.6, // ... and how much of the coast-to-interior contrast survives there
  farAlt: 1.9, // camera altitude at which the land is fully quiet
  nearAlt: 0.75, // ... and at which it is fully up
  // A heat overlay is the subject of the map, so when one is on the land keeps far more of its
  // brightness and nearly all of its contrast at altitude: a tint the caller asked for must
  // still read behind a landing headline, where the plain land is deliberately quiet.
  heatFarTone: 0.66,
  heatFarContrast: 0.94,
  dimStep: 0.55, // how far everything unselected drops when one place is selected
}

/**
 * The land's brightness and contrast for a camera altitude: 1 and 1 close in, falling to
 * `farTone`/`farContrast` as the camera pulls back. With `heat` set, the far end is raised so
 * a heat tint survives at landing altitude.
 * @param {number} altitude
 * @param {boolean} [heat] a heat overlay is being drawn
 * @returns {{ tone: number, contrast: number }}
 */
export function toneForAltitude(altitude, heat = false) {
  const { farAlt, nearAlt } = SURFACE_DEFAULTS
  const farTone = heat ? SURFACE_DEFAULTS.heatFarTone : SURFACE_DEFAULTS.farTone
  const farContrast = heat ? SURFACE_DEFAULTS.heatFarContrast : SURFACE_DEFAULTS.farContrast
  const x = (farAlt - (altitude ?? farAlt)) / (farAlt - nearAlt)
  const t = Math.max(0, Math.min(1, x))
  const e = t * t * (3 - 2 * t) // smoothstep
  return { tone: farTone + (1 - farTone) * e, contrast: farContrast + (1 - farContrast) * e }
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
  // Held on the material so the camera can drive them after the shader has compiled.
  const uniforms = { uDotLimb: { value: limb }, uTone: { value: 1 }, uContrast: { value: 1 }, uDim: { value: 1 } }
  material.userData.uniforms = uniforms
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
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
      .replace(
        '#include <common>',
        '#include <common>\nuniform float uDotLimb;\nuniform float uTone;\nuniform float uContrast;\nuniform float uDim;\nvarying float vFres;',
      )
      .replace(
        '#include <colorspace_fragment>',
        `float mAvg = dot(gl_FragColor.rgb, vec3(0.3333));
        gl_FragColor.rgb = mix(vec3(mAvg), gl_FragColor.rgb, uContrast) * uTone * uDim;
        gl_FragColor.rgb *= mix(uDotLimb, 1.0, smoothstep(0.0, 1.0, vFres));
        #include <colorspace_fragment>`,
      )
  }
  material.customProgramCacheKey = () => `wattson-dot-falloff-${limb}`
  return material
}

/**
 * Drive a patched dot material from the camera altitude. Cheap enough for every camera frame:
 * two uniform writes, no repaint of the 15k instance colours.
 * @param {THREE.Material} material
 * @param {number} altitude
 * @param {boolean} [heat] a heat overlay is on: hold the land brighter at altitude
 */
export function setDotTone(material, altitude, heat = false) {
  const u = material && material.userData && material.userData.uniforms
  if (!u) return
  const { tone, contrast } = toneForAltitude(altitude, heat)
  u.uTone.value = tone
  u.uContrast.value = contrast
}

/**
 * Dim the whole dot field by a factor, on top of whatever the camera altitude asked for. Used
 * to step the map back while one place is selected; one uniform write, no repaint.
 * @param {THREE.Material} material
 * @param {number} k 1 = normal, `SURFACE_DEFAULTS.dimStep` = stepped back
 */
export function setDotDim(material, k) {
  const u = material && material.userData && material.userData.uniforms
  if (!u) return
  u.uDim.value = k
}
