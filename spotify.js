const axios = require('axios');
const querystring = require('querystring');
require('dotenv').config();

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://taubey.com:3000/callback';

module.exports = {
    getAuthUrl: (state) => {
        if (!CLIENT_ID) return '/?error=missing_config';
        const scope = 'user-read-private user-read-email streaming user-read-playback-state user-modify-playback-state';
        return 'https://accounts.spotify.com/authorize?' + querystring.stringify({
            response_type: 'code',
            client_id: CLIENT_ID,
            scope: scope,
            redirect_uri: REDIRECT_URI,
            state: state
        });
    },

    getToken: async (code) => {
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
    },

    getUserProfile: async (accessToken) => {
        const response = await axios.get('https://api.spotify.com/v1/me', {
            headers: { 'Authorization': 'Bearer ' + accessToken }
        });
        return response.data;
    }
};