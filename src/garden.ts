import type { PlantKind } from './types';

// One level per finished work session; a plant is full grown at this level.
export const PLANT_MAX_LEVEL = 12;
export const PLANT_CHOICES = 5;

export const PLANT_KINDS: PlantKind[] = [
  'fern',
  'cactus',
  'bonsai',
  'sunflower',
  'tulip',
  'palm',
  'vine',
  'cherry',
];

export const PLANT_NAMES: Record<PlantKind, string> = {
  fern: 'FERN',
  cactus: 'CACTUS',
  bonsai: 'BONSAI',
  sunflower: 'SUNFLOWER',
  tulip: 'TULIP',
  palm: 'PALM',
  vine: 'VINE',
  cherry: 'CHERRY BLOSSOM',
};

// draw `n` distinct kinds at random
export function drawPlantChoices(n = PLANT_CHOICES): PlantKind[] {
  const pool = [...PLANT_KINDS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

// ---- drawing ----
// Every plant is glowing line art on a canvas, like the Snake board. Shapes are
// driven by a seeded random so the same plant draws identically every time.

const C = {
  green: '#5cf593',
  lime: '#b8f24a',
  cyan: '#3ee5ff',
  amber: '#ffc052',
  orange: '#ffa652',
  yellow: '#ffe66e',
  red: '#ff8797',
  magenta: '#f18dff',
  violet: '#bda6ff',
  pink: '#ff9ed2',
  bark: '#c98b5a',
  faint: '#52657d',
};

function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Ctx = CanvasRenderingContext2D;

// FX off draws the same lines without the neon blur. Set by the Garden
// component before each redraw (this file stays free of store imports).
let glowOn = true;
export function setGardenGlow(on: boolean) {
  glowOn = on;
}
export const gardenGlow = () => glowOn;

function glow(ctx: Ctx, color: string, width: number, blur = 8) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = glowOn ? blur : 0;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

function line(ctx: Ctx, x1: number, y1: number, x2: number, y2: number) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function dot(ctx: Ctx, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function leaf(ctx: Ctx, x: number, y: number, angle: number, len: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.5, -len * 0.32, len, 0);
  ctx.quadraticCurveTo(len * 0.5, len * 0.32, 0, 0);
  ctx.stroke();
  ctx.restore();
}

// a seed: a small glowing mound with a spark in it
function drawSeed(ctx: Ctx, x: number, y: number, s: number, color: string) {
  glow(ctx, color, Math.max(1, s * 0.012));
  ctx.beginPath();
  ctx.ellipse(x, y, s * 0.12, s * 0.05, 0, Math.PI, 0);
  ctx.stroke();
  dot(ctx, x, y - s * 0.035, Math.max(1.2, s * 0.018));
}

const SEED_COLOR: Record<PlantKind, string> = {
  fern: C.green,
  cactus: C.green,
  bonsai: C.amber,
  sunflower: C.yellow,
  tulip: C.red,
  palm: C.lime,
  vine: C.violet,
  cherry: C.pink,
};

/**
 * Draw a plant standing with its base at (x, y). `size` is the height of a
 * full-grown plant in pixels; `level` runs 0..PLANT_MAX_LEVEL.
 */
export function drawPlant(
  ctx: Ctx,
  kind: PlantKind,
  level: number,
  seed: string,
  x: number,
  y: number,
  size: number,
) {
  ctx.save();
  if (level <= 0) {
    drawSeed(ctx, x, y, size, SEED_COLOR[kind]);
  } else {
    const t = Math.min(1, level / PLANT_MAX_LEVEL);
    const rnd = seeded(seed);
    PAINTERS[kind](ctx, x, y, size, t, level, rnd);
  }
  ctx.restore();
}

type Painter = (
  ctx: Ctx,
  x: number,
  y: number,
  s: number,
  t: number, // growth 0..1
  level: number,
  rnd: () => number,
) => void;

const lw = (s: number, k = 1) => Math.max(1, s * 0.014 * k);

const PAINTERS: Record<PlantKind, Painter> = {
  // fronds arch out from the base, more of them and longer each level
  fern(ctx, x, y, s, t, level, rnd) {
    const fronds = Math.min(7, 1 + Math.floor(level / 2));
    glow(ctx, C.green, lw(s));
    for (let i = 0; i < fronds; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const spread = fronds === 1 ? 0 : (i / (fronds - 1) - 0.5) * 2;
      const len = s * (0.35 + 0.6 * t) * (0.75 + 0.25 * rnd()) * (1 - Math.abs(spread) * 0.25);
      const tipX = x + spread * len * 0.75 + side * s * 0.02;
      const tipY = y - len * (1 - Math.abs(spread) * 0.45);
      const cx = x + spread * len * 0.15;
      const cy = y - len * 0.95;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(cx, cy, tipX, tipY);
      ctx.stroke();
      // leaflets along the frond
      const leaflets = Math.round(3 + 6 * t);
      for (let k = 1; k <= leaflets; k++) {
        const u = k / (leaflets + 1);
        const px = (1 - u) * (1 - u) * x + 2 * (1 - u) * u * cx + u * u * tipX;
        const py = (1 - u) * (1 - u) * y + 2 * (1 - u) * u * cy + u * u * tipY;
        const ll = s * 0.07 * (1 - u * 0.7) * (0.5 + t * 0.5);
        line(ctx, px, py, px - ll, py - ll * 0.5);
        line(ctx, px, py, px + ll, py - ll * 0.5);
      }
    }
  },

  // a saguaro column with ribs; arms at levels 4 and 8, a flower when full grown
  cactus(ctx, x, y, s, t, level) {
    const h = s * (0.25 + 0.7 * t);
    const w = s * (0.08 + 0.05 * t);
    glow(ctx, C.green, lw(s));
    const column = (cx: number, by: number, ch: number, cw: number) => {
      ctx.beginPath();
      ctx.moveTo(cx - cw / 2, by);
      ctx.lineTo(cx - cw / 2, by - ch + cw / 2);
      ctx.arc(cx, by - ch + cw / 2, cw / 2, Math.PI, 0);
      ctx.lineTo(cx + cw / 2, by);
      ctx.stroke();
      ctx.save();
      ctx.globalAlpha = 0.5;
      line(ctx, cx, by - 2, cx, by - ch + cw * 0.6);
      ctx.restore();
    };
    column(x, y, h, w);
    const arm = (side: number, at: number, len: number) => {
      const ax = x + side * w / 2;
      const ay = y - h * at;
      const out = w * 1.1;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax + side * out, ay);
      ctx.stroke();
      column(ax + side * (out + w * 0.3), ay + w * 0.35, len, w * 0.7);
    };
    if (level >= 4) arm(1, 0.45, h * 0.35 * Math.min(1, (level - 3) / 4));
    if (level >= 8) arm(-1, 0.6, h * 0.3 * Math.min(1, (level - 7) / 4));
    if (level >= 12) {
      glow(ctx, C.magenta, lw(s));
      const fy = y - h - s * 0.01;
      for (let i = 0; i < 5; i++) leaf(ctx, x, fy, -Math.PI / 2 + (i - 2) * 0.55, s * 0.07);
    }
  },

  // a curving trunk in a pot, with foliage pads added as it grows
  bonsai(ctx, x, y, s, t, level, rnd) {
    const potW = s * 0.34;
    const potH = s * 0.1;
    glow(ctx, C.amber, lw(s));
    ctx.beginPath();
    ctx.moveTo(x - potW / 2, y - potH);
    ctx.lineTo(x + potW / 2, y - potH);
    ctx.lineTo(x + potW * 0.4, y);
    ctx.lineTo(x - potW * 0.4, y);
    ctx.closePath();
    ctx.stroke();
    const base = y - potH;
    const h = s * (0.2 + 0.6 * t);
    glow(ctx, C.bark, lw(s, 1.6));
    const pts: [number, number][] = [];
    const bends = 4;
    for (let i = 0; i <= bends; i++) {
      const u = i / bends;
      const wob = Math.sin(u * Math.PI * 1.4 + 0.6) * s * 0.09 * t;
      pts.push([x + wob, base - h * u]);
    }
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
    const pads = Math.min(6, Math.ceil(level / 2));
    glow(ctx, C.green, lw(s));
    for (let i = 0; i < pads; i++) {
      const p = pts[Math.min(pts.length - 1, 1 + Math.floor((i / Math.max(1, pads - 1)) * (pts.length - 2)) + (i === pads - 1 ? 1 : 0))];
      const side = i === pads - 1 ? 0 : i % 2 === 0 ? 1 : -1;
      const px = p[0] + side * s * (0.1 + 0.06 * rnd());
      const py = p[1] - s * 0.02;
      if (side !== 0) line(ctx, p[0], p[1], px, py);
      const rw = s * (0.08 + 0.06 * t);
      ctx.beginPath();
      ctx.ellipse(px, py - rw * 0.25, rw, rw * 0.42, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  },

  // stem and leaf pairs; the head appears at level 6 and gains petals
  sunflower(ctx, x, y, s, t, level) {
    const h = s * (0.2 + 0.75 * t);
    glow(ctx, C.green, lw(s, 1.2));
    line(ctx, x, y, x, y - h);
    const pairs = Math.min(4, Math.ceil(level / 3));
    for (let i = 0; i < pairs; i++) {
      const ly = y - h * (0.2 + i * 0.18);
      leaf(ctx, x, ly, -0.5, s * 0.13);
      leaf(ctx, x, ly - s * 0.03, Math.PI + 0.5, s * 0.13);
    }
    if (level >= 6) {
      const r = s * (0.04 + 0.06 * t);
      const hy = y - h;
      const petals = Math.min(14, 4 + (level - 6) * 2);
      glow(ctx, C.yellow, lw(s));
      for (let i = 0; i < petals; i++) leaf(ctx, x, hy, (i / petals) * Math.PI * 2, r * 1.9);
      glow(ctx, C.orange, lw(s));
      ctx.beginPath();
      ctx.arc(x, hy, r, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      glow(ctx, C.green, lw(s));
      dot(ctx, x, y - h, s * 0.02);
    }
  },

  // stem, two long leaves, a bud that opens over the last levels
  tulip(ctx, x, y, s, t, level) {
    const h = s * (0.2 + 0.6 * t);
    glow(ctx, C.green, lw(s, 1.2));
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + s * 0.03, y - h * 0.5, x, y - h);
    ctx.stroke();
    leaf(ctx, x, y - s * 0.02, -Math.PI / 2 - 0.45, s * (0.15 + 0.2 * t));
    if (level >= 3) leaf(ctx, x, y - s * 0.04, -Math.PI / 2 + 0.4, s * (0.12 + 0.18 * t));
    if (level >= 4) {
      const open = Math.max(0, (level - 8) / 4); // 0 bud .. 1 open
      const bw = s * (0.05 + 0.04 * t);
      const bh = s * (0.1 + 0.06 * t);
      const by = y - h;
      glow(ctx, C.red, lw(s));
      const spread = 0.15 + open * 0.5;
      for (const a of [-spread, 0, spread]) {
        ctx.save();
        ctx.translate(x, by);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(-bw, -bh * 0.5, 0, -bh);
        ctx.quadraticCurveTo(bw, -bh * 0.5, 0, 0);
        ctx.stroke();
        ctx.restore();
      }
    }
  },

  // a segmented leaning trunk with fronds at the crown; coconuts when full grown
  palm(ctx, x, y, s, t, level, rnd) {
    const h = s * (0.15 + 0.8 * t);
    const lean = s * 0.12 * t;
    const segs = Math.max(2, Math.round(3 + 7 * t));
    glow(ctx, C.bark, lw(s, 1.4));
    let px = x;
    let py = y;
    for (let i = 1; i <= segs; i++) {
      const u = i / segs;
      const nx = x + lean * u * u;
      const ny = y - h * u;
      line(ctx, px, py, nx, ny);
      line(ctx, nx - s * 0.025, ny + 1, nx + s * 0.025, ny + 1);
      px = nx;
      py = ny;
    }
    const fronds = Math.min(8, 2 + Math.floor(level / 2));
    glow(ctx, C.lime, lw(s));
    for (let i = 0; i < fronds; i++) {
      const a = -Math.PI / 2 + ((i / Math.max(1, fronds - 1)) - 0.5) * 2.9 + (rnd() - 0.5) * 0.15;
      const len = s * (0.12 + 0.22 * t);
      const ex = px + Math.cos(a) * len;
      const ey = py + Math.sin(a) * len * 0.6 + len * 0.25;
      const cx = px + Math.cos(a) * len * 0.5;
      const cy = py + Math.sin(a) * len * 0.75 - len * 0.12;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(cx, cy, ex, ey);
      ctx.stroke();
      for (let k = 1; k <= 4; k++) {
        const u = k / 5;
        const qx = (1 - u) * (1 - u) * px + 2 * (1 - u) * u * cx + u * u * ex;
        const qy = (1 - u) * (1 - u) * py + 2 * (1 - u) * u * cy + u * u * ey;
        line(ctx, qx, qy, qx + Math.cos(a + 1.2) * len * 0.12, qy + len * 0.12);
      }
    }
    if (level >= 12) {
      glow(ctx, C.amber, lw(s));
      dot(ctx, px - s * 0.02, py + s * 0.03, s * 0.022);
      dot(ctx, px + s * 0.025, py + s * 0.035, s * 0.022);
    }
  },

  // climbs a trellis in a zigzag, leaves along the way, flowers at the top
  vine(ctx, x, y, s, t, level, rnd) {
    const H = s * 0.95;
    const W = s * 0.3;
    glow(ctx, C.faint, lw(s, 0.8), 0);
    ctx.save();
    ctx.globalAlpha = 0.55;
    line(ctx, x - W / 2, y, x - W / 2, y - H);
    line(ctx, x + W / 2, y, x + W / 2, y - H);
    for (let k = 1; k <= 4; k++) line(ctx, x - W / 2, y - (H * k) / 4.5, x + W / 2, y - (H * k) / 4.5);
    ctx.restore();
    const h = H * (0.12 + 0.88 * t);
    const steps = Math.max(2, Math.round(2 + 5 * t));
    // the stem winds in smooth S-curves through points that alternate sides
    glow(ctx, C.green, lw(s));
    const pts: [number, number][] = [];
    for (let i = 1; i <= steps; i++) {
      const vx = x + (i % 2 === 0 ? -1 : 1) * W * 0.3 * (0.7 + 0.3 * rnd());
      pts.push([vx, y - (h * i) / steps]);
    }
    ctx.beginPath();
    ctx.moveTo(x, y);
    let [lx, ly] = [x, y];
    for (const [vx, vy] of pts) {
      ctx.bezierCurveTo(lx, (ly + vy) / 2, vx, (ly + vy) / 2, vx, vy);
      [lx, ly] = [vx, vy];
    }
    ctx.stroke();
    pts.forEach(([vx, vy], i) => leaf(ctx, vx, vy, i % 2 === 0 ? -0.2 : Math.PI + 0.2, s * 0.08));
    if (level >= 7) {
      const flowers = Math.min(5, level - 6);
      const r = s * 0.026;
      for (let i = 0; i < flowers; i++) {
        const [fx, fy] = pts[pts.length - 1 - ((i * 2) % pts.length)];
        const cx = fx + (i % 2 === 0 ? 1 : -1) * r * 1.6;
        glow(ctx, C.violet, lw(s), 10);
        for (let p = 0; p < 5; p++) {
          const a = (p / 5) * Math.PI * 2;
          dot(ctx, cx + Math.cos(a) * r, fy + Math.sin(a) * r, r * 0.62);
        }
        glow(ctx, C.yellow, 1, 4);
        dot(ctx, cx, fy, r * 0.4);
      }
    }
  },

  // a branching trunk that grows deeper each level; blossoms fill in from level 4
  cherry(ctx, x, y, s, t, level, rnd) {
    const depth = Math.min(6, 1 + Math.floor(level / 2));
    const trunk = s * (0.12 + 0.14 * t);
    const tips: [number, number][] = [];
    const branch = (bx: number, by: number, angle: number, len: number, d: number) => {
      const ex = bx + Math.cos(angle) * len;
      const ey = by + Math.sin(angle) * len;
      glow(ctx, C.bark, Math.max(1, lw(s, 0.6) * (1 + d * 0.5)), 4);
      line(ctx, bx, by, ex, ey);
      if (d <= 1) {
        tips.push([ex, ey]);
        return;
      }
      // pull branches back toward upright so the crown stays rounded, not flat
      const upright = (a: number) => a + (-Math.PI / 2 - a) * 0.22;
      for (let i = 0; i < 2; i++) {
        const spread = 0.28 + rnd() * 0.26;
        const a = upright(angle + (i === 0 ? -spread : spread));
        branch(ex, ey, a, len * (0.7 + rnd() * 0.1), d - 1);
      }
    };
    branch(x, y, -Math.PI / 2 + (rnd() - 0.5) * 0.15, trunk, depth);
    if (level >= 4) {
      const per = Math.min(5, Math.ceil((level - 3) / 2) + 1);
      glow(ctx, C.pink, lw(s), 10);
      for (const [tx, ty] of tips) {
        for (let k = 0; k < per; k++) {
          dot(ctx, tx + (rnd() - 0.5) * s * 0.08, ty + (rnd() - 0.5) * s * 0.07, Math.max(1.2, s * 0.012 * (0.6 + rnd() * 0.6)));
        }
      }
    } else {
      glow(ctx, C.green, lw(s, 0.8));
      for (const [tx, ty] of tips) dot(ctx, tx, ty, Math.max(1, s * 0.01));
    }
  },
};

