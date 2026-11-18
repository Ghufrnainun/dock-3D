import React, { useState } from 'react';
import GlassDock, { DockStyleTag, type DockAppId } from './frosted-glass-dock';

export default function FrostedGlassDockDemo() {
  const [activeAppId, setActiveAppId] = useState<DockAppId | null>(null);
  const [runningApps, setRunningApps] = useState<Set<DockAppId>>(() => new Set(['apps', 'projects']));

  return (
    <div
      onClick={() => setActiveAppId(null)}
      className="relative min-h-[460px] w-full flex flex-col items-center justify-end pb-8 px-4 overflow-hidden rounded-2xl select-none"
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
      <div onClick={(e) => e.stopPropagation()}>
        <GlassDock
          activeAppId={activeAppId}
          runningApps={runningApps}
          onSelectApp={(id) => {
            setRunningApps((prev) => new Set(prev).add(id as DockAppId));
            setActiveAppId((prev) => (prev === id ? null : (id as DockAppId)));
          }}
        />
      </div>
    </div>
  );
}
