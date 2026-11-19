/**
 * Eva — Public Website Application Script
 * Nexora-Inspired Motion, Scroll Observer, Theme Switching & Studio Stage
 */

(function () {
  'use strict';

  // 8 Curated Astra Design System Palettes
  const PALETTES = {
    flame: {
      name: 'Flame',
      dark: { primary: '#D9482B', bright: '#F26A4C', fg: '#FFFFFF' },
      light: { primary: '#D9482B', bright: '#EA580C', fg: '#FFFFFF' },
    },
    gold: {
      name: 'Astra Gold',
      dark: { primary: '#D4A359', bright: '#E5B869', fg: '#111111' },
      light: { primary: '#B88636', bright: '#946722', fg: '#FFFFFF' },
    },
    azure: {
      name: 'Azure',
      dark: { primary: '#2563EB', bright: '#3B82F6', fg: '#FFFFFF' },
      light: { primary: '#1D4ED8', bright: '#1E40AF', fg: '#FFFFFF' },
    },
    iris: {
      name: 'Iris',
      dark: { primary: '#8B5CF6', bright: '#A78BFA', fg: '#FFFFFF' },
      light: { primary: '#7C3AED', bright: '#6D28D9', fg: '#FFFFFF' },
    },
    verdant: {
      name: 'Verdant',
      dark: { primary: '#10B981', bright: '#34D399', fg: '#111111' },
      light: { primary: '#059669', bright: '#047857', fg: '#FFFFFF' },
    },
    amber: {
      name: 'Amber',
      dark: { primary: '#F59E0B', bright: '#FBBF24', fg: '#111111' },
      light: { primary: '#D97706', bright: '#B45309', fg: '#FFFFFF' },
    },
    crimson: {
      name: 'Crimson',
      dark: { primary: '#E11D48', bright: '#F43F5E', fg: '#FFFFFF' },
      light: { primary: '#BE123C', bright: '#9F1239', fg: '#FFFFFF' },
    },
    titanium: {
      name: 'Titanium',
      dark: { primary: '#64748B', bright: '#94A3B8', fg: '#FFFFFF' },
      light: { primary: '#475569', bright: '#334155', fg: '#FFFFFF' },
    },
  };

  // State Management
  let currentThemeMode = localStorage.getItem('eva_website_theme') || 'dark';
  let currentPalette = localStorage.getItem('eva_website_accent') || 'flame';

  function hexToRgba(hex, alpha) {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    const num = parseInt(c, 16);
    return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
  }

  // Apply Theme & Palette to DOM
  function applyTheme() {
    const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const effectiveTheme = currentThemeMode === 'system' ? (isSystemDark ? 'dark' : 'light') : currentThemeMode;

    document.documentElement.setAttribute('data-theme', effectiveTheme);

    const palette = PALETTES[currentPalette] || PALETTES.flame;
    const colors = effectiveTheme === 'dark' ? palette.dark : palette.light;

    const root = document.documentElement;
    root.style.setProperty('--c-accent', colors.primary);
    root.style.setProperty('--c-accent-bright', colors.bright);
    root.style.setProperty('--c-accent-fg', colors.fg);
    root.style.setProperty('--c-accent-surface', hexToRgba(colors.primary, 0.12));
    root.style.setProperty('--c-accent-border', hexToRgba(colors.primary, 0.32));
    root.style.setProperty('--c-accent-glow', hexToRgba(colors.primary, 0.28));

    // Update logos
    const logoImgs = document.querySelectorAll('.dynamic-logo');
    logoImgs.forEach((img) => {
      img.src = effectiveTheme === 'light' ? 'assets/icon-light.png' : 'assets/icon-dark.png';
    });

    // Update theme toggle button icon
    const moonIcon = document.querySelector('.icon-moon');
    const sunIcon = document.querySelector('.icon-sun');
    if (moonIcon && sunIcon) {
      if (effectiveTheme === 'dark') {
        moonIcon.style.display = 'block';
        sunIcon.style.display = 'none';
      } else {
        moonIcon.style.display = 'none';
        sunIcon.style.display = 'block';
      }
    }

    // Update palette button label and swatch
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

  // Set Theme Mode directly ('dark' | 'light' | 'system')
  window.setThemeMode = function (mode) {
    currentThemeMode = mode;
    localStorage.setItem('eva_website_theme', mode);
    applyTheme();
  };

  // Cycle Dark / Light Theme
  window.cycleThemeMode = function () {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    currentThemeMode = isDark ? 'light' : 'dark';
    localStorage.setItem('eva_website_theme', currentThemeMode);
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

  window.togglePaletteDropdown = function (e) {
    e.stopPropagation();
    const dropdown = document.getElementById('paletteDropdown');
    if (dropdown) dropdown.classList.toggle('show');
  };

  window.toggleMobileDrawer = function () {
    const drawer = document.getElementById('mobileDrawer');
    if (drawer) drawer.classList.toggle('open');
  };

  // Close dropdowns on outside click
  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('paletteDropdown');
    if (dropdown && !dropdown.contains(e.target) && !e.target.closest('.palette-btn')) {
      dropdown.classList.remove('show');
    }
    const drawer = document.getElementById('mobileDrawer');
    if (drawer && !drawer.contains(e.target) && !e.target.closest('.mobile-nav-toggle')) {
      drawer.classList.remove('open');
    }
  });

  // ==================================================================== //
  // STUDIO UNIVERSE SWITCHER DATA & LOGIC                               //
  // ==================================================================== //
  const STUDIOS_DATA = [
    {
      tag: 'Studio Universe 01',
      title: 'Deep Persona & Memory Studio',
      desc: 'Construct deeply articulated personas with multi-scene memory banks. Every conversation automatically preserves key moments, backstories, and context without repetitive prompt bloat.',
      bullets: [
        'Long-term memory synthesis with automatic context recall',
        'Per-character prompt directives and custom voice guidelines',
        'Dynamic temperature, top-p, and frequency penalty controls',
      ],
      visualHtml: `
        <div class="code-card">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;border-bottom:1px solid var(--hair);padding-bottom:8px;">
            <span style="color:var(--c-accent-bright);font-weight:700;">● SYSTEM MEMORY BUFFER</span>
            <span style="color:var(--c-muted);font-size:11px;margin-left:auto;">AUTO-CONSOLIDATED</span>
          </div>
          <div style="color:var(--c-text-2);font-size:12.5px;line-height:1.6;">
            [REPUTATION: Allied with Silver Archives (+45)]<br>
            [INVENTORY: Eldorian Starmap, Sunstone Key, Cipher Scroll]<br>
            [KNOWN EVENTS: Discovered ruins at midnight; avoided dusk patrol]<br>
            [DIRECTIVE: Preserve calm, academic voice; reference astrolabe]
          </div>
        </div>
      `,
    },
    {
      tag: 'Studio Universe 02',
      title: 'Anime Canon & Persona Roster',
      desc: 'Explore pre-configured and custom anime personalities with visual avatars, emotional expressions, and expressive dialogue styled after Japanese visual novels and light novels.',
      bullets: [
        'Stylized visual avatars with dynamic emotion markers',
        'Built-in character roster: Aria Silver, Elysia Vance, Captain Chen',
        'Expressive dialogue pacing with stage direction markup',
      ],
      visualHtml: `
        <div class="code-card">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;border-bottom:1px solid var(--hair);padding-bottom:8px;">
            <span style="color:var(--c-accent-bright);font-weight:700;">🌸 ANIME ROSTER PROFILE</span>
            <span style="color:#10B981;font-size:11px;margin-left:auto;">READY</span>
          </div>
          <div style="color:var(--c-text-2);font-size:12.5px;line-height:1.6;">
            [CHARACTER: Aria Silver · Age: 22]<br>
            [VOICE: Gentle archivist with sharp observational wit]<br>
            [THEME: Anime Universe (Deep Violet & Cherry Blossom)]<br>
            [AVATAR: Custom SVG / PNG / Pollinations Generative Art]
          </div>
        </div>
      `,
    },
    {
      tag: 'Studio Universe 03',
      title: 'Living World & Interactive Roleplay',
      desc: 'Step into persistent world roleplay where places, factions, and character relationships stay connected across different cast members and conversations.',
      bullets: [
        'World Codex: persistent places, lore, factions, and events',
        'Faction standing gauges that react dynamically to your actions',
        'Integrated tabletop dice rolling and director command syntax',
      ],
      visualHtml: `
        <div class="code-card">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;border-bottom:1px solid var(--hair);padding-bottom:8px;">
            <span style="color:var(--c-accent-bright);font-weight:700;">🗺️ WORLD CODEX · ELDORIA</span>
            <span style="color:var(--c-muted);font-size:11px;margin-left:auto;">ACTIVE LORE</span>
          </div>
          <div style="color:var(--c-text-2);font-size:12.5px;line-height:1.6;">
            [LOCATION: Sunken Citadel of Oakhaven]<br>
            [FACTIONS: Silver Archives (+82 Revered) · Syndicate (-40 Hostile)]<br>
            [TIMELINE: Fourth Age of Astrals — 3 days to Eclipse]<br>
            [COMMANDS: /roll 1d20+3 · /event · /thought]
          </div>
        </div>
      `,
    },
  ];

  window.switchStudioTab = function (index) {
    const tabs = document.querySelectorAll('.studio-tab');
    tabs.forEach((tab, i) => {
      if (i === index) {
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
      } else {
        tab.classList.remove('active');
        tab.setAttribute('aria-selected', 'false');
      }
    });

    const data = STUDIOS_DATA[index];
    if (!data) return;

    const tag = document.getElementById('studioTag');
    const title = document.getElementById('studioTitle');
    const desc = document.getElementById('studioDesc');
    const bullets = document.getElementById('studioBullets');
    const visual = document.getElementById('studioVisual');

    if (tag) tag.textContent = data.tag;
    if (title) title.textContent = data.title;
    if (desc) desc.textContent = data.desc;

    if (bullets) {
      bullets.innerHTML = data.bullets
        .map(
          (b) => `
        <li>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
          <span>${b}</span>
        </li>
      `
        )
        .join('');
    }

    if (visual) {
      visual.innerHTML = data.visualHtml;
    }
  };

  // ==================================================================== //
  // OS DETECTION & SMART DOWNLOAD RECOMMENDATIONS                       //
  // ==================================================================== //
  function detectOS() {
    const userAgent = window.navigator.userAgent.toLowerCase();
    let os = 'Linux';
    let dlUrl = 'https://github.com/AmanicX/eva/releases/latest/download/Eva-2.2.2.AppImage';
    let btnLabel = 'Download for Linux (AppImage)';

    if (userAgent.indexOf('win') !== -1) {
      os = 'Windows';
      dlUrl = 'https://github.com/AmanicX/eva/releases/latest/download/Eva.Setup.2.2.2.exe';
      btnLabel = 'Download for Windows (64-bit)';
    } else if (userAgent.indexOf('android') !== -1) {
      os = 'Android';
      dlUrl = 'https://github.com/AmanicX/eva/releases/latest/download/Eva-android.apk';
      btnLabel = 'Download for Android (.apk)';
    } else if (userAgent.indexOf('mac') !== -1) {
      os = 'macOS';
      dlUrl = 'https://github.com/AmanicX/eva/releases/latest';
      btnLabel = 'Download on GitHub Releases';
    }

    const heroDlBtn = document.getElementById('heroDlBtn');
    const heroDlLabel = document.getElementById('heroDlLabel');
    const detectedPlatformText = document.getElementById('detectedPlatformText');

    if (heroDlBtn && dlUrl) heroDlBtn.href = dlUrl;
    if (heroDlLabel && btnLabel) heroDlLabel.textContent = btnLabel;
    if (detectedPlatformText) detectedPlatformText.textContent = `${os} (64-bit)`;

    // Highlight card
    document.querySelectorAll('.dl-card').forEach((c) => c.classList.remove('highlight'));
    if (os === 'Linux') {
      const card = document.getElementById('cardLinux');
      if (card) card.classList.add('highlight');
    } else if (os === 'Windows') {
      const card = document.getElementById('cardWindows');
      if (card) card.classList.add('highlight');
    } else if (os === 'Android') {
      const card = document.getElementById('cardAndroid');
      if (card) card.classList.add('highlight');
    }
  }

  // ==================================================================== //
  // SCROLL REVEAL OBSERVER & HEADER STATE                                //
  // ==================================================================== //
  function setupScrollObservers() {
    // Reveal Observer
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    document.querySelectorAll('.rv, .rv-stagger').forEach((el) => {
      observer.observe(el);
    });

    // Header scrolled state
    const head = document.querySelector('.head');
    window.addEventListener(
      'scroll',
      () => {
        if (!head) return;
        if (window.scrollY > 20) {
          head.classList.add('scrolled');
        } else {
          head.classList.remove('scrolled');
        }
      },
      { passive: true }
    );

    // Scrollspy for Nav Links
    const sections = document.querySelectorAll('section[id], header[id]');
    const navLinks = document.querySelectorAll('.nav-link');

    window.addEventListener(
      'scroll',
      () => {
        let current = '';
        sections.forEach((section) => {
          const sectionTop = section.offsetTop - 120;
          if (window.scrollY >= sectionTop) {
            current = section.getAttribute('id');
          }
        });

        navLinks.forEach((link) => {
          link.classList.remove('active');
          if (link.getAttribute('href') === `#${current}`) {
            link.classList.add('active');
          }
        });
      },
      { passive: true }
    );
  }

  // DOM Ready
  document.addEventListener('DOMContentLoaded', () => {
    applyTheme();
    detectOS();
    setupScrollObservers();
  });
})();
