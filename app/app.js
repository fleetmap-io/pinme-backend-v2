const CognitoExpress = require('cognito-express')
const { getOneSignalTokens } = require('fleetmap-partners')
const { logException } = require('./utils')
const { CognitoIdentityProviderClient, ListUsersCommand } = require('@aws-sdk/client-cognito-identity-provider')
const crypto = require('crypto')

exports.mainFunction = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return okResponse('', event)
  }
  if (event.queryStringParameters.jsessionid && event.queryStringParameters.jsessionid) {
    return okResponse('', event, `JSESSIONID=${event.queryStringParameters.jsessionid}; SameSite=None; Secure; Path=/`)
  }
  if (event.queryStringParameters && event.queryStringParameters.emailAuthHash) {
    const email = event.queryStringParameters.emailAuthHash
    const hmac = crypto.createHmac('sha256', getOneSignalTokens(event.headers.host).token)
    hmac.update(email)
    return okResponse(hmac.digest('hex'), event)
  }
  if (!event.headers.Authorization) {
    await logException(new Error('Access Token missing from header'), event)
    return { statusCode: 401, body: 'Access Token missing from header' }
  }
  const region = 'eu-west-3'
  let email
  try {
    const response = await new CognitoExpress({
      region,
      cognitoUserPoolId: process.env.USER_POOL_ID,
      tokenUse: 'access'
    }).validate(event.headers.Authorization)
    console.log('token auth_time', new Date(response.auth_time * 1000))
    const cognito = new CognitoIdentityProviderClient({ region })
    const listUsersResponse = await cognito.send(new ListUsersCommand({
      UserPoolId: process.env.USER_POOL_ID,
      Filter: `sub = "${response.sub}"`,
      Limit: 1
    }))
    email = listUsersResponse.Users[0].Attributes.find(a => a.Name === 'email')
    const [cookies] = await (await require('./auth')).getUserSession(email.Value, crypto.randomUUID())
    return okResponse('', event, cookies)
  } catch (e) {
    await logException(e, undefined, 'auth.getUserSession', email || process.env.USER_POOL_ID)
    return { statusCode: 500, body: e.message }
  }
}

function okResponse (result, event, cookie) {
  const r = {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': 'https://gpsmanager.io',
      'Access-Control-Allow-Headers': 'content-type, authorization',
      'Access-Control-Allow-Credentials': 'true',
      ...(cookie ? { 'Set-Cookie': cookie } : {})
    },
    body: JSON.stringify(result)
  }
  console.log(event, r)
  return r
}
