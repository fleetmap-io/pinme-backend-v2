const CognitoExpress = require('cognito-express')
const crypto = require('crypto')
const { CognitoIdentityProviderClient, ListUsersCommand, AdminCreateUserCommand, AdminSetUserPasswordCommand } = require('@aws-sdk/client-cognito-identity-provider')
const { updateUser } = require('./api/traccar')

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
const client = new CognitoIdentityProviderClient({ region: 'eu-west-3' })

exports.changeUserPass = async (email, clientId, Password, traccarUser) => {
  try {
    const randomPassword = crypto.randomBytes(2).toString('hex').toUpperCase() + crypto.randomBytes(2).toString('hex').toLowerCase()
    traccarUser.password = Password || randomPassword
    await updateUser(traccarUser)

    const response = await client.send(new ListUsersCommand({
      UserPoolId: process.env.USER_POOL_ID,
      Filter: `email = "${email}"`,
      Limit: 1
    }))
    if (!response.Users.length) {
      console.log(`${email} not found on cognito`)
      await createUser(Password, clientId, email)
      return { Password }
    }
    let Username = response.Users[0].Username
    if (Username.startsWith('google_')) {
      if (!response.Users[1]) {
        return { Password: 'Usuário Google!' }
      } else {
        Username = response.Users[1].Username
      }
    }
    const params = {
      Password: Password || randomPassword,
      UserPoolId: process.env.USER_POOL_ID,
      Username,
      Permanent: true
    }
    console.log('AdminSetUserPasswordCommand', response.Users[0], params, await client.send(new AdminSetUserPasswordCommand(params)))
    return { Password: Password || randomPassword }
  } catch (e) {
    console.log(e)
    return { Password: e.message || e }
  }
}

async function createUser (tempPassword, clientId, Username) {
  try {
    const params = {
      TemporaryPassword: tempPassword,
      UserPoolId: process.env.USER_POOL_ID,
      Username,
      ClientMetadata: {
        clientId
      }
    }
    await client.send(new AdminCreateUserCommand(params))
  } catch (e) {
    console.error('AdminCreateUserCommand', e.message)
  }
}
