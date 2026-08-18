// app.js — UI 상태와 이벤트를 담당하는 메인 스크립트
import {
  DIFFICULTIES, generatePuzzle, isBoardComplete, isBoardCorrect, computeScore,
} from './sudoku-engine.js';
import {
  registerUser, loginUser, logoutUser, watchAuthState, friendlyAuthError,
} from './auth.js';
import { submitScore, fetchTopScores } from './leaderboard.js';
import { isFirebaseConfigured } from './firebase-config.js';

// ---------- 상태 ----------
const state = {
  difficulty: 'easy',
  puzzle: [],
  solution: [],
  board: [],
  given: [],
  notes: Array.from({ length: 81 }, () => new Set()),
  selected: -1,
  mistakes: 0,
  hintsUsed: 0,
  noteMode: false,
  startTime: 0,
  elapsedSeconds: 0,
  timerHandle: null,
  finished: false,
  user: null, // { uid, username }
};

// ---------- DOM refs ----------
const $ = (id) => document.getElementById(id);
const boardEl = $('board');
const numpadEl = $('numpad');
const difficultyTabsEl = $('difficultyTabs');
const timerDisplay = $('timerDisplay');
const mistakeCountEl = $('mistakeCount');
const cluesLeftEl = $('cluesLeft');
const accountBar = $('accountBar');
const leaderboardListEl = $('leaderboardList');
const lbDifficultyLabel = $('lbDifficultyLabel');
const offlineNote = $('offlineNote');

// ---------- 초기 렌더: 난이도 탭 ----------
function renderDifficultyTabs() {
  difficultyTabsEl.innerHTML = '';
  Object.entries(DIFFICULTIES).forEach(([key, cfg]) => {
    const btn = document.createElement('button');
    btn.className = 'difficulty-tab' + (key === state.difficulty ? ' active' : '');
    btn.textContent = cfg.label;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', key === state.difficulty ? 'true' : 'false');
    btn.addEventListener('click', () => {
      if (key === state.difficulty) return;
      state.difficulty = key;
      startNewGame();
      renderDifficultyTabs();
      lbDifficultyLabel.textContent = cfg.label;
      loadLeaderboard();
    });
    difficultyTabsEl.appendChild(btn);
  });
}

// ---------- 보드 렌더 ----------
function buildBoardDom() {
  boardEl.innerHTML = '';
  for (let i = 0; i < 81; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.index = String(i);
    cell.setAttribute('role', 'gridcell');
    cell.tabIndex = -1;
    cell.addEventListener('click', () => selectCell(i));
    boardEl.appendChild(cell);
  }
}

function renderBoard() {
  const cells = boardEl.children;
  for (let i = 0; i < 81; i++) {
    const cell = cells[i];
    const val = state.board[i];
    cell.classList.toggle('given', state.given[i]);
    cell.classList.remove('selected', 'peer', 'same-number', 'error', 'hint');
    cell.innerHTML = '';

    if (val !== 0) {
      cell.textContent = String(val);
    } else if (state.notes[i].size > 0) {
      const notesWrap = document.createElement('div');
      notesWrap.className = 'notes';
      for (let n = 1; n <= 9; n++) {
        const span = document.createElement('span');
        span.textContent = state.notes[i].has(n) ? String(n) : '';
        notesWrap.appendChild(span);
      }
      cell.appendChild(notesWrap);
    } else {
      cell.textContent = '';
    }
  }
  applyHighlights();
  const filled = state.board.filter(v => v !== 0).length;
  cluesLeftEl.textContent = `남은 칸 ${81 - filled}`;
}

function applyHighlights() {
  const cells = boardEl.children;
  for (let i = 0; i < 81; i++) cells[i].classList.remove('selected', 'peer', 'same-number');
  if (state.selected === -1) return;

  const sel = state.selected;
  const sr = Math.floor(sel / 9), sc = sel % 9;
  const selVal = state.board[sel];

  for (let i = 0; i < 81; i++) {
    const r = Math.floor(i / 9), c = i % 9;
    const sameBox = Math.floor(r / 3) === Math.floor(sr / 3) && Math.floor(c / 3) === Math.floor(sc / 3);
    if (r === sr || c === sc || sameBox) cells[i].classList.add('peer');
    if (selVal !== 0 && state.board[i] === selVal) cells[i].classList.add('same-number');
  }
  cells[sel].classList.add('selected');
}

function selectCell(i) {
  state.selected = i;
  applyHighlights();
}

// ---------- 숫자 패드 ----------
function buildNumpad() {
  numpadEl.innerHTML = '';
  for (let n = 1; n <= 9; n++) {
    const btn = document.createElement('button');
    btn.textContent = String(n);
    btn.addEventListener('click', () => inputNumber(n));
    numpadEl.appendChild(btn);
  }
  const noteBtn = document.createElement('button');
  noteBtn.textContent = '✎';
  noteBtn.id = 'numpadNote';
  noteBtn.addEventListener('click', toggleNoteMode);
  numpadEl.appendChild(noteBtn);
}

function toggleNoteMode() {
  state.noteMode = !state.noteMode;
  $('numpadNote').classList.toggle('note-mode', state.noteMode);
  $('noteToggleBtn').classList.toggle('note-mode', state.noteMode);
}

// ---------- 입력 처리 ----------
function inputNumber(n) {
  const i = state.selected;
  if (i === -1 || state.given[i] || state.finished) return;

  if (state.noteMode) {
    if (state.notes[i].has(n)) state.notes[i].delete(n);
    else state.notes[i].add(n);
    renderBoard();
    return;
  }

  state.notes[i].clear();
  state.board[i] = n;

  const cellEl = boardEl.children[i];
  if (n !== state.solution[i]) {
    state.mistakes++;
    mistakeCountEl.textContent = String(state.mistakes);
    cellEl.classList.add('error');
    setTimeout(() => cellEl.classList.remove('error'), 260);
  }

  renderBoard();
  checkWin();
}

function eraseCell() {
  const i = state.selected;
  if (i === -1 || state.given[i] || state.finished) return;
  state.board[i] = 0;
  state.notes[i].clear();
  renderBoard();
}

function giveHint() {
  if (state.finished) return;
  const emptyOrWrong = [];
  for (let i = 0; i < 81; i++) {
    if (!state.given[i] && state.board[i] !== state.solution[i]) emptyOrWrong.push(i);
  }
  if (emptyOrWrong.length === 0) return;
  const idx = emptyOrWrong[Math.floor(Math.random() * emptyOrWrong.length)];
  state.board[idx] = state.solution[idx];
  state.notes[idx].clear();
  state.hintsUsed++;
  state.selected = idx;
  renderBoard();
  const cellEl = boardEl.children[idx];
  cellEl.classList.add('hint');
  checkWin();
}

function keydownHandler(e) {
  if (state.selected === -1) return;
  if (/^[1-9]$/.test(e.key)) { inputNumber(Number(e.key)); return; }
  if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') { eraseCell(); return; }
  const moves = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 };
  if (moves[e.key] !== undefined) {
    e.preventDefault();
    let next = state.selected + moves[e.key];
    if (e.key === 'ArrowLeft' && state.selected % 9 === 0) return;
    if (e.key === 'ArrowRight' && state.selected % 9 === 8) return;
    if (next < 0 || next > 80) return;
    selectCell(next);
  }
}

// ---------- 타이머 ----------
function startTimer() {
  stopTimer();
  state.startTime = Date.now() - state.elapsedSeconds * 1000;
  state.timerHandle = setInterval(() => {
    state.elapsedSeconds = Math.floor((Date.now() - state.startTime) / 1000);
    const m = String(Math.floor(state.elapsedSeconds / 60)).padStart(2, '0');
    const s = String(state.elapsedSeconds % 60).padStart(2, '0');
    timerDisplay.textContent = `${m}:${s}`;
  }, 250);
}
function stopTimer() {
  if (state.timerHandle) clearInterval(state.timerHandle);
  state.timerHandle = null;
}

// ---------- 게임 시작/승리 ----------
function startNewGame() {
  stopTimer();
  boardEl.style.opacity = '0.4';
  boardEl.style.pointerEvents = 'none';
  cluesLeftEl.textContent = '퍼즐 만드는 중…';

  // 마스터 난이도는 생성에 다소 시간이 걸릴 수 있어, 다음 프레임으로 미뤄
  // "만드는 중" 표시가 먼저 화면에 그려지도록 한다.
  setTimeout(() => {
    const { puzzle, solution } = generatePuzzle(state.difficulty);
    state.puzzle = puzzle;
    state.solution = solution;
    state.board = puzzle.slice();
    state.given = puzzle.map(v => v !== 0);
    state.notes = Array.from({ length: 81 }, () => new Set());
    state.selected = -1;
    state.mistakes = 0;
    state.hintsUsed = 0;
    state.elapsedSeconds = 0;
    state.finished = false;
    mistakeCountEl.textContent = '0';
    timerDisplay.textContent = '00:00';
    boardEl.style.opacity = '1';
    boardEl.style.pointerEvents = 'auto';
    renderBoard();
    startTimer();
  }, 20);
}

async function checkWin() {
  if (!isBoardComplete(state.board)) return;
  if (!isBoardCorrect(state.board, state.solution)) return;

  state.finished = true;
  stopTimer();

  const score = computeScore({
    difficultyKey: state.difficulty,
    elapsedSeconds: state.elapsedSeconds,
    mistakes: state.mistakes,
    hintsUsed: state.hintsUsed,
  });

  $('winScore').textContent = String(score);
  const m = String(Math.floor(state.elapsedSeconds / 60)).padStart(2, '0');
  const s = String(state.elapsedSeconds % 60).padStart(2, '0');
  $('winStats').textContent = `${DIFFICULTIES[state.difficulty].label} · ${m}:${s} · 실수 ${state.mistakes}회 · 힌트 ${state.hintsUsed}회`;
  openModal('winModal');

  if (state.user && isFirebaseConfigured) {
    try {
      await submitScore({
        uid: state.user.uid,
        username: state.user.username,
        difficulty: state.difficulty,
        score,
        elapsedSeconds: state.elapsedSeconds,
        mistakes: state.mistakes,
      });
      loadLeaderboard();
    } catch (err) {
      console.error('점수 저장 실패', err);
    }
  }
}

// ---------- 모달 헬퍼 ----------
function openModal(id) { $(id).classList.add('open'); }
function closeModal(id) { $(id).classList.remove('open'); }

// ---------- 인증 UI ----------
let authMode = 'login'; // 'login' | 'register'

function setAuthMode(mode) {
  authMode = mode;
  $('authModalTitle').textContent = mode === 'login' ? '로그인' : '계정 만들기';
  $('authSubmitBtn').textContent = mode === 'login' ? '로그인' : '가입하기';
  $('authSwitchText').textContent = mode === 'login' ? '계정이 없으신가요?' : '이미 계정이 있으신가요?';
  $('authSwitchBtn').textContent = mode === 'login' ? '계정 만들기' : '로그인';
  $('authError').textContent = '';
  $('authPassword').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
}

function renderAccountBar() {
  accountBar.innerHTML = '';
  if (state.user) {
    const greeting = document.createElement('span');
    greeting.textContent = `${state.user.username}님`;
    greeting.style.fontWeight = '600';
    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'stamp-btn stamp-btn--ghost';
    logoutBtn.textContent = '로그아웃';
    logoutBtn.addEventListener('click', async () => {
      await logoutUser();
    });
    accountBar.append(greeting, logoutBtn);
  } else {
    const loginBtn = document.createElement('button');
    loginBtn.className = 'stamp-btn';
    loginBtn.textContent = '로그인';
    loginBtn.addEventListener('click', () => { setAuthMode('login'); openModal('authModal'); });

    const registerBtn = document.createElement('button');
    registerBtn.className = 'stamp-btn stamp-btn--ghost';
    registerBtn.textContent = '계정 만들기';
    registerBtn.addEventListener('click', () => { setAuthMode('register'); openModal('authModal'); });

    accountBar.append(loginBtn, registerBtn);
  }
}

async function handleAuthSubmit() {
  const username = $('authUsername').value.trim();
  const password = $('authPassword').value;
  $('authError').textContent = '';
  try {
    if (authMode === 'login') {
      await loginUser(username, password);
    } else {
      await registerUser(username, password);
    }
    closeModal('authModal');
    $('authUsername').value = '';
    $('authPassword').value = '';
  } catch (err) {
    $('authError').textContent = friendlyAuthError(err);
  }
}

// ---------- 리더보드 ----------
async function loadLeaderboard() {
  if (!isFirebaseConfigured) {
    offlineNote.hidden = false;
    leaderboardListEl.innerHTML = '<li class="lb-empty">온라인 순위표를 사용할 수 없어요.</li>';
    return;
  }
  leaderboardListEl.innerHTML = '<li class="lb-empty">불러오는 중…</li>';
  try {
    const scores = await fetchTopScores(state.difficulty, 10);
    if (scores.length === 0) {
      leaderboardListEl.innerHTML = '<li class="lb-empty">아직 기록이 없어요. 첫 기록의 주인공이 되어보세요!</li>';
      return;
    }
    leaderboardListEl.innerHTML = '';
    scores.forEach((s, idx) => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="lb-rank">${idx + 1}</span><span class="lb-name">${escapeHtml(s.username)}</span><span class="lb-score">${s.score}</span>`;
      leaderboardListEl.appendChild(li);
    });
  } catch (err) {
    console.error(err);
    leaderboardListEl.innerHTML = '<li class="lb-empty">순위표를 불러오지 못했어요. (Firestore 색인 설정이 필요할 수 있어요 — README 참고)</li>';
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------- 이벤트 바인딩 ----------
function bindEvents() {
  $('newGameBtn').addEventListener('click', startNewGame);
  $('eraseBtn').addEventListener('click', eraseCell);
  $('hintBtn').addEventListener('click', giveHint);
  $('noteToggleBtn').addEventListener('click', toggleNoteMode);
  $('winNewGameBtn').addEventListener('click', () => { closeModal('winModal'); startNewGame(); });
  $('winCloseBtn').addEventListener('click', () => closeModal('winModal'));
  $('authCloseBtn').addEventListener('click', () => closeModal('authModal'));
  $('authSwitchBtn').addEventListener('click', () => setAuthMode(authMode === 'login' ? 'register' : 'login'));
  $('authSubmitBtn').addEventListener('click', handleAuthSubmit);
  $('authPassword').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleAuthSubmit(); });
  document.addEventListener('keydown', keydownHandler);

  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) backdrop.classList.remove('open');
    });
  });
}

// ---------- 초기화 ----------
function init() {
  renderDifficultyTabs();
  buildBoardDom();
  buildNumpad();
  bindEvents();
  renderAccountBar();
  lbDifficultyLabel.textContent = DIFFICULTIES[state.difficulty].label;
  offlineNote.hidden = isFirebaseConfigured;
  startNewGame();
  loadLeaderboard();

  watchAuthState(async (fbUser) => {
    if (fbUser) {
      const { getUsername } = await import('./auth.js');
      const username = fbUser.displayName || (await getUsername(fbUser.uid)) || '플레이어';
      state.user = { uid: fbUser.uid, username };
    } else {
      state.user = null;
    }
    renderAccountBar();
  });
}

init();
