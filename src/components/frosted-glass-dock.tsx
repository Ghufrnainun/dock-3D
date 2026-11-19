import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

// ============================================================================
// Types & Data
// ============================================================================
export type DockAppId =
  | 'apps'
  | 'projects'
  | 'about'
  | 'resume'
  | 'journal'
  | 'notes'
  | 'settings'
  | 'contact'
  | (string & {});

export interface DockAppItem {
  id: DockAppId;
  label: string;
  subtitle?: string;
  accentColor?: string;
  reflectionGlow?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  href?: string;
}

export const DOCK_APPS: DockAppItem[] = [
  {
    id: 'apps',
    label: 'Apps',
    subtitle: 'Launcher & Workspace Grid',
    accentColor: '#635bff',
    reflectionGlow: 'rgba(99, 91, 255, 0.55)',
  },
  {
    id: 'projects',
    label: 'Projects',
    subtitle: 'Code & Engineering Showcase',
    accentColor: '#22d3ee',
    reflectionGlow: 'rgba(22, 140, 190, 0.55)',
  },
  {
    id: 'about',
    label: 'About',
    subtitle: 'Profile & Biography',
    accentColor: '#c0268d',
    reflectionGlow: 'rgba(155, 32, 120, 0.55)',
  },
  {
    id: 'resume',
    label: 'Resume',
    subtitle: 'Curriculum Vitae',
    accentColor: '#2563eb',
    reflectionGlow: 'rgba(37, 99, 235, 0.55)',
  },
  {
    id: 'journal',
    label: 'Journal',
    subtitle: 'Essays & Writing',
    accentColor: '#d4a64a',
    reflectionGlow: 'rgba(26, 36, 74, 0.65)',
  },
  {
    id: 'notes',
    label: 'Notes',
    subtitle: 'Quick Sketch & Scratchpad',
    accentColor: '#f59e0b',
    reflectionGlow: 'rgba(235, 142, 32, 0.6)',
  },
  {
    id: 'settings',
    label: 'Settings',
    subtitle: 'Dock Physics & Glass Controls',
    accentColor: '#818cf8',
    reflectionGlow: 'rgba(96, 108, 160, 0.5)',
  },
  {
    id: 'contact',
    label: 'Contact',
    subtitle: 'Direct Message & Mail',
    accentColor: '#e15b72',
    reflectionGlow: 'rgba(182, 56, 86, 0.55)',
  },
];

// ============================================================================
// Physics Simulation Engine
// ============================================================================
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

// ============================================================================
// 3D Vector Icons
// ============================================================================
const SQUIRCLE_PATH =
  'M 31 6 H 89 C 105.5 6 114 14.5 114 31 V 89 C 114 105.5 105.5 114 89 114 H 31 C 14.5 114 6 105.5 6 89 V 31 C 6 14.5 14.5 6 31 6 Z';

function SquircleShell({
  uid,
  topColor,
  midColor,
  bottomColor,
  rimColor = 'rgba(255,255,255,0.52)',
  children,
  overflowVisible = false,
}: {
  uid: string;
  topColor: string;
  midColor: string;
  bottomColor: string;
  rimColor?: string;
  children: React.ReactNode;
  overflowVisible?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 120 120"
      className="w-full h-full select-none overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="0.15" y2="1">
          <stop offset="0%" stopColor={topColor} />
          <stop offset="52%" stopColor={midColor} />
          <stop offset="100%" stopColor={bottomColor} />
        </linearGradient>
        <linearGradient id={`${uid}-rim`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={rimColor} />
          <stop offset="28%" stopColor="rgba(255,255,255,0.16)" />
          <stop offset="75%" stopColor="rgba(255,255,255,0.03)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.28)" />
        </linearGradient>
        <radialGradient id={`${uid}-topglow`} cx="0.5" cy="0.06" r="0.65">
          <stop offset="0%" stopColor="rgba(255,255,255,0.24)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        {!overflowVisible && (
          <clipPath id={`${uid}-clip`}>
            <path d={SQUIRCLE_PATH} />
          </clipPath>
        )}
      </defs>

      {/* Baked ambient squircle shadow (replaces expensive CSS filter: drop-shadow) */}
      <path d={SQUIRCLE_PATH} transform="translate(0.9, 6.5) scale(0.985)" fill="rgba(8, 10, 26, 0.14)" />
      <path d={SQUIRCLE_PATH} transform="translate(0, 3.8)" fill="rgba(8, 10, 26, 0.26)" />

      <path d={SQUIRCLE_PATH} fill={`url(#${uid}-bg)`} />
      <path d={SQUIRCLE_PATH} fill={`url(#${uid}-topglow)`} />

      <g clipPath={overflowVisible ? undefined : `url(#${uid}-clip)`}>{children}</g>

      <path
        d={SQUIRCLE_PATH}
        fill="none"
        stroke={`url(#${uid}-rim)`}
        strokeWidth="2.1"
      />
    </svg>
  );
}

function AppsIcon() {
  const uid = useId().replace(/:/g, '');

  return (
    <SquircleShell
      uid={uid}
      topColor="#6660ff"
      midColor="#4a40ef"
      bottomColor="#2f22c2"
      rimColor="rgba(195, 200, 255, 0.72)"
    >
      <defs>
        <linearGradient id={`${uid}-tl`} x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0%" stopColor="#ff6cff" />
          <stop offset="100%" stopColor="#d418ea" />
        </linearGradient>
        <linearGradient id={`${uid}-tr`} x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0%" stopColor="#58fbe1" />
          <stop offset="100%" stopColor="#12b6c2" />
        </linearGradient>
        <linearGradient id={`${uid}-bl`} x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0%" stopColor="#ffcb5c" />
          <stop offset="100%" stopColor="#e27319" />
        </linearGradient>
        <linearGradient id={`${uid}-br`} x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0%" stopColor="#56a7ff" />
          <stop offset="100%" stopColor="#1c49ea" />
        </linearGradient>
      </defs>

      <g fill="#0c064a" fillOpacity="0.42">
        <rect x="23" y="26.5" width="33" height="33" rx="8.5" />
        <rect x="64" y="26.5" width="33" height="33" rx="8.5" />
        <rect x="23" y="67.5" width="33" height="33" rx="8.5" />
        <rect x="64" y="67.5" width="33" height="33" rx="8.5" />
      </g>

      <g className="dock-tile-tl">
        <rect x="23" y="23" width="33" height="33" rx="8.5" fill={`url(#${uid}-tl)`} />
        <rect x="23.8" y="23.8" width="31.4" height="31.4" rx="7.8" fill="none" stroke="rgba(255,255,255,0.48)" strokeWidth="1.2" />
      </g>

      <g className="dock-tile-tr">
        <rect x="64" y="23" width="33" height="33" rx="8.5" fill={`url(#${uid}-tr)`} />
        <rect x="64.8" y="23.8" width="31.4" height="31.4" rx="7.8" fill="none" stroke="rgba(255,255,255,0.52)" strokeWidth="1.2" />
      </g>

      <g className="dock-tile-bl">
        <rect x="23" y="64" width="33" height="33" rx="8.5" fill={`url(#${uid}-bl)`} />
        <rect x="23.8" y="64.8" width="31.4" height="31.4" rx="7.8" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" />
      </g>

      <g className="dock-tile-br">
        <rect x="64" y="64" width="33" height="33" rx="8.5" fill={`url(#${uid}-br)`} />
        <rect x="64.8" y="64.8" width="31.4" height="31.4" rx="7.8" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" />
      </g>
    </SquircleShell>
  );
}

function CodeFolderIcon() {
  const uid = useId().replace(/:/g, '');

  return (
    <SquircleShell
      uid={uid}
      topColor="#1978a8"
      midColor="#0e4f7b"
      bottomColor="#083051"
      rimColor="rgba(140, 224, 255, 0.65)"
    >
      <defs>
        <linearGradient id={`${uid}-folder`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1b83b6" stopOpacity="0.82" />
          <stop offset="100%" stopColor="#08365a" stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id={`${uid}-win`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#092138" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#04101f" stopOpacity="0.97" />
        </linearGradient>
      </defs>

      <path
        className="dock-code-folder"
        d="M 22 33 C 22 29 25 26 29 26 H 46 C 49 26 51 28 53 31 L 56 35 H 88 C 92 35 95 38 95 42 V 82 C 95 86 92 89 88 89 H 29 C 25 89 22 86 22 82 Z"
        fill={`url(#${uid}-folder)`}
        stroke="#5ad4ff"
        strokeOpacity="0.55"
        strokeWidth="1.5"
      />

      <g className="dock-code-card">
        <rect x="26" y="45.5" width="74" height="52" rx="8" fill="#020b16" fillOpacity="0.55" />
        <rect
          x="26"
          y="42"
          width="74"
          height="52"
          rx="8"
          fill={`url(#${uid}-win)`}
          stroke="#4ecbff"
          strokeOpacity="0.52"
          strokeWidth="1.3"
        />
        <line x1="33" y1="43.5" x2="93" y2="43.5" stroke="rgba(165, 236, 255, 0.35)" strokeWidth="1" />

        <circle className="dock-code-dot dock-code-dot-1" cx="34.5" cy="50" r="2.1" fill="#ff5f56" />
        <circle className="dock-code-dot dock-code-dot-2" cx="41.5" cy="50" r="2.1" fill="#ffbd2e" />
        <circle className="dock-code-dot dock-code-dot-3" cx="48.5" cy="50" r="2.1" fill="#27c93f" />

        {/* Layered cyan bloom + animated </> */}
        <g
          fill="none"
          stroke="#3ae8ff"
          strokeOpacity="0.28"
          strokeWidth="7.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline className="dock-code-left" points="51,62 42,69 51,76" />
          <line className="dock-code-slash" x1="65" y1="59.5" x2="59" y2="78.5" />
          <polyline className="dock-code-right" points="73,62 82,69 73,76" />
        </g>
        <g
          fill="none"
          stroke="#6af6ff"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline className="dock-code-left" points="51,62 42,69 51,76" />
          <line className="dock-code-slash" x1="65" y1="59.5" x2="59" y2="78.5" />
          <polyline className="dock-code-right" points="73,62 82,69 73,76" />
        </g>

        <g className="dock-code-lines" stroke="rgba(148, 226, 255, 0.45)" strokeWidth="1.4" strokeLinecap="round">
          <line x1="33" y1="81" x2="43" y2="81" />
          <line x1="33" y1="85" x2="49" y2="85" />
          <line x1="33" y1="89" x2="39" y2="89" />
          <line x1="43" y1="89" x2="54" y2="89" strokeOpacity="0.6" />
        </g>
      </g>
    </SquircleShell>
  );
}

function ProfileIcon() {
  const uid = useId().replace(/:/g, '');

  return (
    <SquircleShell
      uid={uid}
      topColor="#a22382"
      midColor="#74125c"
      bottomColor="#48083b"
      rimColor="rgba(255, 178, 232, 0.65)"
    >
      <defs>
        <radialGradient id={`${uid}-head`} cx="0.38" cy="0.28" r="0.68">
          <stop offset="0%" stopColor="#fffaf8" />
          <stop offset="48%" stopColor="#e6d6da" />
          <stop offset="85%" stopColor="#9d7b87" />
          <stop offset="100%" stopColor="#cba99a" />
        </radialGradient>
        <radialGradient id={`${uid}-bust`} cx="0.4" cy="0.22" r="0.72">
          <stop offset="0%" stopColor="#fff8f5" />
          <stop offset="45%" stopColor="#decbce" />
          <stop offset="85%" stopColor="#896573" />
          <stop offset="100%" stopColor="#d2ae95" />
        </radialGradient>
      </defs>

      <g className="dock-profile-bust">
        <path
          d="M 27 94 C 27 73 41.5 65.5 60 65.5 C 78.5 65.5 93 73 93 94 C 93 100 86 102.5 60 102.5 C 34 102.5 27 100 27 94 Z"
          fill="#290221"
          fillOpacity="0.45"
        />
        <path
          d="M 27 90 C 27 69 41.5 61.5 60 61.5 C 78.5 61.5 93 69 93 90 C 93 96 86 98.5 60 98.5 C 34 98.5 27 96 27 90 Z"
          fill={`url(#${uid}-bust)`}
        />
        <path
          d="M 28 89.5 C 28 70 42 62.5 60 62.5 C 78 62.5 92 70 92 89.5"
          fill="none"
          stroke="rgba(255,255,255,0.48)"
          strokeWidth="1.2"
        />
        <path
          d="M 30 93.5 C 36 97 47 97.8 60 97.8 C 73 97.8 84 97 90 93.5"
          fill="none"
          stroke="rgba(245, 206, 168, 0.58)"
          strokeWidth="1.3"
        />
      </g>

      <g className="dock-profile-head">
        <circle cx="60" cy="43" r="16.5" fill="#290221" fillOpacity="0.45" />
        <circle cx="60" cy="39" r="16.5" fill={`url(#${uid}-head)`} />
        <circle cx="60" cy="39" r="15.8" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1" />
      </g>
    </SquircleShell>
  );
}

function ResumeDocIcon() {
  const uid = useId().replace(/:/g, '');

  return (
    <SquircleShell
      uid={uid}
      topColor="#2b64de"
      midColor="#1942aa"
      bottomColor="#0e2670"
      rimColor="rgba(165, 204, 255, 0.72)"
    >
      <defs>
        <linearGradient id={`${uid}-doc`} x1="0" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor="#e5eeff" />
          <stop offset="48%" stopColor="#a7bce8" />
          <stop offset="100%" stopColor="#7289c4" />
        </linearGradient>
        <linearGradient id={`${uid}-fold`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#f5f8ff" />
          <stop offset="100%" stopColor="#adc0ea" />
        </linearGradient>
      </defs>

      <g className="dock-resume-sheet">
        <path
          d="M 33 25 H 74 L 93 44 V 97 C 93 100.5 90.5 103 87 103 H 33 C 29.5 103 27 100.5 27 97 V 31 C 27 27.5 29.5 25 33 25 Z"
          fill="#041038"
          fillOpacity="0.45"
        />
        <path
          d="M 33 21 H 74 L 93 40 V 93 C 93 96.5 90.5 99 87 99 H 33 C 29.5 99 27 96.5 27 93 V 27 C 27 23.5 29.5 21 33 21 Z"
          fill={`url(#${uid}-doc)`}
          stroke="rgba(255,255,255,0.62)"
          strokeWidth="1.2"
        />
        <path d="M 74 40 L 93 40 L 93 45 L 76 42 Z" fill="rgba(16, 36, 98, 0.25)" />
        <path
          d="M 74 21 V 35 C 74 38 76 40 79 40 H 93 Z"
          fill={`url(#${uid}-fold)`}
          stroke="rgba(255,255,255,0.72)"
          strokeWidth="0.9"
        />

        <g className="dock-resume-avatar">
          <rect
            x="35"
            y="30"
            width="19"
            height="21"
            rx="4"
            fill="#2249ad"
            fillOpacity="0.28"
            stroke="rgba(255,255,255,0.5)"
            strokeWidth="0.9"
          />
          <circle cx="44.5" cy="37.5" r="3.6" fill="#173891" />
          <path
            d="M 38.2 47.5 C 38.2 43.8 41 42.2 44.5 42.2 C 48 42.2 50.8 43.8 50.8 47.5 Z"
            fill="#173891"
          />
        </g>

        <rect x="60" y="34" width="18" height="4.2" rx="2.1" fill="#edf3ff" fillOpacity="0.92" />
        <rect x="60" y="42.5" width="23" height="4.2" rx="2.1" fill="#dfe9ff" fillOpacity="0.82" />
        <rect className="dock-resume-line dock-resume-line-1" x="35" y="59" width="50" height="4.4" rx="2.2" fill="#f3f7ff" fillOpacity="0.9" />
        <rect className="dock-resume-line dock-resume-line-2" x="35" y="68.5" width="50" height="4.4" rx="2.2" fill="#e9f0ff" fillOpacity="0.86" />
        <rect className="dock-resume-line dock-resume-line-3" x="35" y="78" width="50" height="4.4" rx="2.2" fill="#e2ebff" fillOpacity="0.82" />
        <rect className="dock-resume-line dock-resume-line-4" x="35" y="87.5" width="38" height="4.4" rx="2.2" fill="#dbe5ff" fillOpacity="0.78" />
      </g>
    </SquircleShell>
  );
}

function FountainPenIcon() {
  const uid = useId().replace(/:/g, '');

  return (
    <SquircleShell
      uid={uid}
      topColor="#21294b"
      midColor="#121731"
      bottomColor="#080b19"
      rimColor="rgba(130, 148, 210, 0.45)"
    >
      <defs>
        <linearGradient id={`${uid}-barrel`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#42518b" />
          <stop offset="45%" stopColor="#1e2752" />
          <stop offset="100%" stopColor="#0d1229" />
        </linearGradient>
        <linearGradient id={`${uid}-gold`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff0b3" />
          <stop offset="45%" stopColor="#dfa83d" />
          <stop offset="100%" stopColor="#8c5e12" />
        </linearGradient>
        <linearGradient id={`${uid}-nib`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="50%" stopColor="#c9d3e8" />
          <stop offset="100%" stopColor="#6e7994" />
        </linearGradient>
        <linearGradient id={`${uid}-ink`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ffe599" />
          <stop offset="65%" stopColor="#d9a13b" />
          <stop offset="100%" stopColor="#946214" />
        </linearGradient>
      </defs>

      <g className="dock-ink-group">
        <path
          className="dock-ink-ambient"
          d="M 33 88 C 44 88 53 77 62 77 C 71 77 65 92 78 92 C 88 92 94 84 99 81"
          fill="none"
          stroke="rgba(255, 212, 110, 0.22)"
          strokeWidth="6.5"
          strokeLinecap="round"
          pathLength="100"
        />
        <path
          className="dock-ink-stroke"
          d="M 33 88 C 44 88 53 77 62 77 C 71 77 65 92 78 92 C 88 92 94 84 99 81"
          fill="none"
          stroke={`url(#${uid}-ink)`}
          strokeWidth="3.2"
          strokeLinecap="round"
          pathLength="100"
        />
        <path
          className="dock-ink-sheen"
          d="M 33 88 C 44 88 53 77 62 77 C 71 77 65 92 78 92 C 88 92 94 84 99 81"
          fill="none"
          stroke="#fff2b8"
          strokeWidth="1.8"
          strokeLinecap="round"
          pathLength="100"
        />
      </g>

      <g className="dock-pen-nib">
        <g transform="translate(62, 64) rotate(45) translate(-60, -60)" opacity="0.5">
          <path d="M 48 -18 H 72 V 42 H 48 Z" fill="#02030a" />
          <path d="M 49 50.5 H 71 L 74.5 64 L 60 95 L 45.5 64 Z" fill="#02030a" />
        </g>

        <g transform="translate(60, 60) rotate(45) translate(-60, -60)">
          <path
            d="M 48 -18 H 72 V 42 H 48 Z"
            fill={`url(#${uid}-barrel)`}
            stroke="rgba(165, 185, 255, 0.28)"
            strokeWidth="1"
          />
          <rect x="52.5" y="-16" width="5" height="56" fill="rgba(255,255,255,0.16)" />
          <rect x="46.5" y="40" width="27" height="7" rx="2" fill={`url(#${uid}-gold)`} />
          <rect x="48.5" y="47" width="23" height="3.5" rx="1" fill="#182040" />
          <path
            d="M 49 50.5 H 71 L 74.5 64 L 60 95 L 45.5 64 Z"
            fill={`url(#${uid}-nib)`}
            stroke="rgba(255,255,255,0.6)"
            strokeWidth="0.8"
          />
          <path d="M 60 50.5 H 71 L 74.5 64 L 60 95 Z" fill="rgba(20, 28, 52, 0.16)" />
          <line x1="60" y1="68" x2="60" y2="95" stroke="#182038" strokeWidth="1.4" />
          <circle cx="60" cy="66" r="2.7" fill="#182038" />
          {/* Luminous gold writing flare at the active nib tip */}
          <circle cx="60" cy="95" r="3.2" fill="#fff7d6" className="dock-nib-flare" />
        </g>
      </g>
    </SquircleShell>
  );
}

function NotebookPencilIcon() {
  const uid = useId().replace(/:/g, '');
  const ringYs = [26, 43, 60, 77, 94];

  return (
    <svg viewBox="0 0 120 120" className="w-full h-full select-none overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-cover`} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor="#ffc254" />
          <stop offset="55%" stopColor="#ec9623" />
          <stop offset="100%" stopColor="#cc6f12" />
        </linearGradient>
        <linearGradient id={`${uid}-spine`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#9d4b12" />
          <stop offset="55%" stopColor="#c4661a" />
          <stop offset="100%" stopColor="#7a3409" />
        </linearGradient>
        <linearGradient id={`${uid}-ring`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="45%" stopColor="#d0d7e3" />
          <stop offset="100%" stopColor="#697387" />
        </linearGradient>
        <linearGradient id={`${uid}-pwood`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ffa23d" />
          <stop offset="55%" stopColor="#de6d14" />
          <stop offset="100%" stopColor="#9e4107" />
        </linearGradient>
        <linearGradient id={`${uid}-rim`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,244,214,0.75)" />
          <stop offset="40%" stopColor="rgba(255,255,255,0.16)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.28)" />
        </linearGradient>
        <clipPath id={`${uid}-clip`}>
          <path d={SQUIRCLE_PATH} />
        </clipPath>
      </defs>

      <path d={SQUIRCLE_PATH} transform="translate(0.9, 6.5) scale(0.985)" fill="rgba(8, 10, 26, 0.14)" />
      <path d={SQUIRCLE_PATH} transform="translate(0, 3.8)" fill="rgba(8, 10, 26, 0.26)" />

      <path d={SQUIRCLE_PATH} fill={`url(#${uid}-cover)`} />

      <g clipPath={`url(#${uid}-clip)`}>
        <rect x="6" y="6" width="26" height="108" fill={`url(#${uid}-spine)`} />
        <line x1="32" y1="6" x2="32" y2="114" stroke="rgba(255, 224, 170, 0.35)" strokeWidth="1.1" />
      </g>

      {/* Ruled notepad paper lines & active pencil sketch */}
      <g className="dock-notebook-paper">
        <line x1="38" y1="42" x2="88" y2="42" stroke="rgba(120, 50, 10, 0.22)" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="38" y1="58" x2="88" y2="58" stroke="rgba(120, 50, 10, 0.22)" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="38" y1="74" x2="88" y2="74" stroke="rgba(120, 50, 10, 0.22)" strokeWidth="1.2" strokeLinecap="round" />

        {/* Drawn graphite note doodle */}
        <path
          className="dock-pencil-stroke"
          d="M 40 42 Q 52 39 64 42 T 80 42"
          fill="none"
          stroke="#422006"
          strokeWidth="2.4"
          strokeLinecap="round"
          pathLength="100"
        />

        {/* Drawn graphite checkmark */}
        <path
          className="dock-pencil-check"
          d="M 40 58 L 47 64 L 62 52"
          fill="none"
          stroke="#261003"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength="100"
        />
      </g>

      <path d={SQUIRCLE_PATH} fill="none" stroke={`url(#${uid}-rim)`} strokeWidth="2.1" />

      {ringYs.map((ry, idx) => (
        <g key={ry} className={`dock-notebook-ring dock-notebook-ring-${idx + 1}`}>
          <circle cx="22" cy={ry} r="3.4" fill="#3a1604" />
          <rect
            x="-2"
            y={ry - 2.6}
            width="25"
            height="5.2"
            rx="2.6"
            fill={`url(#${uid}-ring)`}
            stroke="rgba(30, 15, 5, 0.35)"
            strokeWidth="0.6"
          />
        </g>
      ))}

      <g className="dock-pencil">
        <g transform="translate(80, 66) rotate(36) translate(-83, -62)" opacity="0.34">
          <rect x="76.5" y="14" width="13" height="65" rx="3.5" fill="#4a1c02" />
          <polygon points="76.5,79 89.5,79 83,96.5" fill="#4a1c02" />
        </g>
        <g transform="translate(83, 62) rotate(36) translate(-83, -62)">
          <rect x="76.5" y="14" width="13" height="11" rx="3.5" fill="#eb7575" />
          <rect x="78" y="15" width="4" height="8" rx="1.5" fill="rgba(255,255,255,0.35)" />
          <rect x="76.2" y="23" width="13.6" height="8" rx="1" fill="#d8dee9" />
          <line x1="76.2" y1="25.5" x2="89.8" y2="25.5" stroke="#858f9e" strokeWidth="1" />
          <line x1="76.2" y1="28.5" x2="89.8" y2="28.5" stroke="#858f9e" strokeWidth="1" />
          <rect x="76.5" y="31" width="13" height="48" fill={`url(#${uid}-pwood)`} />
          <rect x="79.5" y="31" width="3.5" height="48" fill="rgba(255, 224, 175, 0.35)" />
          <polygon points="76.5,79 89.5,79 83,96" fill="#f2cf9e" />
          <polygon points="83,79 89.5,79 83,96" fill="rgba(160, 96, 36, 0.25)" />
          <polygon points="80.8,90 85.2,90 83,96.5" fill="#231f20" />
        </g>
      </g>
    </svg>
  );
}

function SlidersIcon() {
  const uid = useId().replace(/:/g, '');

  return (
    <SquircleShell
      uid={uid}
      topColor="#6b75a8"
      midColor="#4e5684"
      bottomColor="#353b5f"
      rimColor="rgba(198, 206, 255, 0.58)"
    >
      <defs>
        <linearGradient id={`${uid}-fillL`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#6c80d6" />
          <stop offset="100%" stopColor="#b2c2ff" />
        </linearGradient>
        <linearGradient id={`${uid}-fillR`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#b2c2ff" />
          <stop offset="100%" stopColor="#7789de" />
        </linearGradient>
        <radialGradient id={`${uid}-knob`} cx="0.35" cy="0.32" r="0.72">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="55%" stopColor="#ccd4e8" />
          <stop offset="100%" stopColor="#8d98b5" />
        </radialGradient>
      </defs>

      <rect x="24" y="37.5" width="72" height="11" rx="5.5" fill="#222642" stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
      <rect className="dock-track-fill-top" x="25" y="38.5" width="24" height="9" rx="4.5" fill={`url(#${uid}-fillL)`} />

      <rect x="24" y="71.5" width="72" height="11" rx="5.5" fill="#222642" stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
      <rect className="dock-track-fill-bot" x="74" y="72.5" width="21" height="9" rx="4.5" fill={`url(#${uid}-fillR)`} />

      <g className="dock-knob-top">
        <circle cx="47" cy="46.5" r="11.5" fill="#151933" fillOpacity="0.48" />
        <circle cx="47" cy="43" r="11.5" fill={`url(#${uid}-knob)`} />
        <circle cx="47" cy="43" r="10.8" fill="none" stroke="#e2c6ba" strokeWidth="1.4" />
        <path className="dock-knob-top-spin" d="M 38 38 L 56 48 M 38 48 L 56 38" stroke="rgba(255,255,255,0.34)" strokeWidth="2.5" />
      </g>

      <g className="dock-knob-bot">
        <circle cx="74" cy="80.5" r="11.5" fill="#151933" fillOpacity="0.48" />
        <circle cx="74" cy="77" r="11.5" fill={`url(#${uid}-knob)`} />
        <circle cx="74" cy="77" r="10.8" fill="none" stroke="#e2c6ba" strokeWidth="1.4" />
        <path className="dock-knob-bot-spin" d="M 65 72 L 83 82 M 65 82 L 83 72" stroke="rgba(255,255,255,0.34)" strokeWidth="2.5" />
      </g>
    </SquircleShell>
  );
}

function EnvelopeSealIcon() {
  const uid = useId().replace(/:/g, '');

  return (
    <SquircleShell
      uid={uid}
      topColor="#c45169"
      midColor="#9b2f48"
      bottomColor="#6e192f"
      rimColor="rgba(255, 198, 210, 0.65)"
    >
      <defs>
        <linearGradient id={`${uid}-env`} x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0%" stopColor="#fbe2e7" />
          <stop offset="55%" stopColor="#de96a6" />
          <stop offset="100%" stopColor="#ba6579" />
        </linearGradient>
        <linearGradient id={`${uid}-flap`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff1f4" />
          <stop offset="100%" stopColor="#e3a4b3" />
        </linearGradient>
        <radialGradient id={`${uid}-wax`} cx="0.35" cy="0.3" r="0.7">
          <stop offset="0%" stopColor="#ff9e85" />
          <stop offset="55%" stopColor="#df5e4b" />
          <stop offset="100%" stopColor="#9c2c22" />
        </radialGradient>
        <clipPath id={`${uid}-envclip`}>
          <rect x="19" y="10" width="82" height="79" rx="5.5" />
        </clipPath>
      </defs>

      <g className="dock-envelope">
        {/* Envelope shadow */}
        <rect x="19" y="35" width="82" height="58" rx="5.5" fill="#3b0514" fillOpacity="0.45" />

        {/* Back envelope interior (revealed when flap opens) */}
        <rect x="19" y="31" width="82" height="58" rx="5.5" fill="#8b344a" />

        {/* Rear unfolded top flap (sits behind the rising letter) */}
        <path
          className="dock-env-flap-back"
          d="M 21 31 H 99 L 60 56 Z"
          fill="#d9899c"
          stroke="rgba(255, 240, 244, 0.55)"
          strokeWidth="1"
          strokeLinejoin="round"
        />

        {/* Sliding letter peeking out cleanly in front of open flap */}
        <g clipPath={`url(#${uid}-envclip)`}>
          <g className="dock-env-letter">
            <rect
              x="25"
              y="33"
              width="70"
              height="48"
              rx="4"
              fill="#fff9fa"
              stroke="rgba(220, 165, 178, 0.72)"
              strokeWidth="1.1"
            />
            <circle cx="36" cy="40" r="3" fill="#e5617b" />
            <line x1="43" y1="40" x2="77" y2="40" stroke="#cf788c" strokeWidth="2.6" strokeLinecap="round" />
            <line x1="33" y1="48" x2="86" y2="48" stroke="#e4aab8" strokeWidth="2.2" strokeLinecap="round" />
            <line x1="33" y1="55" x2="70" y2="55" stroke="#edd0d8" strokeWidth="2" strokeLinecap="round" />
          </g>
        </g>

        {/* Front envelope pocket with V-notch */}
        <path
          d="M 19 31 L 60 63 L 101 31 V 83.5 C 101 86.5 98.5 89 95.5 89 H 24.5 C 21.5 89 19 86.5 19 83.5 Z"
          fill={`url(#${uid}-env)`}
          stroke="rgba(255, 240, 244, 0.65)"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <path d="M 20 88 L 53 60 M 100 88 L 67 60" stroke="rgba(145, 58, 78, 0.35)" strokeWidth="1.4" />
        <path d="M 20 88 L 60 58 L 100 88" fill="rgba(255, 232, 238, 0.22)" />

        {/* Flap shadow */}
        <path className="dock-env-flap-shadow" d="M 21 33 L 60 66 L 99 33 Z" fill="rgba(96, 22, 42, 0.24)" />

        {/* Closed top V-flap that hinges up to horizontal and hands off to back flap */}
        <path
          className="dock-env-flap-front"
          d="M 21 31 H 99 L 60 63 Z"
          fill={`url(#${uid}-flap)`}
          stroke="rgba(255, 248, 250, 0.72)"
          strokeWidth="1"
          strokeLinejoin="round"
        />

        {/* 3D terracotta wax seal */}
        <g className="dock-wax-seal">
          <circle cx="60" cy="63.5" r="9.5" fill="#4d0d15" fillOpacity="0.4" />
          <circle cx="60" cy="61" r="9.5" fill={`url(#${uid}-wax)`} />
          <circle cx="60" cy="61" r="6.2" fill="none" stroke="rgba(255, 210, 195, 0.55)" strokeWidth="1.2" />
          <circle cx="60" cy="61" r="3.4" fill="rgba(255, 195, 180, 0.28)" />
        </g>
      </g>
    </SquircleShell>
  );
}

export const DockIconGraphic = React.memo(function DockIconGraphic({
  id,
}: {
  id: DockAppId;
  isHovered?: boolean;
  isActive?: boolean;
}) {
  switch (id) {
    case 'apps':
      return <AppsIcon />;
    case 'projects':
      return <CodeFolderIcon />;
    case 'about':
      return <ProfileIcon />;
    case 'resume':
      return <ResumeDocIcon />;
    case 'journal':
      return <FountainPenIcon />;
    case 'notes':
      return <NotebookPencilIcon />;
    case 'settings':
      return <SlidersIcon />;
    case 'contact':
      return <EnvelopeSealIcon />;
  }
});

// ============================================================================
// Embedded Dock Styles
// ============================================================================
export const DOCK_STYLES = `
:root {
  /* ============================================================
     Transitions.dev Motion Tokens
     ============================================================ */
  --duration-stagger: 40ms;
  --duration-micro: 80ms;
  --duration-quick: 150ms;
  --duration-fast: 250ms;
  --duration-medium: 350ms;
  --duration-slow: 400ms;
  --duration-very-slow: 500ms;

  --ease-smooth-out: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-in-out: ease-in-out;
  --ease-out: ease-out;
  --ease-linear: linear;
  --ease-bounce: cubic-bezier(0.34, 1.36, 0.64, 1);
  --ease-bounce-strong: cubic-bezier(0.34, 3.85, 0.64, 1);

  --distance-micro: 4px;
  --distance-small: 6px;
  --distance-base: 8px;
  --distance-medium: 12px;
  --distance-large: 30px;

  --scale-large: 0.96;
  --scale-medium: 0.97;
  --scale-small: 0.98;
  --scale-tiny: 0.99;

  --blur-small: 2px;
  --blur-medium: 3px;
  --blur-large: 8px;
}

@layer base {
  html,
  body {
    font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont,
      sans-serif;
    background-color: #12142e;
    color: #f8fafc;
    overflow-x: hidden;
  }

  code,
  pre,
  .font-mono {
    font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo,
      monospace;
  }
}

@keyframes dock-bounce {
  0% {
    transform: translate3d(0, 0, 0);
  }
  26% {
    transform: translate3d(0, -18px, 0) scaleY(1.03);
  }
  52% {
    transform: translate3d(0, 0, 0) scaleY(0.98);
  }
  74% {
    transform: translate3d(0, -7px, 0) scaleY(1.01);
  }
  100% {
    transform: translate3d(0, 0, 0) scaleY(1);
  }
}

.animate-dock-bounce {
  animation: dock-bounce var(--duration-very-slow) var(--ease-bounce);
}

@keyframes modal-pop {
  0% {
    opacity: 0;
    transform: translate3d(0, var(--distance-base), 0) scale(var(--scale-large));
  }
  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
  }
}

.animate-modal-pop {
  animation: modal-pop var(--duration-fast) var(--ease-smooth-out);
}

/* Stationary dock slot (never moves, preventing hover edge-flicker) */
.dock-slot {
  contain: layout style;
}

/* Dedicated GPU compositor layer driven directly via JS spring rAF transform */
.dock-icon-visual {
  transform-origin: center bottom;
  will-change: transform;
}

/* Tactile Button Feedback (Emil Kowalski Design Engineering) */
.dock-icon-btn {
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  transition: transform var(--duration-micro) var(--ease-out);
}

.dock-icon-btn:active {
  transform: scale(var(--scale-large));
}

button:active {
  transform: scale(var(--scale-medium));
}

/* Tooltip: Open/close asymmetry with intent delay (80ms intent filter) */
.dock-tooltip {
  opacity: 0;
  transform: translate3d(-50%, var(--distance-small), 0)
    scale(var(--scale-small));
  transition: opacity 100ms var(--ease-out),
    transform 120ms var(--ease-smooth-out);
}

.dock-item:not([data-active='true']):is(:hover, :focus-within) .dock-tooltip {
  opacity: 1;
  transform: translate3d(-50%, 0, 0) scale(1);
  transition: opacity var(--duration-quick) var(--ease-out)
      var(--duration-micro),
    transform var(--duration-fast) var(--ease-smooth-out) var(--duration-micro);
}

/* ============================================================
   Expressive, Interruptible Per-Icon Hover Animations (GPU-Only)
   Polished with transitions.dev motion tokens
   ============================================================ */

/* 1. Apps: 4 colored tiles burst outward in a staggered spring wave */
.dock-tile-tl,
.dock-tile-tr,
.dock-tile-bl,
.dock-tile-br {
  transform-box: fill-box;
  transform-origin: center;
  transition: transform var(--duration-fast) var(--ease-smooth-out) 0ms;
}
.dock-item:is(:hover, :focus-within) .dock-tile-tl {
  transform: translate3d(-6px, -6px, 0) scale(1.12) rotate(-8deg);
  transition: transform var(--duration-slow) var(--ease-smooth-out) 0ms;
}
.dock-item:is(:hover, :focus-within) .dock-tile-tr {
  transform: translate3d(6px, -6px, 0) scale(1.12) rotate(8deg);
  transition: transform var(--duration-slow) var(--ease-smooth-out)
    var(--duration-stagger);
}
.dock-item:is(:hover, :focus-within) .dock-tile-bl {
  transform: translate3d(-6px, 6px, 0) scale(1.12) rotate(8deg);
  transition: transform var(--duration-slow) var(--ease-smooth-out)
    calc(var(--duration-stagger) * 2);
}
.dock-item:is(:hover, :focus-within) .dock-tile-br {
  transform: translate3d(6px, 6px, 0) scale(1.12) rotate(-8deg);
  transition: transform var(--duration-slow) var(--ease-smooth-out)
    calc(var(--duration-stagger) * 3);
}

/* 2. Projects: terminal pops forward, </> splits wide, traffic dots hop */
.dock-code-folder,
.dock-code-card,
.dock-code-left,
.dock-code-right,
.dock-code-slash,
.dock-code-dot,
.dock-code-lines {
  transform-box: fill-box;
  transform-origin: center;
  transition: transform var(--duration-medium) var(--ease-smooth-out);
}
.dock-item:is(:hover, :focus-within) .dock-code-folder {
  transform: rotate(2.5deg) scale(0.97);
}
.dock-item:is(:hover, :focus-within) .dock-code-card {
  transform: translate3d(0, -9px, 0) rotate(-3.5deg) scale(1.09);
}
.dock-item:is(:hover, :focus-within) .dock-code-left {
  transform: translate3d(-6.5px, 0, 0) scale(1.08);
}
.dock-item:is(:hover, :focus-within) .dock-code-right {
  transform: translate3d(6.5px, 0, 0) scale(1.08);
}
.dock-item:is(:hover, :focus-within) .dock-code-slash {
  transform: rotate(18deg) scale(1.16);
}
.dock-item:is(:hover, :focus-within) .dock-code-dot-1 {
  transform: translate3d(0, -3.5px, 0) scale(1.32);
  transition-delay: 0ms;
}
.dock-item:is(:hover, :focus-within) .dock-code-dot-2 {
  transform: translate3d(0, -3.5px, 0) scale(1.32);
  transition-delay: var(--duration-stagger);
}
.dock-item:is(:hover, :focus-within) .dock-code-dot-3 {
  transform: translate3d(0, -3.5px, 0) scale(1.32);
  transition-delay: calc(var(--duration-stagger) * 2);
}
.dock-item:is(:hover, :focus-within) .dock-code-lines {
  transform: scaleX(1.14);
}

/* 3. About: head lifts & tilts playfully while bust rises */
.dock-profile-head,
.dock-profile-bust {
  transform-box: fill-box;
  transform-origin: center;
  transition: transform var(--duration-medium) var(--ease-smooth-out);
}
.dock-item:is(:hover, :focus-within) .dock-profile-head {
  transform: translate3d(0, -7.5px, 0) rotate(7deg) scale(1.11);
}
.dock-item:is(:hover, :focus-within) .dock-profile-bust {
  transform: translate3d(0, -4.5px, 0) scale(1.07);
}

/* 4. Resume: document lifts boldly + avatar pops + cascading line highlight */
.dock-resume-sheet,
.dock-resume-avatar,
.dock-resume-line {
  transform-box: fill-box;
  transition: transform var(--duration-medium) var(--ease-smooth-out),
    opacity var(--duration-fast) var(--ease-out);
}
.dock-resume-sheet,
.dock-resume-avatar {
  transform-origin: center;
}
.dock-resume-line {
  transform-origin: left center;
}
.dock-item:is(:hover, :focus-within) .dock-resume-sheet {
  transform: translate3d(0, -8px, 0) rotate(5deg) scale(1.07);
}
.dock-item:is(:hover, :focus-within) .dock-resume-avatar {
  transform: scale(1.16) rotate(-6deg);
}
.dock-item:is(:hover, :focus-within) .dock-resume-line-1 {
  transform: translate3d(var(--distance-micro), 0, 0) scaleX(1.07);
  opacity: 1;
  transition-delay: 0ms;
}
.dock-item:is(:hover, :focus-within) .dock-resume-line-2 {
  transform: translate3d(var(--distance-micro), 0, 0) scaleX(1.07);
  opacity: 1;
  transition-delay: var(--duration-stagger);
}
.dock-item:is(:hover, :focus-within) .dock-resume-line-3 {
  transform: translate3d(var(--distance-micro), 0, 0) scaleX(1.07);
  opacity: 1;
  transition-delay: calc(var(--duration-stagger) * 2);
}
.dock-item:is(:hover, :focus-within) .dock-resume-line-4 {
  transform: translate3d(var(--distance-micro), 0, 0) scaleX(1.07);
  opacity: 1;
  transition-delay: calc(var(--duration-stagger) * 3);
}

/* 5. Journal: Real-time calligraphic writing animation across curve */
.dock-pen-nib {
  transform-box: fill-box;
  transform-origin: 20% 80%;
  transition: transform var(--duration-slow) var(--ease-smooth-out);
}

.dock-ink-group {
  transform-box: fill-box;
  transform-origin: left center;
}

.dock-ink-ambient,
.dock-ink-stroke,
.dock-ink-sheen {
  stroke-dasharray: 100;
  stroke-dashoffset: 0;
  transition: stroke-dashoffset var(--duration-medium) var(--ease-smooth-out);
}

.dock-nib-flare {
  opacity: 0;
  transform-box: fill-box;
  transform-origin: center;
  transition: opacity var(--duration-fast) var(--ease-out);
}

@keyframes dock-pen-write {
  0% {
    transform: translate3d(0, 0, 0) rotate(0deg);
  }
  32% {
    transform: translate3d(27px, -11px, 0) rotate(-6deg);
  }
  62% {
    transform: translate3d(44px, 4px, 0) rotate(7deg);
  }
  86% {
    transform: translate3d(65px, -7px, 0) rotate(-2deg);
  }
  100% {
    transform: translate3d(68px, -14px, 0) rotate(6deg) scale(1.05);
  }
}

@keyframes dock-ink-draw {
  0% {
    stroke-dashoffset: 100;
  }
  32% {
    stroke-dashoffset: 58;
  }
  62% {
    stroke-dashoffset: 28;
  }
  86% {
    stroke-dashoffset: 0;
  }
  100% {
    stroke-dashoffset: 0;
  }
}

@keyframes dock-flare-glow {
  0% {
    opacity: 0;
    transform: scale(0.5);
  }
  15% {
    opacity: 0.95;
    transform: scale(1.3);
  }
  85% {
    opacity: 0.95;
    transform: scale(1.2);
  }
  100% {
    opacity: 0;
    transform: scale(0.3);
  }
}

.dock-item:is(:hover, :focus-within) .dock-pen-nib {
  animation: dock-pen-write 720ms var(--ease-smooth-out) forwards;
}

.dock-item:is(:hover, :focus-within) .dock-ink-ambient,
.dock-item:is(:hover, :focus-within) .dock-ink-stroke,
.dock-item:is(:hover, :focus-within) .dock-ink-sheen {
  animation: dock-ink-draw 720ms var(--ease-smooth-out) forwards;
}

.dock-item:is(:hover, :focus-within) .dock-nib-flare {
  animation: dock-flare-glow 720ms var(--ease-smooth-out) forwards;
}

/* 6. Notes: wooden pencil actively sketches notes & checkmark with cascade ring ripple */
.dock-pencil {
  transform-box: fill-box;
  transform-origin: 30% 70%;
  transition: transform var(--duration-medium) var(--ease-smooth-out);
}

.dock-notebook-paper {
  transform-box: fill-box;
}

.dock-pencil-stroke,
.dock-pencil-check {
  stroke-dasharray: 100;
  stroke-dashoffset: 0;
  transition: stroke-dashoffset var(--duration-fast) var(--ease-smooth-out);
}

.dock-notebook-ring {
  transform-box: fill-box;
  transform-origin: center;
  transition: transform var(--duration-fast) var(--ease-smooth-out);
}

@keyframes dock-pencil-sketch {
  0% {
    transform: translate3d(0, 0, 0) rotate(0deg);
  }
  24% {
    /* Glide to first line & start sketching */
    transform: translate3d(-18px, -18px, 0) rotate(-8deg) scale(0.96);
  }
  48% {
    /* Draw across note line */
    transform: translate3d(10px, -18px, 0) rotate(3deg) scale(0.98);
  }
  70% {
    /* Move down to checkmark */
    transform: translate3d(-14px, -2px, 0) rotate(-5deg) scale(0.95);
  }
  84% {
    /* Tap checkmark flourish */
    transform: translate3d(2px, -8px, 0) rotate(6deg) scale(1.02);
  }
  100% {
    /* Energetic lift & celebrate */
    transform: translate3d(8px, -14px, 0) rotate(14deg) scale(1.14);
  }
}

@keyframes dock-graphite-draw {
  0% {
    stroke-dashoffset: 100;
  }
  48% {
    stroke-dashoffset: 0;
  }
  100% {
    stroke-dashoffset: 0;
  }
}

@keyframes dock-check-draw {
  0% {
    stroke-dashoffset: 100;
  }
  50% {
    stroke-dashoffset: 100;
  }
  84% {
    stroke-dashoffset: 0;
  }
  100% {
    stroke-dashoffset: 0;
  }
}

.dock-item:is(:hover, :focus-within) .dock-pencil {
  animation: dock-pencil-sketch 720ms var(--ease-smooth-out) forwards;
}

.dock-item:is(:hover, :focus-within) .dock-pencil-stroke {
  animation: dock-graphite-draw 720ms var(--ease-smooth-out) forwards;
}

.dock-item:is(:hover, :focus-within) .dock-pencil-check {
  animation: dock-check-draw 720ms var(--ease-smooth-out) forwards;
}

.dock-item:is(:hover, :focus-within) .dock-notebook-ring-1 {
  transform: translate3d(-3px, 0, 0) scale(1.08);
  transition-delay: 0ms;
}
.dock-item:is(:hover, :focus-within) .dock-notebook-ring-2 {
  transform: translate3d(-3px, 0, 0) scale(1.08);
  transition-delay: var(--duration-stagger);
}
.dock-item:is(:hover, :focus-within) .dock-notebook-ring-3 {
  transform: translate3d(-3px, 0, 0) scale(1.08);
  transition-delay: calc(var(--duration-stagger) * 2);
}
.dock-item:is(:hover, :focus-within) .dock-notebook-ring-4 {
  transform: translate3d(-3px, 0, 0) scale(1.08);
  transition-delay: calc(var(--duration-stagger) * 3);
}
.dock-item:is(:hover, :focus-within) .dock-notebook-ring-5 {
  transform: translate3d(-3px, 0, 0) scale(1.08);
  transition-delay: calc(var(--duration-stagger) * 4);
}

/* 7. Settings: brushed metal knobs roll across full track with spring overshoot */
.dock-knob-top,
.dock-knob-bot,
.dock-knob-top-spin,
.dock-knob-bot-spin,
.dock-track-fill-top,
.dock-track-fill-bot {
  transform-box: fill-box;
  transition: transform var(--duration-medium) var(--ease-smooth-out);
}
.dock-knob-top-spin,
.dock-knob-bot-spin {
  transform-origin: center;
}
.dock-track-fill-top {
  transform-origin: left center;
}
.dock-track-fill-bot {
  transform-origin: right center;
}
.dock-item:is(:hover, :focus-within) .dock-knob-top {
  transform: translate3d(26px, 0, 0);
}
.dock-item:is(:hover, :focus-within) .dock-knob-top-spin {
  transform: rotate(180deg);
}
.dock-item:is(:hover, :focus-within) .dock-track-fill-top {
  transform: scaleX(2.08);
}
.dock-item:is(:hover, :focus-within) .dock-knob-bot {
  transform: translate3d(-26px, 0, 0);
}
.dock-item:is(:hover, :focus-within) .dock-knob-bot-spin {
  transform: rotate(-180deg);
}
.dock-item:is(:hover, :focus-within) .dock-track-fill-bot {
  transform: scaleX(2.24);
}

/* 8. Contact: wax seal pops away, flap unfolds cleanly behind, letter rises high */
.dock-envelope {
  transform-box: fill-box;
  transform-origin: center;
  transition: transform var(--duration-medium) var(--ease-smooth-out);
}
.dock-env-flap-front {
  transform-box: fill-box;
  transform-origin: center top;
  opacity: 1;
  transition: transform var(--duration-quick) var(--ease-smooth-out)
      var(--duration-micro),
    opacity var(--duration-quick) var(--ease-out) var(--duration-micro);
}
.dock-env-flap-shadow {
  transition: opacity var(--duration-quick) var(--ease-out)
    var(--duration-micro);
}
.dock-env-flap-back {
  transform-box: fill-box;
  transform-origin: center top;
  transform: scaleY(0);
  opacity: 0;
  transition: transform var(--duration-quick) var(--ease-smooth-out),
    opacity 100ms var(--ease-out);
}
.dock-env-letter {
  transform-box: fill-box;
  transform-origin: center bottom;
  transition: transform var(--duration-fast) var(--ease-smooth-out);
}
.dock-wax-seal {
  transform-box: fill-box;
  transform-origin: center;
  transition: transform var(--duration-fast) var(--ease-bounce)
      var(--duration-micro),
    opacity var(--duration-quick) var(--ease-out) var(--duration-micro);
}

.dock-item:is(:hover, :focus-within) .dock-envelope {
  transform: translate3d(0, -3px, 0) scale(1.03);
}
.dock-item:is(:hover, :focus-within) .dock-env-flap-front {
  transform: scaleY(0);
  opacity: 0;
  transition: transform var(--duration-quick) var(--ease-smooth-out),
    opacity var(--duration-micro) var(--ease-out) var(--duration-micro);
}
.dock-item:is(:hover, :focus-within) .dock-env-flap-shadow {
  opacity: 0;
  transition: opacity var(--duration-quick) var(--ease-out);
}
.dock-item:is(:hover, :focus-within) .dock-env-flap-back {
  transform: scaleY(-0.82);
  opacity: 1;
  transition: transform var(--duration-fast) var(--ease-smooth-out)
      var(--duration-micro),
    opacity var(--duration-micro) var(--ease-out) var(--duration-micro);
}
.dock-item:is(:hover, :focus-within) .dock-env-letter {
  transform: translate3d(0, -18px, 0) rotate(-1.5deg) scale(1.03);
  transition: transform var(--duration-medium) var(--ease-smooth-out)
    var(--duration-micro);
}
.dock-item:is(:hover, :focus-within) .dock-wax-seal {
  transform: translate3d(0, -30px, 0) scale(0.45);
  opacity: 0;
  transition: transform var(--duration-fast) var(--ease-bounce),
    opacity var(--duration-quick) var(--ease-out);
}

@media (prefers-reduced-motion: reduce) {
  .animate-dock-bounce {
    animation: none !important;
  }
  .dock-icon-visual,
  .dock-tooltip,
  .dock-item * {
    animation: none !important;
    transition-duration: 0.01ms !important;
  }
}

`;

export function DockStyleTag() {
  return <style dangerouslySetInnerHTML={{ __html: DOCK_STYLES }} />;
}

// ============================================================================
// GlassDock Component
// ============================================================================
export interface GlassDockProps {
  items?: DockAppItem[];
  settings?: Partial<DockSettings>;
  activeAppId?: DockAppId | null;
  runningApps?: Set<DockAppId>;
  onSelectApp?: (id: DockAppId) => void;
  className?: string;
  showTooltips?: boolean;
  showReflections?: boolean;
  autoDemo?: boolean;
}

const StaticShelfReflections = React.memo(function StaticShelfReflections({
  items,
  baseSize,
  gap,
  unscaledRowWidth,
  reflectionStartTop,
  reflectionOpacity,
}: {
  items: DockAppItem[];
  baseSize: number;
  gap: number;
  unscaledRowWidth: number;
  reflectionStartTop: number;
  reflectionOpacity: number;
}) {
  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 flex items-start pointer-events-none"
      style={{
        top: `${reflectionStartTop}px`,
        width: `${unscaledRowWidth}px`,
        gap: `${gap}px`,
        opacity: reflectionOpacity,
        filter: 'blur(1.2px) saturate(1.15)',
        transform: 'translateZ(0)',
        contain: 'layout style',
        maskImage:
          'linear-gradient(to bottom, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.45) 50%, transparent 100%)',
        WebkitMaskImage:
          'linear-gradient(to bottom, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.45) 50%, transparent 100%)',
      }}
    >
      {items.map((app) => (
        <div
          key={app.id}
          className="shrink-0"
          style={{
            width: `${baseSize}px`,
            height: `${baseSize}px`,
            transformOrigin: 'center top',
            transform: 'scale(1, -0.52)',
          }}
        >
          {app.icon ? (
            <div className="w-full h-full flex items-center justify-center rounded-[22%] bg-white/10 text-white overflow-hidden">
              {app.icon}
            </div>
          ) : (
            <DockIconGraphic id={app.id} />
          )}
        </div>
      ))}
    </div>
  );
});

function computeDockLayoutMetrics(viewportWidth: number): { baseSize: number; gap: number } {
  if (viewportWidth >= 900) {
    return { baseSize: 84, gap: 13 };
  }
  if (viewportWidth >= 640) {
    return { baseSize: 64, gap: 10 };
  }
  const available = Math.max(280, viewportWidth - 44);
  const computedSize = Math.floor(available / 9.4);
  const computedGap = Math.max(4, Math.floor(computedSize * 0.14));
  return {
    baseSize: Math.max(32, Math.min(54, computedSize)),
    gap: computedGap,
  };
}

export function GlassDock({
  items = DOCK_APPS,
  settings,
  activeAppId = null,
  runningApps,
  onSelectApp,
  className = '',
  showTooltips = true,
  showReflections = true,
  autoDemo = false,
}: GlassDockProps) {
  const resolvedSettings = useMemo(() => clampDockSettings(settings ?? {}), [settings]);
  const appCount = items.length;
  const rowRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<Array<HTMLDivElement | null>>([]);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const visualRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const animRafRef = useRef<number>(0);
  const bounceRafRef = useRef<number>(0);
  const bounceTimerRef = useRef<number | null>(null);

  // Cached layout measurements & media preference (invalidated only on resize/enter/change)
  const rowRectRef = useRef<{ left: number; width: number } | null>(null);
  const reduceMotionRef = useRef<boolean>(false);
  // Latest pointer X buffered between vsync frames (processed at most once per rAF)
  const pendingClientXRef = useRef<number | null>(null);
  const pointerActiveRef = useRef<boolean>(false);
  const userInteractedRef = useRef<boolean>(false);
  const autoDemoStartTimeRef = useRef<number>(0);

  // Pre-allocated spring & target buffers (zero GC churn per frame)
  const currentScalesRef = useRef<number[]>([]);
  const scaleVelsRef = useRef<number[]>([]);
  const targetScalesRef = useRef<number[]>([]);

  const currentLiftsRef = useRef<number[]>([]);
  const liftVelsRef = useRef<number[]>([]);
  const targetLiftsRef = useRef<number[]>([]);

  const targetZIndicesRef = useRef<number[]>([]);
  const lastZIndicesRef = useRef<number[]>([]);
  const lastFrameTimeRef = useRef<number>(0);

  if (currentScalesRef.current.length !== appCount) {
    currentScalesRef.current = new Array(appCount).fill(1);
    scaleVelsRef.current = new Array(appCount).fill(0);
    targetScalesRef.current = new Array(appCount).fill(1);
    currentLiftsRef.current = new Array(appCount).fill(0);
    liftVelsRef.current = new Array(appCount).fill(0);
    targetLiftsRef.current = new Array(appCount).fill(0);
    targetZIndicesRef.current = new Array(appCount).fill(3);
    lastZIndicesRef.current = new Array(appCount).fill(3);
  }

  const [{ baseSize, gap }, setDockMetrics] = useState<{ baseSize: number; gap: number }>(() =>
    computeDockLayoutMetrics(typeof window !== 'undefined' ? window.innerWidth : 1440)
  );

  const measureRowRect = useCallback(() => {
    const rowEl = rowRef.current;
    if (!rowEl) return null;
    const rect = rowEl.getBoundingClientRect();
    rowRectRef.current = { left: rect.left, width: rect.width };
    return rowRectRef.current;
  }, []);

  useEffect(() => {
    const handleResize = () => {
      rowRectRef.current = null;
      const next = computeDockLayoutMetrics(window.innerWidth);
      setDockMetrics((prev) =>
        prev.baseSize === next.baseSize && prev.gap === next.gap ? prev : next
      );
    };
    window.addEventListener('resize', handleResize);

    const rowEl = rowRef.current;
    let resizeObserver: ResizeObserver | null = null;
    if (rowEl && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        rowRectRef.current = null;
      });
      resizeObserver.observe(rowEl);
    }

    const mq =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;
    if (mq) {
      reduceMotionRef.current = mq.matches;
      const handleMotionChange = (e: MediaQueryListEvent) => {
        reduceMotionRef.current = e.matches;
      };
      mq.addEventListener('change', handleMotionChange);
      return () => {
        window.removeEventListener('resize', handleResize);
        resizeObserver?.disconnect();
        mq.removeEventListener('change', handleMotionChange);
      };
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver?.disconnect();
    };
  }, []);

  const unscaledRowWidth = appCount * baseSize + (appCount - 1) * gap;

  const effectiveSettings = useMemo<DockSettings>(() => {
    const ratio = baseSize / 84;
    return {
      ...resolvedSettings,
      influenceRadius: resolvedSettings.influenceRadius * Math.max(0.55, ratio),
      maxLift: resolvedSettings.maxLift * Math.max(0.5, ratio),
    };
  }, [resolvedSettings, baseSize]);

  // Keep latest geometry & settings in refs so rAF callback stays stable without re-binding
  const geometryRef = useRef({ baseSize, gap, effectiveSettings, appCount });
  geometryRef.current = { baseSize, gap, effectiveSettings, appCount };

  const applyTargets = useCallback((relativePointerX: number | null) => {
    const { baseSize: bSize, gap: g, effectiveSettings: cfg, appCount: count } = geometryRef.current;
    writeDockIconTargets({
      count,
      baseSize: bSize,
      gap: g,
      pointerX: relativePointerX,
      settings: cfg,
      outScales: targetScalesRef.current,
      outLifts: targetLiftsRef.current,
      outZIndices: targetZIndicesRef.current,
    });

    // Only touch slot z-index DOM style when integer z-index actually changes
    for (let i = 0; i < count; i++) {
      const nextZ = targetZIndicesRef.current[i];
      if (lastZIndicesRef.current[i] !== nextZ) {
        lastZIndicesRef.current[i] = nextZ;
        const slot = slotRefs.current[i];
        if (slot) {
          slot.style.zIndex = String(nextZ);
        }
      }
    }
  }, []);

  const stepAnimation = useCallback(
    (now: number) => {
      // Throttle pointer processing to once per animation frame
      if (pointerActiveRef.current && pendingClientXRef.current !== null) {
        const rect = rowRectRef.current ?? measureRowRect();
        if (rect) {
          applyTargets(pendingClientXRef.current - rect.left);
        }
        pendingClientXRef.current = null;
      } else if (autoDemo && !pointerActiveRef.current && !userInteractedRef.current && !reduceMotionRef.current) {
        const { appCount: count, baseSize: bSize, gap: g } = geometryRef.current;
        const totalRowWidth = count * bSize + (count - 1) * g;
        if (!autoDemoStartTimeRef.current) {
          autoDemoStartTimeRef.current = now;
        }
        const elapsed = (now - autoDemoStartTimeRef.current) / 1000;
        const progress = (Math.sin(elapsed * 1.85 - Math.PI / 2) + 1) * 0.5;
        const sweepX = (0.12 + 0.76 * progress) * totalRowWidth;
        applyTargets(sweepX);
      }

      const prevTime = lastFrameTimeRef.current || now - 16.667;
      const dt = (now - prevTime) / 1000;
      lastFrameTimeRef.current = now;

      let needsNextFrame = false;
      const { appCount: count } = geometryRef.current;

      for (let i = 0; i < count; i++) {
        const targetScale = targetScalesRef.current[i];
        const targetLift = targetLiftsRef.current[i];

        const prevScale = currentScalesRef.current[i];
        const prevLift = currentLiftsRef.current[i];

        const scaleStep = stepSpring(
          prevScale,
          scaleVelsRef.current[i],
          targetScale,
          dt,
          { stiffness: 460, damping: 36, valueThreshold: 0.0005, velocityThreshold: 0.002 }
        );
        const liftStep = stepSpring(
          prevLift,
          liftVelsRef.current[i],
          targetLift,
          dt,
          { stiffness: 460, damping: 36, valueThreshold: 0.02, velocityThreshold: 0.08 }
        );

        currentScalesRef.current[i] = scaleStep.value;
        scaleVelsRef.current[i] = scaleStep.velocity;
        currentLiftsRef.current[i] = liftStep.value;
        liftVelsRef.current[i] = liftStep.velocity;

        if (!scaleStep.settled || !liftStep.settled) {
          needsNextFrame = true;
        }

        // Write transform directly to DOM node via ref (zero React re-renders)
        if (
          scaleStep.value !== prevScale ||
          liftStep.value !== prevLift ||
          !scaleStep.settled ||
          !liftStep.settled
        ) {
          const visualEl = visualRefs.current[i];
          if (visualEl) {
            visualEl.style.transform = `translate3d(0, ${liftStep.value.toFixed(2)}px, 0) scale(${scaleStep.value.toFixed(4)})`;
          }
        }
      }

      if (autoDemo && !pointerActiveRef.current && !userInteractedRef.current && !reduceMotionRef.current) {
        needsNextFrame = true;
      }

      if (needsNextFrame) {
        animRafRef.current = requestAnimationFrame(stepAnimation);
      } else {
        animRafRef.current = 0;
        lastFrameTimeRef.current = 0;
      }
    },
    [applyTargets, measureRowRect]
  );

  const ensureAnimationLoop = useCallback(() => {
    const { appCount: count } = geometryRef.current;
    if (reduceMotionRef.current) {
      if (pointerActiveRef.current && pendingClientXRef.current !== null) {
        const rect = rowRectRef.current ?? measureRowRect();
        if (rect) {
          applyTargets(pendingClientXRef.current - rect.left);
        }
        pendingClientXRef.current = null;
      }
      for (let i = 0; i < count; i++) {
        currentScalesRef.current[i] = targetScalesRef.current[i];
        currentLiftsRef.current[i] = targetLiftsRef.current[i];
        scaleVelsRef.current[i] = 0;
        liftVelsRef.current[i] = 0;
        const visualEl = visualRefs.current[i];
        if (visualEl) {
          visualEl.style.transform = `translate3d(0, ${targetLiftsRef.current[i].toFixed(2)}px, 0) scale(${targetScalesRef.current[i].toFixed(4)})`;
        }
      }
      return;
    }

    if (!animRafRef.current) {
      lastFrameTimeRef.current = 0;
      animRafRef.current = requestAnimationFrame(stepAnimation);
    }
  }, [applyTargets, measureRowRect, stepAnimation]);

  useEffect(() => {
    if (autoDemo && !reduceMotionRef.current) {
      ensureAnimationLoop();
    }
  }, [autoDemo, ensureAnimationLoop]);

  const resetDock = useCallback(() => {
    pointerActiveRef.current = false;
    pendingClientXRef.current = null;
    applyTargets(null);
    ensureAnimationLoop();
  }, [applyTargets, ensureAnimationLoop]);

  useEffect(() => {
    window.addEventListener('blur', resetDock);
    return () => {
      window.removeEventListener('blur', resetDock);
      if (animRafRef.current) cancelAnimationFrame(animRafRef.current);
      if (bounceRafRef.current) cancelAnimationFrame(bounceRafRef.current);
      if (bounceTimerRef.current) window.clearTimeout(bounceTimerRef.current);
    };
  }, [resetDock]);

  const handlePointerEnter = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      userInteractedRef.current = true;
      measureRowRect();
      pointerActiveRef.current = true;
      pendingClientXRef.current = e.clientX;
      ensureAnimationLoop();
    },
    [measureRowRect, ensureAnimationLoop]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      userInteractedRef.current = true;
      pointerActiveRef.current = true;
      pendingClientXRef.current = e.clientX;
      ensureAnimationLoop();
    },
    [ensureAnimationLoop]
  );

  const handleIconFocus = useCallback(
    (index: number) => {
      userInteractedRef.current = true;
      pointerActiveRef.current = false;
      pendingClientXRef.current = null;
      const center = index * (baseSize + gap) + baseSize / 2;
      applyTargets(center);
      ensureAnimationLoop();
    },
    [baseSize, gap, applyTargets, ensureAnimationLoop]
  );

  const handleIconClick = useCallback(
    (app: DockAppItem, index: number) => {
      userInteractedRef.current = true;
      if (resolvedSettings.enableBounce && !reduceMotionRef.current) {
        if (bounceRafRef.current) {
          cancelAnimationFrame(bounceRafRef.current);
        }
        if (bounceTimerRef.current) {
          window.clearTimeout(bounceTimerRef.current);
        }
        const { appCount: count } = geometryRef.current;
        for (let i = 0; i < count; i++) {
          buttonRefs.current[i]?.classList.remove('animate-dock-bounce');
        }
        bounceRafRef.current = requestAnimationFrame(() => {
          bounceRafRef.current = 0;
          const btn = buttonRefs.current[index];
          if (btn) {
            btn.classList.add('animate-dock-bounce');
            bounceTimerRef.current = window.setTimeout(() => {
              btn.classList.remove('animate-dock-bounce');
              bounceTimerRef.current = null;
            }, 580);
          }
        });
      }
      if (app.href && !app.onClick) {
        window.open(app.href, '_blank', 'noopener,noreferrer');
      }
      app.onClick?.();
      onSelectApp?.(app.id);
    },
    [resolvedSettings.enableBounce, onSelectApp]
  );

  // Fixed shelf dimensions (clean liquid glass base, never grows or blurs background)
  const shelfPadX = Math.round(baseSize * 0.36);
  const shelfTotalWidth = unscaledRowWidth + shelfPadX * 2;
  const shelfHeight = Math.round(baseSize * 0.58);
  const shelfThickness = Math.round(baseSize * 0.29);
  const shelfFrontDeck = Math.round(baseSize * 0.17);
  const shelfRadius = Math.round(shelfHeight * 0.48);
  const iconsBottomOffset = shelfThickness + shelfFrontDeck;
  const reflectionStartTop = shelfHeight - shelfFrontDeck;

  return (
    <nav
      aria-label="Application Dock"
      className={`relative flex flex-col items-center justify-center select-none ${className}`}
      data-testid="glass-dock"
      onPointerEnter={handlePointerEnter}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetDock}
    >
      <div
        className="relative flex flex-col items-center"
        style={{
          paddingTop: `${Math.round(baseSize * 0.72)}px`,
          paddingBottom: `${iconsBottomOffset + 4}px`,
        }}
      >
        {/* Fixed Clean 3D Liquid Glass Shelf (isolated GPU layer, never resizes) */}
        <div
          aria-hidden="true"
          data-testid="glass-shelf"
          className="pointer-events-none absolute left-1/2 -translate-x-1/2"
          style={{
            width: `${shelfTotalWidth}px`,
            height: `${shelfHeight + shelfThickness}px`,
            bottom: '4px',
            contain: 'layout style',
            transform: 'translateZ(0)',
          }}
        >
          {/* Clean 3D Extruded Glass Slab */}
          <div
            className="absolute inset-x-0 bottom-0 overflow-hidden"
            style={{
              height: `${shelfHeight + shelfThickness}px`,
              borderRadius: `${shelfRadius}px`,
              background:
                'linear-gradient(180deg, rgba(255, 255, 255, 0.42) 0%, rgba(210, 225, 248, 0.30) 48%, rgba(145, 168, 208, 0.32) 84%, rgba(255, 255, 255, 0.58) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.55)',
              boxShadow:
                '0 18px 34px -8px rgba(34, 42, 82, 0.42), 0 4px 12px rgba(34, 42, 82, 0.18), inset 0 -1.5px 2px rgba(255, 255, 255, 0.75), inset 0 1px 1px rgba(255, 255, 255, 0.55)',
            }}
          >
            {/* Static memoized reflections inside the fixed glass slab */}
            {showReflections && resolvedSettings.reflectionOpacity > 0 && (
              <StaticShelfReflections
                items={items}
                baseSize={baseSize}
                gap={gap}
                unscaledRowWidth={unscaledRowWidth}
                reflectionStartTop={reflectionStartTop}
                reflectionOpacity={resolvedSettings.reflectionOpacity}
              />
            )}

            {/* Curved glass end-cap specular pillars */}
            <div
              className="absolute inset-y-0 left-0 w-10"
              style={{
                background:
                  'linear-gradient(90deg, rgba(255,255,255,0.52) 0%, rgba(240,248,255,0.24) 28%, rgba(255,255,255,0.05) 68%, transparent 100%)',
              }}
            />
            <div
              className="absolute inset-y-0 right-0 w-10"
              style={{
                background:
                  'linear-gradient(270deg, rgba(255,255,255,0.52) 0%, rgba(240,248,255,0.24) 28%, rgba(255,255,255,0.05) 68%, transparent 100%)',
              }}
            />
          </div>

          {/* Upper Receding Glass Deck Rim */}
          <div
            className="absolute inset-x-0 top-0"
            style={{
              height: `${shelfHeight}px`,
              borderRadius: `${shelfRadius}px`,
              background:
                'linear-gradient(180deg, rgba(255, 255, 255, 0.28) 0%, rgba(235, 244, 255, 0.08) 55%, rgba(255, 255, 255, 0.24) 100%)',
              borderTop: '1.3px solid rgba(255, 255, 255, 0.85)',
              borderLeft: '1.2px solid rgba(255, 255, 255, 0.68)',
              borderRight: '1.2px solid rgba(255, 255, 255, 0.68)',
              borderBottom: '1.5px solid rgba(255, 255, 255, 0.88)',
              boxShadow: 'inset 0 1px 5px rgba(255, 255, 255, 0.32)',
            }}
          />

          {/* Crisp front specular lip highlight */}
          <div
            className="absolute inset-x-3"
            style={{
              top: `${shelfHeight - 1}px`,
              height: '1.5px',
              borderRadius: '999px',
              background:
                'linear-gradient(90deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.85) 12%, rgba(255,255,255,0.95) 50%, rgba(255,255,255,0.85) 88%, rgba(255,255,255,0.12) 100%)',
            }}
          />
        </div>

        {/* Interactive Icons Row */}
        <div
          ref={rowRef}
          className="relative z-10 flex items-end"
          style={{
            width: `${unscaledRowWidth}px`,
            gap: `${gap}px`,
          }}
        >
          {items.map((app, index) => {
            const isActive = activeAppId === app.id;
            const isRunning = runningApps ? runningApps.has(app.id) : false;

            return (
              /* Stationary hit-slot: never moves/scales, eliminating hover edge-flicker */
              <div
                key={app.id}
                ref={(el) => {
                  slotRefs.current[index] = el;
                }}
                data-active={isActive ? 'true' : 'false'}
                className="dock-item dock-slot relative shrink-0 flex flex-col items-center"
                style={{
                  width: `${baseSize}px`,
                  height: `${baseSize}px`,
                  zIndex: 3,
                }}
              >
                {/* Clean Tooltip anchored above magnified icon (1:1 crisp text) */}
                {showTooltips && (
                  <div
                    role="tooltip"
                    className="dock-tooltip pointer-events-none absolute left-1/2 whitespace-nowrap rounded-lg px-2.5 py-1 text-[11px] font-medium tracking-wide text-white/95 shadow-lg"
                    style={{
                      bottom: `${Math.round(baseSize * Math.max(1.22, resolvedSettings.magnification) + 18)}px`,
                      background: 'rgba(18, 20, 46, 0.94)',
                      border: '1px solid rgba(255, 255, 255, 0.18)',
                      boxShadow: '0 8px 20px rgba(0, 0, 0, 0.42)',
                    }}
                  >
                    {app.label}
                    <span
                      aria-hidden="true"
                      className="absolute left-1/2 -bottom-1 -translate-x-1/2 h-2 w-2 rotate-45"
                      style={{
                        background: 'rgba(18, 20, 46, 0.94)',
                        borderRight: '1px solid rgba(255, 255, 255, 0.18)',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.18)',
                      }}
                    />
                  </div>
                )}

                {/* Clickable Icon Button covering stationary slot + magnified visual */}
                <button
                  ref={(el) => {
                    buttonRefs.current[index] = el;
                  }}
                  type="button"
                  aria-label={app.label}
                  aria-pressed={isActive}
                  data-testid={`dock-icon-${app.id}`}
                  onFocus={() => handleIconFocus(index)}
                  onBlur={resetDock}
                  onClick={() => handleIconClick(app, index)}
                  className="dock-icon-btn relative w-full h-full rounded-[22%] focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-200/90 focus-visible:ring-offset-2 focus-visible:ring-offset-[#12142e] cursor-pointer"
                >
                  {/* Compositor-only transform wrapper driven directly by spring rAF loop */}
                  <span
                    ref={(el) => {
                      visualRefs.current[index] = el;
                    }}
                    className="dock-icon-visual relative block w-full h-full"
                  >
                    {app.icon ? (
                      <div className="w-full h-full flex items-center justify-center rounded-[22%] bg-white/10 backdrop-blur-sm border border-white/20 text-white shadow-md overflow-hidden">
                        {app.icon}
                      </div>
                    ) : (
                      <DockIconGraphic id={app.id} />
                    )}
                  </span>
                </button>

                {/* Active / Running Indicator Dot */}
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-full transition-all duration-200 ${
                    isRunning ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
                  }`}
                  style={{
                    bottom: `-${Math.round(baseSize * 0.11)}px`,
                    width: isActive ? '6px' : '4.5px',
                    height: isActive ? '6px' : '4.5px',
                    backgroundColor: isActive ? '#242b52' : 'rgba(36, 43, 82, 0.65)',
                    boxShadow: isActive ? '0 0 6px rgba(255,255,255,0.9)' : 'none',
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

export default GlassDock;
