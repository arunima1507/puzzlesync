const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// Keep track of pieces in each room
// rooms = { "roomId": { pieces: { "pieceId": {x, y, placed} } } }
const rooms = {};

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // 1. Join a room
  socket.on('joinRoom', (roomId) => {
    socket.join(roomId);
    socket.roomId = roomId;

    // If room doesn't exist, create it
    if (!rooms[roomId]) {
      rooms[roomId] = { pieces: {} };
    }

    // Send the current puzzle state to the person joining
    socket.emit('roomState', rooms[roomId].pieces);
    console.log(`User ${socket.id} joined room: ${roomId}`);
  });

  // 2. Receive a piece move and broadcast it
  socket.on('pieceMoved', (data) => {
    const roomId = socket.roomId;
    if (!roomId) return;

    // Save state to server memory
    rooms[roomId].pieces[data.pieceId] = {
      x: data.x,
      y: data.y,
      placed: data.placed
    };

    // Send to everyone ELSE in the room
    socket.to(roomId).emit('pieceMoved', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`✨ PuzzleSync running at http://localhost:${PORT}`);
});