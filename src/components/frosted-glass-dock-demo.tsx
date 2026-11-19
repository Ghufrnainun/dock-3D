import React, { useState } from 'react';
import GlassDock, { DockStyleTag, type DockAppId } from './frosted-glass-dock';

export default function FrostedGlassDockDemo() {
  const [activeAppId, setActiveAppId] = useState<DockAppId | null>(null);
  const [runningApps, setRunningApps] = useState<Set<DockAppId>>(() => new Set(['apps', 'projects']));

  return (
    <div
      onClick={() => setActiveAppId(null)}
      className="relative w-full aspect-[16/9] min-h-[520px] max-h-[720px] flex flex-col items-center justify-between py-6 px-4 overflow-hidden rounded-2xl select-none shadow-2xl"
      style={{
        backgroundColor: '#7B7DCE',
        backgroundImage: `
          radial-gradient(110% 42% at 50% 0%, rgba(111, 146, 225, 0.55) 0%, transparent 70%),
          radial-gradient(110% 36% at 50% 100%, rgba(217, 122, 162, 0.45) 0%, transparent 72%),
          linear-gradient(180deg, #6F92E1 0%, #7481CB 13%, #7B7DCE 28%, #B0BBEF 48%, #B2D9D4 67%, #C0C9C5 82%, #D97AA2 100%)
        `,
      }}
    >
      <DockStyleTag />

      {/* Top subtle frosted pill */}
      <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/25 text-white/90 text-xs font-medium tracking-wide shadow-sm pointer-events-none">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span>3D Frosted Glass Dock</span>
        <span className="text-white/40">•</span>
        <span className="text-white/70">60 FPS Spring Physics</span>
      </div>

      {/* Center 3D Dock with Live Wave Motion */}
      <div
        className="w-full flex justify-center pb-2"
        onClick={(e) => e.stopPropagation()}
      >
        <GlassDock
          autoDemo={true}
          activeAppId={activeAppId}
          runningApps={runningApps}
          onSelectApp={(id) => {
            setRunningApps((prev) => new Set(prev).add(id as DockAppId));
            setActiveAppId((prev) => (prev === id ? null : (id as DockAppId)));
          }}
        />
      </div>

      {/* Bottom spacer for 16:9 vertical balance */}
      <div className="h-2 pointer-events-none" />
    </div>
  );
}
