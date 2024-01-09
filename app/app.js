const CognitoExpress = require('cognito-express')
const { getOneSignalTokens } = require('fleetmap-partners')
const { getUserPool } = require('fleetmap-partners')
const { logException, logError} = require('./utils')

exports.mainFunction = async (event) => {
    if (event.queryStringParameters && event.queryStringParameters.emailAuthHash) {
        const email = event.queryStringParameters.emailAuthHash
        const crypto = require('crypto')
        const hmac = crypto.createHmac('sha256', getOneSignalTokens(event.headers.host).token)
        hmac.update(email)
        return okResponse(hmac.digest('hex'), event, [])
    }
    if (!event.headers.authorization) {
        await logError(new Error('Access Token missing from header'), event)
        return { statusCode: 401, body: 'Access Token missing from header' }
    }
    const origin = event.headers.origin || 'https://' + event.headers['x-forwarded-host']
    let userPool, response
    try {
        userPool = getUserPool(origin)
        const cognitoExpress = new CognitoExpress({
            region: 'us-east-1',
            cognitoUserPoolId: userPool,
            tokenUse: 'access' // Possible Values: access | id
        })
        response = await cognitoExpress.validate(event.headers.authorization)
    } catch (e) {
        console.warn(e.message, 'try again')
        userPool = 'us-east-1_olpbc774t'
        const cognitoExpress = new CognitoExpress({
            region: 'us-east-1',
            cognitoUserPoolId: userPool,
            tokenUse: 'access' // Possible Values: access | id
        })
        response = await cognitoExpress.validate(event.headers.authorization)
    }

    console.log('token auth_time', new Date(response.auth_time * 1000))
    const listUsersResponse = await cognito.listUsers({
        UserPoolId: userPool,
        Filter: `sub = "${response.sub}"`,
        Limit: 1
    }).promise()
    let email = listUsersResponse.Users[0].Attributes.find(a => a.Name === 'email')
    if (!email) {
        email = listUsersResponse.Users[0].Attributes.find(a => a.Name === 'phone_number')
    }
    try {
        const cookies = (await require('./auth')).getUserSession(email.Value)
        return okResponse('', event, cookies)
    } catch (e) {
        logException(e, 'auth.getUserSession', email)
        return { statusCode: 500, body: e.message }
    }
}

function okResponse (result, event, cookies) {
    return {
        statusCode: 200,
        headers: {
            'Access-Control-Allow-Origin': event.headers.origin,
            'Access-Control-Allow-Headers': 'content-type, authorization',
            'Access-Control-Allow-Credentials': 'true',
            'Set-Cookie': cookies
        },
        body: JSON.stringify(result)
    }
}

