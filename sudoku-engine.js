// sudoku-engine.js
// 스도쿠 퍼즐 생성 / 검증 / 풀이 엔진 (순수 로직, UI 의존성 없음)

export const DIFFICULTIES = {
  easy:   { label: '쉬움',   clues: 46, scoreMult: 1.0 },
  medium: { label: '보통',   clues: 38, scoreMult: 1.5 },
  hard:   { label: '어려움', clues: 30, scoreMult: 2.2 },
  expert: { label: '전문가', clues: 26, scoreMult: 3.0 },
  master: { label: '마스터', clues: 22, scoreMult: 4.0 },
};

function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function rowOf(i) { return Math.floor(i / 9); }
function colOf(i) { return i % 9; }
function boxOf(i) { return Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3); }

function isSafe(grid, i, val) {
  const r = rowOf(i), c = colOf(i);
  const boxR = Math.floor(r / 3) * 3, boxC = Math.floor(c / 3) * 3;
  for (let k = 0; k < 9; k++) {
    if (grid[r * 9 + k] === val) return false;
    if (grid[k * 9 + c] === val) return false;
    const br = boxR + Math.floor(k / 3);
    const bc = boxC + (k % 3);
    if (grid[br * 9 + bc] === val) return false;
  }
  return true;
}

function fillGrid(grid) {
  const emptyIndex = grid.indexOf(0);
  if (emptyIndex === -1) return true;
  for (const val of shuffled([1,2,3,4,5,6,7,8,9])) {
    if (isSafe(grid, emptyIndex, val)) {
      grid[emptyIndex] = val;
      if (fillGrid(grid)) return true;
      grid[emptyIndex] = 0;
    }
  }
  return false;
}

export function generateSolvedGrid() {
  const grid = new Array(81).fill(0);
  fillGrid(grid);
  return grid;
}

// 해의 개수를 limit까지만 센다 (성능을 위해 조기 종료)
function countSolutions(grid, limit = 2) {
  let count = 0;
  const work = grid.slice();

  function solve() {
    if (count >= limit) return;
    const emptyIndex = work.indexOf(0);
    if (emptyIndex === -1) {
      count++;
      return;
    }
    for (let val = 1; val <= 9; val++) {
      if (isSafe(work, emptyIndex, val)) {
        work[emptyIndex] = val;
        solve();
        work[emptyIndex] = 0;
        if (count >= limit) return;
      }
    }
  }
  solve();
  return count;
}

export function solveGrid(grid) {
  const work = grid.slice();
  function solve() {
    const emptyIndex = work.indexOf(0);
    if (emptyIndex === -1) return true;
    for (const val of [1,2,3,4,5,6,7,8,9]) {
      if (isSafe(work, emptyIndex, val)) {
        work[emptyIndex] = val;
        if (solve()) return true;
        work[emptyIndex] = 0;
      }
    }
    return false;
  }
  solve();
  return work;
}

// solvedGrid로부터 시작해 유일해를 유지하며 셀을 제거
// 최소 클루 수에 가까울수록 유일해 판별(countSolutions) 비용이 커질 수 있어
// 시간 예산(timeBudgetMs)을 두고, 예산을 넘기면 그 시점의 결과로 반환한다
// (여전히 유일해가 보장된 유효한 퍼즐이며, 목표보다 클루가 조금 많을 수 있다).
function makePuzzle(solvedGrid, clueCount, timeBudgetMs = 2500) {
  const puzzle = solvedGrid.slice();
  const order = shuffled([...Array(81).keys()]);
  let removed = 0;
  const toRemove = 81 - clueCount;
  const deadline = Date.now() + timeBudgetMs;

  for (const idx of order) {
    if (removed >= toRemove) break;
    if (Date.now() > deadline) break;
    if (puzzle[idx] === 0) continue;
    const backup = puzzle[idx];
    puzzle[idx] = 0;
    const solutions = countSolutions(puzzle, 2);
    if (solutions === 1) {
      removed++;
    } else {
      puzzle[idx] = backup;
    }
  }
  return puzzle;
}

export function generatePuzzle(difficultyKey) {
  const diff = DIFFICULTIES[difficultyKey] || DIFFICULTIES.easy;
  const solved = generateSolvedGrid();
  const puzzle = makePuzzle(solved, diff.clues);
  return { puzzle, solution: solved, difficulty: difficultyKey };
}

export function isBoardComplete(board) {
  return board.every(v => v !== 0);
}

export function isBoardCorrect(board, solution) {
  return board.every((v, i) => v === solution[i]);
}

export function computeScore({ difficultyKey, elapsedSeconds, mistakes, hintsUsed = 0 }) {
  const diff = DIFFICULTIES[difficultyKey] || DIFFICULTIES.easy;
  const base = 3000 * diff.scoreMult;
  const timePenalty = elapsedSeconds * 2.2;
  const mistakePenalty = mistakes * 60;
  const hintPenalty = hintsUsed * 120;
  const raw = base - timePenalty - mistakePenalty - hintPenalty;
  return Math.max(100, Math.round(raw));
}
