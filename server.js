/**
 * FAKESTER SERVER (Production Ready)
 * 
 * Setup:
 * 1. npm install
 * 2. Erstelle .env Datei
 * 3. npm run build (Erstellt das Frontend)
 * 4. npm start (Startet den Server auf Port 3000)
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs'); // Wichtig für Datei-Speicherung
const spotify = require('./spotify');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'database.json');

// --- MIDDLEWARE ---
app.use(cors()); 
app.use(bodyParser.json());
app.use(cookieParser());

// --- DATABASE & PERSISTENCE ---
const db = {
    users: [],      // User Store (Persistent)
    sessions: new Map(), // Token -> UserId (RAM only)
    games: {}       // Active Games (RAM only)
};

// Laden der Datenbank beim Start
function loadDB() {
    try {
        if (fs.existsSync(DB_FILE)) {
            const raw = fs.readFileSync(DB_FILE, 'utf8');
            const data = JSON.parse(raw);
            if (Array.isArray(data.users)) {
                db.users = data.users;
                console.log(`💾 Datenbank geladen: ${db.users.length} Benutzer wiederhergestellt.`);
            }
        } else {
            // Erstelle leere Datei wenn nicht vorhanden
            saveDB(); 
        }
    } catch (e) {
        console.error("❌ Fehler beim Laden der Datenbank:", e);
    }
}

// Speichern der Datenbank
function saveDB() {
    try {
        // Wir speichern nur die User-Daten dauerhaft. 
        // Sessions und laufende Spiele sind temporär.
        const data = {
            users: db.users,
            lastSaved: new Date().toISOString()
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("❌ Fehler beim Speichern der Datenbank:", e);
    }
}

// Datenbank initial laden
loadDB();

// --- AUTH UTILS ---
const generateId = () => Math.random().toString(36).substr(2, 9);
const generateToken = () => generateId() + Date.now().toString(36);

const getSessionUser = (req) => {
    const token = req.cookies.auth_token;
    if (!token) return null;
    const userId = db.sessions.get(token);
    return db.users.find(u => u.id === userId) || null;
};

// --- API ROUTES ---

// 1. Profile / Session Check
app.get('/api/profile', (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    res.json(user);
});

// 2. Guest Login
app.post('/api/auth/guest', (req, res) => {
    const guestUser = {
        id: 'guest-' + generateId(),
        username: `Gast ${Math.floor(Math.random() * 1000)}`,
        xp: 0,
        spots: 0,
        isGuest: true,
        avatar: null,
        createdAt: new Date()
    };
    db.users.push(guestUser);
    saveDB(); // SPEICHERN
    
    const token = generateToken();
    db.sessions.set(token, guestUser.id);
    
    res.cookie('auth_token', token, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
    res.json({ success: true, user: guestUser });
});

// 3. Spotify Login Redirect
app.get('/login/spotify', (req, res) => {
    const state = generateToken();
    res.redirect(spotify.getAuthUrl(state));
});

// 4. Spotify Callback
app.get('/callback', async (req, res) => {
    const code = req.query.code || null;
    if (!code) return res.redirect('/?error=no_code');

    try {
        const tokens = await spotify.getToken(code);
        const profile = await spotify.getUserProfile(tokens.access_token);
        
        let user = db.users.find(u => u.spotifyId === profile.id);
        
        if (!user) {
            user = {
                id: 'sp-' + profile.id,
                spotifyId: profile.id,
                username: profile.display_name || profile.id,
                email: profile.email,
                avatar: profile.images?.[0]?.url,
                xp: 0,
                spots: 100,
                isGuest: false,
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                createdAt: new Date()
            };
            db.users.push(user);
        } else {
            user.accessToken = tokens.access_token;
            user.refreshToken = tokens.refresh_token;
            // Update Avatar if changed
            if(profile.images?.[0]?.url) user.avatar = profile.images[0].url;
            user.lastLogin = new Date();
        }
        
        saveDB(); // SPEICHERN

        const token = generateToken();
        db.sessions.set(token, user.id);
        res.cookie('auth_token', token, { httpOnly: true });
        res.redirect('/');
        
    } catch (err) {
        console.error('Spotify Auth Failed:', err);
        res.redirect('/?error=spotify_failed');
    }
});

// --- WEBSOCKET SERVER ---
const wss = new WebSocket.Server({ server });

const broadcastLobby = (pin) => {
    const game = db.games[pin];
    if (!game) return;
    
    const payload = JSON.stringify({
        type: 'LOBBY_UPDATE',
        payload: {
            pin,
            hostId: game.hostId,
            players: game.players,
            gameState: game.gameState
        }
    });

    game.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
        }
    });
};

wss.on('connection', (ws, req) => {
    // Parse Cookie from WS Request to identify user
    const cookieString = req.headers.cookie || '';
    const tokenMatch = cookieString.match(/auth_token=([^;]+)/);
    const token = tokenMatch ? tokenMatch[1] : null;
    const userId = db.sessions.get(token);
    const user = db.users.find(u => u.id === userId);

    if (!user) {
        ws.close();
        return;
    }

    ws.userId = user.id;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            // Create Game
            if (data.type === 'CREATE_GAME') {
                const pin = Math.floor(100000 + Math.random() * 900000).toString(); // 6 Digit PIN
                db.games[pin] = {
                    pin,
                    hostId: user.id,
                    gameState: 'LOBBY',
                    players: [{ ...user, score: 0, connected: true }],
                    clients: [ws]
                };
                ws.pin = pin;
                broadcastLobby(pin);
            }

            // Join Game
            if (data.type === 'JOIN_GAME') {
                const { pin } = data.payload;
                const game = db.games[pin];
                if (game && game.gameState === 'LOBBY') {
                    // Prevent duplicate join
                    if (!game.players.find(p => p.id === user.id)) {
                        game.players.push({ ...user, score: 0, connected: true });
                    }
                    game.clients.push(ws);
                    ws.pin = pin;
                    broadcastLobby(pin);
                } else {
                    ws.send(JSON.stringify({ type: 'ERROR', payload: 'Raum nicht gefunden oder Spiel läuft bereits.' }));
                }
            }

            // Start Game
            if (data.type === 'START_GAME') {
                const game = db.games[ws.pin];
                if (game && game.hostId === ws.userId) {
                    game.gameState = 'PLAYING';
                    broadcastLobby(ws.pin);
                    
                    // Simple Mock Game Loop
                    setTimeout(() => {
                         game.clients.forEach(c => {
                             if(c.readyState === WebSocket.OPEN) {
                                 c.send(JSON.stringify({ type: 'GAME_EVENT', payload: { message: 'Spiel startet! (Mock)' }}));
                             }
                         });
                    }, 1000);
                }
            }
            
            // Example: Wenn ein Spiel endet und XP verteilt werden
            // Müsste man hier auch saveDB() aufrufen!

        } catch (e) {
            console.error('WS Error', e);
        }
    });

    ws.on('close', () => {
        if (ws.pin && db.games[ws.pin]) {
            const game = db.games[ws.pin];
            const player = game.players.find(p => p.id === ws.userId);
            if (player) player.connected = false;
            // Clean up clients array
            game.clients = game.clients.filter(c => c !== ws);
            broadcastLobby(ws.pin);
            
            // Delete empty games after timeout
            if (game.clients.length === 0) {
                setTimeout(() => {
                    if (game.clients.length === 0) delete db.games[ws.pin];
                }, 30000); // 30s grace period
            }
        }
    });
});

// --- STATIC FILES (Frontend) ---
app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// --- START ---
server.listen(PORT, () => {
    console.log(`
    🚀 Fakester Server läuft!
    -------------------------
    URL:        http://taubey.com:${PORT}
    DB Status:  ${db.users.length} User geladen.
    `);
});