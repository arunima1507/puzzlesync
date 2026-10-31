const COLS = 4;
const ROWS = 3;
const TOTAL = COLS * ROWS;
const SNAP_DISTANCE = 40;

// --- Socket.io Setup ---
const socket = io();
// Get room from URL, or generate a random one
const urlParams = new URLSearchParams(window.location.search);
let roomId = urlParams.get('room');
if (!roomId) {
  roomId = Math.random().toString(36).substring(2, 8); // e.g. "x7b9k2"
  window.history.replaceState(null, '', `?room=${roomId}`);
}
socket.emit('joinRoom', roomId);

const board = document.getElementById('board');
const tray = document.getElementById('tray');
const progressEl = document.getElementById('progress');
const resetBtn = document.getElementById('resetBtn');
const solvedOverlay = document.getElementById('solvedOverlay');
const playAgainBtn = document.getElementById('playAgainBtn');
const inviteBtn = document.getElementById('inviteBtn');

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
  
  board.style.backgroundImage = `url("${PUZZLE_IMAGE}")`;
  board.style.opacity = '1';

  const pieceW = bRect.width / COLS;
  const pieceH = bRect.height / ROWS;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const id = r * COLS + c;
      const el = document.createElement('div');
      el.className = 'piece';
      el.dataset.id = id;
      
      el.style.backgroundImage = `url("${PUZZLE_IMAGE}")`;
      el.style.backgroundSize = `${bRect.width}px ${bRect.height}px`;
      el.style.backgroundPosition = `-${c * pieceW}px -${r * pieceH}px`;

      tray.appendChild(el);
      el.style.width = '60px';
      el.style.height = '45px';
      
      const tRect = tray.getBoundingClientRect();
      const randomX = Math.random() * (tRect.width - 60);
      const randomY = Math.random() * (tRect.height - 45);
      el.style.left = `${randomX}px`;
      el.style.top = `${randomY}px`;

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
  el.style.position = 'fixed';
  el.style.left = `${rect.left}px`;
  el.style.top = `${rect.top}px`;
  
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

  const centerX = elRect.left + elRect.width / 2;
  const centerY = elRect.top + elRect.height / 2;

  const droppedInTray = centerX > tRect.left && centerX < tRect.right && centerY > tRect.top && centerY < tRect.bottom;
  const droppedInBoard = centerX > bRect.left && centerX < bRect.right && centerY > bRect.top && centerY < bRect.bottom;

  // 1. Dropped in Tray
  if (droppedInTray) {
    tray.appendChild(el);
    el.style.position = 'absolute';
    el.style.width = '60px';
    el.style.height = '45px';
    el.style.left = `${Math.random() * (tRect.width - 60)}px`;
    el.style.top = `${Math.random() * (tRect.height - 45)}px`;
    socket.emit('pieceMoved', { pieceId: p.id, inTray: true });
    return;
  }

  // 2. Dropped in Board
  if (droppedInBoard) {
    board.appendChild(el);
    el.style.position = 'absolute';
    el.style.width = `${bRect.width / COLS}px`;
    el.style.height = `${bRect.height / ROWS}px`;
    
    const relX = elRect.left - bRect.left;
    const relY = elRect.top - bRect.top;
    el.style.left = `${relX}px`;
    el.style.top = `${relY}px`;

    let snapped = false;
    if (Math.abs(relX - p.slotX) < SNAP_DISTANCE && Math.abs(relY - p.slotY) < SNAP_DISTANCE) {
      el.style.left = `${p.slotX}px`;
      el.style.top = `${p.slotY}px`;
      el.classList.add('placed');
      p.placed = true;
      placedCount++;
      updateProgress();
      snapped = true;

      if (placedCount === TOTAL) {
        setTimeout(() => solvedOverlay.classList.remove('hidden'), 400);
      }
    }
    
    // Emit exact board position to other players
    socket.emit('pieceMoved', { 
      pieceId: p.id, 
      x: p.slotX, 
      y: p.slotY, 
      placed: snapped, 
      inTray: false,
      // For unsnapped pieces, send exact coords
      rawX: relX,
      rawY: relY
    });
    return;
  }

  // 3. Dropped outside
  tray.appendChild(el);
  el.style.position = 'absolute';
  el.style.width = '60px';
  el.style.height = '45px';
  el.style.left = `${Math.random() * (tRect.width - 60)}px`;
  el.style.top = `${Math.random() * (tRect.height - 45)}px`;
  socket.emit('pieceMoved', { pieceId: p.id, inTray: true });
}

// --- Multiplayer Sync ---
socket.on('pieceMoved', (data) => {
  const p = pieces.find(piece => piece.id === data.pieceId);
  if (!p) return;
  
  const el = p.el;
  const bRect = board.getBoundingClientRect();

  if (data.inTray) {
    // Someone sent it to the tray
    if (el.parentElement !== tray) {
      tray.appendChild(el);
      el.style.width = '60px';
      el.style.height = '45px';
      el.style.left = `${Math.random() * (tray.getBoundingClientRect().width - 60)}px`;
      el.style.top = `${Math.random() * (tray.getBoundingClientRect().height - 45)}px`;
    }
  } else {
    // Someone placed it on the board
    board.appendChild(el);
    el.style.width = `${bRect.width / COLS}px`;
    el.style.height = `${bRect.height / ROWS}px`;
    
    if (data.placed) {
      // It was snapped correctly
      el.style.left = `${data.x}px`;
      el.style.top = `${data.y}px`;
      el.classList.add('placed');
      p.placed = true;
      // Recalculate progress just in case
      placedCount = pieces.filter(piece => piece.placed).length;
      updateProgress();
      
      if (placedCount === TOTAL) {
        setTimeout(() => solvedOverlay.classList.remove('hidden'), 400);
      }
    } else {
      // It was dropped roughly on the board
      el.style.left = `${data.rawX}px`;
      el.style.top = `${data.rawY}px`;
    }
  }
});

// Catch-up state for late joiners
socket.on('roomState', (serverPieces) => {
  // Wait a tiny bit for DOM to render before applying
  setTimeout(() => {
    const bRect = board.getBoundingClientRect();
    Object.keys(serverPieces).forEach(id => {
      const data = serverPieces[id];
      const p = pieces.find(piece => piece.id == id);
      if (!p) return;
      
      const el = p.el;
      if (data.inTray) {
        tray.appendChild(el);
        el.style.width = '60px';
        el.style.height = '45px';
      } else {
        board.appendChild(el);
        el.style.width = `${bRect.width / COLS}px`;
        el.style.height = `${bRect.height / ROWS}px`;
        el.style.left = `${data.x}px`;
        el.style.top = `${data.y}px`;
        
        if (data.placed) {
          el.classList.add('placed');
          p.placed = true;
        }
      }
    });
    placedCount = pieces.filter(piece => piece.placed).length;
    updateProgress();
  }, 100);
});

// --- UI ---
function updateProgress() {
  progressEl.textContent = `${placedCount} / ${TOTAL} placed`;
}

inviteBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(window.location.href);
  inviteBtn.textContent = '✅ Copied!';
  setTimeout(() => { inviteBtn.textContent = '🔗 Copy Invite'; }, 2000);
});

resetBtn.addEventListener('click', () => {
  solvedOverlay.classList.add('hidden');
  buildPuzzle();
});

playAgainBtn.addEventListener('click', () => {
  solvedOverlay.classList.add('hidden');
  buildPuzzle();
});

window.addEventListener('resize', () => {
  if (placedCount === 0) buildPuzzle();
});

// Boot up
buildPuzzle();