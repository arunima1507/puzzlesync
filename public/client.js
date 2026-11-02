const COLS = 4;
const ROWS = 3;
const TOTAL = COLS * ROWS;
const SNAP_DISTANCE = 40;

const socket = io();
const urlParams = new URLSearchParams(window.location.search);
let roomId = urlParams.get('room');
if (!roomId) {
  roomId = Math.random().toString(36).substring(2, 8);
  window.history.replaceState(null, '', `?room=${roomId}`);
}

const board = document.getElementById('board');
const tray = document.getElementById('tray');
const progressEl = document.getElementById('progress');
const resetBtn = document.getElementById('resetBtn');
const solvedOverlay = document.getElementById('solvedOverlay');
const playAgainBtn = document.getElementById('playAgainBtn');
const inviteBtn = document.getElementById('inviteBtn');
const presenceEl = document.getElementById('presence');
const imageSelect = document.getElementById('imageSelect');

// --- THE IMAGES ---
const IMAGES = {
  puzzle1: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><rect width="800" height="600" fill="#fff0f5"/><circle cx="600" cy="160" r="70" fill="#ff85d8"/><g transform="translate(120 320)"><rect width="260" height="170" rx="18" fill="#fff" stroke="#a78bfa" stroke-width="4"/><rect x="16" y="16" width="228" height="112" rx="10" fill="#6ee7b7"/><rect x="60" y="144" width="140" height="18" rx="8" fill="#e6e6fa" stroke="#a78bfa" stroke-width="2"/></g><text x="400" y="560" text-anchor="middle" font-family="sans-serif" font-size="34" font-weight="700" fill="#3b2a5c" opacity="0.6">coded with love ✨</text></svg>`)}`,
  puzzle2: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><defs><pattern id="p" width="80" height="80" patternUnits="userSpaceOnUse"><rect width="80" height="80" fill="#e6e6fa"/><circle cx="40" cy="40" r="20" fill="#a78bfa" opacity="0.6"/></pattern></defs><rect width="800" height="600" fill="url(#p)"/><circle cx="400" cy="300" r="150" fill="#ff85d8" opacity="0.8"/><circle cx="400" cy="300" r="80" fill="#6ee7b7" opacity="0.9"/></svg>`)}`,
  puzzle3: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><rect width="800" height="600" fill="#fdf5ff"/><path d="M 200 500 L 300 200 L 500 200 L 600 500 Z" fill="#ff85d8"/><path d="M 300 200 L 400 100 L 500 200 Z" fill="#a78bfa"/><circle cx="350" cy="350" r="10" fill="#fff"/><circle cx="450" cy="350" r="10" fill="#fff"/><path d="M 350 420 Q 400 450 450 420" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round"/><text x="400" y="560" text-anchor="middle" font-family="sans-serif" font-size="34" font-weight="700" fill="#3b2a5c" opacity="0.6">you got this ✨</text></svg>`)}`
};

let currentImageId = 'puzzle1';
let pieces = [];
let placedCount = 0;
let draggingPiece = null;
let dragOffset = { x: 0, y: 0 };
let lockedByOthers = new Set();

// --- AUDIO & CONFETTI ---
function playVictorySound() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const ctx = new AudioContext();
  const notes = [523.25, 659.25, 783.99, 1046.50];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
    osc.start(ctx.currentTime + i * 0.1);
    osc.stop(ctx.currentTime + 1.5);
  });
}

function launchConfetti() {
  const canvas = document.getElementById('confettiCanvas');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  
  const colors = ['#ff85d8', '#a78bfa', '#6ee7b7', '#67e8f9', '#fbbf24'];
  const particles = Array.from({ length: 150 }).map(() => ({
    x: canvas.width / 2, y: canvas.height / 2,
    vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 1) * 20,
    size: Math.random() * 8 + 4, color: colors[Math.floor(Math.random() * colors.length)],
    life: 1
  }));

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    particles.forEach(p => {
      if (p.life <= 0) return;
      alive = true;
      p.x += p.vx; p.y += p.vy; p.vy += 0.4; p.vx *= 0.98; p.life -= 0.01;
      ctx.fillStyle = p.color; ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    if (alive) requestAnimationFrame(animate);
  }
  animate();
}

// --- INIT ---
function buildPuzzle() {
  board.innerHTML = '';
  tray.innerHTML = '';
  pieces = [];
  placedCount = 0;
  lockedByOthers.clear();
  updateProgress();

  const bRect = board.getBoundingClientRect();
  const img = IMAGES[currentImageId];
  board.style.backgroundImage = `url("${img}")`;

  const pieceW = bRect.width / COLS;
  const pieceH = bRect.height / ROWS;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const id = r * COLS + c;
      const el = document.createElement('div');
      el.className = 'piece';
      el.dataset.id = id;
      
      el.style.backgroundImage = `url("${img}")`;
      el.style.backgroundSize = `${bRect.width}px ${bRect.height}px`;
      el.style.backgroundPosition = `-${c * pieceW}px -${r * pieceH}px`;

      tray.appendChild(el);
      el.style.width = '60px';
      el.style.height = '45px';
      
      const tRect = tray.getBoundingClientRect();
      el.style.left = `${Math.random() * Math.max(0, tRect.width - 60)}px`;
      el.style.top = `${Math.random() * Math.max(0, tRect.height - 45)}px`;

      // FIXED: Properly scope each piece's data
      const pieceData = { 
        el: el, 
        id: id, 
        r: r, 
        c: c, 
        slotX: c * pieceW, 
        slotY: r * pieceH, 
        placed: false 
      };
      
      pieces.push(pieceData);
      
      // Attach events to this specific piece
      el.addEventListener('pointerdown', (e) => startDrag(e, pieceData));
      
      // Double click to auto-snap if correct
      el.addEventListener('dblclick', () => autoSnap(pieceData));
    }
  }
}

// --- AUTO SNAP (Double Click) ---
function autoSnap(p) {
  if (p.placed || lockedByOthers.has(p.id)) return;
  
  const bRect = board.getBoundingClientRect();
  
  // Instantly snap it to its correct slot
  board.appendChild(p.el);
  p.el.style.position = 'absolute';
  p.el.style.width = `${bRect.width / COLS}px`;
  p.el.style.height = `${bRect.height / ROWS}px`;
  p.el.style.left = `${p.slotX}px`;
  p.el.style.top = `${p.slotY}px`;
  p.el.classList.add('placed');
  
  p.placed = true;
  placedCount++;
  updateProgress();
  
  socket.emit('pieceMoved', { 
    pieceId: p.id, 
    x: p.slotX, 
    y: p.slotY, 
    placed: true, 
    inTray: false, 
    rawX: p.slotX, 
    rawY: p.slotY 
  });

  if (placedCount === TOTAL) {
    setTimeout(triggerWin, 400);
  }
}

// --- DRAG LOGIC ---
function startDrag(e, p) {
  if (p.placed || lockedByOthers.has(p.id)) return;
  
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
  
  if (el.parentElement === tray) {
    const bRect = board.getBoundingClientRect();
    el.style.width = `${bRect.width / COLS}px`;
    el.style.height = `${bRect.height / ROWS}px`;
  }
  
  document.body.appendChild(el);
  socket.emit('lockPiece', p.id);

  window.addEventListener('pointermove', onDrag, { passive: false });
  window.addEventListener('pointerup', endDrag);
}

function onDrag(e) {
  if (!draggingPiece) return;
  e.preventDefault(); 
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
  socket.emit('unlockPiece', p.id);

  const elRect = el.getBoundingClientRect();
  const bRect = board.getBoundingClientRect();
  const tRect = tray.getBoundingClientRect();

  const centerX = elRect.left + elRect.width / 2;
  const centerY = elRect.top + elRect.height / 2;

  const droppedInTray = centerX > tRect.left && centerX < tRect.right && centerY > tRect.top && centerY < tRect.bottom;
  const droppedInBoard = centerX > bRect.left && centerX < bRect.right && centerY > bRect.top && centerY < bRect.bottom;

  if (droppedInTray) {
    tray.appendChild(el);
    el.style.position = 'absolute';
    el.style.width = '60px';
    el.style.height = '45px';
    el.style.left = `${Math.random() * Math.max(0, tRect.width - 60)}px`;
    el.style.top = `${Math.random() * Math.max(0, tRect.height - 45)}px`;
    socket.emit('pieceMoved', { pieceId: p.id, inTray: true });
    return;
  }

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
        setTimeout(triggerWin, 400);
      }
    }
    
    socket.emit('pieceMoved', { pieceId: p.id, x: p.slotX, y: p.slotY, placed: snapped, inTray: false, rawX: relX, rawY: relY });
    return;
  }

  tray.appendChild(el);
  el.style.position = 'absolute';
  el.style.width = '60px';
  el.style.height = '45px';
  el.style.left = `${Math.random() * Math.max(0, tRect.width - 60)}px`;
  el.style.top = `${Math.random() * Math.max(0, tRect.height - 45)}px`;
  socket.emit('pieceMoved', { pieceId: p.id, inTray: true });
}

// --- SOCKET EVENTS ---
socket.on('playerCount', (count) => {
  presenceEl.textContent = `🟢 ${count} here`;
});

socket.on('pieceLocked', (pieceId) => {
  lockedByOthers.add(pieceId);
  const p = pieces.find(piece => piece.id === pieceId);
  if (p) p.el.classList.add('locked-by-other');
});

socket.on('pieceUnlocked', (pieceId) => {
  lockedByOthers.delete(pieceId);
  const p = pieces.find(piece => piece.id === pieceId);
  if (p) p.el.classList.remove('locked-by-other');
});

socket.on('imageChanged', (imageId) => {
  currentImageId = imageId;
  imageSelect.value = imageId;
  buildPuzzle();
});

socket.on('pieceMoved', (data) => {
  const p = pieces.find(piece => piece.id === data.pieceId);
  if (!p) return;
  const el = p.el;
  const bRect = board.getBoundingClientRect();

  if (data.inTray) {
    if (el.parentElement !== tray) {
      tray.appendChild(el);
      el.style.width = '60px';
      el.style.height = '45px';
      el.style.left = `${Math.random() * Math.max(0, tray.getBoundingClientRect().width - 60)}px`;
      el.style.top = `${Math.random() * Math.max(0, tray.getBoundingClientRect().height - 45)}px`;
    }
  } else {
    board.appendChild(el);
    el.style.width = `${bRect.width / COLS}px`;
    el.style.height = `${bRect.height / ROWS}px`;
    if (data.placed) {
      el.style.left = `${data.x}px`;
      el.style.top = `${data.y}px`;
      el.classList.add('placed');
      p.placed = true;
      placedCount = pieces.filter(piece => piece.placed).length;
      updateProgress();
      if (placedCount === TOTAL) setTimeout(triggerWin, 400);
    } else {
      el.style.left = `${data.rawX}px`;
      el.style.top = `${data.rawY}px`;
    }
  }
});

socket.on('roomState', (state) => {
  currentImageId = state.imageId;
  imageSelect.value = currentImageId;
  
  setTimeout(() => {
    buildPuzzle(); 
    const bRect = board.getBoundingClientRect();
    Object.keys(state.pieces).forEach(id => {
      const data = state.pieces[id];
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
function triggerWin() {
  solvedOverlay.classList.remove('hidden');
  playVictorySound();
  launchConfetti();
}

function updateProgress() {
  progressEl.textContent = `${placedCount} / ${TOTAL} placed`;
}

imageSelect.addEventListener('change', (e) => {
  socket.emit('changeImage', e.target.value);
});

inviteBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(window.location.href);
  inviteBtn.textContent = '✅ Copied!';
  setTimeout(() => { inviteBtn.textContent = '🔗 Invite'; }, 2000);
});

resetBtn.addEventListener('click', () => { solvedOverlay.classList.add('hidden'); buildPuzzle(); });
playAgainBtn.addEventListener('click', () => { solvedOverlay.classList.add('hidden'); buildPuzzle(); });

window.addEventListener('resize', () => {
  if (placedCount === 0) buildPuzzle();
});

socket.emit('joinRoom', roomId);
buildPuzzle();