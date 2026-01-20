export interface User {
  id: string;
  username: string;
  xp: number;
  spots: number;
  isGuest?: boolean;
}

export interface Player extends User {
  score: number;
  lives: number;
  isReady: boolean;
  isConnected: boolean;
  currentGuess?: any;
}

export interface GameSettings {
  songCount: number;
  guessTime: number;
  gameType: 'points' | 'lives';
  guessTypes: string[];
  deviceId?: string;
  playlistId?: string;
}

export interface LobbyState {
  pin: string | null;
  hostId: string | null;
  players: Player[];
  settings: GameSettings;
  gameMode: string;
  gameState: 'LOBBY' | 'STARTING' | 'PLAYING' | 'RESULTS' | 'FINISHED';
}

export interface ShopItem {
    id: number;
    type: 'title' | 'icon' | 'background' | 'color';
    name: string;
    cost: number;
    description: string;
    iconClass?: string;
    isOwned?: boolean;
}