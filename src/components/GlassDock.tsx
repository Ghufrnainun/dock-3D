import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DOCK_APPS, type DockAppId, type DockAppItem } from '../data/dockApps';
import {
  stepSpring,
  writeDockIconTargets,
  type DockSettings,
} from '../utils/dockPhysics';
import { DockIconGraphic } from './icons/DockIcons';

interface GlassDockProps {
  settings: DockSettings;
  activeAppId: DockAppId | null;
  runningApps: Set<DockAppId>;
  onSelectApp: (id: DockAppId) => void;
}

const StaticShelfReflections = React.memo(function StaticShelfReflections({
  baseSize,
  gap,
  unscaledRowWidth,
  reflectionStartTop,
  reflectionOpacity,
}: {
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
      {DOCK_APPS.map((app) => (
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
          <DockIconGraphic id={app.id} />
        </div>
      ))}
    </div>
  );
});

const APP_COUNT = DOCK_APPS.length;

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
  settings,
  activeAppId,
  runningApps,
  onSelectApp,
}: GlassDockProps) {
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
  const currentScalesRef = useRef<number[]>(new Array(APP_COUNT).fill(1));
  const scaleVelsRef = useRef<number[]>(new Array(APP_COUNT).fill(0));
  const targetScalesRef = useRef<number[]>(new Array(APP_COUNT).fill(1));

  const currentLiftsRef = useRef<number[]>(new Array(APP_COUNT).fill(0));
  const liftVelsRef = useRef<number[]>(new Array(APP_COUNT).fill(0));
  const targetLiftsRef = useRef<number[]>(new Array(APP_COUNT).fill(0));

  const targetZIndicesRef = useRef<number[]>(new Array(APP_COUNT).fill(3));
  const lastZIndicesRef = useRef<number[]>(new Array(APP_COUNT).fill(3));
  const lastFrameTimeRef = useRef<number>(0);

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

  const unscaledRowWidth = APP_COUNT * baseSize + (APP_COUNT - 1) * gap;

  const effectiveSettings = useMemo<DockSettings>(() => {
    const ratio = baseSize / 84;
    return {
      ...settings,
      influenceRadius: settings.influenceRadius * Math.max(0.55, ratio),
      maxLift: settings.maxLift * Math.max(0.5, ratio),
    };
  }, [settings, baseSize]);

  // Keep latest geometry & settings in refs so rAF callback stays stable without re-binding
  const geometryRef = useRef({ baseSize, gap, effectiveSettings });
  geometryRef.current = { baseSize, gap, effectiveSettings };

  const applyTargets = useCallback((relativePointerX: number | null) => {
    const { baseSize: bSize, gap: g, effectiveSettings: cfg } = geometryRef.current;
    writeDockIconTargets({
      count: APP_COUNT,
      baseSize: bSize,
      gap: g,
      pointerX: relativePointerX,
      settings: cfg,
      outScales: targetScalesRef.current,
      outLifts: targetLiftsRef.current,
      outZIndices: targetZIndicesRef.current,
    });

    // Only touch slot z-index DOM style when integer z-index actually changes
    for (let i = 0; i < APP_COUNT; i++) {
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

      for (let i = 0; i < APP_COUNT; i++) {
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
    if (reduceMotionRef.current) {
      if (pointerActiveRef.current && pendingClientXRef.current !== null) {
        const rect = rowRectRef.current ?? measureRowRect();
        if (rect) {
          applyTargets(pendingClientXRef.current - rect.left);
        }
        pendingClientXRef.current = null;
      }
      for (let i = 0; i < APP_COUNT; i++) {
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
      if (settings.enableBounce && !reduceMotionRef.current) {
        if (bounceRafRef.current) {
          cancelAnimationFrame(bounceRafRef.current);
        }
        if (bounceTimerRef.current) {
          window.clearTimeout(bounceTimerRef.current);
        }
        for (let i = 0; i < APP_COUNT; i++) {
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
      onSelectApp(app.id);
    },
    [settings.enableBounce, onSelectApp]
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
      className="relative flex flex-col items-center justify-center select-none"
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
            <StaticShelfReflections
              baseSize={baseSize}
              gap={gap}
              unscaledRowWidth={unscaledRowWidth}
              reflectionStartTop={reflectionStartTop}
              reflectionOpacity={settings.reflectionOpacity}
            />

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
          {DOCK_APPS.map((app, index) => {
            const isActive = activeAppId === app.id;
            const isRunning = runningApps.has(app.id);

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
                <div
                  role="tooltip"
                  className="dock-tooltip pointer-events-none absolute left-1/2 whitespace-nowrap rounded-lg px-2.5 py-1 text-[11px] font-medium tracking-wide text-white/95 shadow-lg"
                  style={{
                    bottom: `${Math.round(baseSize * Math.max(1.22, settings.magnification) + 18)}px`,
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
                    <DockIconGraphic id={app.id} />
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
