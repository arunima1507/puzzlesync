// ============================================================
// PuzzleSync — single-player jigsaw (Block 2)
// Multiplayer wiring arrives in Block 3. Keep this file self-contained.
// ============================================================

const COLS = 4;
const ROWS = 3;
const TOTAL = COLS * ROWS;
const SNAP_DISTANCE = 32; // px — how close counts as "placed"

const board       = document.getElementById('board');
const progressEl  = document.getElementById('progress');
const resetBtn    = document.getElementById('resetBtn');
const solvedOverlay = document.getElementById('solvedOverlay');
const playAgainBtn  = document.getElementById('playAgainBtn');
const solvedMeta    = document.getElementById('solvedMeta');

// ---------- The Cyberfemme puzzle image (SVG data URL) ----------
function buildPuzzleSvgDataUrl() {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1b0a2e"/>
      <stop offset="1" stop-color="#2a0f47"/>
    </linearGradient>
    <linearGradient id="sun" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ff4fd8"/>
      <stop offset="1" stop-color="#b06bff"/>
    </linearGradient>
    <linearGradient id="screen" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6ee7ff"/>
      <stop offset="1" stop-color="#7dffd4"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#ff4fd8" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#ff4fd8" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="800" height="600" fill="url(#sky)"/>

  <!-- grid lines -->
  <g stroke="#b06bff" stroke-opacity="0.12" stroke-width="1">
    ${Array.from({length: 16}, (_, i) => `<line x1="${i*50}" y1="0" x2="${i*50}" y2="600"/>`).join('')}
    ${Array.from({length: 12}, (_, i) => `<line x1="0" y1="${i*50}" x2="800" y2="${i*50}"/>`).join('')}
  </g>

  <!-- glowing sun/heart -->
  <circle cx="600" cy="160" r="140" fill="url(#glow)"/>
  <circle cx="600" cy="160" r="70" fill="url(#sun)"/>
  <circle cx="600" cy="160" r="70" fill="none" stroke="#fbeaff" stroke-opacity="0.5"/>

  <!-- retro computer -->
  <g transform="translate(120 320)">
    <rect x="0" y="0" width="260" height="170" rx="18" fill="#1e0f33" stroke="#b06bff" stroke-width="3"/>
    <rect x="16" y="16" width="228" height="112" rx="10" fill="url(#screen)" fill-opacity="0.85"/>
    <!-- smiley on screen -->
    <circle cx="130" cy="72" r="26" fill="#12081f"/>
    <circle cx="122" cy="66" r="4" fill="#7dffd4"/>
    <circle cx="138" cy="66" r="4" fill="#7dffd4"/>
    <path d="M118 80 q12 12 24 0" stroke="#7dffd4" stroke-width="3" fill="none" stroke-linecap="round"/>
    <!-- base -->
    <rect x="96" y="130" width="68" height="14" rx="6" fill="#b06bff"/>
    <rect x="60" y="144" width="140" height="18" rx="8" fill="#2a0f47" stroke="#b06bff" stroke-width="2"/>
  </g>

  <!-- sparkle stars -->
  <g fill="#fbeaff">
    ${[
      [90,100],[240,80],[380,140],[500,90],[720,110],[740,380],[80,480],[680,520],[430,480],[300,240]
    ].map(([x,y],i) => {
      const s = 6 + (i % 3) * 4;
      return `<path d="M${x} ${y-s} L${x+s*0.35} ${y-s*0.35} L${x+s} ${y} L${x+s*0.35} ${y+s*0.35} L${x} ${y+s} L${x-s*0.35} ${y+s*0.35} L${x-s} ${y} L${x-s*0.35} ${y-s*0.35} Z" opacity="0.85"/>`;
    }).join('')}
  </g>

  <!-- hearts -->
  <g fill="#ff4fd8" fill-opacity="0.9">
    <path d="M180 200 c -8 -14 -30 -14 -30 6 c 0 16 20 26 30 34 c 10 -8 30 -18 30 -34 c 0 -20 -22 -20 -30 -6 z"/>
    <path d="M520 420 c -6 -10 -22 -10 -22 4 c 0 12 15 20 22 26 c 7 -6 22 -14 22 -26 c 0 -14 -16 -14 -22 -4 z" fill="#7dffd4"/>
  </g>

  <!-- caption -->
  <text x="400" y="560" text-anchor="middle" font-family="'Space Grotesk', sans-serif"
        font-size="34" font-weight="700" fill="#fbeaff" opacity="0.9">
    coded with love ✨
  </text>
</svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.trim());
}

const PUZZLE_IMAGE = buildPuzzleSvgDataUrl();

// ---------- State ----------
let pieces = [];       // [{ el, id, sx, sy, slotX, slotY, placed, dragging, offsetX, offsetY }]
let placedCount = 0;

// ---------- Helpers ----------
function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function boardRect() {
  return board.getBoundingClientRect();
}

// Scatter within board, avoiding the correct-slot area for each piece
function computeScatter(pieceW, pieceH, slotX, slotY, boardW, boardH) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const x = randomBetween(0, boardW - pieceW);
    const y = randomBetween(0, boardH - pieceH);
    const dx = Math.abs(x - slotX);
    const dy = Math.abs(y - slotY);
    if (dx > pieceW * 0.6 || dy > pieceH * 0.6) return { x, y };
  }
  return { x: randomBetween(0, boardW - pieceW), y: randomBetween(0, boardH - pieceH) };
}

// ---------- Build the puzzle ----------
function buildPuzzle() {
  board.innerHTML = '';
  pieces = [];
  placedCount = 0;
  updateProgress();

  const rect = boardRect();
  const boardW = rect.width;
  const boardH = rect.height;
  const pieceW = boardW / COLS;
  const pieceH = boardH / ROWS;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const id = r * COLS + c;
      const el = document.createElement('div');
      el.className = 'piece';
      el.dataset.id = id;

      // Slice the SVG: background-size = full image scaled to board, background-position = grid offset
      el.style.backgroundImage = `url("${PUZZLE_IMAGE}")`;
      el.style.backgroundSize = `${boardW}px ${boardH}px`;
      el.style.backgroundPosition = `-${c * pieceW}px -${r * pieceH}px`;

      const slotX = c * pieceW;
      const slotY = r * pieceH;
      const scatter = computeScatter(pieceW, pieceH, slotX, slotY, boardW, boardH);

      el.style.left = `${scatter.x}px`;
      el.style.top  = `${scatter.y}px`;

      board.appendChild(el);

      pieces.push({
        el, id,
        slotX, slotY,
        x: scatter.x, y: scatter.y,
        placed: false, dragging: false,
        offsetX: 0, offsetY: 0,
      });

      attachPointerHandlers(pieces[pieces.length - 1]);
    }
  }
}

// ---------- Drag (pointer events = mouse + touch) ----------
function attachPointerHandlers(piece) {
  const { el } = piece;

  el.addEventListener('pointerdown', (e) => {
    if (piece.placed) return;
    e.preventDefault();
    piece.dragging = true;
    el.classList.add('dragging');
    el.setPointerCapture(e.pointerId);

    const boardBox = boardRect();
    piece.offsetX = e.clientX - boardBox.left - piece.x;
    piece.offsetY = e.clientY - boardBox.top  - piece.y;
  });

  el.addEventListener('pointermove', (e) => {
    if (!piece.dragging) return;
    const boardBox = boardRect();
    let nx = e.clientX - boardBox.left - piece.offsetX;
    let ny = e.clientY - boardBox.top  - piece.offsetY;

    // Clamp inside board
    const maxX = boardBox.width  - el.offsetWidth;
    const maxY = boardBox.height - el.offsetHeight;
    nx = Math.max(0, Math.min(maxX, nx));
    ny = Math.max(0, Math.min(maxY, ny));

    piece.x = nx;
    piece.y = ny;
    el.style.left = `${nx}px`;
    el.style.top  = `${ny}px`;
  });

  const endDrag = (e) => {
    if (!piece.dragging) return;
    piece.dragging = false;
    el.classList.remove('dragging');
    try { el.releasePointerCapture(e.pointerId); } catch (_) {}

    const dx = Math.abs(piece.x - piece.slotX);
    const dy = Math.abs(piece.y - piece.slotY);
    if (dx <= SNAP_DISTANCE && dy <= SNAP_DISTANCE) {
      snapPiece(piece);
    }
  };

  el.addEventListener('pointerup', endDrag);
  el.addEventListener('pointercancel', endDrag);
}

function snapPiece(piece) {
  piece.x = piece.slotX;
  piece.y = piece.slotY;
  piece.el.style.left = `${piece.x}px`;
  piece.el.style.top  = `${piece.y}px`;
  piece.placed = true;
  piece.el.classList.add('placed');

  placedCount++;
  updateProgress();

  if (placedCount === TOTAL) {
    setTimeout(showSolved, 300);
  }
}

// ---------- UI ----------
function updateProgress() {
  progressEl.textContent = `${placedCount} / ${TOTAL} placed`;
}

function showSolved() {
  solvedMeta.textContent = 'nice work, bestie 💜';
  solvedOverlay.classList.remove('hidden');
}

function reset() {
  solvedOverlay.classList.add('hidden');
  buildPuzzle();
}

// ---------- Wire up ----------
resetBtn.addEventListener('click', reset);
playAgainBtn.addEventListener('click', reset);

// Rebuild on resize so pieces stay aligned to a changing board size
let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    // Only rebuild if nothing placed yet — avoids wiping progress mid-game
    if (placedCount === 0) buildPuzzle();
  }, 200);
});

// Boot
buildPuzzle();
console.log('%c✨ PuzzleSync client loaded — single-player mode', 'color:#ff4fd8; font-weight:bold;');