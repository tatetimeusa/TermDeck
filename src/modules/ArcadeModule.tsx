import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { Panel } from '../components/Panel';
import { fmtTimer } from '../util';

const CELLS = 21;
const CELL = 20;
const SIZE = CELLS * CELL; // 420px board
const SPEED = 110; // ms per step

type P = { x: number; y: number };
type Status = 'idle' | 'playing' | 'paused' | 'over';

export function ArcadeModule() {
  const banked = useStore((s) => s.bankedBreakSeconds);
  const spendBreak = useStore((s) => s.spendBreak);
  const best = useStore((s) => s.bestSnake);
  const setBest = useStore((s) => s.setBestSnake);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [score, setScore] = useState(0);

  // mutable game state kept in refs so the interval loop never goes stale
  const snake = useRef<P[]>([]);
  const dir = useRef<P>({ x: 1, y: 0 });
  const nextDir = useRef<P>({ x: 1, y: 0 });
  const food = useRef<P>({ x: 5, y: 5 });
  const statusRef = useRef<Status>('idle');
  statusRef.current = status;

  const randFood = (sn: P[]): P => {
    let p: P;
    do {
      p = { x: Math.floor(Math.random() * CELLS), y: Math.floor(Math.random() * CELLS) };
    } while (sn.some((s) => s.x === p.x && s.y === p.y));
    return p;
  };

  const draw = () => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#080c14';
    ctx.fillRect(0, 0, SIZE, SIZE);

    ctx.strokeStyle = 'rgba(163, 230, 53, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 1; i < CELLS; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL, 0);
      ctx.lineTo(i * CELL, SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * CELL);
      ctx.lineTo(SIZE, i * CELL);
      ctx.stroke();
    }

    const f = food.current;
    ctx.fillStyle = '#2dd4ee';
    ctx.shadowColor = '#2dd4ee';
    ctx.shadowBlur = 12;
    ctx.fillRect(f.x * CELL + 4, f.y * CELL + 4, CELL - 8, CELL - 8);

    snake.current.forEach((s, i) => {
      ctx.fillStyle = i === 0 ? '#d4ff7a' : '#a3e635';
      ctx.shadowColor = '#a3e635';
      ctx.shadowBlur = i === 0 ? 14 : 6;
      ctx.fillRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2);
    });
    ctx.shadowBlur = 0;
  };

  const reset = () => {
    const mid = Math.floor(CELLS / 2);
    snake.current = [
      { x: mid, y: mid },
      { x: mid - 1, y: mid },
      { x: mid - 2, y: mid },
    ];
    dir.current = { x: 1, y: 0 };
    nextDir.current = { x: 1, y: 0 };
    food.current = randFood(snake.current);
    setScore(0);
  };

  const start = () => {
    if (useStore.getState().bankedBreakSeconds <= 0) return;
    reset();
    setStatus('playing');
  };

  // draw an idle board on first mount
  useEffect(() => {
    reset();
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // redraw on status transitions (pause overlay, game over, etc.)
  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // record a new high score
  useEffect(() => {
    if (status === 'over' && score > best) setBest(score);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // the game loop — runs only while playing
  useEffect(() => {
    if (status !== 'playing') return;
    const id = setInterval(() => {
      dir.current = nextDir.current;
      const head = snake.current[0];
      const nh = { x: head.x + dir.current.x, y: head.y + dir.current.y };

      if (nh.x < 0 || nh.y < 0 || nh.x >= CELLS || nh.y >= CELLS) {
        setStatus('over');
        return;
      }
      if (snake.current.some((s) => s.x === nh.x && s.y === nh.y)) {
        setStatus('over');
        return;
      }

      const grew = nh.x === food.current.x && nh.y === food.current.y;
      const next = [nh, ...snake.current];
      if (grew) {
        setScore((sc) => sc + 1);
        food.current = randFood(next);
      } else {
        next.pop();
      }
      snake.current = next;
      draw();
    }, SPEED);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // spend banked break time while playing; when it runs out, break's over
  useEffect(() => {
    if (status !== 'playing') return;
    const id = setInterval(() => {
      spendBreak(1);
      if (useStore.getState().bankedBreakSeconds <= 0) setStatus('over');
    }, 1000);
    return () => clearInterval(id);
  }, [status, spendBreak]);

  // keyboard controls
  useEffect(() => {
    const map: Record<string, P> = {
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      w: { x: 0, y: -1 },
      s: { x: 0, y: 1 },
      a: { x: -1, y: 0 },
      d: { x: 1, y: 0 },
    };
    const onKey = (e: KeyboardEvent) => {
      // don't steal keys while the user is typing (e.g. in the command bar)
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) {
        return;
      }
      if (e.key === ' ') {
        e.preventDefault();
        if (statusRef.current === 'playing') setStatus('paused');
        else if (statusRef.current === 'paused') setStatus('playing');
        else start();
        return;
      }
      const nd = map[e.key];
      if (!nd) return;
      e.preventDefault();
      const cur = dir.current;
      if (nd.x === -cur.x && nd.y === -cur.y) return; // no instant reverse
      nextDir.current = nd;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const locked = banked <= 0 && status !== 'over';

  return (
    <Panel title="ARCADE" accent="arcade">
      <div className="arcade">
        <div className="arcade-stage">
          <canvas ref={canvasRef} width={SIZE} height={SIZE} className="snake-canvas" />

          {locked && status === 'idle' && (
            <div className="arcade-overlay">
              <div className="ov-title">🔒 LOCKED</div>
              <div className="ov-sub">Finish a focus session in FOCUS to earn break time, then come play.</div>
            </div>
          )}
          {!locked && status === 'idle' && (
            <div className="arcade-overlay">
              <div className="ov-title">SNAKE</div>
              <div className="ov-sub">
                <b>Space</b> or START to play · <b>Arrows / WASD</b> to steer
              </div>
            </div>
          )}
          {status === 'paused' && (
            <div className="arcade-overlay">
              <div className="ov-title">PAUSED</div>
              <div className="ov-sub">press <b>Space</b> to resume</div>
            </div>
          )}
          {status === 'over' && (
            <div className="arcade-overlay">
              <div className="ov-title">GAME OVER</div>
              <div className="ov-sub">
                score <b>{score}</b>
                {score > 0 && score >= best ? ' · new best!' : ''}
              </div>
              <button className="big-btn go" onClick={start} disabled={banked <= 0}>
                [ PLAY AGAIN ]
              </button>
              {banked <= 0 && <div className="ov-sub dim">out of break time — go focus to earn more</div>}
            </div>
          )}
        </div>

        <div className="arcade-side">
          <div className="arcade-stat">
            <span>SCORE</span>
            <b>{score}</b>
          </div>
          <div className="arcade-stat">
            <span>BEST</span>
            <b>{best}</b>
          </div>
          <div className="arcade-stat">
            <span>BREAK LEFT</span>
            <b className={banked <= 0 ? 'empty' : ''}>{fmtTimer(banked)}</b>
          </div>

          {status === 'playing' ? (
            <button className="big-btn" onClick={() => setStatus('paused')}>
              [ PAUSE ]
            </button>
          ) : (
            <button className="big-btn go" onClick={start} disabled={banked <= 0 && status !== 'over'}>
              {status === 'over' ? '[ PLAY AGAIN ]' : '[ START ]'}
            </button>
          )}

          <p className="arcade-hint dim">
            Playing spends the break time you bank by finishing focus sessions. Earn it, then enjoy it.
          </p>
        </div>
      </div>
    </Panel>
  );
}
