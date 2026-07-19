(() => {
  "use strict";

  const $ = selector => document.querySelector(selector);
  const canvas = $("#scene");
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "high-performance"
  });

  if (!gl) {
    $("#error").hidden = false;
    $("#status").textContent = "UNAVAILABLE";
    return;
  }
  const gpuTimerExtension = gl.getExtension("EXT_disjoint_timer_query_webgl2");


  const vertexSource = `#version 300 es
precision highp float;
const vec2 POSITIONS[3] = vec2[3](vec2(-1.0,-1.0),vec2(3.0,-1.0),vec2(-1.0,3.0));
out vec2 vUv;
void main() {
  vec2 p = POSITIONS[gl_VerID];
  vUv = p * 0.5 + 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}`.replace("gl_VerID", "gl_VertexID");

  const fragmentSource = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;

uniform vec2 uResolution;
uniform vec2 uOrbit;
uniform vec2 uPan;
uniform float uTime;
uniform float uDistance;
uniform vec4 uShapeParams;
uniform float uExposure;
uniform float uZoom;
uniform int uIterations;
uniform int uPalette;
uniform int uMode;

const int MARCH_STEPS = 112;
const float BASE_EPSILON = 0.0008;
const float FAR_CLIP = 12.0;

mat2 rotate2d(float angle) {
  float s = sin(angle), c = cos(angle);
  return mat2(c, -s, s, c);
}

vec3 palette(float t) {
  if (uPalette == 1) {
    return 0.55 + 0.45 * cos(6.28318 * (vec3(0.66,0.38,0.18) * t + vec3(0.05,0.12,0.22)));
  }
  if (uPalette == 2) {
    return 0.52 + 0.48 * cos(6.28318 * (vec3(0.28,0.44,0.62) * t + vec3(0.48,0.08,0.16)));
  }
  return 0.53 + 0.47 * cos(6.28318 * (vec3(0.72,0.46,0.28) * t + vec3(0.58,0.18,0.08)));
}

float mandelbulbDE(vec3 p, out float trap) {
  vec3 z = p;
  float derivative = 1.0;
  float radius = 0.0;
  trap = 10.0;
  for (int i = 0; i < 32; i++) {
    if (i >= uIterations) break;
    radius = length(z);
    trap = min(trap, abs(length(z.xy) - 0.72) + 0.22 * abs(z.z));
    if (radius > 2.4) break;
    float safeRadius = max(radius, 0.00001);
    float theta = acos(clamp(z.z / safeRadius, -1.0, 1.0));
    float phi = atan(z.y, z.x);
    float poweredRadius = pow(safeRadius, uShapeParams.x);
    derivative = pow(safeRadius, uShapeParams.x - 1.0) * uShapeParams.x * derivative + 1.0;
    theta *= uShapeParams.x;
    phi *= uShapeParams.x;
    z = poweredRadius * vec3(sin(theta) * cos(phi), sin(phi) * sin(theta), cos(theta)) + p;
  }
  return 0.5 * log(max(radius, 0.00001)) * radius / derivative;
}

float mandelboxDE(vec3 p, out float trap) {
  vec3 z = p;
  float derivative = 1.0;
  float scale = uShapeParams.x;
  float innerRadius2 = uShapeParams.y * uShapeParams.y;
  trap = 10.0;
  for (int i = 0; i < 32; i++) {
    if (i >= uIterations) break;
    z = clamp(z, -1.0, 1.0) * 2.0 - z;
    float radius2 = dot(z, z);
    if (radius2 < innerRadius2) {
      float fold = 1.0 / max(innerRadius2, 0.0001);
      z *= fold;
      derivative *= fold;
    } else if (radius2 < 1.0) {
      z /= radius2;
      derivative /= radius2;
    }
    z = z * scale + p;
    derivative = derivative * abs(scale) + 1.0;
    trap = min(trap, abs(length(z) - 1.25));
  }
  return length(z) / abs(derivative) - 0.0015;
}

float boxSDF(vec3 p, vec3 bounds) {
  vec3 q = abs(p) - bounds;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float crossSDF(vec3 p) {
  p = abs(p);
  float dxy = max(p.x, p.y);
  float dyz = max(p.y, p.z);
  float dzx = max(p.z, p.x);
  return min(dxy, min(dyz, dzx)) - 1.0;
}

float mengerDE(vec3 p, out float trap) {
  float distance = boxSDF(p, vec3(1.0));
  float scale = 1.0;
  trap = min(abs(p.x), min(abs(p.y), abs(p.z)));
  for (int i = 0; i < 8; i++) {
    if (i * 4 >= uIterations && i > 0) break;
    float cellScale = uShapeParams.x;
    vec3 cell = mod(p * scale, 2.0) - 1.0;
    scale *= cellScale;
    vec3 repeated = 1.0 - cellScale * abs(cell);
    distance = max(distance, crossSDF(repeated) / scale);
    trap = min(trap, length(repeated) / scale);
  }
  return distance;
}

float sceneDE(vec3 p, out float trap) {
  p.yz *= rotate2d(-0.18);
  if (uMode == 1) return mandelboxDE(p * 0.82, trap) / 0.82;
  if (uMode == 2) return mengerDE(p, trap);
  return mandelbulbDE(p, trap);
}

float mapOnly(vec3 p) {
  float trap;
  return sceneDE(p, trap);
}

vec3 surfaceNormal(vec3 p) {
  float epsilon = max(0.0000005, 0.0015 / uZoom);
  vec2 e = vec2(epsilon, 0.0);
  return normalize(vec3(
    mapOnly(p + e.xyy) - mapOnly(p - e.xyy),
    mapOnly(p + e.yxy) - mapOnly(p - e.yxy),
    mapOnly(p + e.yyx) - mapOnly(p - e.yyx)
  ));
}

float ambientOcclusion(vec3 p, vec3 normal) {
  float occlusion = 0.0;
  float weight = 1.0;
  for (int i = 1; i <= 5; i++) {
    float height = 0.025 * float(i);
    occlusion += (height - mapOnly(p + normal * height)) * weight;
    weight *= 0.62;
  }
  return clamp(1.0 - occlusion * 3.4, 0.0, 1.0);
}

vec2 complexSquare(vec2 z) {
  return vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y);
}

vec2 complexPower(vec2 z, float power) {
  float radius = max(length(z), 0.0000000001);
  float angle = atan(z.y, z.x);
  float poweredRadius = pow(radius, power);
  return poweredRadius * vec2(cos(angle * power), sin(angle * power));
}

vec2 complexMultiply(vec2 a, vec2 b) {
  return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}

vec2 complexDivide(vec2 a, vec2 b) {
  float denominator = max(dot(b, b), 0.0000000001);
  return vec2(dot(a, b), a.y * b.x - a.x * b.y) / denominator;
}

vec3 escapeColor(float smoothIteration, float orbitTrap) {
  float bands = 0.5 + 0.5 * cos(smoothIteration * 0.42);
  vec3 color = palette(smoothIteration * 0.028 + orbitTrap * 0.08);
  color *= 0.38 + 0.9 * pow(bands, 1.6);
  color += palette(orbitTrap * 0.12 + 0.45) * exp(-orbitTrap * 4.0) * 0.35;
  return color;
}

vec3 renderEscapeSet(vec2 coordinate) {
  bool fixedConstant = uMode == 4 || uMode == 12;
  bool absoluteFold = uMode == 5 || uMode == 12;
  vec2 z = fixedConstant ? coordinate : vec2(0.0);
  vec2 constantValue = fixedConstant ? uShapeParams.yz : coordinate;
  float power = uShapeParams.x;
  float orbitTrap = 20.0;
  float radius2 = 0.0;
  int usedIterations = 0;
  int iterationLimit = 8 + uIterations * 8;
  bool escaped = false;

  for (int i = 0; i < 320; i++) {
    if (i >= iterationLimit) break;
    if (absoluteFold) z = abs(z);
    z = complexPower(z, power) + constantValue;
    radius2 = dot(z, z);
    orbitTrap = min(orbitTrap, abs(length(z) - 0.5) + 0.35 * abs(z.y));
    usedIterations = i;
    if (radius2 > 256.0) {
      escaped = true;
      break;
    }
  }

  if (!escaped) {
    return palette(orbitTrap * 0.1) * (0.015 + 0.12 * exp(-orbitTrap * 12.0));
  }
  float smoothIteration = float(usedIterations) + 1.0 - log(max(1.0, log(sqrt(radius2)))) / log(power);
  return escapeColor(smoothIteration, orbitTrap);
}

vec3 renderNewton(vec2 coordinate) {
  vec2 z = coordinate;
  float degree = uShapeParams.x;
  int usedIterations = 0;
  int iterationLimit = 6 + uIterations * 3;
  for (int i = 0; i < 128; i++) {
    if (i >= iterationLimit) break;
    vec2 numerator = complexPower(z, degree) - vec2(1.0, 0.0);
    vec2 denominator = complexPower(z, degree - 1.0) * degree;
    vec2 delta = complexDivide(numerator, denominator);
    z -= delta;
    usedIterations = i;
    if (dot(delta, delta) < 0.0000000001) break;
  }

  float tau = 6.28318530718;
  float rootNumber = mod(round(mod(atan(z.y, z.x) + tau, tau) * degree / tau), degree);
  float rootIndex = fract(rootNumber / degree + 0.08);
  float shade = 0.2 + 0.8 * exp(-float(usedIterations) * 0.055);
  float rings = 0.82 + 0.18 * cos(float(usedIterations) * 1.7);
  return palette(rootIndex) * shade * rings;
}

vec3 glassPalette(float t) {
  float w0 = 0.5 + 0.5 * cos(6.28318530718 * t);
  float w1 = 0.5 + 0.5 * cos(6.28318530718 * (t + 0.3333333));
  float w2 = 0.5 + 0.5 * cos(6.28318530718 * (t + 0.6666667));
  w0 = w0 * w0 * w0;
  w1 = w1 * w1 * w1;
  w2 = w2 * w2 * w2;
  vec3 colorA;
  vec3 colorB;
  vec3 colorC;
  if (uPalette == 1) {
    colorA = vec3(0.58, 0.34, 1.0);
    colorB = vec3(1.0, 0.28, 0.66);
    colorC = vec3(1.0, 0.68, 0.25);
  } else if (uPalette == 2) {
    colorA = vec3(0.15, 1.0, 0.58);
    colorB = vec3(0.18, 0.82, 1.0);
    colorC = vec3(0.92, 0.82, 0.25);
  } else {
    colorA = vec3(0.12, 0.88, 1.0);
    colorB = vec3(0.43, 0.42, 1.0);
    colorC = vec3(0.95, 0.22, 0.68);
  }
  return (colorA * w0 + colorB * w1 + colorC * w2) / max(0.001, w0 + w1 + w2);
}

vec3 calmGeometryColor(float brightness) {
  vec3 base = uPalette == 1 ? vec3(0.66, 0.58, 1.0) : (uPalette == 2 ? vec3(0.34, 1.0, 0.67) : vec3(0.32, 0.88, 1.0));
  return base * brightness;
}

vec3 renderSierpinskiCarpet(vec2 coordinate) {
  vec2 uv = coordinate * 0.5 + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec3(0.002, 0.006, 0.012);

  vec2 cell = uv;
  float divisions = uShapeParams.x;
  float center = floor(divisions * 0.5);
  float depth = 0.0;
  bool removed = false;
  for (int i = 0; i < 16; i++) {
    if (i >= 3 + uIterations / 2) break;
    cell *= divisions;
    vec2 digit = floor(cell);
    if (abs(digit.x - center) < 0.5 && abs(digit.y - center) < 0.5) {
      removed = true;
      depth = float(i);
      break;
    }
    cell = fract(cell);
    depth = float(i + 1);
  }

  float edgeDistance = min(min(cell.x, 1.0 - cell.x), min(cell.y, 1.0 - cell.y));
  float line = exp(-95.0 * max(0.0, edgeDistance));
  if (removed) return calmGeometryColor(0.008 + line * 0.035);
  return calmGeometryColor(0.22 + depth * 0.025 + line * 0.78);
}

vec3 renderKaleidoscope(vec2 coordinate) {
  float wedge = 6.28318530718 / uShapeParams.x;
  float angle = abs(mod(atan(coordinate.y, coordinate.x) + wedge * 0.5, wedge) - wedge * 0.5);
  vec2 p = vec2(cos(angle), sin(angle)) * length(coordinate);
  float geometry = 0.0;
  float weight = 1.0;
  float scale = uShapeParams.y;

  for (int i = 0; i < 16; i++) {
    if (i >= 2 + uIterations / 2) break;
    vec2 q = p * scale;
    float horizontal = abs(fract(q.y * 1.7320508) - 0.5);
    float diagonalA = abs(fract(q.x + q.y) - 0.5);
    float diagonalB = abs(fract(q.x - q.y) - 0.5);
    float triangularLine = min(horizontal, min(diagonalA, diagonalB));
    geometry += exp(-105.0 * triangularLine) / weight;
    p = abs(p) - vec2(uShapeParams.z, uShapeParams.z * 0.581);
    scale *= 1.48;
    weight *= 1.7;
  }

  float facets = 0.5 + 0.5 * cos((angle / wedge) * 6.28318 + length(coordinate) * 7.0);
  vec3 background = calmGeometryColor(0.018 + facets * 0.018);
  vec3 lines = calmGeometryColor(0.18 + min(geometry, 1.25) * 0.82);
  return background + lines;
}
float periodicLine(float value, float sharpness) {
  return exp(-sharpness * abs(sin(3.14159265359 * value)));
}

vec3 renderInfiniteKaleidoscope(vec2 coordinate) {
  float radius = max(length(coordinate), 0.0000001);
  float logRadius = log(radius) / log(uShapeParams.y) - uShapeParams.w;
  float phase = fract(logRadius);
  float wedge = 6.28318530718 / uShapeParams.x;
  float angle = atan(coordinate.y, coordinate.x) + logRadius * uShapeParams.z;
  float mirrorAngle = abs(mod(angle + wedge * 0.5, wedge) - wedge * 0.5);
  float fold = mirrorAngle / (wedge * 0.5);

  float shardA = phase * 4.0 + fold * 1.5;
  float shardB = phase * 3.0 - fold * 2.5;
  float shardC = phase * 2.0 + fold * 4.0;
  float edgeDistance = min(abs(sin(3.14159265359 * shardA)),
                           min(abs(sin(3.14159265359 * shardB)),
                               abs(sin(3.14159265359 * shardC))));
  float lead = exp(-42.0 * edgeDistance);
  float hairline = exp(-115.0 * edgeDistance);

  float facetLight = 0.5 + 0.5 * sin(6.28318530718 * (phase * 1.7 + fold * 0.63));
  float shardId = floor(shardA) * 0.19 + floor(shardB) * 0.31 + floor(shardC) * 0.13;
  float glassShift = shardId + 0.17 * sin(6.28318530718 * (phase - fold));
  vec3 glass = glassPalette(glassShift);
  vec3 reflectedGlass = glassPalette(glassShift + 0.38 + facetLight * 0.14);
  vec3 pane = mix(glass, reflectedGlass, 0.28 + facetLight * 0.36);

  float mirrorSeam = exp(-48.0 * min(fold, 1.0 - fold));
  float jewel = pow(max(0.0, sin(6.28318530718 * phase) * cos(3.14159265359 * fold)), 10.0);
  vec3 color = pane * (0.09 + facetLight * 0.24);
  color += pane * jewel * 0.62;
  color += mix(pane, vec3(0.82, 0.95, 1.0), 0.68) * lead * 0.42;
  color += vec3(0.72, 0.94, 1.0) * (hairline * 0.42 + mirrorSeam * 0.14);
  return color;
}

vec3 renderInfinitePrism(vec2 coordinate) {
  float radius = max(length(coordinate), 0.0000001);
  float logRadius = log(radius) / log(uShapeParams.y) - uShapeParams.w;
  float angle = atan(coordinate.y, coordinate.x) + logRadius * uShapeParams.z;
  float wedge = 6.28318530718 / uShapeParams.x;
  float fold = abs(mod(angle + wedge * 0.5, wedge) - wedge * 0.5) / wedge;
  float a = logRadius + fold * 2.0;
  float b = logRadius - fold * 2.0;
  float lattice = periodicLine(a, 32.0) + periodicLine(b, 32.0);
  float crossbar = periodicLine(logRadius * 2.0 + fold, 38.0);
  float chamber = 0.5 + 0.5 * cos(6.28318530718 * logRadius) * cos(6.28318530718 * fold);
  return calmGeometryColor(0.012 + chamber * 0.032 + min(lattice + crossbar * 0.65, 1.8) * 0.64);
}

vec3 renderInfiniteSpiral(vec2 coordinate) {
  float radius = max(length(coordinate), 0.0000001);
  float logRadius = log(radius) / log(uShapeParams.y) - uShapeParams.w;
  float angle = atan(coordinate.y, coordinate.x) / 6.28318530718;
  float arms = uShapeParams.x;
  float spiral = uShapeParams.z;
  float clockwise = periodicLine(angle * arms + logRadius * spiral, 28.0);
  float counter = periodicLine(angle * arms - logRadius * (spiral * 0.62 + 0.38), 34.0);
  float beads = periodicLine(logRadius * 2.0 + sin(angle * 6.28318530718 * arms) * 0.18, 42.0);
  float cells = 0.5 + 0.5 * cos(6.28318530718 * (logRadius + angle * arms));
  float glow = clockwise + counter * 0.72 + beads * clockwise * 0.82;
  return calmGeometryColor(0.013 + cells * 0.028 + min(glow, 1.75) * 0.66);
}

vec3 renderPhyllotaxis(vec2 coordinate) {
  float spacing = 0.082;
  float radius = length(coordinate);
  float radialPower = uShapeParams.y;
  float estimate = pow(radius / spacing, 1.0 / radialPower);
  float nearest = 10.0;
  float seedIndex = 0.0;
  for (int i = 0; i < 11; i++) {
    float n = max(0.0, floor(estimate) + float(i - 5));
    float seedRadius = spacing * pow(n, radialPower);
    float seedAngle = n * radians(uShapeParams.x);
    vec2 seed = seedRadius * vec2(cos(seedAngle), sin(seedAngle));
    float distanceToSeed = distance(coordinate, seed);
    if (distanceToSeed < nearest) {
      nearest = distanceToSeed;
      seedIndex = n;
    }
  }
  float seedSize = 0.014 + 0.004 * sin(seedIndex * 0.17);
  float disc = smoothstep(seedSize * 1.7, seedSize, nearest);
  float halo = exp(-90.0 * nearest) * 0.35;
  vec3 background = calmGeometryColor(0.012 + 0.018 * exp(-radius * 1.3));
  return background + calmGeometryColor(disc * 0.78 + halo);
}

float truchetDistance(vec2 coordinate, float scale) {
  vec2 grid = coordinate * scale;
  vec2 cell = floor(grid);
  vec2 local = fract(grid) - 0.5;
  float orientation = fract(sin(dot(cell + uShapeParams.x, vec2(127.1, 311.7))) * 43758.5453);
  if (orientation < 0.5) local.x = -local.x;
  float arcA = abs(length(local - vec2(0.5, 0.5)) - 0.5);
  float arcB = abs(length(local + vec2(0.5, 0.5)) - 0.5);
  return min(arcA, arcB) / scale;
}

vec3 renderTruchet(vec2 coordinate) {
  float coarse = truchetDistance(coordinate, 2.4);
  float fine = truchetDistance(coordinate + vec2(0.17, -0.11), 2.4 * uShapeParams.y);
  float broadLine = exp(-120.0 * coarse);
  float fineLine = exp(-260.0 * fine) * 0.42;
  float tileTone = 0.5 + 0.5 * cos((coordinate.x - coordinate.y) * 2.2);
  return calmGeometryColor(0.018 + tileTone * 0.025 + broadLine * 0.72 + fineLine);
}

vec3 renderHarmonicField(vec2 coordinate) {
  float waveA = sin(coordinate.x * 3.1 + sin(coordinate.y * 1.7) * uShapeParams.x);
  float waveB = sin(coordinate.y * 4.2 - sin(coordinate.x * 2.3) * uShapeParams.x * 0.85);
  float waveC = sin((coordinate.x + coordinate.y) * 2.05);
  float field = waveA + waveB * uShapeParams.y + waveC * 0.5;
  float contourA = exp(-32.0 * abs(field - 0.42));
  float contourB = exp(-32.0 * abs(field + 0.42));
  float nodes = exp(-16.0 * abs(waveA * waveB));
  vec3 quiet = calmGeometryColor(0.018 + 0.028 * (0.5 + 0.5 * field / max(1.5, 1.5 + uShapeParams.y)));
  return quiet + calmGeometryColor((contourA + contourB) * 0.58 + nodes * 0.12);
}

vec3 renderPlane(vec2 screenPoint) {
  float planeScale = 1.72;
  if (uMode == 6) planeScale = 1.42;
  else if (uMode == 7) planeScale = 1.15;
  else if (uMode == 8) planeScale = 1.75;
  else if (uMode == 9) planeScale = 1.55;
  else if (uMode == 10) planeScale = 1.35;
  else if (uMode == 11) planeScale = 1.65;
  else if (uMode >= 13) planeScale = 1.75;
  vec2 coordinate = uPan + screenPoint * (planeScale / uZoom);
  vec3 color;
  if (uMode == 6) color = renderNewton(coordinate);
  else if (uMode == 7) color = renderSierpinskiCarpet(coordinate);
  else if (uMode == 8) color = renderKaleidoscope(coordinate);
  else if (uMode == 9) color = renderPhyllotaxis(coordinate);
  else if (uMode == 10) color = renderTruchet(coordinate);
  else if (uMode == 11) color = renderHarmonicField(coordinate);
  else if (uMode == 13) color = renderInfiniteKaleidoscope(coordinate);
  else if (uMode == 14) color = renderInfinitePrism(coordinate);
  else if (uMode == 15) color = renderInfiniteSpiral(coordinate);
  else color = renderEscapeSet(coordinate);
  float gridGlow = (uMode <= 6 || uMode == 12) ? exp(-70.0 * min(abs(coordinate.x), abs(coordinate.y))) / max(1.0, uZoom * 0.04) : 0.0;
  return color + vec3(0.08, 0.22, 0.27) * gridGlow;
}
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  vec2 screenPoint = (gl_FragCoord.xy * 2.0 - uResolution) / min(uResolution.x, uResolution.y);

  if (uMode >= 3) {
    vec3 planeColor = renderPlane(screenPoint) * uExposure;
    planeColor *= 1.0 - 0.2 * dot(vUv - 0.5, vUv - 0.5);
    planeColor = pow(1.0 - exp(-planeColor * 1.35), vec3(0.82));
    planeColor += (hash21(gl_FragCoord.xy + uTime) - 0.5) / 255.0;
    outColor = vec4(planeColor, 1.0);
    return;
  }

  vec3 rayOrigin = vec3(0.0, 0.0, uDistance);
  rayOrigin.yz *= rotate2d(uOrbit.y);
  rayOrigin.xz *= rotate2d(uOrbit.x);
  vec3 forward = normalize(-rayOrigin);
  vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(right, forward);
  vec3 rayDirection = normalize(forward * (1.72 * uZoom) + right * screenPoint.x + up * screenPoint.y);

  float totalDistance = 0.0;
  float trap = 1.0;
  float localTrap = 1.0;
  float nearestStep = 10.0;
  bool hit = false;
  vec3 point = rayOrigin;
  float hitEpsilon = max(0.00000035, BASE_EPSILON / uZoom);

  for (int i = 0; i < MARCH_STEPS; i++) {
    point = rayOrigin + rayDirection * totalDistance;
    float distanceToScene = sceneDE(point, localTrap);
    trap = min(trap, localTrap);
    nearestStep = min(nearestStep, abs(distanceToScene));
    if (distanceToScene < hitEpsilon * (1.0 + totalDistance * 0.18)) {
      hit = true;
      break;
    }
    totalDistance += distanceToScene * 0.72;
    if (totalDistance > FAR_CLIP) break;
  }

  vec3 color = vec3(0.003, 0.008, 0.015);
  color += vec3(0.005, 0.018, 0.028) * pow(max(0.0, 1.0 - abs(rayDirection.y)), 2.0);
  float star = step(0.9976, hash21(floor(gl_FragCoord.xy * 0.72))) * (0.25 + 0.75 * hash21(gl_FragCoord.xy));
  color += star * vec3(0.45, 0.72, 0.82);

  if (hit) {
    vec3 normal = surfaceNormal(point);
    vec3 lightDirection = normalize(vec3(-0.5, 0.72, 0.65));
    float diffuse = max(dot(normal, lightDirection), 0.0);
    float rim = pow(1.0 - max(dot(normal, -rayDirection), 0.0), 2.7);
    float specular = pow(max(dot(reflect(-lightDirection, normal), -rayDirection), 0.0), 42.0);
    float occlusion = ambientOcclusion(point, normal);
    vec3 base = palette(trap * 1.9 + 0.05 * length(point));
    color = base * (0.12 + 1.18 * diffuse) * occlusion;
    color += palette(trap + 0.3) * rim * 1.25;
    color += specular * vec3(1.0, 0.88, 0.68) * 1.5;
  } else {
    color += palette(trap * 1.4) * exp(-85.0 * nearestStep) * 0.13;
  }

  color *= (1.0 - 0.2 * dot(vUv - 0.5, vUv - 0.5)) * uExposure;
  color = pow(1.0 - exp(-color * 1.24), vec3(0.82));
  color += (hash21(gl_FragCoord.xy + uTime) - 0.5) / 255.0;
  outColor = vec4(color, 1.0);
}`;

  function compileShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) || "Shader compilation failed");
    }
    return shader;
  }

  let program;
  try {
    program = gl.createProgram();
    gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || "Shader linking failed");
    }
  } catch (error) {
    console.error(error);
    $("#error").hidden = false;
    $("#status").textContent = "SHADER ERROR";
    return;
  }

  gl.useProgram(program);
  gl.bindVertexArray(gl.createVertexArray());

  const uniforms = {};
  [
    "uResolution", "uOrbit", "uPan", "uTime", "uDistance", "uShapeParams",
    "uExposure", "uZoom", "uIterations", "uPalette", "uMode"
  ].forEach(name => {
    uniforms[name] = gl.getUniformLocation(program, name);
  });

  const modes = [
    { title: "MANDELBULB", subtitle: "/ DEEP FIELD", dimension: "3D", distance: 3.08, orbit: [-0.48, 0.12], pan: [0, 0], formula: "", explanation: "複素数の累乗を3次元の球面座標へ拡張したもの。各点を反復し、無限へ逃げる速さから表面までの距離を推定します。", note: "POWERを変えると突起の本数と全体の輪郭が変化します。", parameters: [
      { key: "power", label: "POWER", description: "球面累乗", min: 2, max: 16, step: 0.1, value: 8, digits: 1 }
    ] },
    { title: "MANDELBOX", subtitle: "/ FOLDED SPACE", dimension: "3D", distance: 8.2, orbit: [-0.62, 0.22], pan: [0, 0], formula: "", explanation: "座標を箱の内側へ折り返し、球で反転してから拡大する操作を反復します。丸い有機物ではなく『折り紙の空間』に近い構造です。", note: "SCALEとINNER FOLDで反転の強さと空洞の密度が変わります。", parameters: [
      { key: "scale", label: "SCALE", description: "折り返し後の倍率", min: -2.5, max: -1.1, step: 0.01, value: -1.77, digits: 2 },
      { key: "innerRadius", label: "INNER FOLD", description: "球面反転の内半径", min: 0.2, max: 0.9, step: 0.01, value: 0.5, digits: 2 }
    ] },
    { title: "MENGER SPONGE", subtitle: "/ VOID CUBE", dimension: "3D", distance: 4.15, orbit: [-0.58, 0.34], pan: [0, 0], formula: "", explanation: "立方体へ中央を貫く空洞を反復的に刻む、建築模型のような幾何学フラクタルです。", note: "CELL SCALEを3から外すと、古典的Menger spongeから崩れた別の空洞構造になります。", parameters: [
      { key: "cellScale", label: "CELL SCALE", description: "反復セルの倍率", min: 2.2, max: 4.2, step: 0.05, value: 3, digits: 2 }
    ] },
    { title: "MANDELBROT", subtitle: "/ CLASSIC SET", dimension: "2D", orbit: [0, 0], pan: [-0.52, 0], formula: "", explanation: "画面上の点 c ごとに反復し、値が発散しない点を集合にします。指数を変えると花弁状の対称性が変わります。", note: "cは画面座標なので、位置はドラッグ、スケールはズームで操作します。", parameters: [
      { key: "exponent", label: "EXPONENT", description: "複素累乗の次数", min: 2, max: 8, step: 1, value: 2, digits: 0 }
    ] },
    { title: "JULIA SET", subtitle: "/ ORBIT SLICE", dimension: "2D", orbit: [0, 0], pan: [0, 0], formula: "", explanation: "開始点 z₀ を画面上で変え、cを固定します。指数と固定するcの両方で模様が大きく変わります。", note: "cの実部・虚部を動かすと、連結した島から粉状の集合まで遷移します。", parameters: [
      { key: "exponent", label: "EXPONENT", description: "複素累乗の次数", min: 2, max: 8, step: 1, value: 2, digits: 0 },
      { key: "cReal", label: "C · REAL", description: "固定するcの実部", min: -1.5, max: 1.5, step: 0.00001, value: -0.74543, digits: 5, signed: true },
      { key: "cImag", label: "C · IMAGINARY", description: "固定するcの虚部", min: -1.5, max: 1.5, step: 0.00001, value: 0.11301, digits: 5, signed: true }
    ] },
    { title: "BURNING SHIP", subtitle: "/ ABSOLUTE SET", dimension: "2D", orbit: [0, 0], pan: [-0.45, -0.5], formula: "", explanation: "反復前に実部と虚部を絶対値へ折り返します。指数を変えると炎や船の尖り方と対称性が変化します。", note: "このcは画面座標です。固定c版はBURNING JULIAとして別標本にしています。", parameters: [
      { key: "exponent", label: "EXPONENT", description: "折り返し後の累乗", min: 2, max: 8, step: 1, value: 2, digits: 0 }
    ] },
    { title: "NEWTON FRACTAL", subtitle: "/ ROOT BASINS", dimension: "2D", orbit: [0, 0], pan: [0, 0], formula: "", explanation: "方程式 zⁿ = 1 をNewton法で解き、各開始点がどの解へ収束するかを色分けします。", note: "DEGREEが解の個数になり、収束領域の枝数も一緒に変わります。", parameters: [
      { key: "degree", label: "DEGREE", description: "方程式の次数", min: 2, max: 8, step: 1, value: 3, digits: 0 }
    ] },
    { title: "SIERPINSKI CARPET", subtitle: "/ CLEAN GRID", dimension: "2D", orbit: [0, 0], pan: [0, 0], formula: "", explanation: "正方形を奇数個の格子へ分けて中央を除き、残った領域へ同じ操作を繰り返します。", note: "DIVISIONSを3・5・7・9へ変えると、穴の密度と自己相似の周期が変わります。", parameters: [
      { key: "divisions", label: "DIVISIONS", description: "一辺の分割数", min: 3, max: 9, step: 2, value: 3, digits: 0 }
    ] },
    { title: "KALEIDOSCOPE", subtitle: "/ MIRROR TILES", dimension: "2D", orbit: [0, 0], pan: [0, 0], formula: "", explanation: "角度を鏡へ折り畳み、その中で反射・移動・拡大を反復する対称フィールドです。", note: "鏡の枚数・反復倍率・折り返し位置をそれぞれ変更できます。", parameters: [
      { key: "mirrors", label: "MIRRORS", description: "放射対称の枚数", min: 3, max: 24, step: 1, value: 12, digits: 0 },
      { key: "foldScale", label: "FOLD SCALE", description: "反復ごとの倍率", min: 1.1, max: 2.2, step: 0.01, value: 1.65, digits: 2 },
      { key: "offset", label: "OFFSET", description: "鏡像の折り返し位置", min: 0.1, max: 0.65, step: 0.005, value: 0.37, digits: 3 }
    ] },
    { title: "PHYLLOTAXIS", subtitle: "/ GOLDEN SEEDS", dimension: "2D", orbit: [0, 0], pan: [0, 0], formula: "", explanation: "一定角度で回りながら半径をnの累乗に比例させて種を置く、植物に見られる充填パターンです。", note: "黄金角137.51°から少し外すだけでも、別の螺旋列が急に現れます。", parameters: [
      { key: "angle", label: "DIVERGENCE", description: "種ごとの回転角", min: 120, max: 160, step: 0.01, value: 137.50776, digits: 2, suffix: "°" },
      { key: "radialPower", label: "RADIAL POWER", description: "半径 r ∝ nᵖ", min: 0.35, max: 0.75, step: 0.005, value: 0.5, digits: 3 }
    ] },
    { title: "TRUCHET TILES", subtitle: "/ QUIET MAZE", dimension: "2D", orbit: [0, 0], pan: [0, 0], formula: "", explanation: "各マスの向きを擬似乱数で決め、隣接する円弧をつないで迷路を作ります。", note: "SEEDで経路そのもの、LAYER RATIOで細い迷路の重なり方が変わります。", parameters: [
      { key: "seed", label: "SEED", description: "タイル配置の種", min: 0, max: 100, step: 0.1, value: 0, digits: 1 },
      { key: "layerRatio", label: "LAYER RATIO", description: "細密層との倍率比", min: 2, max: 5, step: 0.05, value: 3, digits: 2 }
    ] },
    { title: "HARMONIC FIELD", subtitle: "/ WAVE NODES", dimension: "2D", orbit: [0, 0], pan: [0, 0], formula: "", explanation: "方向と周期の違う正弦波を重ね、同じ値になる等高線を光らせています。", note: "WARPは波の曲がり、CROSS MIXは交差する波の寄与を変えます。", parameters: [
      { key: "warp", label: "WARP", description: "波面の曲がり", min: 0, max: 1.5, step: 0.01, value: 0.65, digits: 2 },
      { key: "crossMix", label: "CROSS MIX", description: "交差波の混合率", min: 0, max: 1.5, step: 0.01, value: 0.82, digits: 2 }
    ] },
    { title: "BURNING JULIA", subtitle: "/ FIXED FLAME", dimension: "2D", orbit: [0, 0], pan: [0, 0], formula: "", explanation: "Burning Shipの絶対値折り返しを使いながら、cを固定して開始点 z₀ を画面上で変えるJulia型の集合です。", note: "固定cを動かすと、羽根・炎・結晶のような構造へ大きく変形します。", parameters: [
      { key: "exponent", label: "EXPONENT", description: "折り返し後の累乗", min: 2, max: 8, step: 1, value: 2, digits: 0 },
      { key: "cReal", label: "C · REAL", description: "固定するcの実部", min: -1.5, max: 1.5, step: 0.00001, value: -0.4, digits: 5, signed: true },
      { key: "cImag", label: "C · IMAGINARY", description: "固定するcの虚部", min: -1.5, max: 1.5, step: 0.00001, value: -0.59, digits: 5, signed: true }
    ] },
    { title: "INFINITE KALEIDOSCOPE", subtitle: "/ STAINED MIRRORS", dimension: "2D", orbit: [0, 0], pan: [0, 0], formula: "", explanation: "対数半径で繰り返す色ガラスの断片を、中心から伸びる鏡の扇形へ折り返します。拡大しても新しい破片が現れ続ける無限ズーム万華鏡です。", note: "MIRRORSで鏡の枚数、ZOOM PERIODでガラス模様の反復倍率、TWISTで階層ごとの回転を変えられます。", parameters: [
      { key: "mirrors", label: "MIRRORS", description: "放射対称の枚数", min: 4, max: 32, step: 1, value: 12, digits: 0 },
      { key: "zoomPeriod", label: "ZOOM PERIOD", description: "ガラス模様が戻る倍率", min: 1.35, max: 5, step: 0.05, value: 2.6, digits: 2, suffix: "×" },
      { key: "twist", label: "TWIST", description: "階層ごとの回転", min: -3, max: 3, step: 0.05, value: 0.05, digits: 2, signed: true }
    ] },
    { title: "INFINITE CRYSTAL", subtitle: "/ PRISM TUNNEL", dimension: "2D", orbit: [0, 0], pan: [0, 0], formula: "", explanation: "対数半径と鏡映角を斜めに交差させ、拡大しても終わらない結晶格子を作ります。線の交点が次々に奥へ続く回廊になります。", note: "SIDESで結晶の面数、ZOOM PERIODで階層間隔、SHEARで回廊の傾きを調整できます。", parameters: [
      { key: "sides", label: "SIDES", description: "結晶の面数", min: 3, max: 24, step: 1, value: 8, digits: 0 },
      { key: "zoomPeriod", label: "ZOOM PERIOD", description: "格子が戻る倍率", min: 1.35, max: 5, step: 0.05, value: 2.35, digits: 2, suffix: "×" },
      { key: "shear", label: "SHEAR", description: "階層のねじれ", min: -2.5, max: 2.5, step: 0.05, value: 0.35, digits: 2, signed: true }
    ] },
    { title: "INFINITE SPIRAL", subtitle: "/ ENDLESS CHAMBER", dimension: "2D", orbit: [0, 0], pan: [0, 0], formula: "", explanation: "角度と対数半径を結び、逆向きの螺旋を重ねたスケール周期パターンです。ズームすると螺旋が回転しながら同じ構造へ戻ります。", note: "ARMSで腕の本数、ZOOM PERIODで反復倍率、SPIRALで巻きの強さを変えられます。", parameters: [
      { key: "arms", label: "ARMS", description: "螺旋の本数", min: 3, max: 24, step: 1, value: 10, digits: 0 },
      { key: "zoomPeriod", label: "ZOOM PERIOD", description: "模様が戻る倍率", min: 1.35, max: 5, step: 0.05, value: 2, digits: 2, suffix: "×" },
      { key: "spiral", label: "SPIRAL", description: "巻きの強さ", min: 0.25, max: 3, step: 0.05, value: 1.15, digits: 2 }
    ] }
  ];

  const parameterValues = modes.map(mode => Object.fromEntries(mode.parameters.map(parameter => [parameter.key, parameter.value])));
  const DEFAULT_MODE = 13;
  const defaultMode = modes[DEFAULT_MODE];

  const state = {
    mode: DEFAULT_MODE,
    orbitX: defaultMode.orbit[0],
    orbitY: defaultMode.orbit[1],
    targetOrbitX: defaultMode.orbit[0],
    targetOrbitY: defaultMode.orbit[1],
    panX: defaultMode.pan[0],
    panY: defaultMode.pan[1],
    distance: defaultMode.distance,
    zoom: 1,
    logZoom: 0,
    targetLogZoom: 0,
    iterations: 12,
    exposure: 1,
    palette: 0,
    quality: 0.78,
    speed: 0.36,
    motion: true,
    touched: false
  };

  const pointers = new Map();
  let pinchDistance = 0;
  let lastFrame = performance.now();
  let frameCount = 0;
  let fpsStartedAt = lastFrame;
  let resizePending = true;
  let activeGpuQuery = null;
  let pendingGpuQuery = null;
  let gpuTimeMs = null;
  let refreshRateEstimate = 60;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const damp = (from, to, factor, delta) => from + (to - from) * (1 - Math.exp(-factor * delta));

  function setMotion(active) {
    state.motion = active;
    $("#motion").textContent = active ? "Ⅱ" : "▶";
    const action = state.mode >= 13 ? "自動ズーム" : "自動回転";
    $("#motion").ariaLabel = active ? action + "を一時停止" : action + "を再開";
  }

  function formatParameter(parameter, value) {
    const absolute = Math.abs(value).toFixed(parameter.digits);
    const number = parameter.signed ? (value >= 0 ? "+" : "−") + absolute : value.toFixed(parameter.digits);
    return number + (parameter.suffix || "");
  }

  function complexText(real, imaginary) {
    const realText = real < 0 ? "−" + Math.abs(real).toFixed(5) : real.toFixed(5);
    const sign = imaginary >= 0 ? "+" : "−";
    return realText + " " + sign + " " + Math.abs(imaginary).toFixed(5) + "i";
  }

  function formatModeFormula() {
    const values = parameterValues[state.mode];
    switch (state.mode) {
      case 0: return "zₙ₊₁ = sphericalPower(zₙ, " + values.power.toFixed(1) + ") + c\nDE ≈ ½ · ln(r) · r / dr";
      case 1: return "z′ = sphereFold(boxFold(z), r=" + values.innerRadius.toFixed(2) + ")\nzₙ₊₁ = " + values.scale.toFixed(2) + " · z′ + c";
      case 2: return "Cₙ₊₁ = scale(" + values.cellScale.toFixed(2) + " · Cₙ) − center crosses";
      case 3: return "z₀ = 0\nzₙ₊₁ = zₙ^" + values.exponent.toFixed(0) + " + c";
      case 4: return "z₀ = pixel\nzₙ₊₁ = zₙ^" + values.exponent.toFixed(0) + " + (" + complexText(values.cReal, values.cImag) + ")";
      case 5: return "z₀ = 0\nzₙ₊₁ = (|Re zₙ| + i|Im zₙ|)^" + values.exponent.toFixed(0) + " + c";
      case 6: return "zₙ₊₁ = zₙ − (zₙ^" + values.degree.toFixed(0) + " − 1) / (" + values.degree.toFixed(0) + "zₙ^" + (values.degree - 1).toFixed(0) + ")";
      case 7: return "base" + values.divisions.toFixed(0) + "(xₖ) = base" + values.divisions.toFixed(0) + "(yₖ) = center\n→ remove that square";
      case 8: return "α = 2π / " + values.mirrors.toFixed(0) + "\nθ′ = |mod(θ + α/2, α) − α/2|\npₙ₊₁ = " + values.foldScale.toFixed(2) + " · (|pₙ| − " + values.offset.toFixed(3) + ")";
      case 9: return "θₙ = n · " + values.angle.toFixed(2) + "°\nrₙ = c · n^" + values.radialPower.toFixed(3);
      case 10: return "tile(x,y, seed=" + values.seed.toFixed(1) + ") ∈ {↗, ↘}\nfine scale = coarse × " + values.layerRatio.toFixed(2);
      case 11: return "F(x,y) = sin(ax + " + values.warp.toFixed(2) + " sin(by))\n        + " + values.crossMix.toFixed(2) + " sin(cy − 0.85k sin(dx))";
      case 12: return "z₀ = pixel\nzₙ₊₁ = (|Re zₙ| + i|Im zₙ|)^" + values.exponent.toFixed(0) + "\n        + (" + complexText(values.cReal, values.cImag) + ")";
      case 13: return "ρ = log(r) / log(" + values.zoomPeriod.toFixed(2) + ")\nφ = fract(ρ),  θ′ = θ + " + values.twist.toFixed(2) + "ρ\nK(" + values.zoomPeriod.toFixed(2) + "r, θ) = K(r, θ + " + values.twist.toFixed(2) + ")";
      case 14: return "ρ = log(r) / log(" + values.zoomPeriod.toFixed(2) + ")\nα = fold(θ + " + values.shear.toFixed(2) + "ρ, 2π / " + values.sides.toFixed(0) + ")\nL = lines(ρ + 2α, ρ − 2α)";
      case 15: return "ρ = log(r) / log(" + values.zoomPeriod.toFixed(2) + ")\nS± = " + values.arms.toFixed(0) + "θ ± " + values.spiral.toFixed(2) + "ρ\nK(r, θ) = lines(S+, S−)";
      default: return "";
    }
  }

  function updateModeFormula() {
    $("#formula").textContent = formatModeFormula();
  }

  function renderModeParameters() {
    const group = $("#modeParameters");
    const mode = modes[state.mode];
    const values = parameterValues[state.mode];
    group.replaceChildren();

    mode.parameters.forEach((parameter, index) => {
      const label = document.createElement("label");
      label.className = "modeParameter";
      const caption = document.createElement("span");
      const name = document.createElement("b");
      const description = document.createElement("small");
      const output = document.createElement("output");
      const input = document.createElement("input");

      name.textContent = parameter.label;
      description.textContent = parameter.description;
      caption.append(name, description);
      output.textContent = formatParameter(parameter, values[parameter.key]);
      input.type = "range";
      input.min = parameter.min;
      input.max = parameter.max;
      input.step = parameter.step;
      input.value = values[parameter.key];
      input.id = "modeParameter" + index;
      input.addEventListener("input", () => {
        values[parameter.key] = Number(input.value);
        output.textContent = formatParameter(parameter, values[parameter.key]);
        updateModeFormula();
        updateReadouts();
      });
      label.append(caption, output, input);
      group.append(label);
    });
  }

  function setMode(index) {
    const mode = modes[index];
    state.mode = index;
    state.distance = mode.distance || 3.08;
    state.targetOrbitX = mode.orbit[0];
    state.targetOrbitY = mode.orbit[1];
    state.panX = mode.pan[0];
    state.panY = mode.pan[1];
    state.targetLogZoom = 0;
    state.logZoom = 0;
    state.zoom = 1;
    setMotion(mode.dimension === "3D" || index >= 13);

    $("#fractalTitle").textContent = mode.title;
    $("#fractalSubtitle").textContent = mode.subtitle;
    $("#axisLabel").textContent = mode.dimension === "3D" ? "ORBIT" : "PAN";
    $("#theoryTitle").textContent = mode.title;
    $("#theoryText").textContent = mode.explanation;
    $("#theoryNote").textContent = mode.note;
    renderModeParameters();
    updateModeFormula();
    document.querySelectorAll("[data-mode]").forEach(button => {
      const active = Number(button.dataset.mode) === index;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    updateReadouts();
  }

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.floor(canvas.clientWidth * dpr * state.quality));
    const height = Math.max(1, Math.floor(canvas.clientHeight * dpr * state.quality));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
    resizePending = false;
  }

  function formatZoom() {
    if (state.zoom > 0 && state.zoom < 0.0001) {
      const scientific = state.zoom.toExponential(2).replace("e+", "e");
      return { compact: "×" + scientific, rich: "×" + scientific };
    }
    if (state.zoom < 1000) {
      const digits = state.zoom < 0.01 ? 4 : state.zoom < 0.1 ? 3 : state.zoom < 10 ? 2 : state.zoom < 100 ? 1 : 0;
      const plain = state.zoom.toFixed(digits);
      return { compact: "×" + plain, rich: "×" + plain };
    }
    if (state.zoom >= 1e15) {
      const scientific = state.zoom.toExponential(2).replace("e+", "e");
      return { compact: "×" + scientific, rich: "×" + scientific };
    }
    const grouped = Math.round(state.zoom).toLocaleString("en-US");
    return { compact: "×" + grouped, rich: "×" + grouped };
  }
  function updateReadouts() {
    const zoomText = formatZoom();
    $("#distOut").textContent = zoomText.compact;
    $("#zoomBadge").innerHTML = zoomText.rich;
    const primaryParameter = modes[state.mode].parameters[0];
    $("#shapeLabel").textContent = primaryParameter.label;
    $("#powerOut").textContent = formatParameter(primaryParameter, parameterValues[state.mode][primaryParameter.key]);

    if (state.mode < 3) {
      const xPrefix = state.orbitX >= 0 ? "+" : "";
      const yPrefix = state.orbitY >= 0 ? "+" : "";
      $("#orbitOut").textContent = xPrefix + (state.orbitX * 57.3).toFixed(1) + " / " + yPrefix + (state.orbitY * 57.3).toFixed(1);
    } else {
      $("#orbitOut").textContent = state.panX.toFixed(4) + " / " + state.panY.toFixed(4);
    }
  }

  function pollGpuTimer() {
    if (!gpuTimerExtension || !pendingGpuQuery) return;
    const available = gl.getQueryParameter(pendingGpuQuery, gl.QUERY_RESULT_AVAILABLE);
    const disjoint = gl.getParameter(gpuTimerExtension.GPU_DISJOINT_EXT);
    if (disjoint) {
      gl.deleteQuery(pendingGpuQuery);
      pendingGpuQuery = null;
      gpuTimeMs = null;
      return;
    }
    if (!available) return;
    const sampleMs = gl.getQueryParameter(pendingGpuQuery, gl.QUERY_RESULT) / 1000000;
    gpuTimeMs = gpuTimeMs === null ? sampleMs : gpuTimeMs * 0.82 + sampleMs * 0.18;
    gl.deleteQuery(pendingGpuQuery);
    pendingGpuQuery = null;
  }

  function beginGpuTimer() {
    if (!gpuTimerExtension || pendingGpuQuery || activeGpuQuery) return;
    activeGpuQuery = gl.createQuery();
    gl.beginQuery(gpuTimerExtension.TIME_ELAPSED_EXT, activeGpuQuery);
  }

  function endGpuTimer() {
    if (!activeGpuQuery) return;
    gl.endQuery(gpuTimerExtension.TIME_ELAPSED_EXT);
    pendingGpuQuery = activeGpuQuery;
    activeGpuQuery = null;
  }

  function updatePerformanceReadout(fps) {
    const commonRates = [60, 75, 90, 120, 144, 165, 240];
    if (fps >= 50) {
      const nearest = commonRates.reduce((best, rate) => Math.abs(rate - fps) < Math.abs(best - fps) ? rate : best);
      if (Math.abs(nearest - fps) / nearest < 0.14) refreshRateEstimate = nearest;
    }
    const budgetMs = 1000 / refreshRateEstimate;
    $("#fps").textContent = fps + " FPS";
    if (!gpuTimerExtension) {
      $("#gpu").textContent = "GPU N/A / " + budgetMs.toFixed(1) + " ms";
      $("#headroom").textContent = "HEADROOM N/A";
      return;
    }
    if (gpuTimeMs === null) {
      $("#gpu").textContent = "GPU -- ms / " + budgetMs.toFixed(1) + " ms";
      $("#headroom").textContent = "HEADROOM --%";
      return;
    }
    const headroom = Math.round(clamp((1 - gpuTimeMs / budgetMs) * 100, 0, 99));
    $("#gpu").textContent = "GPU " + gpuTimeMs.toFixed(1) + " ms / " + budgetMs.toFixed(1) + " ms";
    $("#headroom").textContent = "HEADROOM " + headroom + "%";
  }
  function render(now) {
    const delta = Math.min(0.05, Math.max(0.001, (now - lastFrame) / 1000));
    lastFrame = now;
    if (resizePending) resize();

    if (state.motion && state.mode < 3) {
      state.targetOrbitX += state.speed * delta * 0.18;
    } else if (state.motion && state.mode >= 13) {
      state.targetLogZoom += state.speed * delta * 0.7;
    }
    state.orbitX = damp(state.orbitX, state.targetOrbitX, 9.5, delta);
    state.orbitY = damp(state.orbitY, state.targetOrbitY, 9.5, delta);
    state.logZoom = damp(state.logZoom, state.targetLogZoom, 10, delta);
    state.zoom = Math.exp(state.logZoom);

    gl.uniform2f(uniforms.uResolution, canvas.width, canvas.height);
    gl.uniform2f(uniforms.uOrbit, state.orbitX, state.orbitY);
    gl.uniform2f(uniforms.uPan, state.panX, state.panY);
    gl.uniform1f(uniforms.uTime, now / 1000);
    gl.uniform1f(uniforms.uDistance, state.distance);
    const shapeValues = modes[state.mode].parameters.map(parameter => parameterValues[state.mode][parameter.key]);
    let shaderZoom = state.zoom;
    let zoomCycle = shapeValues[3] || 0;
    if (state.mode >= 13) {
      const periodLog = Math.log(shapeValues[1]);
      zoomCycle = Math.floor(state.logZoom / periodLog);
      shaderZoom = Math.exp(state.logZoom - zoomCycle * periodLog);
    }
    gl.uniform4f(uniforms.uShapeParams, shapeValues[0] || 0, shapeValues[1] || 0, shapeValues[2] || 0, zoomCycle);
    gl.uniform1f(uniforms.uExposure, state.exposure);
    gl.uniform1f(uniforms.uZoom, shaderZoom);
    gl.uniform1i(uniforms.uIterations, state.iterations);
    gl.uniform1i(uniforms.uPalette, state.palette);
    gl.uniform1i(uniforms.uMode, state.mode);
    pollGpuTimer();
    beginGpuTimer();
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    endGpuTimer();

    frameCount++;
    if (now - fpsStartedAt > 750) {
      const fps = Math.round(frameCount * 1000 / (now - fpsStartedAt));
      updatePerformanceReadout(fps);
      $("#status").textContent = fps < 18 ? "HEAVY FIELD" : "LIVE RENDER";
      frameCount = 0;
      fpsStartedAt = now;
      updateReadouts();
    }
    requestAnimationFrame(render);
  }

  function acknowledgeTouch() {
    if (!state.touched) {
      state.touched = true;
      $("#hint").classList.add("hidden");
    }
  }

  function zoomBy(delta) {
    state.targetLogZoom += delta;
    if (state.targetLogZoom > 0.2) setMotion(false);
  }

  canvas.addEventListener("pointerdown", event => {
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    pinchDistance = 0;
    acknowledgeTouch();
  });

  canvas.addEventListener("pointermove", event => {
    const previous = pointers.get(event.pointerId);
    if (!previous) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const activePointers = [...pointers.values()];

    if (activePointers.length === 1) {
      const deltaX = event.clientX - previous.x;
      const deltaY = event.clientY - previous.y;
      if (state.mode < 3) {
        const sensitivity = 0.006 / Math.sqrt(state.zoom);
        state.targetOrbitX += deltaX * sensitivity;
        state.targetOrbitY = clamp(state.targetOrbitY + deltaY * sensitivity, -1.35, 1.35);
      } else {
        const scale = 3.44 / (Math.min(canvas.clientWidth, canvas.clientHeight) * state.zoom);
        state.panX -= deltaX * scale;
        state.panY += deltaY * scale;
      }
    } else if (activePointers.length >= 2) {
      const distance = Math.hypot(
        activePointers[0].x - activePointers[1].x,
        activePointers[0].y - activePointers[1].y
      );
      if (pinchDistance) zoomBy(Math.log(distance / pinchDistance) * 1.8);
      pinchDistance = distance;
    }
  });

  function releasePointer(event) {
    pointers.delete(event.pointerId);
    pinchDistance = 0;
  }

  canvas.addEventListener("pointerup", releasePointer);
  canvas.addEventListener("pointercancel", releasePointer);
  canvas.addEventListener("wheel", event => {
    event.preventDefault();
    zoomBy(-event.deltaY * 0.0018);
    acknowledgeTouch();
  }, { passive: false });

  function bindRange(inputSelector, key, outputSelector, format) {
    const input = $(inputSelector);
    input.addEventListener("input", () => {
      state[key] = Number(input.value);
      $(outputSelector).textContent = format(state[key]);
    });
  }

  bindRange("#detail", "iterations", "#detailValue", String);
  bindRange("#exposure", "exposure", "#exposureValue", value => value.toFixed(2));
  bindRange("#speed", "speed", "#speedValue", value => "×" + value.toFixed(2));

  $("#motion").addEventListener("click", () => setMotion(!state.motion));
  $("#reset").addEventListener("click", () => setMode(state.mode));
  $("#openPanel").addEventListener("click", () => $("#panel").classList.add("open"));
  $("#closePanel").addEventListener("click", () => $("#panel").classList.remove("open"));

  document.querySelectorAll("[data-mode]").forEach(button => {
    button.addEventListener("click", () => setMode(Number(button.dataset.mode)));
  });

  document.querySelectorAll("[data-palette]").forEach(button => {
    button.addEventListener("click", () => {
      state.palette = Number(button.dataset.palette);
      document.querySelectorAll("[data-palette]").forEach(item => item.classList.toggle("active", item === button));
    });
  });

  document.querySelectorAll("[data-quality]").forEach(button => {
    button.addEventListener("click", () => {
      state.quality = Number(button.dataset.quality);
      resizePending = true;
      document.querySelectorAll("[data-quality]").forEach(item => item.classList.toggle("active", item === button));
    });
  });

  addEventListener("resize", () => { resizePending = true; });
  document.addEventListener("visibilitychange", () => { lastFrame = performance.now(); });
  setMode(DEFAULT_MODE);
  requestAnimationFrame(render);
})();