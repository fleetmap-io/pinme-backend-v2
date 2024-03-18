const axios = require('axios')
const bodyParser = require('body-parser')
const express = require('express')
const devices = require('./devices')
const drivers = require('./drivers')
const users = require('./users')
const reports = require('./reports')
const permissions = require('./permissions')
const cors = require('cors')
const compression = require('compression')
const CognitoExpress = require('fleetmap-cognito-express')
const companies = require('./companies')
const { getUserPartnerId } = require('./auth')
const crypto = require('crypto')
const auth = require('./cognito')
const { CognitoIdentityProviderClient, ListUsersCommand } = require('@aws-sdk/client-cognito-identity-provider')
const { getCommands, sendCommand } = require('./api/traccar')
const serverlessExpress = require('@vendia/serverless-express')

const app = express()
app.use(cors())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true })) // support encoded bodies
app.use(compression({ threshold: 0 }))
app.set('etag', false)

let cognitoExpress

const region = 'eu-west-3'
async function validate (accessTokenFromClient, req, res, next, retries = 3) {
  try {
    if (!cognitoExpress) {
      cognitoExpress = new CognitoExpress({
        region,
        cognitoUserPoolId: process.env.USER_POOL_ID,
        tokenUse: 'access' // Possible Values: access | id
      })
    }
    const response = await cognitoExpress.validate(accessTokenFromClient)
    if (!response['cognito:groups'] || !response['cognito:groups'].find(g => g === 'Backoffice')) {
      console.warn('not authorized for ', response.username)
      return res.status(401).send('Unauthorized')
    }

    const cognito = new CognitoIdentityProviderClient({ region })
    const listUsersResponse = await cognito.send(new ListUsersCommand({
      UserPoolId: process.env.USER_POOL_ID,
      Filter: `username = "${response.username}"`,
      Limit: 1
    }))

    res.locals.user = listUsersResponse.Users[0].Attributes.find(a => a.Name === 'email').Value
    res.locals.sub = listUsersResponse.Users[0].Attributes.find(a => a.Name === 'sub').Value
    res.locals.partners = listUsersResponse.Users[0].Attributes.find(a => a.Name === 'custom:partners')
    res.locals.userType = listUsersResponse.Users[0].Attributes.find(a => a.Name === 'custom:userType')
    next()
  } catch (e) {
    if (retries && String(e.message).startsWith('Unable to generate certificate due to')) {
      console.error(e.message, retries, 'trying again', req.headers['user-agent'], req.headers['x-forwarded-for'])
      cognitoExpress = null
      return validate(accessTokenFromClient, req, res, next, retries--)
    } else {
      await logTokenError(req, e.message)
      res.status(401).send(e.message === 'jwt expired' ? 'TokenExpiredError' : e.message)
    }
  }
}

function getCity (ip) {
  return axios.get(`https://ipinfo.io/${ip}?token=${process.env.IPINFO_TOKEN}`).then(d => d.data)
}

async function logTokenError (req, message = 'Access Token missing from header') {
  console.warn(message,
    req.headers['user-agent'], req.headers['x-forwarded-for'], await getCity(req.headers['x-forwarded-for'].split(',')[0]))
}

app.use(async (req, res, next) => {
  const accessTokenFromClient = req.headers.authorization
  if (!accessTokenFromClient) {
    await logTokenError(req)
    return res.status(401).send('Access Token missing from header')
  }
  await validate(accessTokenFromClient, req, res, next)
  console.log(res.locals, req.method, req.path, req.query, req.body)
})

app.get('/gpsmanager', async (req, res) => {
  await processRequest(devices.get, res, req.query, res.locals.user, res.locals.partners)
})

app.get('/', async (req, res) => {
  await processRequest(devices.get, res, req.query, res.locals.user, res.locals.partners)
})

app.get('/partnerId', async (req, res) => {
  await processRequest(getUserPartnerId, res, res.locals.user)
})

app.get('/devices/conf/:deviceId', async (req, res) => {
  await processRequest(devices.getConfById, res, req.params.deviceId, res.locals.user)
})

app.get('/devices/uniqueId/:uniqueId', async (req, res) => {
  await processRequest(devices.getByUniqueId, res, req.params.uniqueId, res.locals.user)
})

app.get('/devices/:id', async (req, res) => {
  await processRequest(devices.getById, res, req.params.id)
})

app.get('/canprotocols', async (req, res) => {
  console.log('Request CanProtocols')
  res.json(await devices.getCanProtocols())
})

app.post('/gpsmanager', async (req, res) => {
  await processRequest(devices.post, res, req.body, res.locals.user)
})

app.put('/devices', async (req, res) => {
  console.log(req.body)
  res.json(await devices.putDevice(req.body, res.locals.user))
})

app.delete('/devices/:deviceId', async (req, res) => {
  console.log(res.locals.user, 'deleting device', req.params.deviceId)
  try {
    res.json(await devices.delete(req.params.deviceId))
  } catch (e) {
    console.error(e.message, e.response && e.response.data)
    res.status(500).send(e.message)
  }
})

app.post('/devices/:deviceId', async (req, res) => {
  console.log(res.locals.user, 'post device', req.params.deviceId, req.body)
  res.json(await devices.postById(req.params.deviceId, res.locals.user, req.body))
})

app.post('/users', async (req, res) => {
  try {
    res.json(await users.post(req.body, res.locals.user))
  } catch (e) {
    console.error(e.message, e.response && e.response.data)
    res.status(500).send(e.message)
  }
})

app.post('/token', async (req, res) => {
  console.log(req.body)
  res.json(res.locals)
})

app.post('/users/create', async (req, res) => {
  try {
    res.json(await auth.createUser(req.body, res.locals.user))
  } catch (e) {
    console.error(e.message, e.response && e.response.data)
    res.status(500).send(e.message)
  }
})

app.get('/users', async (req, res) => {
  await processRequest(users.getDB, res, req.query, res.locals.user)
})

app.get('/user', async (req, res) => {
  res.json(await users.getUser(res.locals.user))
})

app.get('/companies', async (req, res) => {
  await processRequest(companies.get, res, res.locals.user)
})

app.put('/companies', async (req, res) => {
  console.log(req.body)
  res.json(await companies.put(req.body, res.locals.user))
})

app.post('/companies', async (req, res) => {
  console.log(req.body)
  res.json(await companies.post(req.body, res.locals.user))
})

app.delete('/companies/:companyId', async (req, res) => {
  res.json(await companies.delete(req.params.companyId, res.locals.user))
})

app.post('/permissions', async (req, res) => {
  console.log(req.body)
  try {
    const resp = await permissions.post(req.body)
    console.log('response', resp)
    res.json(resp)
  } catch (e) {
    console.error(e.message, e.response && e.response.data)
    res.status(500).send(e.message)
  }
})

app.get('/positions', async (req, res) => {
  console.log(req.body)
  try {
    res.json(await require('./positions').get(req.query))
  } catch (e) {
    console.error(res.locals.user, e.message, e.response && e.response.data)
    res.status(500).send(e.message)
  }
})

app.get('/permissions', async (req, res) => {
  console.log(req.body)
  res.json(await devices.getComputedAttributes(req.query.deviceid))
})

async function processRequest (method, res, ...args) {
  try {
    res.json(await method(...args))
  } catch (e) {
    logAndSendError(e, res)
  }
}

app.delete('/permissions', async (req, res) => {
  await processRequest(permissions.delete, res, req.body)
})

app.delete('/users/:userId', async (req, res) => {
  console.log(res.locals.user, 'deleting', req.params.userId)
  res.json(await users.delete(req.params.userId))
})

app.get('/reports', async (req, res) => {
  res.json(await reports.get())
})

app.get('/session', async (req, res) => {
  console.log('get session', req.query.email)
  res.json(await require('./auth').getUserSession(req.query.email, crypto.randomUUID()))
})

app.get('/attributes/computed', async (req, res) => {
  await processRequest(async () => {
    const [rows] = await require('./mysql').query('select * from traccar.tc_attributes order by description', process.env.DB_HOST_READER)
    console.log('returning', rows)
    return rows
  }, res)
})

app.get('/commands', async (req, res) => {
  await processRequest(async () => {
    const [rows] = await require('./mysql').query('select * from traccar.tc_commands order by description')
    console.log('returning', rows)
    console.log('returning', rows)
    return rows
  }, res)
})

app.get('/commands/:deviceId', async (req, res) => {
  res.json(await getCommands(req.params.deviceId))
})

app.post('/commands/:deviceId', async (req, res) => {
  res.json(await sendCommand(req.params.deviceId, req.body))
})

app.get('/logs/:query', async (req, res) => {
  res.json(await require('./cloudwatch/cloudwatch').get(req.params.query))
})

app.post('/logs/:device', async (req, res) => {
  res.json(await require('./cloudwatch/cloudwatch').post(req.params.device))
})

app.post('/logs/import/:device', async (req, res) => {
  res.json(await require('./cloudwatch/cloudwatch').post(req.params.device, '/aws/lambda/import-backend-ProcessVehicle-lnss6J9beBGo'))
})

app.post('/logs/commands/:device', async (req, res) => {
  res.json(await require('./cloudwatch/cloudwatch').post('"deviceId": ' + req.params.device, '/aws/lambda/pinme-backend-api-helper'))
})

app.get('/sms/:phoneNumber', async (req, res) => {
  console.log(res.locals.user, 'get sms', req.params.phoneNumber)
  res.json(await require('./sms').get(req.params.phoneNumber, res.locals.user))
})

app.get('/smsreceived/:phoneNumber', async (req, res) => {
  console.log(res.locals.user, 'get received sms', req.params.phoneNumber)
  res.json(await require('./sms').getReceived(req.params.phoneNumber, res.locals.user))
})

app.post('/cloudwatch/widget', async (req, res) => {
  res.json(await require('./cloudwatch/cloudwatch').getWidget(res.locals.user, req.body))
})

app.get('/partners', async (req, res) => {
  res.json(await require('users').getPartners(res.locals.partners && res.locals.partners.Value, res.locals.user))
})

app.post('/partners/:partnerId', async (req, res) => {
  res.json(await require('users').setPartnerId(res.locals.user, req.params.partnerId, res.locals.partners && res.locals.partners.Value))
})

function logAndSendError (err, res) {
  console.error(res.locals.user, err.message, (err.response && err.response.data) || err, (err.config && err.config.url) || err)
  res.status(500).send(err.message)
}

app.put('/drivers', async (req, res) => {
  console.log(req.body)
  try {
    res.json(await drivers.put(req.body, res.locals.user))
  } catch (e) {
    logAndSendError(e, res)
  }
})

app.delete('/drivers/:driverId', async (req, res) => {
  console.log(res.locals.user, 'deleting driver', req.params.driverId)
  res.json(await drivers.delete(req.params.driverId))
})

app.get('/drivers', async (req, res) => {
  try {
    res.json(await drivers.get(req.query, res.locals.user))
  } catch (e) {
    logAndSendError(e, res)
  }
})

app.post('/inofleet', async (req, res) => {
  await processRequest(require('inosat').post, res, req, res)
})

app.get('/tachocards', async (req, res) => {
  require('tacho').get(req, res)
})

app.post('/tachocards/:icc', async (req, res) => {
  require('tacho').post(req, res)
})

app.get('/subtel/:imei', async (req, res) => {
  res.json(await require('partners/subtel').checkImei(req.params.imei))
})

exports.main = serverlessExpress({ app })
