import React from 'react';

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
