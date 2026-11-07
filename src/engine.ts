export const W = 10, H = 20;
export const COLORS = ['#10141f','#22d3ee','#facc15','#a855f7','#22c55e','#ef4444','#3b82f6','#f97316'];
export const SHAPES: number[][][] = [
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
  [[2,2],[2,2]],
  [[0,3,0],[3,3,3],[0,0,0]],
  [[0,4,4],[4,4,0],[0,0,0]],
  [[5,5,0],[0,5,5],[0,0,0]],
  [[6,0,0],[6,6,6],[0,0,0]],
  [[0,0,7],[7,7,7],[0,0,0]],
];
export type Piece = { m: number[][]; x: number; y: number };

// Stage system: fixed line goals per stage (replaces dynamic level calculation)
export const STAGE_GOALS: number[] = [
  10,  // Stage 1
  20,  // Stage 2
  30,  // Stage 3
  40,  // Stage 4
  50,  // Stage 5
  60,  // Stage 6
  70,  // Stage 7
  80,  // Stage 8
  90,  // Stage 9
  100, // Stage 10
];

/**
 * Returns the total lines required to complete the given stage (1-indexed).
 * Stage 1 = 10 lines, Stage 2 = 20 lines, ..., Stage 10 = 100 lines.
 */
export function stageGoal(stage: number): number {
  if (stage < 1) return STAGE_GOALS[0];
  if (stage > STAGE_GOALS.length) return STAGE_GOALS[STAGE_GOALS.length - 1];
  return STAGE_GOALS[stage - 1];
}

/**
 * Returns the current stage based on total lines cleared.
 * Stage increments only when the stage's line goal is reached.
 */
export function stageFromLines(lines: number): number {
  for (let i = 0; i < STAGE_GOALS.length; i++) {
    if (lines < STAGE_GOALS[i]) return i + 1;
  }
  return STAGE_GOALS.length; // Max stage
}

/**
 * Returns the progress (0-1) within the current stage.
 */
export function stageProgress(lines: number): number {
  const stage = stageFromLines(lines);
  const prevGoal = stage > 1 ? STAGE_GOALS[stage - 2] : 0;
  const currentGoal = STAGE_GOALS[stage - 1];
  return Math.min(1, Math.max(0, (lines - prevGoal) / (currentGoal - prevGoal)));
}

export type State = {
  board: number[][]; cur: Piece; bag: number[]; next: number;
  score: number; lines: number; level: number; pieces: number;
  stage: number;                    // Current stage (1-10)
  stageComplete: boolean;           // Flag to show stage complete screen
  clears: number[]; over: boolean; start: number;
};

const shuffle = () => {
  const a = [0,1,2,3,4,5,6];
  for (let i = 6; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
const make = (t: number): Piece => {
  const m = SHAPES[t].map(r => [...r]);
  return { m, x: Math.floor((W - m[0].length) / 2), y: 0 };
};
export const fits = (b: number[][], m: number[][], x: number, y: number) =>
  m.every((row, r) => row.every((v, c) => {
    if (!v) return true;
    const bx = x + c, by = y + r;
    return bx >= 0 && bx < W && by < H && !b[by][bx];
  }));

export function init(): State {
  const bag = [...shuffle(), ...shuffle()];
  const t = bag.shift()!, n = bag.shift()!;
  return {
    board: Array.from({ length: H }, () => Array(W).fill(0)),
    cur: make(t), bag, next: n, score: 0, lines: 0, level: 1, stage: 1, stageComplete: false, pieces: 1,
    clears: [0,0,0,0], over: false, start: Date.now(),
  };
}

export const move = (s: State, dx: number): State =>
  s.over || !fits(s.board, s.cur.m, s.cur.x + dx, s.cur.y) ? s : { ...s, cur: { ...s.cur, x: s.cur.x + dx } };

export const rotate = (s: State): State => {
  if (s.over) return s;
  const m = s.cur.m[0].map((_, i) => s.cur.m.map(r => r[i]).reverse());
  for (const k of [0, -1, 1, -2, 2])
    if (fits(s.board, m, s.cur.x + k, s.cur.y)) return { ...s, cur: { ...s.cur, m, x: s.cur.x + k } };
  return s;
};

function lock(s: State): State {
  const board = s.board.map(r => [...r]);
  s.cur.m.forEach((row, r) => row.forEach((v, c) => {
    const y = s.cur.y + r;
    if (v && y >= 0) board[y][s.cur.x + c] = v;
  }));
  const kept = board.filter(r => r.some(v => !v));
  const n = H - kept.length;
  const rows = [...Array.from({ length: n }, () => Array(W).fill(0)), ...kept];
  const lines = s.lines + n;
  const clears = [...s.clears];
  if (n) clears[n - 1]++;
  const bag = [...s.bag];
  if (bag.length < 7) bag.push(...shuffle());
  const cur = make(s.next);
  const next = bag.shift()!;
  const newStage = stageFromLines(lines);
  const stageComplete = newStage > s.stage;
  return {
    ...s, board: rows, cur, next, bag, lines, clears,
    score: s.score + [0, 100, 300, 500, 800][n] * s.level,
    level: newStage, // Use stage as level for backward compatibility
    stage: newStage,
    stageComplete,
    pieces: s.pieces + 1,
    over: !fits(rows, cur.m, cur.x, cur.y),
  };
}

export const tick = (s: State, soft = false): State => {
  if (s.over) return s;
  if (fits(s.board, s.cur.m, s.cur.x, s.cur.y + 1))
    return { ...s, cur: { ...s.cur, y: s.cur.y + 1 }, score: s.score + (soft ? 1 : 0) };
  return lock(s);
};

export const ghostY = (s: State) => {
  let y = s.cur.y;
  while (fits(s.board, s.cur.m, s.cur.x, y + 1)) y++;
  return y;
};

export const hardDrop = (s: State): State => {
  if (s.over) return s;
  const y = ghostY(s);
  return lock({ ...s, cur: { ...s.cur, y }, score: s.score + 2 * (y - s.cur.y) });
};