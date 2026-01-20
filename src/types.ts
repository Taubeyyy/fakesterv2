export interface User {
    id: string;
    username: string;
    email?: string;
    avatar?: string;
    xp: number;
    spots: number;
    isGuest: boolean;
}

export interface Player extends User {
    score: number;
    connected: boolean;
}

export interface LobbyState {
    pin: string;
    hostId: string;
    players: Player[];
    gameState: 'LOBBY' | 'STARTING' | 'PLAYING' | 'FINISHED';
}