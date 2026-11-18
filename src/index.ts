export { GlassDock, type GlassDockProps } from './components/GlassDock';
export { DOCK_APPS, type DockAppId, type DockAppItem } from './data/dockApps';
export {
  DEFAULT_DOCK_SETTINGS,
  clampDockSettings,
  stepSpring,
  writeDockIconTargets,
  computeDockIconTransforms,
  computeProximityIntensity,
  type DockSettings,
  type IconTransform,
} from './utils/dockPhysics';
export { DockIconGraphic } from './components/icons/DockIcons';
export { AppPreviewModal } from './components/AppPreviewModal';
