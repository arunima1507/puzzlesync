const express = require('express');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Serve everything inside /public to the browser
app.use(express.static(path.join(__dirname, '..', 'public')));

server.listen(PORT, () => {
  console.log(`✨ PuzzleSync running at http://localhost:${PORT}`);
});