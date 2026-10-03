import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { PLANT_MAX_LEVEL, PLANT_NAMES, drawPlant, gardenGlow, setGardenGlow } from '../garden';
import type { PlantKind } from '../types';

const H = 240;
const HORIZON = 26; // where the far end of the grid fades out
const FRONT_Y = H - 22; // where the front row stands
const UNIT = 84; // spacing between plants in the front row, in px
const ROW_DEPTH = 0.55; // how much further away each row back is
const MAX_ROWS = 8; // the back row is nearly faded out
const FINISHED_SIZE = 74; // a finished plant's height in the front row
const GROWING_SIZE = 150;
const EDGE = 60; // keep plants this far in from the sides (they fade there)
const LANE = 78; // half-width of the clear lane behind the growing plant, in px

// the canvas is drawn at device resolution so the glow lines stay crisp
function setupCanvas(canvas: HTMLCanvasElement, w: number, h: number) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

// Perspective: something `d` times further away than the front row sits
// higher up the screen and draws 1/d the size.
const depthOf = (row: number) => 1 + row * ROW_DEPTH;
const yAt = (d: number) => HORIZON + (FRONT_Y - HORIZON) / d;
const rowAlpha = (row: number) => (row === 0 ? 1 : Math.pow(1 - row / MAX_ROWS, 1.3));

// A Tron floor that fades out toward the horizon instead of ending in a line.
// Columns are one plant apart so the plants stand on the grid lines.
function drawFloor(ctx: CanvasRenderingContext2D, w: number) {
  ctx.clearRect(0, 0, w, H);
  const cx = w / 2;

  const glowFill = ctx.createLinearGradient(0, HORIZON, 0, H);
  glowFill.addColorStop(0, 'rgba(62, 229, 255, 0)');
  glowFill.addColorStop(1, 'rgba(62, 229, 255, 0.09)');
  ctx.fillStyle = glowFill;
  ctx.fillRect(0, HORIZON, w, H - HORIZON);

  ctx.shadowColor = '#3ee5ff';
  ctx.shadowBlur = gardenGlow() ? 6 : 0;
  ctx.lineWidth = 1;

  // rows: fade out completely before the horizon
  for (let d = 0.8; d < 9; d *= 1.25) {
    const y = yAt(d);
    if (y > H) continue;
    const t = (y - HORIZON) / (FRONT_Y - HORIZON); // 1 at the front, 0 at the horizon
    ctx.strokeStyle = `rgba(62, 229, 255, ${0.34 * Math.min(1, Math.pow(t, 1.6) * 1.2)})`;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // columns: bright at the front, gone by the horizon
  const fade = ctx.createLinearGradient(0, H, 0, HORIZON);
  fade.addColorStop(0, 'rgba(62, 229, 255, 0.34)');
  fade.addColorStop(0.55, 'rgba(62, 229, 255, 0.07)');
  fade.addColorStop(0.85, 'rgba(62, 229, 255, 0)');
  ctx.strokeStyle = fade;
  const near = 0.75; // a depth just in front of the canvas bottom
  const reach = Math.ceil((cx * near) / UNIT) + 1;
  for (let j = -reach; j <= reach; j++) {
    ctx.beginPath();
    ctx.moveTo(cx + (j * UNIT) / near, yAt(near));
    ctx.lineTo(cx, HORIZON);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
}

// Spots on one row, nearest the middle first, right before left. Every row
// leaves a clear lane behind the growing plant, and rows alternate by half a
// spot so plants peek out between the ones in front. A row holds as many as
// fit across the grid; only then do plants move back a row.
function rowSlots(row: number, w: number): number[] {
  const d = depthOf(row);
  const fit = ((w / 2 - EDGE) * d) / UNIT; // furthest offset still on screen
  const lane = (LANE * d) / UNIT; // the lane's half-width, in spots, at this depth
  const first = Math.ceil(lane - (row % 2) * 0.5) + (row % 2) * 0.5;
  const offsets: number[] = [];
  for (let o = Math.max(first, 0.5); o <= fit; o += 1) offsets.push(o, -o);
  return offsets;
}

// Newest finished plants stand at the front beside the growing one; each new
// one pushes the older ones outward and, when a row is full, a row further back.
function layout(count: number, w: number) {
  const spots: { row: number; offset: number }[] = [];
  for (let row = 0; row < MAX_ROWS && spots.length < count; row++) {
    for (const offset of rowSlots(row, w)) {
      if (spots.length >= count) break;
      spots.push({ row, offset });
    }
  }
  return spots;
}

export function Garden() {
  const plant = useStore((s) => s.plant);
  const finished = useStore((s) => s.finishedPlants);
  const choices = useStore((s) => s.plantChoices);
  const pendingGrowth = useStore((s) => s.pendingGrowth);
  const offerPlants = useStore((s) => s.offerPlants);
  const pickPlant = useStore((s) => s.pickPlant);
  const fxEnabled = useStore((s) => s.fxEnabled);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);

  // first visit, or a deck from before the garden: put choices on the table
  useEffect(() => {
    if (!plant && choices.length === 0) offerPlants();
  }, [plant, choices.length, offerPlants]);

  // the grid spans the whole panel, so redraw whenever the panel resizes
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(Math.round(el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const newestFirst = [...finished].reverse();
  const spots = width > 0 ? layout(newestFirst.length, width) : [];
  const hidden = width > 0 ? newestFirst.length - spots.length : 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width === 0) return;
    const ctx = setupCanvas(canvas, width, H);
    setGardenGlow(fxEnabled);
    drawFloor(ctx, width);
    const cx = width / 2;
    // back to front, so nearer plants overlap the ones behind them
    const placed = spots.map((spot, i) => ({ ...spot, p: newestFirst[i] }));
    placed.sort((a, b) => b.row - a.row);
    for (const { row, offset, p } of placed) {
      const d = depthOf(row);
      ctx.save();
      ctx.globalAlpha = rowAlpha(row);
      drawPlant(ctx, p.kind, PLANT_MAX_LEVEL, p.id, cx + (offset * UNIT) / d, yAt(d), FINISHED_SIZE / d);
      ctx.restore();
    }
    if (plant) drawPlant(ctx, plant.kind, plant.level, plant.id, cx, FRONT_Y + 6, GROWING_SIZE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plant, finished, width, fxEnabled]);

  return (
    <div className="garden">
      <div className="garden-stage" ref={stageRef}>
        <canvas ref={canvasRef} className="garden-canvas" style={{ width: width || '100%', height: H }} />
        {choices.length > 0 && (
          <PlantPicker choices={choices} pending={pendingGrowth} onPick={pickPlant} first={finished.length === 0} />
        )}
      </div>
      <div className="garden-info">
        {plant ? (
          <>
            <span className="garden-name">{PLANT_NAMES[plant.kind]}</span>
            <span className="garden-level">
              {plant.level === 0 ? 'seed' : `level ${plant.level}`}/{PLANT_MAX_LEVEL}
            </span>
            <span className="garden-pips" aria-hidden>
              {Array.from({ length: PLANT_MAX_LEVEL }, (_, i) => (
                <i key={i} className={i < plant.level ? 'on' : ''} />
              ))}
            </span>
          </>
        ) : (
          <span className="garden-name">pick a plant to grow</span>
        )}
        <span className="dim">
          garden {finished.length}
          {hidden > 0 && ` · ${hidden} faded into the distance`}
        </span>
      </div>
      <p className="garden-hint dim">
        Each finished session grows your plant one level. RESET or SKIP mid-session costs a level.
      </p>
    </div>
  );
}

function PlantPicker({
  choices,
  pending,
  onPick,
  first,
}: {
  choices: PlantKind[];
  pending: number;
  onPick: (k: PlantKind) => void;
  first: boolean;
}) {
  return (
    <div className="garden-picker">
      <div className="garden-picker-title">
        {first ? '> choose your first plant' : '> fully grown. choose your next plant'}
        {pending > 0 && <span className="dim"> · {pending} session{pending > 1 ? 's' : ''} saved for it</span>}
      </div>
      <div className="garden-choices">
        {choices.map((k) => (
          <button key={k} className="garden-choice" onClick={() => onPick(k)}>
            <PlantPreview kind={k} />
            <span>{PLANT_NAMES[k]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// a small full-grown preview so you can see what you are picking
function PlantPreview({ kind }: { kind: PlantKind }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = setupCanvas(canvas, 72, 80);
    ctx.clearRect(0, 0, 72, 80);
    drawPlant(ctx, kind, PLANT_MAX_LEVEL, `preview-${kind}`, 36, 74, 66);
  }, [kind]);
  return <canvas ref={ref} style={{ width: 72, height: 80 }} />;
}
