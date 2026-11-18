export interface DockSettings {
  magnification: number; // 1.0 to 1.55 (default 1.30)
  influenceRadius: number; // in px (default 155)
  maxLift: number; // in px (default 16)
  reflectionOpacity: number; // 0 to 0.95 (default 0.72)
  enableBounce: boolean;
}

export const DEFAULT_DOCK_SETTINGS: DockSettings = {
  magnification: 1.30,
  influenceRadius: 155,
  maxLift: 16,
  reflectionOpacity: 0.72,
  enableBounce: true,
};

export interface IconTransform {
  scale: number;
  translateY: number;
  zIndex: number;
  intensity: number; // 0..1 proximity weight
}

export function clampNumber(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function clampDockSettings(partial: Partial<DockSettings>): DockSettings {
  return {
    magnification: clampNumber(
      partial.magnification ?? DEFAULT_DOCK_SETTINGS.magnification,
      1.0,
      1.55
    ),
    influenceRadius: clampNumber(
      partial.influenceRadius ?? DEFAULT_DOCK_SETTINGS.influenceRadius,
      90,
      260
    ),
    maxLift: clampNumber(partial.maxLift ?? DEFAULT_DOCK_SETTINGS.maxLift, 0, 28),
    reflectionOpacity: clampNumber(
      partial.reflectionOpacity ?? DEFAULT_DOCK_SETTINGS.reflectionOpacity,
      0,
      0.95
    ),
    enableBounce: partial.enableBounce ?? DEFAULT_DOCK_SETTINGS.enableBounce,
  };
}

/**
 * Smoothstep falloff returning 1 at distance 0 and 0 at distance >= radius.
 */
export function computeProximityIntensity(distance: number, influenceRadius: number): number {
  if (influenceRadius <= 0) return 0;
  const s = Math.max(0, 1 - Math.abs(distance) / influenceRadius);
  return s * s * (3 - 2 * s);
}

/**
 * Computes per-icon scale, vertical lift, and z-index for a fixed-width liquid glass dock.
 * Only the icons animate; the glass shelf remains completely stationary.
 */
export function computeDockIconTransforms(params: {
  count: number;
  baseSize: number;
  gap: number;
  pointerX: number | null;
  settings: DockSettings;
}): IconTransform[] {
  const { count, baseSize, gap, pointerX, settings } = params;

  if (count <= 0) {
    return [];
  }

  if (pointerX === null || settings.magnification <= 1.001) {
    return Array.from({ length: count }, () => ({
      scale: 1,
      translateY: 0,
      zIndex: 3,
      intensity: 0,
    }));
  }

  const step = baseSize + gap;
  const transforms: IconTransform[] = [];

  for (let i = 0; i < count; i++) {
    const iconCenterX = i * step + baseSize / 2;
    const distance = pointerX - iconCenterX;
    const intensity = computeProximityIntensity(distance, settings.influenceRadius);
    const scale = 1 + (settings.magnification - 1) * intensity;
    const translateY = -settings.maxLift * intensity;
    const zIndex = 3 + Math.round(10 * intensity);

    transforms.push({
      scale,
      translateY,
      zIndex,
      intensity,
    });
  }

  return transforms;
}

/**
 * Allocation-free target calculation writing into pre-allocated arrays for 60/120fps rAF loops.
 */
export function writeDockIconTargets(params: {
  count: number;
  baseSize: number;
  gap: number;
  pointerX: number | null;
  settings: DockSettings;
  outScales: number[];
  outLifts: number[];
  outZIndices: number[];
}): void {
  const { count, baseSize, gap, pointerX, settings, outScales, outLifts, outZIndices } = params;

  if (pointerX === null || settings.magnification <= 1.001) {
    for (let i = 0; i < count; i++) {
      outScales[i] = 1;
      outLifts[i] = 0;
      outZIndices[i] = 3;
    }
    return;
  }

  const step = baseSize + gap;
  const scaleDelta = settings.magnification - 1;

  for (let i = 0; i < count; i++) {
    const iconCenterX = i * step + baseSize / 2;
    const distance = pointerX - iconCenterX;
    const intensity = computeProximityIntensity(distance, settings.influenceRadius);
    outScales[i] = 1 + scaleDelta * intensity;
    outLifts[i] = -settings.maxLift * intensity;
    outZIndices[i] = 3 + Math.round(10 * intensity);
  }
}

export interface SpringStepResult {
  value: number;
  velocity: number;
  settled: boolean;
}

/**
 * Sub-stepped semi-implicit Euler damped spring for frame-rate-independent,
 * interruptible macOS-style motion with continuous velocity on rapid reversals.
 */
export function stepSpring(
  value: number,
  velocity: number,
  target: number,
  dtSeconds: number,
  options?: {
    stiffness?: number;
    damping?: number;
    valueThreshold?: number;
    velocityThreshold?: number;
  }
): SpringStepResult {
  const stiffness = options?.stiffness ?? 460;
  const damping = options?.damping ?? 36;
  const valueThreshold = options?.valueThreshold ?? 0.0005;
  const velocityThreshold = options?.velocityThreshold ?? 0.001;

  const clampedDt = Math.min(0.032, Math.max(0.001, dtSeconds));
  const subDt = clampedDt * 0.5;

  let x = value;
  let v = velocity;

  for (let s = 0; s < 2; s++) {
    const force = (target - x) * stiffness;
    const accel = force - v * damping;
    v += accel * subDt;
    x += v * subDt;
  }

  if (Math.abs(target - x) < valueThreshold && Math.abs(v) < velocityThreshold) {
    return { value: target, velocity: 0, settled: true };
  }

  return { value: x, velocity: v, settled: false };
}
