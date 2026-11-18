import { useCallback, useEffect, useState } from 'react';
import { AppPreviewModal } from './components/AppPreviewModal';
import { GlassDock } from './components/GlassDock';
import { DOCK_APPS, type DockAppId } from './data/dockApps';
import {
  clampDockSettings,
  DEFAULT_DOCK_SETTINGS,
  type DockSettings,
} from './utils/dockPhysics';

export default function App() {
  const [settings, setSettings] = useState<DockSettings>(DEFAULT_DOCK_SETTINGS);
  const [activeAppId, setActiveAppId] = useState<DockAppId | null>(null);
  const [runningApps, setRunningApps] = useState<Set<DockAppId>>(() => new Set());

  const handleSelectApp = useCallback((id: DockAppId) => {
    setRunningApps((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setActiveAppId((prev) => (prev === id ? null : id));
  }, []);

  const handleUpdateSettings = useCallback((next: DockSettings) => {
    setSettings(clampDockSettings(next));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveAppId(null);
      } else if (
        e.key >= '1' &&
        e.key <= '8' &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
      ) {
        const idx = Number(e.key) - 1;
        const app = DOCK_APPS[idx];
        if (app) {
          handleSelectApp(app.id);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSelectApp]);

  return (
    <main
      className="relative min-h-screen w-full flex flex-col items-center justify-center px-3 sm:px-6 overflow-hidden"
      style={{
        backgroundColor: '#7B7DCE',
        backgroundImage: `
          radial-gradient(110% 42% at 50% 0%, rgba(111, 146, 225, 0.55) 0%, transparent 70%),
          radial-gradient(110% 36% at 50% 100%, rgba(217, 122, 162, 0.45) 0%, transparent 72%),
          linear-gradient(180deg, #6F92E1 0%, #7481CB 13%, #7B7DCE 28%, #B0BBEF 48%, #B2D9D4 67%, #C0C9C5 82%, #D97AA2 100%)
        `,
      }}
    >
      {/* Anchored 3D Frosted Glass Dock (never shifts vertically when modals open) */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Interactive App Window floating cleanly above the dock */}
        {activeAppId && (
          <div className="fixed inset-x-0 bottom-[calc(50%+96px)] px-3 sm:px-6 flex justify-center z-30 pointer-events-none">
            <div className="w-full max-w-[520px] pointer-events-auto">
              <AppPreviewModal
                activeAppId={activeAppId}
                settings={settings}
                onUpdateSettings={handleUpdateSettings}
                onSelectApp={handleSelectApp}
                onClose={() => setActiveAppId(null)}
              />
            </div>
          </div>
        )}

        <GlassDock
          settings={settings}
          activeAppId={activeAppId}
          runningApps={runningApps}
          onSelectApp={handleSelectApp}
        />
      </div>
    </main>
  );
}
