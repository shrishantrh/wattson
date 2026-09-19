// Subsolar point: the latitude/longitude where the sun is directly overhead right now.
// Standard low-precision solar position (Meeus; the same formulas NOAA's solar calculator
// uses): declination and equation of time from Julian centuries since J2000. No
// dependencies. Accuracy is a small fraction of a degree, far finer than a terminator
// drawn at globe scale.

const DEG = Math.PI / 180

function norm360(x) {
  return ((x % 360) + 360) % 360
}

function norm180(x) {
  const n = norm360(x)
  return n > 180 ? n - 360 : n
}

/**
 * Subsolar point for a moment in time.
 * @param {Date|number} [date] Date or epoch milliseconds. Defaults to now.
 * @returns {{ lat: number, lng: number }} degrees; lat is the solar declination, lng is in [-180, 180]
 */
export function subsolarPoint(date = new Date()) {
  const ms = date instanceof Date ? date.getTime() : Number(date)
  const jd = ms / 86400000 + 2440587.5 // Julian day (UTC)
  const T = (jd - 2451545) / 36525 // Julian centuries since J2000.0

  const L0 = norm360(280.46646 + T * (36000.76983 + T * 0.0003032)) // geometric mean longitude
  const M = norm360(357.52911 + T * (35999.05029 - 0.0001537 * T)) // mean anomaly
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T) // orbital eccentricity
  const Mr = M * DEG
  const C =
    Math.sin(Mr) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
    Math.sin(2 * Mr) * (0.019993 - 0.000101 * T) +
    Math.sin(3 * Mr) * 0.000289 // equation of centre
  const omega = 125.04 - 1934.136 * T
  const lambda = L0 + C - 0.00569 - 0.00478 * Math.sin(omega * DEG) // apparent longitude
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60
  const eps = (eps0 + 0.00256 * Math.cos(omega * DEG)) * DEG // obliquity, corrected

  const declination = Math.asin(Math.sin(eps) * Math.sin(lambda * DEG)) / DEG

  // Equation of time, minutes (apparent solar time minus mean solar time).
  const y = Math.tan(eps / 2) ** 2
  const L0r = L0 * DEG
  const eot =
    (4 *
      (y * Math.sin(2 * L0r) -
        2 * e * Math.sin(Mr) +
        4 * e * y * Math.sin(Mr) * Math.cos(2 * L0r) -
        0.5 * y * y * Math.sin(4 * L0r) -
        1.25 * e * e * Math.sin(2 * Mr))) /
    DEG

  // Solar noon happens where (UTC minutes + eot + 4 * lng) == 720.
  const utcMinutes = (((ms % 86400000) + 86400000) % 86400000) / 60000
  const lng = norm180((720 - utcMinutes - eot) / 4)

  return { lat: declination, lng }
}
