const CognitoExpress = require('cognito-express')
const traccar = require('./api/traccar')

exports.validate = async (req, res) => {
  await _validate(req, res)
}

async function _validate (req, res, retries = 10) {
  try {
    const cognitoExpress = new CognitoExpress({
      region: 'us-east-1',
      cognitoUserPoolId: 'us-east-1_SWTiH7d38',
      tokenUse: 'access', // Possible Values: access | id
      tokenExpiration: 3600000 // Up to default expiration of 1 hour (3600000 ms)
    })

    const accessTokenFromClient = req.headers.authorization
    if (!accessTokenFromClient) return res.status(401).send('Access Token missing from header')
    await cognitoExpress.validate(accessTokenFromClient.replace('Bearer ', ''), function (err, response) {
      if (err) return res.status(401).send(err)
      res.json(response)
    })
  } catch (e) {
    console.error(e)
    if (retries > 0) { await _validate(req, res, retries--) }
  }
}

exports.migrateUser = async (e, context) => {
  console.log(e)
  /* await traccar.createSession(e.userName, e.request.password).then(d => d.headers['set-cookie'])
  e.response.userAttributes = {
    username: e.userName,
    email: e.userName,
    email_verified: true
  }
  e.response.finalUserStatus = 'CONFIRMED'
  context.succeed(e) */
}
