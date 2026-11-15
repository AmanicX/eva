/**
 * Eva — Public Website Application Script
 * Theme switcher, 8 Curated Accent palettes, Interactive studio preview, mobile drawer
 */

(function () {
  'use strict';

  // 8 Curated Palettes matching Eva's Astra Design System
  const PALETTES = {
    gold: {
      name: 'Astra Gold',
      dark: { primary: '#D4A359', contrast: '#E5B869', fg: '#111111' },
      light: { primary: '#B88636', contrast: '#946722', fg: '#FFFFFF' },
    },
    azure: {
      name: 'Azure',
      dark: { primary: '#2563EB', contrast: '#3B82F6', fg: '#FFFFFF' },
      light: { primary: '#1D4ED8', contrast: '#1E40AF', fg: '#FFFFFF' },
    },
    iris: {
      name: 'Iris',
      dark: { primary: '#8B5CF6', contrast: '#A78BFA', fg: '#FFFFFF' },
      light: { primary: '#7C3AED', contrast: '#6D28D9', fg: '#FFFFFF' },
    },
    verdant: {
      name: 'Verdant',
      dark: { primary: '#10B981', contrast: '#34D399', fg: '#111111' },
      light: { primary: '#059669', contrast: '#047857', fg: '#FFFFFF' },
    },
    amber: {
      name: 'Amber',
      dark: { primary: '#F59E0B', contrast: '#FBBF24', fg: '#111111' },
      light: { primary: '#D97706', contrast: '#B45309', fg: '#FFFFFF' },
    },
    terracotta: {
      name: 'Terracotta',
      dark: { primary: '#F97316', contrast: '#FB923C', fg: '#111111' },
      light: { primary: '#EA580C', contrast: '#C2410C', fg: '#FFFFFF' },
    },
    crimson: {
      name: 'Crimson',
      dark: { primary: '#E11D48', contrast: '#F43F5E', fg: '#FFFFFF' },
      light: { primary: '#BE123C', contrast: '#9F1239', fg: '#FFFFFF' },
    },
    titanium: {
      name: 'Titanium',
      dark: { primary: '#64748B', contrast: '#94A3B8', fg: '#FFFFFF' },
      light: { primary: '#475569', contrast: '#334155', fg: '#FFFFFF' },
    },
  };

  // State (default to dark to match Eva's Astra dark aesthetic)
  let currentThemeMode = localStorage.getItem('eva_website_theme') || 'dark';
  let currentPalette = localStorage.getItem('eva_website_accent') || 'gold';

  // Apply Theme & Accent to document
  function applyTheme() {
    const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const effectiveTheme = currentThemeMode === 'system' ? (isSystemDark ? 'dark' : 'light') : currentThemeMode;

    document.documentElement.setAttribute('data-theme', effectiveTheme);

    const palette = PALETTES[currentPalette] || PALETTES.gold;
    const colors = effectiveTheme === 'dark' ? palette.dark : palette.light;

    const root = document.documentElement;
    root.style.setProperty('--c-accent', colors.primary);
    root.style.setProperty('--c-accent-contrast', colors.contrast);
    root.style.setProperty('--c-accent-fg', colors.fg);
    root.style.setProperty('--c-accent-surface', hexToRgba(colors.primary, 0.14));
    root.style.setProperty('--c-accent-border', hexToRgba(colors.primary, 0.3));
    root.style.setProperty('--c-accent-ring', hexToRgba(colors.primary, 0.4));

    // Update Brand Logos
    const logoImgs = document.querySelectorAll('.brand-icon, .dynamic-logo');
    logoImgs.forEach((img) => {
      img.src = effectiveTheme === 'light' ? 'assets/icon-light.png' : 'assets/icon-dark.png';
    });

    // Update Theme Switch Buttons UI
    document.querySelectorAll('.theme-switch-btn').forEach((btn) => {
      const mode = btn.getAttribute('data-mode');
      if (mode === currentThemeMode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update Palette Swatch UI
    const swatchDot = document.querySelector('.palette-swatch-dot');
    if (swatchDot) swatchDot.style.background = colors.primary;

    const labelSpan = document.querySelector('.palette-btn-label');
    if (labelSpan) labelSpan.textContent = palette.name;

    document.querySelectorAll('.palette-option').forEach((opt) => {
      if (opt.getAttribute('data-palette') === currentPalette) {
        opt.classList.add('active');
      } else {
        opt.classList.remove('active');
      }
    });
  }

  function hexToRgba(hex, alpha) {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    const num = parseInt(c, 16);
    return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
  }

  // Set Theme Mode
  window.setThemeMode = function (mode) {
    currentThemeMode = mode;
    localStorage.setItem('eva_website_theme', mode);
    applyTheme();
  };

  // Set Accent Palette
  window.setAccentPalette = function (paletteKey) {
    if (!PALETTES[paletteKey]) return;
    currentPalette = paletteKey;
    localStorage.setItem('eva_website_accent', paletteKey);
    applyTheme();
    const dropdown = document.getElementById('paletteDropdown');
    if (dropdown) dropdown.classList.remove('show');
  };

  // System listener
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (currentThemeMode === 'system') applyTheme();
  });

  // Toggle Palette Popover
  window.togglePaletteDropdown = function (e) {
    e.stopPropagation();
    const dropdown = document.getElementById('paletteDropdown');
    if (dropdown) dropdown.classList.toggle('show');
  };

  // Mobile Drawer
  window.toggleMobileDrawer = function () {
    const drawer = document.getElementById('mobileDrawer');
    if (drawer) drawer.classList.toggle('open');
  };

  // Close popovers when clicking outside
  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('paletteDropdown');
    if (dropdown && !dropdown.contains(e.target) && !e.target.closest('.palette-btn')) {
      dropdown.classList.remove('show');
    }
  });

  // Init on DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    applyTheme();
  });
})();
