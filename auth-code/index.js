const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const request = require('request');

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

const { CLIENT_ID, CLIENT_SECRET, REDIRECT_URI, SCOPE } = process.env;
const authorize_url = 'https://accounts.spotify.com/authorize';
const token_url = 'https://accounts.spotify.com/api/token';

const app = express();

app.use(express.static(__dirname + '/public'));
app.use(cors());
app.use(cookieParser());

const port = 5500;

app.get('/login', (req, res) => {
  const state = crypto
    .createHash('sha1')
    .update(new Date().valueOf().toString() + Math.random().toString())
    .digest('hex');

  const queryParams = {
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: encodeURIComponent(REDIRECT_URI),
    state,
    scope: encodeURIComponent(SCOPE),
    show_dialog: 'true',
  };

  const loginUrl = `${authorize_url}?${toQuery(queryParams)}`;

  res.cookie(stateKey, state);
  res.redirect(loginUrl);
});

app.get('/callback', (req, res) => {
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

  const authOptions = {
    url: token_url,
    form: {
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
    },
    headers: {
      Authorization:
        'Basic ' +
        Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'),
    },
    json: true,
  };

  request.post(authOptions, (err, response, body) => {
    if (!err && response.statusCode === 200) {
      const { access_token, refresh_token, expires_in } = body;
      let queryParams = {
        access_token,
        refresh_token,
        expires_in,
      };
      res.redirect(`/#${toQuery(queryParams)}`);
    } else {
      // logout()?
      res.redirect('/');
    }
  });
});

app.get('/refresh_token', (req, res) => {
  const { refresh_token } = req.query;
  const authOptions = {
    url: token_url,
    headers: {
      Authorization:
        'Basic ' +
        Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'),
    },
    form: {
      grant_type: 'refresh_token',
      refresh_token,
    },
    json: true,
  };

  request.post(authOptions, (err, response, body) => {
    if (!err && response.statusCode === 200) {
      const { access_token } = body;
      res.send({ access_token });
    } else {
      // logout()?
      res.redirect('/');
    }
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}.`);
});
