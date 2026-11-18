import React, { useState } from 'react';
import { Check, Copy, RotateCcw, Send, X } from 'lucide-react';
import { DOCK_APPS, type DockAppId } from '../data/dockApps';
import { DEFAULT_DOCK_SETTINGS, type DockSettings } from '../utils/dockPhysics';
import { DockIconGraphic } from './icons/DockIcons';

interface AppPreviewModalProps {
  activeAppId: DockAppId | null;
  settings: DockSettings;
  onUpdateSettings: (next: DockSettings) => void;
  onSelectApp: (id: DockAppId) => void;
  onClose: () => void;
}

export function AppPreviewModal({
  activeAppId,
  settings,
  onUpdateSettings,
  onSelectApp,
  onClose,
}: AppPreviewModalProps) {
  const [noteText, setNoteText] = useState(
    'Glass dock notes:\n- Frosted acrylic 3D bevel\n- Raised-cosine wave magnification\n- Live mirrored shelf reflections'
  );
  const [copiedCode, setCopiedCode] = useState(false);
  const [messageSent, setMessageSent] = useState(false);
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');

  if (!activeAppId) return null;

  const activeApp = DOCK_APPS.find((item) => item.id === activeAppId);
  if (!activeApp) return null;

  const handleCopySnippet = async () => {
    const snippet = `const intensity = 0.5 * (1 + Math.cos(Math.PI * Math.min(1, Math.abs(dist) / radius)));`;
    try {
      await navigator.clipboard.writeText(snippet);
    } catch {
      // Clipboard may be restricted in headless contexts; still provide feedback
    }
    setCopiedCode(true);
    window.setTimeout(() => setCopiedCode(false), 1600);
  };

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactEmail.trim() || !contactMessage.trim()) return;
    setMessageSent(true);
    setContactEmail('');
    setContactMessage('');
    window.setTimeout(() => setMessageSent(false), 2600);
  };

  return (
    <div
      role="dialog"
      aria-label={`${activeApp.label} window`}
      data-testid="app-preview-modal"
      className="w-full max-w-[520px] mx-auto mb-4 rounded-2xl overflow-hidden text-slate-100 shadow-2xl animate-modal-pop"
      style={{
        background: 'linear-gradient(155deg, rgba(30, 29, 72, 0.96), rgba(18, 20, 46, 0.98))',
        border: '1px solid rgba(255, 255, 255, 0.18)',
        boxShadow:
          '0 28px 60px -12px rgba(4, 6, 18, 0.78), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
      }}
    >
      {/* macOS-style Window Titlebar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={`Close ${activeApp.label}`}
            onClick={onClose}
            className="w-3 h-3 rounded-full bg-[#ff5f56] hover:brightness-110 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          />
          <span className="w-3 h-3 rounded-full bg-[#ffbd2e]/85" aria-hidden="true" />
          <span className="w-3 h-3 rounded-full bg-[#27c93f]/85" aria-hidden="true" />
        </div>

        <div className="flex items-center gap-2 text-xs font-medium text-slate-200">
          <span className="w-4 h-4 inline-block shrink-0">
            <DockIconGraphic id={activeApp.id} />
          </span>
          <span>{activeApp.label}</span>
          <span aria-hidden="true" className="text-slate-500">·</span>
          <span className="text-slate-400 font-normal">{activeApp.subtitle}</span>
        </div>

        <button
          type="button"
          aria-label="Close window"
          onClick={onClose}
          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Window Content */}
      <div className="p-5 text-sm">
        {activeApp.id === 'apps' && (
          <div className="grid grid-cols-4 gap-3">
            {DOCK_APPS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectApp(item.id)}
                className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl hover:bg-white/8 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                <span className="w-11 h-11 block">
                  <DockIconGraphic id={item.id} />
                </span>
                <span className="text-xs font-medium text-slate-200">{item.label}</span>
              </button>
            ))}
          </div>
        )}

        {activeApp.id === 'projects' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-sky-300">dockPhysics.ts</span>
              <button
                type="button"
                onClick={handleCopySnippet}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-white/8 hover:bg-white/14 text-slate-200 transition-colors cursor-pointer"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <pre className="p-3.5 rounded-xl bg-slate-950/75 border border-white/10 font-mono text-xs text-cyan-200 overflow-x-auto leading-relaxed">
{`// Raised-cosine macOS magnification wave
export function computeProximityIntensity(dist: number, radius: number) {
  const t = Math.min(1, Math.abs(dist) / radius);
  return 0.5 * (1 + Math.cos(Math.PI * t));
}`}
            </pre>
          </div>
        )}

        {activeApp.id === 'about' && (
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 shrink-0">
              <DockIconGraphic id="about" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-base font-semibold text-white">3D Frosted Glass Dock</h2>
              <p className="text-slate-300 leading-relaxed text-xs sm:text-sm">
                Crafted with layered skeuomorphic SVG geometry, physical frosted acrylic bevels, synchronized surface reflections, and smooth spring wave magnification.
              </p>
            </div>
          </div>
        )}

        {activeApp.id === 'resume' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <div>
                <h2 className="font-semibold text-white">Curriculum Vitae</h2>
                <p className="text-xs text-slate-400">Interactive UI & Motion Craft</p>
              </div>
              <span className="text-xs text-sky-300 tabular-nums">2026 Edition</span>
            </div>
            <ul className="space-y-2 text-xs text-slate-300">
              <li className="flex justify-between">
                <span>Skeuomorphic Glass & Lighting Systems</span>
                <span className="text-slate-400">SVG / CSS 3D</span>
              </li>
              <li className="flex justify-between">
                <span>Wave Magnification & Neighbor Displacement</span>
                <span className="text-slate-400">60fps Compositor</span>
              </li>
              <li className="flex justify-between">
                <span>Accessible Keyboard & Pointer Navigation</span>
                <span className="text-slate-400">WCAG AA</span>
              </li>
            </ul>
          </div>
        )}

        {activeApp.id === 'journal' && (
          <div className="space-y-2.5">
            <h2 className="font-semibold text-amber-200">On Tactile Digital Surfaces</h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Great glass interfaces combine crisp edge specular highlights with subtle chromatic reflections below each object—anchoring floating icons onto a believable physical shelf.
            </p>
          </div>
        )}

        {activeApp.id === 'notes' && (
          <div className="space-y-2">
            <label htmlFor="dock-quick-note" className="block text-xs font-medium text-amber-200/90">
              Quick Scratchpad
            </label>
            <textarea
              id="dock-quick-note"
              rows={4}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              className="w-full rounded-xl bg-slate-950/60 border border-white/12 p-3 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/70 resize-none"
            />
          </div>
        )}

        {activeApp.id === 'settings' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <label htmlFor="slider-magnification" className="text-slate-200 font-medium">
                  Magnification Scale
                </label>
                <span className="font-mono tabular-nums text-indigo-300">
                  {settings.magnification.toFixed(2)}x
                </span>
              </div>
              <input
                id="slider-magnification"
                type="range"
                min="1"
                max="1.55"
                step="0.01"
                value={settings.magnification}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    magnification: parseFloat(e.target.value),
                  })
                }
                className="w-full accent-indigo-400 cursor-pointer"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <label htmlFor="slider-reflection" className="text-slate-200 font-medium">
                  Glass Reflection Intensity
                </label>
                <span className="font-mono tabular-nums text-indigo-300">
                  {Math.round(settings.reflectionOpacity * 100)}%
                </span>
              </div>
              <input
                id="slider-reflection"
                type="range"
                min="0"
                max="0.8"
                step="0.02"
                value={settings.reflectionOpacity}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    reflectionOpacity: parseFloat(e.target.value),
                  })
                }
                className="w-full accent-indigo-400 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="inline-flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enableBounce}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...settings,
                      enableBounce: e.target.checked,
                    })
                  }
                  className="rounded accent-indigo-400"
                />
                <span>Click Bounce Animation</span>
              </label>

              <button
                type="button"
                onClick={() => onUpdateSettings(DEFAULT_DOCK_SETTINGS)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-white/8 hover:bg-white/14 text-slate-200 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>
          </div>
        )}

        {activeApp.id === 'contact' && (
          <form onSubmit={handleContactSubmit} className="space-y-3">
            <div>
              <label htmlFor="contact-email" className="block text-xs text-slate-300 mb-1">
                Email
              </label>
              <input
                id="contact-email"
                type="email"
                required
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg bg-slate-950/60 border border-white/12 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-400/70"
              />
            </div>
            <div>
              <label htmlFor="contact-message" className="block text-xs text-slate-300 mb-1">
                Message
              </label>
              <textarea
                id="contact-message"
                rows={2}
                required
                value={contactMessage}
                onChange={(e) => setContactMessage(e.target.value)}
                placeholder="Say hello..."
                className="w-full rounded-lg bg-slate-950/60 border border-white/12 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-400/70 resize-none"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-emerald-300" role="status">
                {messageSent ? 'Message sent!' : ''}
              </span>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-rose-500 hover:bg-rose-400 text-white transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
