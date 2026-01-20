/**
 * LOCAL SERVER IMPLEMENTATION
 * Removes Supabase and stores data in-memory variables.
 * Run with: node server.js
 */

const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const axios = require('axios');
const path = require('path');

const app = express();
const server = http.createServer(app);

// --- LOCAL DATABASE (In-Memory) ---
const db = {
    users: [], // { id, username, password, xp, spots, inventory: [] }
    sessions: new Map(), // token -> userId
    games: {}, // pin -> Game Object
};

// --- CONFIG ---
const PORT = 8080;
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || 'dummy_client_id';
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || 'dummy_secret';
const REDIRECT_URI = 'http://localhost:8080/callback';

app.use(cors({ origin: true, credentials: true }));
app.use(bodyParser.json());
app.use(cookieParser());

// --- AUTH HELPERS ---
const generateToken = () => Math.random().toString(36).substring(2) + Date.now().toString(36);
const findUserByToken = (token) => {
    const userId = db.sessions.get(token);
    return db.users.find(u => u.id === userId);
};

// --- API ROUTES ---

// Login
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const user = db.users.find(u => u.username === username && u.password === password);
    
    if (user) {
        const token = generateToken();
        db.sessions.set(token, user.id);
        res.cookie('auth_token', token, { httpOnly: true });
        res.json({ success: true, user: { id: user.id, username: user.username, xp: user.xp, spots: user.spots } });
    } else {
        res.status(401).json({ success: false, message: "Invalid credentials" });
    }
});

// Register
app.post('/api/auth/register', (req, res) => {
    const { username, password } = req.body;
    if (db.users.find(u => u.username === username)) {
        return res.status(400).json({ success: false, message: "Username taken" });
    }
    
    const newUser = {
        id: 'user-' + Date.now(),
        username,
        password, // stored plain text for local demo
        xp: 0,
        spots: 100,
        inventory: []
    };
    
    db.users.push(newUser);
    const token = generateToken();
    db.sessions.set(token, newUser.id);
    res.cookie('auth_token', token, { httpOnly: true });
    res.json({ success: true, user: { id: newUser.id, username: newUser.username, xp: newUser.xp, spots: newUser.spots } });
});

// Get Profile
app.get('/api/profile', (req, res) => {
    const token = req.cookies.auth_token;
    const user = findUserByToken(token);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    res.json(user);
});

// Mock Shop Items
const SHOP_ITEMS = [
    { id: 1, name: "Gold Title", cost: 100, type: 'title' },
    { id: 2, name: "Cool Icon", cost: 50, type: 'icon', iconClass: 'fa-user-astronaut' }
];

app.get('/api/shop/items', (req, res) => {
    const token = req.cookies.auth_token;
    const user = findUserByToken(token);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    
    const items = SHOP_ITEMS.map(item => ({
        ...item,
        isOwned: user.inventory.includes(item.id)
    }));
    res.json({ items });
});

// Buy Item
app.post('/api/shop/buy', (req, res) => {
    const { itemId } = req.body;
    const token = req.cookies.auth_token;
    const user = findUserByToken(token);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (!item) return res.status(404).json({ message: "Item not found" });
    
    if (user.spots < item.cost) return res.status(400).json({ message: "Not enough spots" });
    
    user.spots -= item.cost;
    user.inventory.push(item.id);
    
    res.json({ success: true, newSpots: user.spots });
});

// --- SPOTIFY PROXY (Simplified) ---
// Note: In a real "local" environment without a registered Spotify App Callback, 
// this part is tricky. Assuming the user has configured Client ID/Secret.

app.get('/login/spotify', (req, res) => {
     const scopes = 'user-read-private user-read-email playlist-read-private streaming user-modify-playback-state user-read-playback-state';
     res.redirect('https://accounts.spotify.com/authorize?' + new URLSearchParams({ response_type: 'code', client_id: CLIENT_ID, scope: scopes, redirect_uri: REDIRECT_URI }).toString());
});

app.get('/callback', async (req, res) => {
    // This expects a real Spotify App Configured
    res.redirect('http://localhost:3000'); // Redirect back to React Dev Server
});

// --- WEBSOCKET SERVER ---
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => ws.isAlive = true);

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            handleWSMessage(ws, data);
        } catch (e) {
            console.error("WS Parse Error", e);
        }
    });
});

// Helper: Broadcast to lobby
const broadcast = (pin, type, payload) => {
    const game = db.games[pin];
    if (!game) return;
    game.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type, payload }));
        }
    });
};

function handleWSMessage(ws, data) {
    const { type, payload } = data;
    
    if (type === 'create-game') {
        const pin = Math.floor(1000 + Math.random() * 9000).toString();
        db.games[pin] = {
            pin,
            hostId: payload.user.id,
            players: [{
                ...payload.user,
                score: 0,
                isReady: false,
                isConnected: true
            }],
            settings: payload.settings || {},
            gameMode: payload.gameMode,
            gameState: 'LOBBY',
            clients: [ws]
        };
        ws.pin = pin;
        ws.userId = payload.user.id;
        
        ws.send(JSON.stringify({ 
            type: 'lobby-update', 
            payload: { 
                pin, 
                hostId: payload.user.id, 
                players: db.games[pin].players,
                settings: db.games[pin].settings,
                gameMode: payload.gameMode 
            } 
        }));
    }
    
    if (type === 'join-game') {
        const game = db.games[payload.pin];
        if (game) {
            game.players.push({
                ...payload.user,
                score: 0,
                isReady: false,
                isConnected: true
            });
            game.clients.push(ws);
            ws.pin = payload.pin;
            ws.userId = payload.user.id;
            
            broadcast(payload.pin, 'lobby-update', {
                pin: payload.pin,
                hostId: game.hostId,
                players: game.players,
                settings: game.settings,
                gameMode: game.gameMode
            });
        }
    }
    
    if (type === 'start-game') {
        const game = db.games[ws.pin];
        if (game && game.hostId === ws.userId) {
            game.gameState = 'PLAYING';
            broadcast(ws.pin, 'game-starting', {});
            // Simulate game loop logic here (Countdown etc)
            setTimeout(() => {
                broadcast(ws.pin, 'new-round', { round: 1, totalRounds: 10, mcOptions: { title: ['Song A', 'Song B', 'Song C'] } });
            }, 3000);
        }
    }
    
    if (type === 'submit-guess') {
         // Handle scoring locally
         const game = db.games[ws.pin];
         if(game) {
             const player = game.players.find(p => p.id === ws.userId);
             if(player) {
                 player.score += 100; // Mock scoring
                 player.isReady = true;
                 broadcast(ws.pin, 'player-reacted', { playerId: ws.userId, reaction: '✅' });
             }
         }
    }
}

server.listen(PORT, () => {
    console.log(`Fakester Local Server running on port ${PORT}`);
});