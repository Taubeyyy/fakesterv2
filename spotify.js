const axios = require('axios');
const querystring = require('querystring');
require('dotenv').config();

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
// Fallback auf taubey.com:3000, wenn nichts in ENV steht
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://taubey.com:3000/callback';

if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error("❌ FEHLER: SPOTIFY_CLIENT_ID oder SPOTIFY_CLIENT_SECRET fehlt in der .env Datei!");
}

module.exports = {
    /**
     * Generiert die URL für den Spotify Login
     */
    getAuthUrl: (state) => {
        const scope = 'user-read-private user-read-email playlist-read-private streaming user-modify-playback-state user-read-playback-state';
        return 'https://accounts.spotify.com/authorize?' + querystring.stringify({
            response_type: 'code',
            client_id: CLIENT_ID,
            scope: scope,
            redirect_uri: REDIRECT_URI,
            state: state
        });
    },

    /**
     * Tauscht den Authorization Code gegen Access & Refresh Token
     */
    getToken: async (code) => {
        try {
            const response = await axios.post('https://accounts.spotify.com/api/token', 
                querystring.stringify({
                    code: code,
                    redirect_uri: REDIRECT_URI,
                    grant_type: 'authorization_code'
                }), {
                headers: {
                    'Authorization': 'Basic ' + (Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64')),
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });
            return response.data;
        } catch (error) {
            console.error("Spotify Token Error:", error.response ? error.response.data : error.message);
            throw new Error("Fehler beim Abrufen des Spotify Tokens");
        }
    },

    /**
     * Ruft das Benutzerprofil von Spotify ab
     */
    getUserProfile: async (accessToken) => {
        try {
            const response = await axios.get('https://api.spotify.com/v1/me', {
                headers: { 'Authorization': 'Bearer ' + accessToken }
            });
            return response.data;
        } catch (error) {
            console.error("Spotify Profile Error:", error.response ? error.response.data : error.message);
            throw new Error("Fehler beim Abrufen des Profils");
        }
    }
};