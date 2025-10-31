export type Combo = {
  type: 'run' | 'set' | 'single';
  label: string;
  score: number;
  indices: number[]; // indices of dice used
};

export type ScoreResult = {
  total: number;
  combos: Combo[];
  unusedIndices: number[];
};

// Scores per rules (without jokers/loaded dice for now):
// - Singles: 1 => 100, 5 => 50
// - Runs: 1-5 => 500, 2-6 => 750, 1-6 => 1500
// - Sets: three or more of a kind
//   * three 1s => 1000, three Xs (2..6) => X * 100
//   * each extra die after three doubles the value (e.g., 4 twos => 400, 5 twos => 800, 6 twos => 1600)
// Notes:
// - Dice cannot be reused across combos. We choose the best non-overlapping set of combos (maximize total score).
// - We do not implement jokers yet.

function countByFace(dice: number[]) {
  const counts = new Map<number, number>();
  dice.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
  return counts;
}

function indicesByFace(dice: number[]) {
  const map = new Map<number, number[]>();
  dice.forEach((v, i) => {
    if (!map.has(v)) map.set(v, []);
    map.get(v)!.push(i);
  });
  return map;
}

function setScore(face: number, count: number): number {
  if (count < 3) return 0;
  const base = face === 1 ? 1000 : face * 100;
  const extra = count - 3;
  return base * Math.pow(2, extra);
}

function generateSetCombos(dice: number[]): Combo[] {
  const idxMap = indicesByFace(dice);
  const combos: Combo[] = [];
  for (const [face, idxs] of idxMap.entries()) {
    if (idxs.length >= 3) {
      const score = setScore(face, idxs.length);
      if (score > 0) {
        combos.push({
          type: 'set',
          label: `${idxs.length} of ${face}s`,
          score,
          indices: [...idxs],
        });
      }
    }
  }
  return combos;
}

function generateRunCombos(dice: number[]): Combo[] {
  const idxMap = indicesByFace(dice);
  const have = (face: number) => (idxMap.get(face)?.length ?? 0) > 0;

  const combos: Combo[] = [];

  // Helper to take one index from each requested face
  const takeOneEach = (faces: number[]): number[] | null => {
    const used: number[] = [];
    const tempMap = new Map<number, number[]>(
      Array.from(idxMap.entries()).map(([f, arr]) => [f, [...arr]])
    );
    for (const f of faces) {
      const arr = tempMap.get(f) ?? [];
      if (arr.length === 0) return null;
      const idx = arr.shift()!;
      used.push(idx);
      tempMap.set(f, arr);
    }
    return used;
  };

  // 1-6 run
  if ([1, 2, 3, 4, 5, 6].every(have)) {
    const indices = takeOneEach([1, 2, 3, 4, 5, 6]);
    if (indices) {
      combos.push({ type: 'run', label: 'Run 1-6', score: 1500, indices });
    }
  }
  // 1-5 run
  if ([1, 2, 3, 4, 5].every(have)) {
    const indices = takeOneEach([1, 2, 3, 4, 5]);
    if (indices) {
      combos.push({ type: 'run', label: 'Run 1-5', score: 500, indices });
    }
  }
  // 2-6 run
  if ([2, 3, 4, 5, 6].every(have)) {
    const indices = takeOneEach([2, 3, 4, 5, 6]);
    if (indices) {
      combos.push({ type: 'run', label: 'Run 2-6', score: 750, indices });
    }
  }

  return combos;
}

function generateSingleCombos(dice: number[]): Combo[] {
  const combos: Combo[] = [];
  dice.forEach((v, i) => {
    if (v === 1) combos.push({ type: 'single', label: 'Single 1', score: 100, indices: [i] });
    else if (v === 5) combos.push({ type: 'single', label: 'Single 5', score: 50, indices: [i] });
  });
  return combos;
}

function maxNonOverlappingSum(candidates: Combo[], nDice: number): ScoreResult {
  // Backtracking search for best sum of non-overlapping combos
  const used = new Array<boolean>(nDice).fill(false);
  let bestTotal = 0;
  let bestCombos: Combo[] = [];

  // Sort by score descending for a bit of pruning
  const sorted = [...candidates].sort((a, b) => b.score - a.score);

  function canUse(combo: Combo): boolean {
    return combo.indices.every((i) => !used[i]);
  }
  function use(combo: Combo, val: boolean) {
    combo.indices.forEach((i) => (used[i] = val));
  }

  function backtrack(i: number, running: number, picked: Combo[]) {
    if (i >= sorted.length) {
      if (running > bestTotal) {
        bestTotal = running;
        bestCombos = [...picked];
      }
      return;
    }

    // Upper bound pruning: optimistic sum of remaining top scores
    // (skipped for simplicity — small search space with 6 dice)

    // Option 1: skip
    backtrack(i + 1, running, picked);

    // Option 2: take if possible
    const c = sorted[i];
    if (canUse(c)) {
      use(c, true);
      picked.push(c);
      backtrack(i + 1, running + c.score, picked);
      picked.pop();
      use(c, false);
    }
  }

  backtrack(0, 0, []);

  const usedSet = new Set<number>();
  bestCombos.forEach((c) => c.indices.forEach((i) => usedSet.add(i)));
  const unusedIndices = Array.from({ length: nDice }, (_, i) => i).filter((i) => !usedSet.has(i));

  return { total: bestTotal, combos: bestCombos, unusedIndices };
}

export function scoreRoll(dice: number[]): ScoreResult {
  // Generate all candidate combos
  const candidates: Combo[] = [];
  
  // Get each type of combo and log them
  const runCombos = generateRunCombos(dice);
  const setCombos = generateSetCombos(dice);
  const singleCombos = generateSingleCombos(dice);
  
  console.log('Scoring dice:', dice);
  console.log('Run combos:', runCombos);
  console.log('Set combos:', setCombos);
  console.log('Single combos:', singleCombos);
  
  candidates.push(...runCombos);
  candidates.push(...setCombos);
  candidates.push(...singleCombos);

  const result = maxNonOverlappingSum(candidates, dice.length);
  console.log('Final score result:', result);
  return result;
}
