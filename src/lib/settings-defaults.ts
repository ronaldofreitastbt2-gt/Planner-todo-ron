import { type AppSettings } from './db'

export const DEFAULT_SETTINGS: Omit<AppSettings, 'id'> = {
  userId: '',
  theme: '',
  dark: false,
  bgType: 'color',
  bgColor: '',
  bgSvgPreset: 'waves',
  bgImageDataUrl: '',
  bgOverlayOpacity: 0,
  bgOverlayBlur: 0,
  notificationSound: '',
  taskSound: '',
  eventSound: '',
  habitSound: '',
  notificationVibrate: true,
  notificationPush: false,
  alarmMinutesBefore: 5,
}

/* Deterministic PRNG so animations look the same on every render */
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const SVG_PRESETS: Record<string, { label: string; render: () => string }> = {
  none: {
    label: 'Nenhum',
    render: () => '',
  },

  /* ===== Ondas — layered smooth waves with gradient ===== */
  waves: {
    label: 'Ondas',
    render: () => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 800" preserveAspectRatio="xMidYMid slice" width="100%" height="100%">
        <defs>
          <linearGradient id="w-g1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--primary)" stop-opacity="0.18"/>
            <stop offset="100%" stop-color="var(--primary)" stop-opacity="0.02"/>
          </linearGradient>
          <linearGradient id="w-g2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.14"/>
            <stop offset="100%" stop-color="var(--accent)" stop-opacity="0.01"/>
          </linearGradient>
          <linearGradient id="w-g3" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--primary)" stop-opacity="0.08"/>
            <stop offset="100%" stop-color="var(--primary)" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <path fill="url(#w-g3)" d="M0,420 C240,360 480,480 720,420 C960,360 1200,480 1440,420 L1440,800 L0,800 Z">
          <animate attributeName="d" dur="12s" repeatCount="indefinite"
            values="M0,420 C240,360 480,480 720,420 C960,360 1200,480 1440,420 L1440,800 L0,800 Z;
                    M0,400 C240,460 480,340 720,400 C960,460 1200,340 1440,400 L1440,800 L0,800 Z;
                    M0,420 C240,360 480,480 720,420 C960,360 1200,480 1440,420 L1440,800 L0,800 Z"/>
        </path>
        <path fill="url(#w-g2)" d="M0,500 C240,440 480,560 720,500 C960,440 1200,560 1440,500 L1440,800 L0,800 Z">
          <animate attributeName="d" dur="10s" repeatCount="indefinite"
            values="M0,500 C240,440 480,560 720,500 C960,440 1200,560 1440,500 L1440,800 L0,800 Z;
                    M0,520 C240,580 480,420 720,520 C960,580 1200,420 1440,520 L1440,800 L0,800 Z;
                    M0,500 C240,440 480,560 720,500 C960,440 1200,560 1440,500 L1440,800 L0,800 Z"/>
        </path>
        <path fill="url(#w-g1)" d="M0,580 C240,520 480,640 720,580 C960,520 1200,640 1440,580 L1440,800 L0,800 Z">
          <animate attributeName="d" dur="8s" repeatCount="indefinite"
            values="M0,580 C240,520 480,640 720,580 C960,520 1200,640 1440,580 L1440,800 L0,800 Z;
                    M0,560 C240,620 480,500 720,560 C960,620 1200,500 1440,560 L1440,800 L0,800 Z;
                    M0,580 C240,520 480,640 720,580 C960,520 1200,640 1440,580 L1440,800 L0,800 Z"/>
        </path>
      </svg>`,
  },

  /* ===== Partículas — floating glowing orbs / bokeh ===== */
  particles: {
    label: 'Partículas',
    render: () => {
      const rnd = mulberry32(42)
      let circles = ''
      for (let i = 0; i < 35; i++) {
        const cx = rnd() * 1440
        const cy = rnd() * 800
        const r = rnd() * 40 + 8
        const dur = rnd() * 8 + 8
        const delay = rnd() * 6
        const opacity = rnd() * 0.08 + 0.03
        const driftX = (rnd() - 0.5) * 80
        const driftY = (rnd() - 0.5) * 100
        const color = rnd() > 0.5 ? 'var(--primary)' : 'var(--accent)'
        circles += `
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" opacity="${opacity}">
            <animate attributeName="cy" dur="${dur}s" repeatCount="indefinite" begin="${delay}s"
              values="${cy};${cy + driftY};${cy}"/>
            <animate attributeName="cx" dur="${dur * 1.3}s" repeatCount="indefinite" begin="${delay}s"
              values="${cx};${cx + driftX};${cx}"/>
            <animate attributeName="opacity" dur="${dur}s" repeatCount="indefinite" begin="${delay}s"
              values="${opacity};${opacity * 2.5};${opacity}"/>
          </circle>`
      }
      return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 800" preserveAspectRatio="xMidYMid slice" width="100%" height="100%">
        <defs>
          <filter id="p-blur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8"/>
          </filter>
        </defs>
        <g filter="url(#p-blur)">${circles}</g>
      </svg>`
    },
  },

  /* ===== Gradiente — animated mesh blobs ===== */
  gradient: {
    label: 'Gradiente',
    render: () => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 800" preserveAspectRatio="xMidYMid slice" width="100%" height="100%">
        <defs>
          <filter id="g-blur" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="60"/>
          </filter>
          <radialGradient id="g-blob1" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="var(--primary)" stop-opacity="0.35"/>
            <stop offset="100%" stop-color="var(--primary)" stop-opacity="0"/>
          </radialGradient>
          <radialGradient id="g-blob2" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.30"/>
            <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
          </radialGradient>
          <radialGradient id="g-blob3" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="var(--primary)" stop-opacity="0.15"/>
            <stop offset="100%" stop-color="var(--primary)" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <g filter="url(#g-blur)">
          <circle cx="300" cy="200" r="350" fill="url(#g-blob1)">
            <animate attributeName="cx" dur="20s" repeatCount="indefinite" values="300;500;300"/>
            <animate attributeName="cy" dur="25s" repeatCount="indefinite" values="200;350;200"/>
          </circle>
          <circle cx="1100" cy="600" r="300" fill="url(#g-blob2)">
            <animate attributeName="cx" dur="22s" repeatCount="indefinite" values="1100;900;1100"/>
            <animate attributeName="cy" dur="18s" repeatCount="indefinite" values="600;400;600"/>
          </circle>
          <circle cx="700" cy="500" r="250" fill="url(#g-blob3)">
            <animate attributeName="cx" dur="16s" repeatCount="indefinite" values="700;500;700"/>
            <animate attributeName="cy" dur="20s" repeatCount="indefinite" values="500;650;500"/>
          </circle>
        </g>
      </svg>`,
  },

  /* ===== Grid — wireframe perspective grid ===== */
  grid: {
    label: 'Grid',
    render: () => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 800" preserveAspectRatio="xMidYMid slice" width="100%" height="100%">
        <defs>
          <pattern id="grid-fine" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="var(--primary)" stroke-width="0.5" opacity="0.08"/>
          </pattern>
          <pattern id="grid-bold" x="0" y="0" width="240" height="240" patternUnits="userSpaceOnUse">
            <path d="M 240 0 L 0 0 0 240" fill="none" stroke="var(--primary)" stroke-width="1" opacity="0.15"/>
          </pattern>
          <linearGradient id="grid-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--background)" stop-opacity="0.8"/>
            <stop offset="50%" stop-color="var(--background)" stop-opacity="0.2"/>
            <stop offset="100%" stop-color="var(--background)" stop-opacity="0.8"/>
          </linearGradient>
        </defs>
        <rect width="1440" height="800" fill="url(#grid-fine)"/>
        <rect width="1440" height="800" fill="url(#grid-bold)"/>
        <rect width="1440" height="800" fill="url(#grid-fade)">
          <animate attributeName="opacity" dur="6s" repeatCount="indefinite" values="0.7;1;0.7"/>
        </rect>
        <!-- Sweeping highlight line -->
        <rect x="0" y="0" width="2" height="800" fill="var(--primary)" opacity="0.12">
          <animate attributeName="x" dur="8s" repeatCount="indefinite" values="0;1440;0"/>
        </rect>
      </svg>`,
  },

  /* ===== Hexágonos — floating rotating honeycomb ===== */
  hexagons: {
    label: 'Hexágonos',
    render: () => {
      const rnd = mulberry32(99)
      let hexes = ''
      const hexPoints = (size: number) => {
        const pts: string[] = []
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i - Math.PI / 6
          pts.push(`${(size * Math.cos(angle)).toFixed(1)},${(size * Math.sin(angle)).toFixed(1)}`)
        }
        return pts.join(' ')
      }
      for (let i = 0; i < 22; i++) {
        const x = rnd() * 1400 + 20
        const y = rnd() * 760 + 20
        const size = rnd() * 30 + 18
        const dur = rnd() * 6 + 6
        const delay = rnd() * 4
        const opacity = rnd() * 0.08 + 0.05
        const rotDir = rnd() > 0.5 ? 360 : -360
        const floatY = (rnd() - 0.5) * 40
        hexes += `
          <polygon points="${hexPoints(size)}" fill="none" stroke="var(--primary)" stroke-width="1" opacity="${opacity}"
            transform="translate(${x.toFixed(1)},${y.toFixed(1)})">
            <animateTransform attributeName="transform" type="rotate" dur="${dur}s" repeatCount="indefinite"
              begin="${delay}s" values="0;${rotDir}" additive="sum"/>
            <animate attributeName="opacity" dur="${dur}s" repeatCount="indefinite" begin="${delay}s"
              values="${opacity};${opacity * 2.5};${opacity}"/>
            <animateTransform attributeName="transform" type="translate" dur="${dur * 1.5}s" repeatCount="indefinite"
              begin="${delay}s" values="0,0;0,${floatY.toFixed(1)};0,0" additive="sum"/>
          </polygon>`
      }
      return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 800" preserveAspectRatio="xMidYMid slice" width="100%" height="100%">
        <defs>
          <filter id="h-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2"/>
          </filter>
        </defs>
        <g filter="url(#h-glow)">${hexes}</g>
      </svg>`
    },
  },
}
