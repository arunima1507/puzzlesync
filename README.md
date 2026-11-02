# ✨ PuzzleSync

A collaborative, real-time multiplayer jigsaw puzzle built for the web. Open a link, grab a piece, and solve it together with friends across the world.

![PuzzleSync Preview](https://img.shields.io/badge/Status-Live%20v1.0-ff85d8?style=for-the-badge)
![Tech Stack](https://img.shields.io/badge/Stack-Node.js%20%7C%20Express%20%7C%20Socket.io%20%7C%20Vanilla%20JS-a78bfa?style=for-the-badge)

## 🎮 Features (v1)

- **Real-time Multiplayer:** Powered by Socket.io. Moves are synced instantly.
- **Private Rooms:** Auto-generated room links to invite friends.
- **True Jigsaw Mechanics:** Draggable, snapping pieces with a "Loose Pieces" side-tray.
- **Piece Locking:** If a friend is dragging a piece, it glows pink and locks so you can't fight over it.
- **Multiple Puzzles:** Switch between three custom-coded SVG images on the fly.
- **Victory State:** Confetti explosion and a synthesized victory chime when the puzzle is solved.
- **Pastel/Cyberfemme UI:** A soft, vibrant, responsive design with glassmorphism and custom jigsaw clip-paths.

## 🛠️ Architecture & Tech Stack

- **Frontend:** Vanilla HTML5, CSS3, JavaScript (ES6+). No frameworks.
- **Backend:** Node.js & Express (static file serving).
- **Real-time Engine:** Socket.io (WebSocket fallback to long-polling).
- **State Management:** The server maintains a lightweight in-memory object per room containing piece coordinates, lock states, and the current image selection.

## 🚀 Running Locally

1. Clone the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/puzzlesync.git
   cd puzzlesync

2. Install dependencies:
    ```bash
    npm install

3. Start the development server:
    ```bash
    npm run dev

4. Open http://localhost:3000 in two different browser windows to test the multiplayer sync!

## ☁️ Deployment
This app is configured for one-click deployment to Render.
Build Command: npm install
Start Command: npm start

## 🗺️ Roadmap
[v] v1.0: Core multiplayer, piece locking, sound, confetti.
[] v2.0: Landing page lobby, difficulty levels (3x3, 5x5, 8x8), real image support.
[] v3.0: True interlocking SVG jigsaw paths, user image uploads.
