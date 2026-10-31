const COLS = 4;
const ROWS = 3;
const TOTAL = COLS * ROWS;
const SNAP_DISTANCE = 40;

const board = document.getElementById('board');
const tray = document.getElementById('tray');
const progressEl = document.getElementById('progress');
const resetBtn = document.getElementById('resetBtn');
const solvedOverlay = document.getElementById('solvedOverlay');
const playAgainBtn = document.getElementById('playAgainBtn');

// --- Custom Jigsaw Image ---
function buildPuzzleSvgDataUrl() {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
  <rect width="800" height="600" fill="#fff0f5"/>
  <circle cx="600" cy="160" r="70" fill="#ff85d8"/>
  <g transform="translate(120 320)">
    <rect x="0" y="0" width="260" height="170" rx="18" fill="#ffffff" stroke="#a78bfa" stroke-width="4"/>
    <rect x="16" y="16" width="228" height="112" rx="10" fill="#6ee7b7"/>
    <rect x="60" y="144" width="140" height="18" rx="8" fill="#e6e6fa" stroke="#a78bfa" stroke-width="2"/>
  </g>
  <text x="400" y="560" text-anchor="middle" font-family="sans-serif" font-size="34" font-weight="700" fill="#3b2a5c" opacity="0.6">coded with love ✨</text>
</svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.trim());
}
const PUZZLE_IMAGE = buildPuzzleSvgDataUrl();

let pieces = [];
let placedCount = 0;
let draggingPiece = null;
let dragOffset = { x: 0, y: 0 };

// --- Init ---
function buildPuzzle() {
  board.innerHTML = '';
  tray.innerHTML = '';
  pieces = [];
  placedCount = 0;
  updateProgress();

  const bRect = board.getBoundingClientRect();
  
  // Add the faint image to the board background as a hint
  board.style.backgroundImage = `url("${PUZZLE_IMAGE}")`;
  board.style.opacity = '1';

  // Calculate piece size. We add a 10% padding to the background size and offsets
  // to account for the jigsaw tabs extending outside the base square.
  const pieceW = bRect.width / COLS;
  const pieceH = bRect.height / ROWS;
  const tabOverlap = 0.15; // 15% extra space for the clip-path tabs

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const id = r * COLS + c;
      const el = document.createElement('div');
      el.className = 'piece';
      
      // Slice the image (sized to board with slight offset to center the tabs)
      el.style.backgroundImage = `url("${PUZZLE_IMAGE}")`;
      el.style.backgroundSize = `${bRect.width}px ${bRect.height}px`;
      el.style.backgroundPosition = `-${c * pieceW}px -${r * pieceH}px`;

      // Start in tray (scaled down)
      tray.appendChild(el);
      el.style.width = '60px';
      el.style.height = '45px';
      
      const tRect = tray.getBoundingClientRect();
      el.style.left = `${Math.random() * (tRect.width - 60)}px`;
      el.style.top = `${Math.random() * (tRect.height - 45)}px`;

      const pieceData = {
        el, id, r, c,
        slotX: c * pieceW, 
        slotY: r * pieceH,
        placed: false
      };

      pieces.push(pieceData);
      el.addEventListener('pointerdown', (e) => startDrag(e, pieceData));
    }
  }
}

// --- Drag Logic ---
function startDrag(e, p) {
  if (p.placed) return;
  e.preventDefault();
  
  draggingPiece = p;
  const el = p.el;
  const rect = el.getBoundingClientRect();
  
  dragOffset.x = e.clientX - rect.left;
  dragOffset.y = e.clientY - rect.top;

  el.classList.add('dragging');
  
  // Freeze it in place on the screen
  el.style.position = 'fixed';
  el.style.left = `${rect.left}px`;
  el.style.top = `${rect.top}px`;
  
  // If dragging from the tray, scale it up to full board size
  if (p.el.parentElement === tray) {
    const bRect = board.getBoundingClientRect();
    el.style.width = `${bRect.width / COLS}px`;
    el.style.height = `${bRect.height / ROWS}px`;
  }
  
  document.body.appendChild(el);
  
  window.addEventListener('pointermove', onDrag);
  window.addEventListener('pointerup', endDrag);
}

function onDrag(e) {
  if (!draggingPiece) return;
  draggingPiece.el.style.left = `${e.clientX - dragOffset.x}px`;
  draggingPiece.el.style.top = `${e.clientY - dragOffset.y}px`;
}

function endDrag(e) {
  if (!draggingPiece) return;
  window.removeEventListener('pointermove', onDrag);
  window.removeEventListener('pointerup', endDrag);
  
  const p = draggingPiece;
  const el = p.el;
  el.classList.remove('dragging');
  draggingPiece = null;

  const elRect = el.getBoundingClientRect();
  const bRect = board.getBoundingClientRect();
  const tRect = tray.getBoundingClientRect();

  // Check where it was dropped (using center point)
  const centerX = elRect.left + elRect.width / 2;
  const centerY = elRect.top + elRect.height / 2;

  const droppedInTray = centerX > tRect.left && centerX < tRect.right && centerY > tRect.top && centerY < tRect.bottom;
  const droppedInBoard = centerX > bRect.left && centerX < bRect.right && centerY > bRect.top && centerY < bRect.bottom;

  // 1. If dropped in Tray, put it back
  if (droppedInTray) {
    tray.appendChild(el);
    el.style.position = 'absolute';
    el.style.width = '60px';
    el.style.height = '45px';
    el.style.left = `${Math.random() * (tRect.width - 60)}px`;
    el.style.top = `${Math.random() * (tRect.height - 45)}px`;
    return;
  }

  // 2. If dropped in Board, leave it there!
  if (droppedInBoard) {
    board.appendChild(el);
    el.style.position = 'absolute';
    el.style.width = `${bRect.width / COLS}px`;
    el.style.height = `${bRect.height / ROWS}px`;
    
    // Set exact coordinates relative to board
    const relX = elRect.left - bRect.left;
    const relY = elRect.top - bRect.top;
    el.style.left = `${relX}px`;
    el.style.top = `${relY}px`;

    // Check if it's close enough to snap
    if (Math.abs(relX - p.slotX) < SNAP_DISTANCE && Math.abs(relY - p.slotY) < SNAP_DISTANCE) {
      el.style.left = `${p.slotX}px`;
      el.style.top = `${p.slotY}px`;
      el.classList.add('placed');
      p.placed = true;
      placedCount++;
      updateProgress();

      if (placedCount === TOTAL) {
        setTimeout(() => solvedOverlay.classList.remove('hidden'), 400);
      }
    }
    return;
  }

  // 3. Dropped outside both (e.g., on the page background) -> send to tray
  tray.appendChild(el);
  el.style.position = 'absolute';
  el.style.width = '60px';
  el.style.height = '45px';
  el.style.left = `${Math.random() * (tRect.width - 60)}px`;
  el.style.top = `${Math.random() * (tRect.height - 45)}px`;
}

// --- UI ---
function updateProgress() {
  progressEl.textContent = `${placedCount} / ${TOTAL} placed`;
}

resetBtn.addEventListener('click', () => {
  solvedOverlay.classList.add('hidden');
  buildPuzzle();
});

playAgainBtn.addEventListener('click', () => {
  solvedOverlay.classList.add('hidden');
  buildPuzzle();
});

// Boot up
buildPuzzle();