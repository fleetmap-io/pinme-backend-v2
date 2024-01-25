const CognitoExpress = require('cognito-express')
const { getOneSignalTokens } = require('fleetmap-partners')
const { logException } = require('./utils')
const { CognitoIdentityProviderClient, ListUsersCommand } = require('@aws-sdk/client-cognito-identity-provider')
exports.mainFunction = async (event) => {
  if (event.queryStringParameters && event.queryStringParameters.emailAuthHash) {
    const email = event.queryStringParameters.emailAuthHash
    const crypto = require('crypto')
    const hmac = crypto.createHmac('sha256', getOneSignalTokens(event.headers.host).token)
    hmac.update(email)
    return okResponse(hmac.digest('hex'), event)
  }

  if (!event.headers.Authorization) {
    await logException(new Error('Access Token missing from header'), event)
    return { statusCode: 401, body: 'Access Token missing from header' }
  }

  const response = await new CognitoExpress({
    region: 'sa-east-1',
    cognitoUserPoolId: 'sa-east-1_b7SDvkW1U',
    tokenUse: 'access' // Possible Values: access | id
  }).validate(event.headers.Authorization)

  console.log('token auth_time', new Date(response.auth_time * 1000))
  const cognito = new CognitoIdentityProviderClient({ region: 'sa-east-1' })
  const listUsersResponse = await cognito.send(new ListUsersCommand({
    UserPoolId: 'sa-east-1_b7SDvkW1U',
    Filter: `sub = "${response.sub}"`,
    Limit: 1
  }))
  const email = listUsersResponse.Users[0].Attributes.find(a => a.Name === 'email') ||
         listUsersResponse.Users[0].Attributes.find(a => a.Name === 'phone_number')
  try {
    const [cookies] = await (await require('./auth')).getUserSession(email.Value)
    return okResponse('', event, cookies)
  } catch (e) {
    await logException(e, undefined, 'auth.getUserSession', email)
    return { statusCode: 500, body: e.message }
  }
}

function okResponse (result, event, cookie) {
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': event.headers.origin || '*',
      'Access-Control-Allow-Headers': 'content-type, authorization',
      'Access-Control-Allow-Credentials': 'true',
      ...(cookie ? { 'Set-Cookie': cookie } : {})
    },
    body: JSON.stringify(result)
  }
}
