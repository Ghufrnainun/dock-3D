import fs from 'node:fs';
import path from 'node:path';

const srcDir = path.resolve('src');
const physicsCode = fs.readFileSync(path.join(srcDir, 'utils', 'dockPhysics.ts'), 'utf-8');
const appsCode = fs.readFileSync(path.join(srcDir, 'data', 'dockApps.ts'), 'utf-8');
const iconsCode = fs.readFileSync(path.join(srcDir, 'components', 'icons', 'DockIcons.tsx'), 'utf-8');
const dockCode = fs.readFileSync(path.join(srcDir, 'components', 'GlassDock.tsx'), 'utf-8');
const cssCode = fs.readFileSync(path.join(srcDir, 'index.css'), 'utf-8');

// Extract relevant dock keyframes and per-icon animation classes from index.css
const cssExtract = cssCode.slice(cssCode.indexOf(':root {'));

// Clean up imports in component pieces
const cleanPhysics = physicsCode.trim();

const cleanApps = appsCode
  .replace(/import React from 'react';/, '')
  .trim();

const cleanIcons = iconsCode
  .replace(/import React, \{ useId \} from 'react';/, '')
  .replace(/import type \{ DockAppId \} from '\.\.\/\.\.\/data\/dockApps';/, '')
  .trim();

const cleanDock = dockCode
  .replace(/import React, \{[^\}]+\} from 'react';/, '')
  .replace(/import \{ DOCK_APPS[^\}]+\} from '\.\.\/data\/dockApps';/, '')
  .replace(/import \{[^\}]+\} from '\.\.\/utils\/dockPhysics';/, '')
  .replace(/import \{ DockIconGraphic \} from '\.\/icons\/DockIcons';/, '')
  .trim();

const bundled = `import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

// ============================================================================
// Types & Data
// ============================================================================
${cleanApps}

// ============================================================================
// Physics Simulation Engine
// ============================================================================
${cleanPhysics}

// ============================================================================
// 3D Vector Icons
// ============================================================================
${cleanIcons}

// ============================================================================
// Embedded Dock Styles
// ============================================================================
export const DOCK_STYLES = \`
${cssExtract.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')}
\`;

export function DockStyleTag() {
  return <style dangerouslySetInnerHTML={{ __html: DOCK_STYLES }} />;
}

// ============================================================================
// GlassDock Component
// ============================================================================
${cleanDock}

export default GlassDock;
`;

fs.writeFileSync(path.join(srcDir, 'components', 'frosted-glass-dock.tsx'), bundled);
console.log('Successfully bundled frosted-glass-dock.tsx');
