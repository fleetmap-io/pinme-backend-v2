const CognitoExpress = require('cognito-express')
const { getOneSignalTokens } = require('fleetmap-partners')
const { logException } = require('./utils')
const { CognitoIdentityProviderClient, ListUsersCommand, AdminUpdateUserAttributesCommand } = require('@aws-sdk/client-cognito-identity-provider')
const crypto = require('crypto')
const axios = require('axios')

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
    try {
      let skip = false
      const xforwarded = event.headers && event.headers['X-Forwarded-For']
      if (xforwarded) {
        try {
          const skipCountries = ['PT', 'MA']
          const { country } = await axios.get(`https://ipinfo.io/${xforwarded.split(',')[0]}?token=${process.env.IPINFO_TOKEN}`, { timeout: 1000 }).then(d => d.data)
          if (skipCountries.indexOf(country) !== -1) {
            skip = true
            console.log(xforwarded, 'skipping for', country, email)
          } else {
            console.log('moving on for', country, email, xforwarded)
          }
        } catch (e) { console.error(e) }
      }
      if (!skip && !listUsersResponse.Users[0].Attributes.find(a => a.Name === 'custom:SERVER_HOST')) {
        console.log('setting custom attributes', email)
        await cognito.send(new AdminUpdateUserAttributesCommand({
          UserPoolId: process.env.USER_POOL_ID,
          Username: listUsersResponse.Users[0].Username,
          UserAttributes: [ // AttributeListType // required
            { // AttributeType
              Name: 'custom:SERVER_HOST', // required
              Value: 'api2.pinme.io'
            },
            { // AttributeType
              Name: 'custom:WEB_SOCKET_HOST', // required
              Value: 'traccar-eu.fleetmap.pt'
            }
          ]
        }))
      } else {
        console.log(email, 'already has custom attributes')
      }
    } catch (e) {
      console.error(e)
    }
    const [cookies] = await (await require('./auth')).getUserSession(email.Value, crypto.randomUUID())
    return okResponse('', event, cookies)
  } catch (e) {
    await logException(e, undefined, 'mainFunction', email || process.env.USER_POOL_ID)
    return { statusCode: 500, body: e.message }
  }
}

function okResponse (result, event, cookie) {
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': event.headers.origin,
      'Access-Control-Allow-Headers': 'authorization,content-type',
      'Access-Control-Allow-Credentials': 'true',
      ...(cookie ? { 'Set-Cookie': cookie } : {})
    },
    body: JSON.stringify(result)
  }
}
