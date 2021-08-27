const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const SpotifyWebApi = require('spotify-web-api-node');

require('dotenv').config();

function toQuery(params, delimiter = '&') {
  const keys = Object.keys(params);
  return keys.reduce((result, key, index) => {
    let query = `${result}${key}=${params[key]}`;
    if (index < keys.length - 1) {
      query += delimiter;
    }
    return query;
  }, '');
}

const stateKey = 'spotify_auth_state';

const { CLIENT_ID, CLIENT_SECRET } = process.env;

const spotifyApi = new SpotifyWebApi({
  clientId: CLIENT_ID,
  clientSecret: CLIENT_SECRET,
  redirectUri: 'http://localhost:5500/callback/',
});

const app = express();

app.use(express.static(__dirname + '/public'));
app.use(cors());
app.use(cookieParser());

const port = 5500;

app.get('/login', (_, res) => {
  const scopes = ['user-follow-read', 'user-read-email'];
  const state = crypto
    .createHash('sha1')
    .update(new Date().valueOf().toString() + Math.random().toString())
    .digest('hex');
  const authorizeUrl = spotifyApi.createAuthorizeURL(scopes, state, true);

  res.cookie(stateKey, state);
  res.redirect(authorizeUrl);
});

app.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;
  const storedState = req.cookies ? req.cookies[stateKey] : null;

  if (!(state && state === storedState)) {
    let queryParams = {
      error: 'state_mismatch',
    };
    return res.redirect(`/#${toQuery(queryParams)}`);
  }

  res.clearCookie(stateKey);

  if (error) {
    return res.redirect('/');
  }

  try {
    const data = await spotifyApi.authorizationCodeGrant(code);
    const { access_token, refresh_token, expires_in } = data.body;

    spotifyApi.setAccessToken(access_token);
    spotifyApi.setRefreshToken(refresh_token);

    let queryParams = {
      access_token,
      refresh_token,
      expires_in,
    };
    res.redirect(`/#${toQuery(queryParams)}`);
  } catch (error) {
    // logout()?
    res.redirect('/');
  }
});

app.get('/refresh_token', async (_, res) => {
  try {
    const data = await spotifyApi.refreshAccessToken();
    const { access_token } = data.body;
    spotifyApi.setAccessToken(access_token);
    res.send({ access_token });
  } catch (error) {
    // logout()?
    res.redirect('/');
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}.`);
});
