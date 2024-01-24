const CognitoExpress = require('cognito-express')

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

exports.migrateUser = async (e) => {
  const AmazonCognitoIdentity = require('amazon-cognito-identity-js')

  const poolData = {
    UserPoolId: 'us-east-1_SWTiH7d38',
    ClientId: '16seahimlsre6ocin0uvivtet2'
  }

  const Pool = new AmazonCognitoIdentity.CognitoUserPool(poolData)

  const Username = e.userName
  const Password = e.request.password
  const authenticationData = { Username, Password }
  const authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails(authenticationData)
  const userData = { Username, Pool }

  const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData)
  console.log(await new Promise((resolve, reject) => {
    cognitoUser.authenticateUser(authenticationDetails, {
      onSuccess: () => {
        console.log('auth ok cognito', e.userName)
        resolve('Authentication successful')
      },
      onFailure: (err) => {
        console.log('failure, lets try traccar', err)
        const body = 'email=' + encodeURIComponent(Username) + '&password=' + encodeURIComponent(Password)
        console.log(body)
        require('axios').post('https://api2.pinme.io/api/session', body, {
          headers: {
            'user-agent': 'pinme-backend',
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }).then(r => resolve(r.data)).catch(e => reject(e))
      },
      newPasswordRequired: () => {
        console.log('new password required', e.userName)
        resolve('New password required')
      }
    })
  }))

  e.response.userAttributes = {
    username: Username,
    email: Username,
    email_verified: true
  }
  e.response.finalUserStatus = 'CONFIRMED'
  e.response.messageAction = 'SUPPRESS'
  console.log('returning', e)
  return e
}
