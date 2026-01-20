/**
 * LOCAL SERVER IMPLEMENTATION
 * Removes Supabase and stores data in-memory variables.
 * Run with: node server.js
 */

require('dotenv').config();
const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');
const querystring = require('querystring'); // HINZUGEFÜGT: Fix für Error Code
const spotify = require('./spotify');

const app = express();
const server = http.createServer(app);

// --- LOCAL DATABASE (In-Memory) ---
const db = {
    users: [], // { id, username, password, xp, spots, spotifyId, inventory: [] }
    sessions: new Map(), // token -> userId
    games: {}, // pin -> Game Object
};

// --- CONFIG ---
const PORT = process.env.PORT || 3000; // Geändert auf 3000 als Standard

app.use(cors({ origin: true, credentials: true }));
app.use(bodyParser.json());
app.use(cookieParser());

// --- STATIC FILES (Frontend Build) ---
// Liefert die React App aus dem 'build' Ordner aus
app.use(express.static(path.join(__dirname, 'build')));

// --- AUTH HELPERS ---
const generateToken = () => Math.random().toString(36).substring(2) + Date.now().toString(36);
const findUserByToken = (token) => {
    const userId = db.sessions.get(token);
    return db.users.find(u => u.id === userId);
};

// --- API ROUTES ---

// Login (Lokal)
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const user = db.users.find(u => u.username === username && u.password === password);
    
    if (user) {
        const token = generateToken();
        db.sessions.set(token, user.id);
        res.cookie('auth_token', token, { httpOnly: true });
        res.json({ success: true, user: { id: user.id, username: user.username, xp: user.xp, spots: user.spots } });
    } else {
        res.status(401).json({ success: false, message: "Ungültige Anmeldedaten" });
    }
});

// Register (Lokal)
app.post('/api/auth/register', (req, res) => {
    const { username, password } = req.body;
    if (db.users.find(u => u.username === username)) {
        return res.status(400).json({ success: false, message: "Benutzername vergeben" });
    }
    
    const newUser = {
        id: 'user-' + Date.now(),
        username,
        password, 
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
    if (!user) return res.status(401).json({ message: "Nicht angemeldet" });
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

// --- SPOTIFY AUTHENTICATION ---

app.get('/login/spotify', (req, res) => {
    const state = generateToken();
    const authUrl = spotify.getAuthUrl(state);
    res.redirect(authUrl);
});

app.get('/callback', async (req, res) => {
    const code = req.query.code || null;
    const state = req.query.state || null;

    if (code === null) {
        return res.redirect('/#' + querystring.stringify({ error: 'state_mismatch' }));
    }

    try {
        // 1. Token von Spotify holen
        const data = await spotify.getToken(code);
        const { access_token, refresh_token } = data;

        // 2. Benutzerprofil laden
        const profile = await spotify.getUserProfile(access_token);
        
        // 3. Benutzer in lokaler DB finden oder erstellen
        let user = db.users.find(u => u.spotifyId === profile.id);

        if (!user) {
            // Wenn der User noch nicht existiert, erstellen wir ihn
            user = {
                id: 'sp-' + profile.id,
                spotifyId: profile.id,
                username: profile.display_name || profile.id,
                xp: 0,
                spots: 100,
                inventory: [],
                accessToken: access_token, 
                refreshToken: refresh_token
            };
            db.users.push(user);
        } else {
            // Update Token für existierenden User
            user.accessToken = access_token;
            user.refreshToken = refresh_token;
        }

        // 4. Session erstellen
        const token = generateToken();
        db.sessions.set(token, user.id);
        res.cookie('auth_token', token, { httpOnly: true });

        // 5. Zurück zum Frontend
        res.redirect('/'); 

    } catch (error) {
        console.error("Callback Error:", error);
        res.redirect('/?error=spotify_login_failed');
    }
});

// --- CLIENT ROUTING FALLBACK ---
// Wichtig: Muss NACH den API Routes stehen.
// Leitet alle unbekannten Anfragen an die React App weiter (für Client-Side Routing)
app.get('*', (req, res) => {
    // API Calls sollen 404 zurückgeben, wenn sie oben nicht gefunden wurden
    if(req.path.startsWith('/api') || req.path.startsWith('/login') || req.path.startsWith('/callback')) {
        return res.status(404).json({error: 'Not found'});
    }
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
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
            // Mock Loop
            setTimeout(() => {
                broadcast(ws.pin, 'new-round', { round: 1, totalRounds: 10, mcOptions: { title: ['Song A', 'Song B', 'Song C'] } });
            }, 3000);
        }
    }
    
    if (type === 'submit-guess') {
         const game = db.games[ws.pin];
         if(game) {
             const player = game.players.find(p => p.id === ws.userId);
             if(player) {
                 player.score += 100;
                 player.isReady = true;
                 broadcast(ws.pin, 'player-reacted', { playerId: ws.userId, reaction: '✅' });
             }
         }
    }
}

server.listen(PORT, () => {
    console.log(`Fakester Server running on port ${PORT}`);
    if(!process.env.SPOTIFY_CLIENT_ID) console.log("⚠️  WARNUNG: Keine Spotify Credentials in .env gefunden!");
});