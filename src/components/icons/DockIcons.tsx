import React, { useId } from 'react';
import type { DockAppId } from '../../data/dockApps';

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
