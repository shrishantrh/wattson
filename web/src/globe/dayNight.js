// Day/night globe material. The shader is the one from globe.gl's day-night-cycle example
// (view-space normal dotted with the sun direction rotated into the camera frame), with two
// additions: the day texture is multiplied by `dayDim` so the whole globe stays dark, and the
// textures are declared sRGB so three decodes them, which means the fragment has to be
// re-encoded with three's colorspace_fragment chunk before it hits the canvas.
import * as THREE from 'three'

export const TEXTURE_URLS = {
  night: import.meta.env.BASE_URL + 'textures/earth-night.jpg',
  day: import.meta.env.BASE_URL + 'textures/earth-day.jpg',
}

const VERTEX_SHADER = /* glsl */ `
  varying vec3 vNormal;
  varying vec2 vUv;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const FRAGMENT_SHADER = /* glsl */ `
  #define PI 3.141592653589793
  uniform sampler2D dayTexture;
  uniform sampler2D nightTexture;
  uniform vec2 sunPosition;    // (lng, lat) degrees
  uniform vec2 globeRotation;  // (lng, lat) degrees of the camera point of view
  uniform float dayDim;        // perceptual brightness multiplier for the day side, 0..1
  varying vec3 vNormal;
  varying vec2 vUv;

  float toRad(in float a) {
    return a * PI / 180.0;
  }

  vec3 Polar2Cartesian(in vec2 c) { // [lng, lat]
    float theta = toRad(90.0 - c.x);
    float phi = toRad(90.0 - c.y);
    return vec3( // x,y,z
      sin(phi) * cos(theta),
      cos(phi),
      sin(phi) * sin(theta)
    );
  }

  void main() {
    float invLon = toRad(globeRotation.x);
    float invLat = -toRad(globeRotation.y);
    mat3 rotX = mat3(
      1, 0, 0,
      0, cos(invLat), -sin(invLat),
      0, sin(invLat), cos(invLat)
    );
    mat3 rotY = mat3(
      cos(invLon), 0, sin(invLon),
      0, 1, 0,
      -sin(invLon), 0, cos(invLon)
    );
    vec3 rotatedSunDirection = rotX * rotY * Polar2Cartesian(sunPosition);
    float intensity = dot(normalize(vNormal), normalize(rotatedSunDirection));
    vec4 dayColor = texture2D(dayTexture, vUv);
    vec4 nightColor = texture2D(nightTexture, vUv);
    float blendFactor = smoothstep(-0.1, 0.1, intensity);
    // Textures are sampled as linear light; raise dayDim to 2.2 so it behaves as a perceptual
    // multiplier (dayDim 0.35 reads as 35% brightness on screen, not 63%).
    float dim = pow(clamp(dayDim, 0.0, 1.0), 2.2);
    vec3 rgb = mix(nightColor.rgb, dayColor.rgb * dim, blendFactor);
    gl_FragColor = vec4(rgb, 1.0);
    #include <colorspace_fragment>
  }
`

/**
 * Load one sRGB texture.
 * @param {string} url
 * @returns {Promise<THREE.Texture>}
 */
export function loadTexture(url) {
  return new THREE.TextureLoader().loadAsync(url).then((texture) => {
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 1
    return texture
  })
}

/**
 * Load the night texture and, when `withDay` is true, the day texture too.
 * @param {boolean} [withDay=true]
 * @returns {Promise<{ day: THREE.Texture|null, night: THREE.Texture }>}
 */
export function loadDayNightTextures(withDay = true) {
  return Promise.all([loadTexture(TEXTURE_URLS.night), withDay ? loadTexture(TEXTURE_URLS.day) : null]).then(
    ([night, day]) => ({ night, day }),
  )
}

/**
 * ShaderMaterial blending a night texture and a dimmed day texture across the terminator.
 * The component updates `material.uniforms.sunPosition` (lng, lat), `globeRotation` (lng, lat
 * of the camera point of view) and `dayDim` in place; no material rebuild is needed.
 * @param {object} opts
 * @param {THREE.Texture} opts.dayTexture
 * @param {THREE.Texture} opts.nightTexture
 * @param {number} [opts.sunLat=0]
 * @param {number} [opts.sunLng=0]
 * @param {number} [opts.dayDim=0.35]
 * @param {number} [opts.globeLat=0] initial camera latitude (keeps the terminator right before the first zoom event)
 * @param {number} [opts.globeLng=0] initial camera longitude
 * @returns {THREE.ShaderMaterial}
 */
export function makeDayNightMaterial({
  dayTexture,
  nightTexture,
  sunLat = 0,
  sunLng = 0,
  dayDim = 0.35,
  globeLat = 0,
  globeLng = 0,
}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      dayTexture: { value: dayTexture },
      nightTexture: { value: nightTexture },
      sunPosition: { value: new THREE.Vector2(sunLng, sunLat) },
      globeRotation: { value: new THREE.Vector2(globeLng, globeLat) },
      dayDim: { value: dayDim },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
  })
}

/**
 * Update the day/night uniforms in place. Only the fields passed are changed. Safe to call
 * with any material: it is a no-op for materials without these uniforms.
 * @param {THREE.Material|null|undefined} material
 * @param {{ sunLat?: number, sunLng?: number, dayDim?: number, globeLat?: number, globeLng?: number }} values
 */
export function setDayNightUniforms(material, { sunLat, sunLng, dayDim, globeLat, globeLng } = {}) {
  const u = material && material.uniforms
  if (!u || !u.sunPosition) return
  if (sunLng != null) u.sunPosition.value.x = sunLng
  if (sunLat != null) u.sunPosition.value.y = sunLat
  if (dayDim != null) u.dayDim.value = dayDim
  if (globeLng != null) u.globeRotation.value.x = globeLng
  if (globeLat != null) u.globeRotation.value.y = globeLat
}

/**
 * Unlit material showing only the night texture (used when the terminator is disabled).
 * Unlit on purpose: globe.gl's default MeshPhongMaterial would be lit by its ambient and
 * directional lights and the city lights would no longer be the only bright thing.
 * @param {THREE.Texture} nightTexture
 * @returns {THREE.MeshBasicMaterial}
 */
export function makeNightMaterial(nightTexture) {
  return new THREE.MeshBasicMaterial({ map: nightTexture })
}
