const Spotify = require('spotify-web-api-node');

const spotifyApi = new Spotify({
  clientId: '...',
  clientSecret: '...',
});

spotifyApi
  .clientCredentialsGrant()
  .then(({ body }) => {
    spotifyApi.setAccessToken(body.access_token);
    return spotifyApi.getUser('kshmr');
  })
  .then(({ body }) => {
    console.log(body);
  })
  .catch(err => {
    console.error('error getting user info', err);
  });
