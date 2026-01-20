import React, { useState, useEffect, useRef } from 'react';
import { User, LobbyState } from './types';

// --- COMPONENTS ---

const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false }: any) => {
  const base = "relative overflow-hidden font-bold rounded-full px-8 py-3 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg";
  const styles = {
    primary: "bg-accent text-black hover:bg-[#1ed760]",
    secondary: "bg-transparent border border-gray-600 text-white hover:bg-white/10",
    danger: "bg-danger text-white hover:bg-red-600"
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${styles[variant as keyof typeof styles]} ${className}`}>
      {children}
    </button>
  );
};

const Card = ({ children, className = '' }: any) => (
  <div className={`glass rounded-2xl p-6 ${className}`}>
    {children}
  </div>
);

// --- SCREENS ---

const AuthScreen = ({ onLogin }: { onLogin: (u: User) => void }) => {
  const loginGuest = async () => {
    const res = await fetch('/api/auth/guest', { method: 'POST' });
    const data = await res.json();
    if(data.success) onLogin(data.user);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 radial-bg">
      <div className="text-center mb-12">
        <h1 className="text-6xl font-black text-white tracking-tighter mb-2">FAKESTER</h1>
        <p className="text-gray-400 font-medium tracking-widest text-sm">MUSIC QUIZ EVOLVED</p>
      </div>
      
      <Card className="w-full max-w-md flex flex-col gap-4">
        <Button onClick={() => window.location.href = '/login/spotify'}>
          <i className="fa-brands fa-spotify text-xl"></i> Mit Spotify Login
        </Button>
        <div className="relative py-2">
           <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-700"></div></div>
           <div className="relative flex justify-center text-xs uppercase"><span className="bg-[#282828] px-2 text-gray-500">Oder</span></div>
        </div>
        <Button variant="secondary" onClick={loginGuest}>Als Gast spielen</Button>
      </Card>
    </div>
  );
};

const Dashboard = ({ user, ws }: { user: User, ws: WebSocket | null }) => {
  const [isJoining, setIsJoining] = useState(false);
  const [pinInput, setPinInput] = useState('');

  const createGame = () => {
    ws?.send(JSON.stringify({ type: 'CREATE_GAME' }));
  };

  const joinGame = () => {
    if(!pinInput) return;
    ws?.send(JSON.stringify({ type: 'JOIN_GAME', payload: { pin: pinInput } }));
  };

  if(isJoining) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 radial-bg">
         <Card className="w-full max-w-sm text-center">
            <h2 className="text-2xl font-bold mb-6">Raum beitreten</h2>
            <input 
              autoFocus
              type="tel"
              maxLength={6}
              placeholder="123456"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              className="w-full bg-black/30 border border-gray-600 rounded-lg p-4 text-center text-3xl font-mono tracking-widest mb-6 focus:border-accent focus:outline-none"
            />
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setIsJoining(false)}>Zurück</Button>
              <Button className="flex-1" onClick={joinGame}>Los</Button>
            </div>
         </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen p-6 radial-bg">
      <header className="flex justify-between items-center py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-700 overflow-hidden flex items-center justify-center border-2 border-accent">
            {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover"/> : <i className="fa-solid fa-user text-gray-400"></i>}
          </div>
          <div>
            <div className="font-bold leading-tight">{user.username}</div>
            <div className="text-xs text-accent font-bold">{user.spots} Spots</div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center gap-6 w-full max-w-md mx-auto">
        <Button className="w-full py-6 text-xl" onClick={createGame}>
          <i className="fa-solid fa-plus-circle"></i> Spiel erstellen
        </Button>
        <Button variant="secondary" className="w-full py-6 text-xl" onClick={() => setIsJoining(true)}>
          <i className="fa-solid fa-gamepad"></i> Beitreten
        </Button>
        <Button variant="secondary" className="w-full">
          <i className="fa-solid fa-shirt"></i> Shop
        </Button>
      </main>
    </div>
  );
};

const Lobby = ({ lobby, userId, ws }: { lobby: LobbyState, userId: string, ws: WebSocket | null }) => {
  const isHost = lobby.hostId === userId;
  
  return (
    <div className="flex flex-col items-center min-h-screen p-6 radial-bg">
      <div className="mt-12 mb-8 text-center">
        <div className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">Game PIN</div>
        <div className="text-7xl font-black text-white tracking-wider font-mono">{lobby.pin}</div>
      </div>

      <Card className="w-full max-w-2xl flex-1 mb-8">
        <div className="flex justify-between items-end mb-6 border-b border-gray-700 pb-4">
          <h2 className="text-xl font-bold">Lobby</h2>
          <span className="text-accent font-bold">{lobby.players.length} Spieler</span>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {lobby.players.map(player => (
            <div key={player.id} className="bg-black/40 p-3 rounded-lg flex items-center gap-3 animate-fade-in">
               <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                 <i className={`fa-solid fa-user ${player.id === lobby.hostId ? 'text-yellow-400' : 'text-gray-400'}`}></i>
               </div>
               <span className="font-bold truncate text-sm">{player.username}</span>
            </div>
          ))}
        </div>
      </Card>

      {isHost ? (
        <div className="w-full max-w-md sticky bottom-6">
           <Button className="w-full shadow-xl shadow-accent/20" onClick={() => ws?.send(JSON.stringify({ type: 'START_GAME' }))}>
             Starten
           </Button>
        </div>
      ) : (
        <div className="text-gray-400 animate-pulse pb-10">Warte auf Host...</div>
      )}
    </div>
  );
};

// --- APP ---

const App = () => {
  const [user, setUser] = useState<User | null>(null);
  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const ws = useRef<WebSocket | null>(null);

  // Initial Auth Check
  useEffect(() => {
    fetch('/api/profile').then(r => r.json()).then(data => {
      if(data.id) setUser(data);
    }).catch(() => {});
  }, []);

  // WebSocket Connection
  useEffect(() => {
    if(!user) return;
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}`);
    
    socket.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if(msg.type === 'LOBBY_UPDATE') setLobby(msg.payload);
      if(msg.type === 'ERROR') alert(msg.payload);
    };

    ws.current = socket;
    return () => socket.close();
  }, [user]);

  if (!user) return <AuthScreen onLogin={setUser} />;
  if (lobby) return <Lobby lobby={lobby} userId={user.id} ws={ws.current} />;
  
  return <Dashboard user={user} ws={ws.current} />;
};

export default App;