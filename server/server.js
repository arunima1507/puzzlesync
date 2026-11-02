const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
app.use(express.static(path.join(__dirname, '..', 'public')));

// rooms = { "roomId": { imageId, lockedPieces: Set, pieces: {}, playerCount: 0 } }
const rooms = {};

io.on('connection', (socket) => {
  socket.on('joinRoom', (roomId) => {
    socket.join(roomId);
    socket.roomId = roomId;

    if (!rooms[roomId]) {
      rooms[roomId] = { 
        imageId: 'puzzle1', 
        lockedPieces: new Set(), 
        pieces: {}, 
        playerCount: 0 
      };
    }

    rooms[roomId].playerCount++;
    io.to(roomId).emit('playerCount', rooms[roomId].playerCount);

    // Send current state to the new joiner
    socket.emit('roomState', {
      pieces: rooms[roomId].pieces,
      imageId: rooms[roomId].imageId
    });
  });

  socket.on('changeImage', (imageId) => {
    const roomId = socket.roomId;
    if (!roomId || !rooms[roomId]) return;
    rooms[roomId].imageId = imageId;
    rooms[roomId].pieces = {}; // reset pieces
    rooms[roomId].lockedPieces.clear();
    io.to(roomId).emit('imageChanged', imageId);
  });

  socket.on('pieceMoved', (data) => {
    const roomId = socket.roomId;
    if (!roomId || !rooms[roomId]) return;
    rooms[roomId].pieces[data.pieceId] = {
      x: data.x, y: data.y, placed: data.placed, inTray: data.inTray, rawX: data.rawX, rawY: data.rawY
    };
    socket.to(roomId).emit('pieceMoved', data);
  });

  socket.on('lockPiece', (pieceId) => {
    const roomId = socket.roomId;
    if (!roomId || !rooms[roomId]) return;
    rooms[roomId].lockedPieces.add(pieceId);
    socket.to(roomId).emit('pieceLocked', pieceId);
  });

  socket.on('unlockPiece', (pieceId) => {
    const roomId = socket.roomId;
    if (!roomId || !rooms[roomId]) return;
    rooms[roomId].lockedPieces.delete(pieceId);
    socket.to(roomId).emit('pieceUnlocked', pieceId);
  });

  socket.on('disconnect', () => {
    const roomId = socket.roomId;
    if (roomId && rooms[roomId]) {
      rooms[roomId].playerCount = Math.max(0, rooms[roomId].playerCount - 1);
      io.to(roomId).emit('playerCount', rooms[roomId].playerCount);
    }
  });
});

server.listen(PORT, () => {
  console.log(`✨ PuzzleSync running at http://localhost:${PORT}`);
});