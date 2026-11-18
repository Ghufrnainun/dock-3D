import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DOCK_APPS, type DockAppId, type DockAppItem } from '../data/dockApps';
import {
  DEFAULT_DOCK_SETTINGS,
  clampDockSettings,
  stepSpring,
  writeDockIconTargets,
  type DockSettings,
} from '../utils/dockPhysics';
import { DockIconGraphic } from './icons/DockIcons';

export interface GlassDockProps {
  items?: DockAppItem[];
  settings?: Partial<DockSettings>;
  activeAppId?: DockAppId | null;
  runningApps?: Set<DockAppId>;
  onSelectApp?: (id: DockAppId) => void;
  className?: string;
  showTooltips?: boolean;
  showReflections?: boolean;
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
      pointerActiveRef.current = true;
      pendingClientXRef.current = e.clientX;
      ensureAnimationLoop();
    },
    [ensureAnimationLoop]
  );

  const handleIconFocus = useCallback(
    (index: number) => {
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
