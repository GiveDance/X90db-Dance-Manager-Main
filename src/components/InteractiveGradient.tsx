"use client";

import { useEffect, useRef, type RefObject } from "react";

export interface GradientSettings {
  bpm: number;
  speed: number;
  topPosition: number;
  mainPosition: number;
  mainSlope: number;
  lowerPosition: number;
  coreWidth: number;
  edgeWidth: number;
  brightness: number;
  warp: number;
  grain: number;
  beatWarp: number;
  beatExpansion: number;
  morphDiameter: number;
  morphStrength: number;
  mouseFollow: number;
  mouseTiltInfluence: number;
  mouseWidthInfluence: number;
  coreColor: string;
  edgeColor: string;
  falloffColor: string;
}

export const DEFAULT_GRADIENT_SETTINGS: GradientSettings = {
  bpm: 40,
  speed: 0.54,
  topPosition: -0.07,
  mainPosition: 0.64,
  mainSlope: -0.055,
  lowerPosition: 0.82,
  coreWidth: 1.43,
  edgeWidth: 0.54,
  brightness: 0.4,
  warp: 2.5,
  grain: 0.06,
  beatWarp: 0.16,
  beatExpansion: 0.09,
  morphDiameter: 1200,
  morphStrength: 0.119,
  mouseFollow: 1,
  mouseTiltInfluence: 0,
  mouseWidthInfluence: 0.8,
  coreColor: "#6b4aff",
  edgeColor: "#4ff7ff",
  falloffColor: "#0061ff",
};

function colorToVector(color: string) {
  const value = Number.parseInt(color.slice(1), 16);
  return new Float32Array([
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
  ]);
}

function writeColor(vector: Float32Array, color: string) {
  const value = Number.parseInt(color.slice(1), 16);
  vector[0] = ((value >> 16) & 255) / 255;
  vector[1] = ((value >> 8) & 255) / 255;
  vector[2] = (value & 255) / 255;
}

const FRAGMENT_SHADER = `
  precision highp float;

  varying vec2 vTextureCoord;
  uniform float uTime;
  uniform float uPulse;
  uniform vec2 uMouse;
  uniform vec2 uMousePixels;
  uniform vec2 uResolution;
  uniform float uSpeed;
  uniform float uTopPosition;
  uniform float uMainPosition;
  uniform float uMainSlope;
  uniform float uLowerPosition;
  uniform float uCoreWidth;
  uniform float uEdgeWidth;
  uniform float uBrightness;
  uniform float uWarp;
  uniform float uWidthScale;
  uniform float uHeightScale;
  uniform float uGrain;
  uniform float uBeatWarp;
  uniform float uBeatExpansion;
  uniform float uMorphDiameter;
  uniform float uMorphStrength;
  uniform float uMouseTiltInfluence;
  uniform float uMouseWidthInfluence;
  uniform vec3 uCoreColor;
  uniform vec3 uEdgeColor;
  uniform vec3 uFalloffColor;

  float hash(vec2 point) {
    return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 point) {
    vec2 cell = floor(point);
    vec2 local = fract(point);
    local = local * local * (3.0 - 2.0 * local);
    return mix(
      mix(hash(cell), hash(cell + vec2(1.0, 0.0)), local.x),
      mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0)), local.x),
      local.y
    );
  }

  float fbm(vec2 point) {
    float value = 0.0;
    float amplitude = 0.5;
    mat2 rotation = mat2(0.80, 0.60, -0.60, 0.80);
    for (int octave = 0; octave < 4; octave++) {
      value += amplitude * noise(point);
      point = rotation * point * 2.03 + 17.17;
      amplitude *= 0.5;
    }
    return value;
  }

  vec3 ribbon(
    float signedDistance,
    float intensity,
    float pathX,
    float phase
  ) {
    float pathTaper = 0.72 + 0.38 * (
      0.5 + 0.5 * sin(pathX * 6.2831853 + phase)
    );
    float localMouse = exp(-pow((pathX - uMouse.x) / 0.18, 2.0));
    float mouseWidth = 1.0 + localMouse * (
      0.10 + (1.0 - uMouse.y) * uMouseWidthInfluence * 0.22
    );
    float beatWidth = 1.0 + uPulse * uBeatExpansion * 0.16;
    float width = pathTaper * mouseWidth * beatWidth;
    float coreWidth = uCoreWidth * width;
    float edgeWidth = uEdgeWidth * width;

    float violetHalo = exp(-pow(
      (signedDistance + 0.020 * coreWidth) / (0.085 * coreWidth),
      2.0
    ));
    float violetBody = exp(-pow(
      (signedDistance + 0.012 * coreWidth) / (0.041 * coreWidth),
      2.0
    ));
    float whiteHot = exp(-pow(
      (signedDistance - 0.020 * edgeWidth) / (0.010 * edgeWidth),
      2.0
    ));
    float cyanHighlight = exp(-pow(
      (signedDistance - 0.033 * edgeWidth) / (0.020 * edgeWidth),
      2.0
    ));
    float blueFalloff = exp(-pow(
      (signedDistance - 0.080 * edgeWidth) / (0.070 * edgeWidth),
      2.0
    ));

    vec3 color = uCoreColor * violetHalo * 0.44;
    color += uCoreColor * violetBody * 0.92;
    color += mix(uEdgeColor, vec3(1.0), 0.82) * whiteHot * 1.35;
    color += uEdgeColor * cyanHighlight * 1.05;
    color += uFalloffColor * blueFalloff * 0.62;
    return color * intensity * uBrightness;
  }

  void main() {
    vec2 uv = vTextureCoord;
    float aspect = uResolution.x / max(1.0, uResolution.y);
    vec2 point = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
    float time = uTime * 0.045 * uSpeed;

    vec2 cursorPixels = vec2(uMousePixels.x, uResolution.y - uMousePixels.y);
    vec2 pixelDelta = gl_FragCoord.xy - cursorPixels;
    float lensRadius = uMorphDiameter * 0.5;
    float lensDistance = length(pixelDelta);
    float lens = smoothstep(lensRadius, 0.0, lensDistance);
    vec2 lensDirection = normalize(vec2(pixelDelta.x, -pixelDelta.y) + vec2(0.0001));
    point -= lensDirection * lens * uMorphStrength;

    vec2 widthLinkedPoint = vec2(point.x / uWidthScale, point.y);
    float broadNoise = fbm(widthLinkedPoint * 1.35 + vec2(0.37, 0.91)) - 0.5;
    float detailNoise = fbm(widthLinkedPoint * 3.7 + vec2(2.17, 1.43)) - 0.5;
    float x = point.x / aspect + 0.5;
    float y = point.y + 0.5;
    float organicWarp = (
      broadNoise * 0.048 +
      detailNoise * 0.009
    ) * uWarp;
    float beatWave = uPulse * uBeatWarp * (
      sin(x * 16.0 + time * 4.0) * 0.018 +
      sin(x * 29.0 - time * 2.7) * 0.007
    );

    float topCurve = uTopPosition + 0.20 * pow(x - 0.54, 2.0);
    topCurve += sin(x * 6.2 + time * 0.7) * 0.014;
    topCurve += organicWarp * 0.82 + beatWave * 0.70;

    float mouseSlope = (uMouse.x - 0.5) * uMouseTiltInfluence;
    float mainCurve = uMainPosition + x * uMainSlope;
    mainCurve += (x - 0.5) * mouseSlope;
    mainCurve += sin(x * 4.5 - 0.65 + time) * 0.044;
    mainCurve += organicWarp * 1.22 + beatWave;

    float lowerCurve = uLowerPosition - x * 0.12;
    lowerCurve += sin(x * 5.0 + 1.4 - time * 0.65) * 0.036;
    lowerCurve += organicWarp * 0.90 - beatWave * 0.55;

    vec3 color = vec3(0.0015, 0.0018, 0.0025);
    color += ribbon(y - topCurve, 0.58, x, 0.35);
    color += ribbon(y - mainCurve, 1.08, x, 2.25);
    color += ribbon(y - lowerCurve, 0.50, x, 4.15);

    color *= 1.0 - smoothstep(0.52, 1.18, length(point)) * 0.24;

    color = max(color, vec3(0.0));
    color = pow(color, vec3(0.90));
    float grain = hash(gl_FragCoord.xy * 0.183) - 0.5;
    color = clamp(color + grain * uGrain, 0.0, 1.0);

    gl_FragColor = vec4(color, 1.0);
  }
`;

const LIGHT_FIELD_SHADER = `
  precision highp float;

  varying vec2 vTextureCoord;
  uniform float uTime;
  uniform float uPulse;
  uniform vec2 uMouse;
  uniform vec2 uMousePixels;
  uniform vec2 uResolution;
  uniform float uSpeed;
  uniform float uMainPosition;
  uniform float uMainSlope;
  uniform float uCoreWidth;
  uniform float uEdgeWidth;
  uniform float uBrightness;
  uniform float uWarp;
  uniform float uWidthScale;
  uniform float uHeightScale;
  uniform float uGrain;
  uniform float uBeatWarp;
  uniform float uBeatExpansion;
  uniform float uMorphDiameter;
  uniform float uMorphStrength;
  uniform float uMouseTiltInfluence;
  uniform float uMouseWidthInfluence;
  uniform vec3 uCoreColor;
  uniform vec3 uEdgeColor;
  uniform vec3 uFalloffColor;

  float randomValue(vec2 point) {
    return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453);
  }

  float valueNoise(vec2 point) {
    vec2 cell = floor(point);
    vec2 local = fract(point);
    local = local * local * (3.0 - 2.0 * local);
    return mix(
      mix(randomValue(cell), randomValue(cell + vec2(1.0, 0.0)), local.x),
      mix(
        randomValue(cell + vec2(0.0, 1.0)),
        randomValue(cell + vec2(1.0, 1.0)),
        local.x
      ),
      local.y
    );
  }

  float fieldNoise(vec2 point) {
    float value = valueNoise(point) * 0.58;
    value += valueNoise(point * 2.03 + 11.7) * 0.28;
    value += valueNoise(point * 4.07 + 23.1) * 0.14;
    return value;
  }

  float bell(float value, float center, float width) {
    float normalized = (value - center) / max(width, 0.0001);
    return exp(-normalized * normalized);
  }

  void main() {
    vec2 uv = vTextureCoord;
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 point = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
    float time = uTime * uSpeed * 0.035;

    vec2 cursorPixels = vec2(uMousePixels.x, uResolution.y - uMousePixels.y);
    vec2 pixelDelta = gl_FragCoord.xy - cursorPixels;
    float lensRadius = max(1.0, uMorphDiameter * 0.5);
    float lens = smoothstep(lensRadius, 0.0, length(pixelDelta));
    vec2 lensDirection = normalize(vec2(pixelDelta.x, -pixelDelta.y) + vec2(0.0001));
    point -= lensDirection * lens * uMorphStrength;

    float pathX = point.x / aspect + 0.5;
    float pathY = point.y + 0.5;
    vec2 noisePoint = vec2(point.x / uWidthScale, point.y);
    float broadNoise = fieldNoise(noisePoint * 1.18 + vec2(0.2, 1.4)) - 0.5;
    float fineNoise = fieldNoise(noisePoint * 2.65 + vec2(4.3, 0.7)) - 0.5;
    float naturalBend = (broadNoise * 0.050 + fineNoise * 0.010) * uWarp;
    float beatBend = uPulse * uBeatWarp * (
      sin(pathX * 15.0 + time * 5.0) * 0.032 +
      sin(pathX * 27.0 - time * 3.0) * 0.011
    );
    float mouseTilt = (uMouse.x - 0.5) * uMouseTiltInfluence;
    float center = uMainPosition + pathX * uMainSlope;
    center += (pathX - 0.5) * mouseTilt;
    center += sin(pathX * 4.7 - 0.8 + time) * 0.045;
    center += naturalBend + beatBend;

    float pathVariation = 0.78 + 0.28 * (
      0.5 + 0.5 * sin(pathX * 6.2831853 + 1.1)
    );
    float pointerVariation = exp(-pow((pathX - uMouse.x) / 0.19, 2.0));
    float pointerWidth = 1.0 + pointerVariation * uMouseWidthInfluence * 0.18;
    float beatWidth = 1.0 + uPulse * uBeatExpansion * 0.24;
    float width = pathVariation * pointerWidth * beatWidth;
    float signedDistance = pathY - center;
    float coreScale = uCoreWidth * width;
    float edgeScale = uEdgeWidth * width;

    float violetGlow = bell(signedDistance, -0.025 * coreScale, 0.105 * coreScale);
    float violetBody = bell(signedDistance, -0.015 * coreScale, 0.050 * coreScale);
    float hotLine = bell(signedDistance, 0.020 * edgeScale, 0.014 * edgeScale);
    float cyanLine = bell(signedDistance, 0.036 * edgeScale, 0.030 * edgeScale);
    float blueBody = bell(signedDistance, 0.085 * edgeScale, 0.075 * edgeScale);
    float blueHalo = bell(signedDistance, 0.145 * edgeScale, 0.125 * edgeScale);

    vec3 color = vec3(0.0015, 0.0018, 0.0025);
    color += uCoreColor * violetGlow * 0.38;
    color += uCoreColor * violetBody * 0.92;
    color += mix(uEdgeColor, vec3(1.0), 0.90) * hotLine * 1.62;
    color += uEdgeColor * cyanLine * 1.12;
    color += uFalloffColor * blueBody * 0.70;
    color += uFalloffColor * blueHalo * 0.20;
    color *= uBrightness;

    color = pow(max(color, vec3(0.0)), vec3(0.90));
    float grain = randomValue(gl_FragCoord.xy * 0.183) - 0.5;
    color = clamp(color + grain * uGrain, 0.0, 1.0);
    gl_FragColor = vec4(color, 1.0);
  }
`;

const MONOPO_FIELD_SHADER = `
  precision highp float;

  varying vec2 vTextureCoord;
  uniform float uTime;
  uniform float uPulse;
  uniform vec2 uMouse;
  uniform vec2 uMousePixels;
  uniform vec2 uResolution;
  uniform float uSpeed;
  uniform float uMainPosition;
  uniform float uBrightness;
  uniform float uWarp;
  uniform float uWidthScale;
  uniform float uHeightScale;
  uniform float uGrain;
  uniform float uBeatWarp;
  uniform float uBeatExpansion;
  uniform float uMorphDiameter;
  uniform float uMorphStrength;
  uniform vec3 uCoreColor;
  uniform vec3 uEdgeColor;
  uniform vec3 uFalloffColor;

  float random2(vec2 point) {
    point = 50.0 * fract(point * 0.3183099 + vec2(0.71, 0.113));
    return -1.0 + 2.0 * fract(point.x * point.y * (point.x + point.y));
  }

  float valueNoise2(vec2 point) {
    vec2 cell = floor(point);
    vec2 local = fract(point);
    local = local * local * (3.0 - 2.0 * local);
    return mix(
      mix(random2(cell), random2(cell + vec2(1.0, 0.0)), local.x),
      mix(
        random2(cell + vec2(0.0, 1.0)),
        random2(cell + vec2(1.0, 1.0)),
        local.x
      ),
      local.y
    );
  }

  float fieldNoise2(vec2 point) {
    float value = valueNoise2(point) * 0.55;
    value += valueNoise2(point * 2.03 + 13.1) * 0.29;
    value += valueNoise2(point * 4.09 + 27.7) * 0.16;
    return value;
  }

  vec3 gradientHash(vec3 point) {
    point = fract(point * vec3(0.1031, 0.1030, 0.0973));
    point += dot(point, point.yxz + 33.33);
    return fract((point.xxy + point.yxx) * point.zyx);
  }

  vec4 gradientNoise3(vec3 point) {
    vec3 cell = floor(point);
    vec3 local = fract(point);
    vec3 interpolation = local * local * local * (
      local * (local * 6.0 - 15.0) + 10.0
    );
    vec3 interpolationDerivative = 30.0 * local * local * (
      local * (local - 2.0) + 1.0
    );

    vec3 gradientA = gradientHash(cell + vec3(0.0, 0.0, 0.0));
    vec3 gradientB = gradientHash(cell + vec3(1.0, 0.0, 0.0));
    vec3 gradientC = gradientHash(cell + vec3(0.0, 1.0, 0.0));
    vec3 gradientD = gradientHash(cell + vec3(1.0, 1.0, 0.0));
    vec3 gradientE = gradientHash(cell + vec3(0.0, 0.0, 1.0));
    vec3 gradientF = gradientHash(cell + vec3(1.0, 0.0, 1.0));
    vec3 gradientG = gradientHash(cell + vec3(0.0, 1.0, 1.0));
    vec3 gradientH = gradientHash(cell + vec3(1.0, 1.0, 1.0));

    float valueA = dot(gradientA, local);
    float valueB = dot(gradientB, local - vec3(1.0, 0.0, 0.0));
    float valueC = dot(gradientC, local - vec3(0.0, 1.0, 0.0));
    float valueD = dot(gradientD, local - vec3(1.0, 1.0, 0.0));
    float valueE = dot(gradientE, local - vec3(0.0, 0.0, 1.0));
    float valueF = dot(gradientF, local - vec3(1.0, 0.0, 1.0));
    float valueG = dot(gradientG, local - vec3(0.0, 1.0, 1.0));
    float valueH = dot(gradientH, local - vec3(1.0, 1.0, 1.0));

    float cornerBlend =
      -valueA + valueB + valueC - valueD +
      valueE - valueF - valueG + valueH;
    float value =
      valueA +
      interpolation.x * (valueB - valueA) +
      interpolation.y * (valueC - valueA) +
      interpolation.z * (valueE - valueA) +
      interpolation.x * interpolation.y * (
        valueA - valueB - valueC + valueD
      ) +
      interpolation.y * interpolation.z * (
        valueA - valueC - valueE + valueG
      ) +
      interpolation.z * interpolation.x * (
        valueA - valueB - valueE + valueF
      ) +
      interpolation.x * interpolation.y * interpolation.z * cornerBlend;

    vec3 gradient =
      gradientA +
      interpolation.x * (gradientB - gradientA) +
      interpolation.y * (gradientC - gradientA) +
      interpolation.z * (gradientE - gradientA) +
      interpolation.x * interpolation.y * (
        gradientA - gradientB - gradientC + gradientD
      ) +
      interpolation.y * interpolation.z * (
        gradientA - gradientC - gradientE + gradientG
      ) +
      interpolation.z * interpolation.x * (
        gradientA - gradientB - gradientE + gradientF
      ) +
      interpolation.x * interpolation.y * interpolation.z * (
        -gradientA + gradientB + gradientC - gradientD +
        gradientE - gradientF - gradientG + gradientH
      ) +
      interpolationDerivative * (
        vec3(valueB, valueC, valueE) -
        valueA +
        interpolation.yzx * vec3(
          valueA - valueB - valueC + valueD,
          valueA - valueC - valueE + valueG,
          valueA - valueB - valueE + valueF
        ) +
        interpolation.zxy * vec3(
          valueA - valueB - valueE + valueF,
          valueA - valueB - valueC + valueD,
          valueA - valueC - valueE + valueG
        ) +
        interpolation.yzx * interpolation.zxy * cornerBlend
      );
      return vec4(value, gradient);
  }

  vec2 rotateField(vec2 point, float angle) {
    float sine = sin(angle);
    float cosine = cos(angle);
    return mat2(cosine, -sine, sine, cosine) * point;
  }

  void main() {
    vec2 screenUv = gl_FragCoord.xy / uResolution;
    vec2 position = screenUv * 2.0 - 1.0;
    position.x *= min(1.0, uResolution.x / uResolution.y);
    position.y *= min(1.0, uResolution.y / uResolution.x);
    position /= 0.72;
    position += vec2(-0.281611, -0.439148);

    float seed = 0.18 + (uMouse.y - 0.3) * 0.72;
    seed += uTime * uSpeed * 0.0015;
    seed += uPulse * uBeatWarp * 0.035;
    vec2 noisePosition = position * 0.5 + 0.5;
    vec3 displacementNoise = gradientNoise3(
      vec3(noisePosition, seed)
    ).xyz;
    float mouseDisplacement = mix(2.6, 5.0, uMouse.x);
    float responsiveProgress = clamp(
      (uWidthScale - 0.72) / 0.73,
      0.0,
      1.0
    );
    float responsiveDisplacement = mix(0.84, 1.08, responsiveProgress);
    float displacement =
      mouseDisplacement *
      (uWarp / 2.5) *
      responsiveDisplacement;
    displacement *= 1.0 + uPulse * uBeatWarp * 0.045;
    position += displacementNoise.xz * displacement;

    vec2 cursorPixels = vec2(uMousePixels.x, uResolution.y - uMousePixels.y);
    vec2 pixelDelta = gl_FragCoord.xy - cursorPixels;
    float lensRadius = max(1.0, uMorphDiameter * 0.5);
    float lensDistance = length(pixelDelta);
    float lensShape = exp(-pow(
      lensDistance / (lensRadius * 0.55),
      2.0
    ));
    float responsiveLens = mix(0.68, 1.0, responsiveProgress);
    position +=
      displacementNoise.zx *
      lensShape *
      uMorphStrength *
      0.80 *
      responsiveLens;

    vec2 colorPosition = position;
    colorPosition -= vec2(
      -0.774117,
      -0.206448 + (0.64 - uMainPosition) * 0.8
    );
    const float spacing = 4.27;
    colorPosition =
      mod(colorPosition - spacing, vec2(spacing * 2.0)) -
      spacing;
    colorPosition = rotateField(colorPosition, 0.38159265);
    float colorSize = 0.75 * (
      1.0 + uPulse * uBeatExpansion * 0.055
    );
    colorSize *= mix(0.84, 1.08, responsiveProgress);
    float colorSpread = 4.52 * mix(0.92, 1.06, responsiveProgress);
    colorPosition /= vec2(colorSize);
    colorPosition *= vec2(1.0 / colorSpread, 1.0);

    const float colorSpacing = 0.52;
    vec3 color = vec3(0.0);
    color = mix(
      mix(vec3(0.0), uFalloffColor, 0.35),
      color,
      smoothstep(
        0.0,
        1.0,
        distance(colorPosition, vec2(0.0, colorSpacing * 1.5))
      )
    );
    color = mix(
      uFalloffColor,
      color,
      smoothstep(
        0.0,
        1.0,
        distance(colorPosition, vec2(0.0, colorSpacing * 0.5))
      )
    );
    color = mix(
      uEdgeColor,
      color,
      smoothstep(
        0.0,
        1.0,
        distance(colorPosition, vec2(0.0, -colorSpacing * 0.5))
      )
    );
    color = mix(
      uCoreColor,
      color,
      smoothstep(
        0.0,
        1.0,
        distance(colorPosition, vec2(0.0, -colorSpacing * 1.5))
      )
    );

    color *= uBrightness;
    float grain = random2(gl_FragCoord.xy * 0.183) * uGrain;
    color = clamp(color + grain, 0.0, 1.0);
    gl_FragColor = vec4(color, 1.0);
  }
`;

const REFERENCE_BAND_SHADER = `
  precision highp float;

  varying vec2 vTextureCoord;
  uniform float uTime;
  uniform float uPulse;
  uniform vec2 uMouse;
  uniform vec2 uMousePixels;
  uniform vec2 uResolution;
  uniform float uSpeed;
  uniform float uTopPosition;
  uniform float uMainPosition;
  uniform float uMainSlope;
  uniform float uLowerPosition;
  uniform float uCoreWidth;
  uniform float uEdgeWidth;
  uniform float uBrightness;
  uniform float uWarp;
  uniform float uWidthScale;
  uniform float uHeightScale;
  uniform float uGrain;
  uniform float uBeatWarp;
  uniform float uBeatExpansion;
  uniform float uMorphDiameter;
  uniform float uMorphStrength;
  uniform float uMouseTiltInfluence;
  uniform float uMouseWidthInfluence;
  uniform vec3 uCoreColor;
  uniform vec3 uEdgeColor;
  uniform vec3 uFalloffColor;

  float randomValue(vec2 point) {
    return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453);
  }

  float valueNoise(vec2 point) {
    vec2 cell = floor(point);
    vec2 local = fract(point);
    local = local * local * (3.0 - 2.0 * local);
    return mix(
      mix(randomValue(cell), randomValue(cell + vec2(1.0, 0.0)), local.x),
      mix(
        randomValue(cell + vec2(0.0, 1.0)),
        randomValue(cell + vec2(1.0, 1.0)),
        local.x
      ),
      local.y
    );
  }

  float broadNoise(vec2 point) {
    float value = valueNoise(point) * 0.62;
    value += valueNoise(point * 2.01 + 9.7) * 0.26;
    value += valueNoise(point * 4.03 + 21.3) * 0.12;
    return value;
  }

  float bell(float value, float center, float width) {
    float normalized = (value - center) / max(width, 0.0001);
    return exp(-normalized * normalized);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution;
    uv.y = 1.0 - uv.y;
    float x = uv.x;
    float time = uTime * uSpeed * 0.035;

    float arch = 1.0 - pow(x * 2.0 - 1.0, 2.0);
    float center = 0.58 + arch * 0.16 + uMainSlope * (x - 0.5);
    float naturalWarp = (
      broadNoise(vec2(x * 1.35 / uWidthScale, time * 0.12 + 0.4)) - 0.5
    ) * uWarp * 0.055;
    center += naturalWarp;

    float beatShape = uPulse * uBeatWarp * (
      sin(x * 13.0 + time * 4.0) * 0.020 +
      sin(x * 23.0 - time * 2.8) * 0.006
    );
    center += beatShape;

    vec2 cursorPixels = vec2(uMousePixels.x, uResolution.y - uMousePixels.y);
    vec2 pixelDelta = gl_FragCoord.xy - cursorPixels;
    float lensRadius = max(1.0, uMorphDiameter * 0.5);
    float lens = exp(-pow(length(pixelDelta) / (lensRadius * 0.58), 2.0));
    float cursorTarget = uMouse.y;
    center += (cursorTarget - center) * lens * uMorphStrength * 0.72;

    float pathTaper = 0.88 + 0.18 * (
      0.5 + 0.5 * sin(x * 6.2831853 + 0.8)
    );
    float beatWidth = 1.0 + uPulse * uBeatExpansion * 0.085;
    float pointerWidth = 1.0 + lens * uMouseWidthInfluence * 0.10;
    float responsiveWidth = mix(
      0.90,
      1.08,
      clamp((uWidthScale - 0.72) / 0.73, 0.0, 1.0)
    );
    float width = pathTaper * beatWidth * pointerWidth * responsiveWidth;
    float distanceToBand = uv.y - center;

    float violetHalo = bell(distanceToBand, -0.020 * width, 0.105 * width);
    float violetCore = bell(distanceToBand, -0.010 * width, 0.052 * width);
    float whiteLine = bell(distanceToBand, 0.035 * width, 0.010 * width);
    float cyanLine = bell(distanceToBand, 0.048 * width, 0.025 * width);
    float blueBody = bell(distanceToBand, 0.130 * width, 0.120 * width);
    float blueHalo = bell(distanceToBand, 0.235 * width, 0.205 * width);

    vec3 color = vec3(0.0012, 0.0015, 0.0022);
    color += uCoreColor * violetHalo * 0.34;
    color += uCoreColor * violetCore * 0.82;
    color += mix(uEdgeColor, vec3(1.0), 0.84) * whiteLine * 1.28;
    color += uEdgeColor * cyanLine * 0.92;
    color += uFalloffColor * blueBody * 0.54;
    color += uFalloffColor * blueHalo * 0.16;
    color *= uBrightness;

    float topFade = smoothstep(0.30, 0.52, uv.y);
    color *= mix(0.20, 1.0, topFade);
    color = pow(max(color, vec3(0.0)), vec3(0.92));
    float grain = randomValue(gl_FragCoord.xy * 0.183) - 0.5;
    color = clamp(color + grain * uGrain, 0.0, 1.0);
    gl_FragColor = vec4(color, 1.0);
  }
`;

interface InteractiveGradientProps {
  settings: GradientSettings;
  scrollProgressRef: RefObject<number>;
}

export function InteractiveGradient({
  settings,
  scrollProgressRef,
}: InteractiveGradientProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let cleanup = () => {};

    void import("pixi.js").then(
      ({ Application, Filter, Sprite, Texture }) => {
        if (disposed) return;

        const reduceMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        const app = new Application({
          resizeTo: window,
          backgroundAlpha: 0,
          antialias: true,
          autoDensity: true,
          resolution: Math.min(window.devicePixelRatio || 1, 1.5),
          powerPreference: "high-performance",
        });
        const canvas = app.view as HTMLCanvasElement;
        canvas.className = "home-gradient__canvas";
        host.appendChild(canvas);

        const surface = new Sprite(Texture.WHITE);
        const uniforms = {
          uTime: 0,
          uPulse: 0,
          uMouse: new Float32Array([0.72, 0.3]),
          uMousePixels: new Float32Array([
            window.innerWidth * 0.72,
            window.innerHeight * 0.3,
          ]),
          uResolution: new Float32Array([
            app.renderer.width,
            app.renderer.height,
          ]),
          uSpeed: settings.speed,
          uTopPosition: settings.topPosition,
          uMainPosition: settings.mainPosition,
          uMainSlope: settings.mainSlope,
          uLowerPosition: settings.lowerPosition,
          uCoreWidth: settings.coreWidth,
          uEdgeWidth: settings.edgeWidth,
          uBrightness: settings.brightness,
          uWarp: settings.warp,
          uWidthScale: 1,
          uHeightScale: 1,
          uGrain: settings.grain,
          uBeatWarp: settings.beatWarp,
          uBeatExpansion: settings.beatExpansion,
          uMorphDiameter: settings.morphDiameter * app.renderer.resolution,
          uMorphStrength: settings.morphStrength,
          uMouseTiltInfluence: settings.mouseTiltInfluence,
          uMouseWidthInfluence: settings.mouseWidthInfluence,
          uCoreColor: colorToVector(settings.coreColor),
          uEdgeColor: colorToVector(settings.edgeColor),
          uFalloffColor: colorToVector(settings.falloffColor),
        };
        const filter = new Filter(undefined, MONOPO_FIELD_SHADER, uniforms);
        surface.filters = [filter];
        app.stage.addChild(surface);

        const pointerTarget = { x: 0.72, y: 0.3 };
        const pointerCurrent = { ...pointerTarget };
        const startedAt = performance.now();

        const resize = () => {
          surface.position.set(0, 0);
          surface.width = window.innerWidth;
          surface.height = window.innerHeight;
          uniforms.uResolution[0] = app.renderer.width;
          uniforms.uResolution[1] = app.renderer.height;
        };
        const movePointer = (event: PointerEvent) => {
          pointerTarget.x = event.clientX / Math.max(1, window.innerWidth);
          pointerTarget.y = event.clientY / Math.max(1, window.innerHeight);
        };
        const resetPointer = () => {
          pointerTarget.x = 0.72;
          pointerTarget.y = 0.3;
        };

        resize();
        window.addEventListener("resize", resize);
        window.addEventListener("pointermove", movePointer, { passive: true });
        document.documentElement.addEventListener("mouseleave", resetPointer);

        app.ticker.add(() => {
          const elapsed = (performance.now() - startedAt) / 1000;
          const currentSettings = settingsRef.current;
          const scrollProgress = Math.min(
            1,
            Math.max(0, scrollProgressRef.current),
          );
          const effectiveBpm =
            148 + (currentSettings.bpm - 148) * scrollProgress;
          const effectiveBrightness =
            0.9 + (currentSettings.brightness - 0.9) * scrollProgress;
          const effectiveBeatWarp =
            2.2 + (currentSettings.beatWarp - 2.2) * scrollProgress;
          const effectiveBeatExpansion =
            1.5 + (currentSettings.beatExpansion - 1.5) * scrollProgress;
          const cssWidth = app.renderer.width / app.renderer.resolution;
          const cssHeight = app.renderer.height / app.renderer.resolution;
          const widthScale = Math.min(1.45, Math.max(0.72, cssWidth / 1440));
          const heightScale = Math.min(
            1.45,
            Math.max(0.72, cssHeight / 900),
          );
          host.style.opacity = "1";
          host.style.visibility = scrollProgress >= 0.5 ? "hidden" : "visible";
          if (currentSettings.mouseFollow >= 0.999) {
            pointerCurrent.x = pointerTarget.x;
            pointerCurrent.y = pointerTarget.y;
          } else {
            pointerCurrent.x +=
              (pointerTarget.x - pointerCurrent.x) * currentSettings.mouseFollow;
            pointerCurrent.y +=
              (pointerTarget.y - pointerCurrent.y) * currentSettings.mouseFollow;
          }
          uniforms.uMouse[0] = pointerCurrent.x;
          uniforms.uMouse[1] = pointerCurrent.y;
          uniforms.uMousePixels[0] = pointerCurrent.x * app.renderer.width;
          uniforms.uMousePixels[1] = pointerCurrent.y * app.renderer.height;
          uniforms.uTime = reduceMotion ? 0 : elapsed;
          const secondsPerBeat = 60 / effectiveBpm;
          const beatPhase = (elapsed % secondsPerBeat) / secondsPerBeat;
          uniforms.uPulse = reduceMotion ? 0 : Math.exp(-beatPhase * 7.5);
          uniforms.uSpeed = currentSettings.speed;
          uniforms.uTopPosition = currentSettings.topPosition;
          uniforms.uMainPosition = currentSettings.mainPosition;
          uniforms.uMainSlope = currentSettings.mainSlope;
          uniforms.uLowerPosition = currentSettings.lowerPosition;
          uniforms.uCoreWidth = currentSettings.coreWidth;
          uniforms.uEdgeWidth = currentSettings.edgeWidth;
          uniforms.uBrightness = effectiveBrightness;
          uniforms.uWarp = currentSettings.warp * widthScale;
          uniforms.uWidthScale = widthScale;
          uniforms.uHeightScale = heightScale;
          uniforms.uGrain = currentSettings.grain;
          uniforms.uBeatWarp = effectiveBeatWarp;
          uniforms.uBeatExpansion = effectiveBeatExpansion;
          uniforms.uMorphDiameter =
            currentSettings.morphDiameter * app.renderer.resolution;
          uniforms.uMorphStrength = currentSettings.morphStrength;
          uniforms.uMouseTiltInfluence = currentSettings.mouseTiltInfluence;
          uniforms.uMouseWidthInfluence = currentSettings.mouseWidthInfluence;
          writeColor(uniforms.uCoreColor, currentSettings.coreColor);
          writeColor(uniforms.uEdgeColor, currentSettings.edgeColor);
          writeColor(uniforms.uFalloffColor, currentSettings.falloffColor);
        });

        cleanup = () => {
          window.removeEventListener("resize", resize);
          window.removeEventListener("pointermove", movePointer);
          document.documentElement.removeEventListener(
            "mouseleave",
            resetPointer,
          );
          app.destroy(true, {
            children: true,
            texture: false,
            baseTexture: false,
          });
        };
      },
    );

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return (
    <div ref={hostRef} className="home-gradient" aria-hidden="true">
      <span className="home-gradient__fallback" />
      <span className="home-gradient__shade" />
    </div>
  );
}
