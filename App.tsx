import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User, LobbyState, GameSettings } from './types';

// --- COMPONENTS ---

const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false }: any) => {
  const baseStyle = "font-bold rounded-full px-6 py-3 transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2";
  const variants = {
    primary: "bg-accent text-black hover:brightness-110",
    secondary: "bg-transparent border-2 border-surface text-white hover:bg-surface",
    danger: "bg-danger text-white"
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${baseStyle} ${variants[variant as keyof typeof variants]} ${className}`}>
      {children}
    </button>
  );
};

const Input = (props: any) => (
  <input {...props} className="w-full bg-surface border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-accent focus:outline-none" />
);

// --- SCREENS ---

const AuthScreen = ({ onLogin, onGuest }: any) => {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
    try {
      // Relative URL nutzen, damit es auf taubey.com funktioniert
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (data.success) {
        onLogin(data.user);
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.error(err);
      alert("Server connection failed");
    }
  };

  const handleSpotifyLogin = () => {
      // Relative URL für den Login
      window.location.href = '/login/spotify';
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 radial-bg">
      <h1 className="text-4xl font-extrabold tracking-widest text-accent mb-8">FAKESTER</h1>
      <div className="w-full max-w-md bg-surface p-8 rounded-2xl shadow-2xl">
        <h2 className="text-2xl font-bold mb-6 text-center">{isRegister ? 'Registrieren' : 'Anmelden'}</h2>
        
        {/* Spotify Login Button Highlighted */}
        <Button onClick={handleSpotifyLogin} className="w-full mb-6 bg-[#1DB954] text-black hover:brightness-105">
           <i className="fa-brands fa-spotify text-xl"></i> Mit Spotify anmelden
        </Button>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input placeholder="Benutzername" value={username} onChange={(e: any) => setUsername(e.target.value)} />
          <Input type="password" placeholder="Passwort" value={password} onChange={(e: any) => setPassword(e.target.value)} />
          <Button type="submit" variant="secondary">{isRegister ? 'Konto erstellen' : 'Anmelden'}</Button>
        </form>
        <div className="mt-4 text-center text-sm text-gray-400">
          {isRegister ? 'Schon ein Konto?' : 'Noch kein Konto?'} 
          <button onClick={() => setIsRegister(!isRegister)} className="text-accent font-bold ml-2">
            {isRegister ? 'Anmelden' : 'Registrieren'}
          </button>
        </div>
        <div className="flex items-center my-6 text-gray-500">
          <div className="flex-1 border-b border-gray-700"></div>
          <span className="px-4 text-xs">ODER</span>
          <div className="flex-1 border-b border-gray-700"></div>
        </div>
        <Button variant="secondary" onClick={onGuest} className="w-full text-sm py-2">
          <i className="fa-solid fa-user-secret"></i> Als Gast spielen
        </Button>
      </div>
    </div>
  );
};

const HomeScreen = ({ user, onCreateGame, onJoinGame, onLogout }: any) => {
  return (
    <div className="flex flex-col min-h-screen p-6 radial-bg">
       <header className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
        <h1 className="text-xl font-extrabold text-accent tracking-widest">FAKESTER</h1>
        <div className="font-bold text-accent">{user.spots} 🎵</div>
      </header>
      
      <div className="flex-1 flex flex-col items-center gap-6 w-full max-w-md mx-auto">
        {/* Profile Card */}
        <div className="w-full bg-surface p-4 rounded-xl flex items-center gap-4">
           <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center text-2xl text-gray-500 overflow-hidden">
             {/* Use Spotify Avatar if available (not stored currently but ready structure) */}
             <i className="fa-solid fa-user"></i>
           </div>
           <div className="flex-1">
             <h2 className="text-xl font-bold">{user.username}</h2>
             <span className="bg-[#1db95420] text-accent text-xs font-bold px-2 py-1 rounded-full">Neuling</span>
             <div className="w-full h-1.5 bg-gray-700 rounded-full mt-2 overflow-hidden">
               <div className="h-full bg-accent w-[10%]"></div>
             </div>
             <p className="text-xs text-gray-400 mt-1">0 / 100 XP</p>
           </div>
        </div>

        {/* Actions */}
        <div className="w-full flex flex-col gap-4 mt-8">
          <Button onClick={onCreateGame}><i className="fa-solid fa-plus"></i> Raum erstellen</Button>
          <Button variant="secondary" onClick={onJoinGame}><i className="fa-solid fa-right-to-bracket"></i> Raum beitreten</Button>
          <Button variant="secondary"><i className="fa-solid fa-store"></i> Shop</Button>
        </div>
      </div>
      
      <button onClick={onLogout} className="fixed bottom-6 right-6 w-12 h-12 bg-surface rounded-full flex items-center justify-center text-gray-400 hover:text-white shadow-lg">
        <i className="fa-solid fa-right-from-bracket"></i>
      </button>
    </div>
  );
};

const LobbyScreen = ({ lobby, isHost, onStartGame, onLeave }: any) => {
  return (
     <div className="flex flex-col min-h-screen p-6 radial-bg items-center">
        <h2 className="text-gray-400 font-bold mb-2">LOBBY PIN</h2>
        <div className="text-6xl font-black text-white tracking-widest mb-12">{lobby.pin}</div>
        
        <div className="w-full max-w-md">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold">Spieler ({lobby.players.length})</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-8">
            {lobby.players.map((p: any) => (
              <div key={p.id} className="bg-surface p-4 rounded-xl flex items-center gap-3 relative overflow-hidden">
                <i className="fa-solid fa-user text-2xl text-gray-500"></i>
                <span className="font-bold truncate">{p.username}</span>
                {lobby.hostId === p.id && <i className="fa-solid fa-crown text-accent absolute top-2 right-2 text-xs"></i>}
              </div>
            ))}
          </div>
          
          {isHost ? (
            <div className="bg-surface p-6 rounded-xl flex flex-col gap-4">
              <h3 className="font-bold border-b border-gray-700 pb-2">Einstellungen</h3>
              <div className="text-sm text-gray-400">Gerät & Playlist wählen (Simuliert)</div>
              <Button onClick={onStartGame}>Spiel starten</Button>
            </div>
          ) : (
            <div className="text-center text-gray-400 animate-pulse">
              Warte auf Host...
            </div>
          )}
          
          <Button variant="secondary" className="mt-8 w-full border-danger text-danger hover:bg-danger hover:text-white" onClick={onLeave}>
            Verlassen
          </Button>
        </div>
     </div>
  );
};

const GameScreen = ({ lobby, ws }: any) => {
  const [guess, setGuess] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const submitGuess = () => {
    ws.send(JSON.stringify({ type: 'submit-guess', payload: { guess } }));
    setSubmitted(true);
  };

  return (
    <div className="flex flex-col min-h-screen p-6 radial-bg items-center justify-center">
       <div className="w-full max-w-md text-center">
         <h2 className="text-3xl font-bold mb-8">Was ist das für ein Song?</h2>
         
         <div className="bg-surface p-8 rounded-2xl mb-8">
           <div className="w-16 h-16 bg-gray-700 rounded-full mx-auto mb-4 animate-bounce flex items-center justify-center">
             <i className="fa-solid fa-music text-accent text-2xl"></i>
           </div>
           <p className="text-gray-400">Musik spielt...</p>
         </div>
         
         {!submitted ? (
           <div className="flex flex-col gap-4">
             <Input placeholder="Titel eingeben..." value={guess} onChange={(e: any) => setGuess(e.target.value)} />
             <Button onClick={submitGuess}>Absenden</Button>
           </div>
         ) : (
           <div className="text-accent font-bold text-xl">Antwort gesendet!</div>
         )}
       </div>
    </div>
  );
};

// --- MAIN APP ---

const App = () => {
  const [user, setUser] = useState<User | null>(null);
  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Check for existing session on mount
    fetch('/api/profile')
      .then(res => res.json())
      .then(data => {
        if(data.id) setUser(data);
      })
      .catch(() => {});
  }, []);

  const connectWS = useCallback((currentUser: User) => {
    if(ws.current) return;
    
    // Automatisch Protokoll (ws oder wss) und Host erkennen
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host; // Enthält taubey.com:3000
    const socket = new WebSocket(`${protocol}//${host}`);
    
    socket.onopen = () => {
      console.log('Connected to WS');
    };
    
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'lobby-update') {
        setLobby(data.payload);
      }
      if (data.type === 'game-starting') {
        setLobby(prev => prev ? { ...prev, gameState: 'PLAYING' } : null);
      }
    };
    
    ws.current = socket;
  }, []);

  useEffect(() => {
    if (user) {
      connectWS(user);
    }
  }, [user, connectWS]);

  const handleCreateGame = () => {
    if(!ws.current) return;
    ws.current.send(JSON.stringify({ 
      type: 'create-game', 
      payload: { user, settings: {}, gameMode: 'quiz' } 
    }));
  };

  const handleJoinGame = () => {
    const pin = prompt("PIN eingeben:");
    if(pin && ws.current) {
      ws.current.send(JSON.stringify({
        type: 'join-game',
        payload: { pin, user }
      }));
    }
  };

  const handleStartGame = () => {
    if(!ws.current || !lobby) return;
    ws.current.send(JSON.stringify({ type: 'start-game' }));
  };

  const handleLeave = () => {
    setLobby(null);
    // In a real app, send leave message
  };

  if (!user) {
    return (
      <AuthScreen 
        onLogin={setUser} 
        onGuest={() => setUser({ id: `guest-${Date.now()}`, username: 'Gast', xp: 0, spots: 0, isGuest: true })} 
      />
    );
  }

  if (lobby) {
    if (lobby.gameState === 'PLAYING') {
      return <GameScreen lobby={lobby} ws={ws.current} />;
    }
    return (
      <LobbyScreen 
        lobby={lobby} 
        isHost={lobby.hostId === user.id} 
        onStartGame={handleStartGame}
        onLeave={handleLeave}
      />
    );
  }

  return (
    <HomeScreen 
      user={user} 
      onCreateGame={handleCreateGame} 
      onJoinGame={handleJoinGame} 
      onLogout={() => { setUser(null); setLobby(null); }}
    />
  );
};

export default App;