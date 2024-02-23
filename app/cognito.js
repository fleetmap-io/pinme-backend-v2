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

const mysql = require('./mysql')
const traccar = require('./traccar')

exports.migrateUser = async (e, context) => {
  console.log(e)
  await traccar.sessions.create(e.userName, e.request.password)
  e.response.userAttributes = {
    username: e.userName,
    email: e.userName,
    email_verified: true
  }
  e.response.finalUserStatus = 'CONFIRMED'
  context.succeed(e)
}

exports.createUser = async (item, adminUser) => {
  const [result] = await mysql.query(`select attributes->'$.clientId' clientId, partnerId from traccar.tc_users  where email = '${adminUser}'`)
  item.email = item.email.trim()
  console.log('clientId', result[0].clientId)
  const tempPassword = '0' + crypto.randomBytes(4).toString('hex').toUpperCase() + crypto.randomBytes(4).toString('hex').toLowerCase()
  await createUser(tempPassword, result[0].clientId, item.email)
  const newUser = {
    administrator: false,
    coordinateFormat: '',
    deviceLimit: -1,
    deviceReadonly: false,
    disabled: false,
    expirationTime: null,
    id: -1,
    latitude: 0,
    limitCommands: false,
    login: '',
    longitude: 0,
    map: '',
    phone: '',
    poiLayer: '',
    readonly: false,
    token: null,
    twelveHourFormat: false,
    userLimit: -1,
    zoom: 0,
    password: tempPassword,
    name: item.email,
    email: item.email,
    attributes: {
      clientId: result[0].clientId,
      dashboard: false
    }
  }
  console.log(newUser)
  try {
    const newTraccarUser = await traccar.createUser(newUser)
    console.log(await mysql.query(`update traccar.tc_users set partnerid=${result[0].partnerId} where id=${newTraccarUser.data.id}`))
  } catch (e) {
    console.error(e.message, e.response && e.response.data)
    const log = `update traccar.tc_users set partnerid=${result[0].partnerId} where email='${item.email}' and (partnerid=0 or partnerid=12)`
    console.log(log, await mysql.query(log))
    const [[_user]] = await mysql.query(`select id from traccar.tc_users  where email='${item.email}' and partnerid=${result[0].partnerId}`)
    const user = await traccar.users.get(_user.id).then(d => d.data)
    user.attributes.clientId = result[0].clientId
    await traccar.updateUser(user)
  }
  return { tempPassword }
}
