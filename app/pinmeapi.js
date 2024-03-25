const {
  SessionApi, PositionsApi, DevicesApi, PermissionsApi, AttributesApi, UsersApi, DriversApi, ReportsApi,
  GroupsApi,
  GeofencesApi
} = require('traccar-api')
const cors = require('cors')
const bodyParser = require('body-parser')
const express = require('express')
const secrets = require('./secrets')
const uniqueId = require('./uniqueId')
const { validate } = require('./cognito')
const whatsapp = require('./whatsapp')
const { put } = require('./s3')
const schedulerTable = 'scheduler-1'
const multer = require('multer')
const { sendSms } = require('./sms')
const { sendReport } = require('./scheduler')
const { deleteGeofences } = require('./geofences')
const { apiConfig } = require('./api/traccar')
const storage = multer.memoryStorage()
const upload = multer({ storage })

const app = express()
const serverlessExpress = require('@vendia/serverless-express')
const { batchGet } = require('./dynamo')
const {
  logException,
  processRequest
} = require('./utils')

// noinspection JSCheckFunctionSignatures
app.use(cors({ origin: true, credentials: true, methods: 'GET,PUT,POST,DELETE,OPTIONS' }))
app.use(bodyParser.json({ limit: '50mb' }))
app.use(bodyParser.urlencoded({ extended: true }))

app.use((req, res, next) => {
  console.log(req.method, req.path, req.query, req.params, req.body)
  next()
})

app.get('/scheduler/send/:id', async (req, res) => {
  await sendReport(req)
  res.status(200).end()
})

app.get('/scheduler', async (req, res) => {
  const dynamodb = require('aws-sdk/clients/dynamodb')
  const docClient = new dynamodb.DocumentClient()
  const user = await new SessionApi(apiConfig).sessionGet(null, { headers: { cookie: req.header('cookie') } }).then(d => d.data)
  const params = {
    TableName: schedulerTable,
    FilterExpression: 'userId = :userId',
    ExpressionAttributeValues: {
      ':userId': user.id
    }
  }
  const data = await docClient.scan(params).promise()
  const items = data.Items
  res.json(items)
})

app.put('/scheduler', async (req, res) => {
  const dynamodb = require('aws-sdk/clients/dynamodb')
  const docClient = new dynamodb.DocumentClient()
  const user = await new SessionApi(apiConfig).sessionGet(null, { headers: { cookie: req.header('cookie') } }).then(d => d.data)

  const body = req.body
  console.log('Add:', body)
  const id = body.id
  const name = body.name
  const reportType = body.reportType
  const periodicity = body.periodicity
  const devices = body.devices
  const drivers = body.drivers
  const byDriver = body.byDriver
  const groups = body.groups
  const users = body.users
  const otherEmails = body.otherEmails
  const geofences = body.geofences ? body.geofences : []
  const eventTypes = body.eventTypes ? body.eventTypes : []
  const nextExecution = body.nextExecution
  const minimumIdleMinutes = body.minimumIdleMinutes
  const maxSpeedThreshold = body.maxSpeedThreshold
  const useVehicleSpeedLimit = body.useVehicleSpeedLimit
  const roadSpeedLimits = body.roadSpeedLimits
  const customSpeed = body.customSpeed
  const groupByDay = body.groupByDay
  const allWeek = body.allWeek ? body.allWeek : false
  const dayHours = body.dayHours
  const weekDays = body.weekDays
  const onlyWithActivity = body.onlyWithActivity
  const onlyWithStop = body.onlyWithStop

  const params = {
    TableName: schedulerTable,
    Item: {
      id,
      userId: user.id,
      name,
      reportType,
      periodicity,
      devices,
      drivers,
      byDriver,
      groups,
      users,
      otherEmails,
      creationDate: new Date(Date.now()).toISOString(),
      nextExecution,
      geofences,
      eventTypes,
      allWeek,
      dayHours,
      weekDays,
      minimumIdleMinutes,
      maxSpeedThreshold,
      useVehicleSpeedLimit,
      roadSpeedLimits,
      customSpeed,
      groupByDay,
      onlyWithActivity,
      onlyWithStop
    }
  }
  res.json(await docClient.put(params).promise())
})

app.delete('/scheduler/:id', async (req, res) => {
  const dynamodb = require('aws-sdk/clients/dynamodb')
  const docClient = new dynamodb.DocumentClient()
  const user = await new SessionApi(apiConfig).sessionGet(null, { headers: { cookie: req.header('cookie') } }).then(d => d.data)
  const id = req.params.id
  console.log('Delete:', id)

  const params = {
    TableName: schedulerTable,
    Key: {
      id
    },
    ConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {
      ':userId': user.id
    }
  }

  res.json(await docClient.delete(params).promise())
})

app.post('/scheduler/:id', async (req, res) => {
  const dynamodb = require('aws-sdk/clients/dynamodb')
  const docClient = new dynamodb.DocumentClient()
  const user = await new SessionApi(apiConfig).sessionGet(null, { headers: { cookie: req.header('cookie') } }).then(d => d.data)
  const body = req.body
  const id = req.params.id

  const name = body.name
  const reportType = body.reportType
  const periodicity = body.periodicity
  const devices = body.devices ? body.devices : []
  const drivers = body.drivers ? body.drivers : []
  const byDriver = body.byDriver ? body.byDriver : false
  const groups = body.groups ? body.groups : []
  const users = body.users ? body.users : []
  const geofences = body.geofences ? body.geofences : []
  const eventTypes = body.eventTypes ? body.eventTypes : []
  const otherEmails = body.otherEmails ? body.otherEmails : ''
  const nextExecution = body.nextExecution
  const allWeek = body.allWeek ? body.allWeek : false
  const dayHours = body.dayHours ? body.dayHours : { startTime: '00:00', endTime: '23:59' }
  const weekDays = body.weekDays ? body.weekDays : { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: true, sunday: true }
  const minimumIdleMinutes = body.minimumIdleMinutes ? body.minimumIdleMinutes : 0
  const maxSpeedThreshold = body.maxSpeedThreshold ? body.maxSpeedThreshold : 0
  const useVehicleSpeedLimit = body.useVehicleSpeedLimit ? body.useVehicleSpeedLimit : false
  const roadSpeedLimits = body.roadSpeedLimits ? body.roadSpeedLimits : false
  const customSpeed = body.customSpeed ? body.customSpeed : false
  const groupByDay = body.groupByDay ? body.groupByDay : false
  const onlyWithActivity = body.onlyWithActivity ? body.onlyWithActivity : false
  const onlyWithStop = body.onlyWithStop ? body.onlyWithStop : false

  console.log('Update:', id, body)

  const params = {
    TableName: schedulerTable,
    Key: {
      id
    },
    UpdateExpression: 'set #name = :name, reportType = :reportType, periodicity = :periodicity, ' +
            'devices = :devices, drivers = :drivers, groups = :groups, #users = :users, otherEmails = :otherEmails, ' +
            'byDriver = :byDriver, geofences = :geofences, nextExecution = :nextExecution, eventTypes = :eventTypes, ' +
            'allWeek = :allWeek, dayHours = :dayHours, weekDays = :weekDays, minimumIdleMinutes = :minimumIdleMinutes, ' +
            'groupByDay = :groupByDay, maxSpeedThreshold = :maxSpeedThreshold, useVehicleSpeedLimit = :useVehicleSpeedLimit, ' +
            'roadSpeedLimits = :roadSpeedLimits, customSpeed = :customSpeed, onlyWithActivity = :onlyWithActivity, ' +
            'onlyWithStop = :onlyWithStop',
    ConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {
      ':userId': user.id,
      ':name': name,
      ':reportType': reportType,
      ':periodicity': periodicity,
      ':devices': devices,
      ':drivers': drivers,
      ':byDriver': byDriver,
      ':groups': groups,
      ':users': users,
      ':otherEmails': otherEmails,
      ':geofences': geofences,
      ':nextExecution': nextExecution,
      ':eventTypes': eventTypes,
      ':allWeek': allWeek,
      ':dayHours': dayHours,
      ':weekDays': weekDays,
      ':minimumIdleMinutes': minimumIdleMinutes,
      ':maxSpeedThreshold': maxSpeedThreshold,
      ':useVehicleSpeedLimit': useVehicleSpeedLimit,
      ':roadSpeedLimits': roadSpeedLimits,
      ':customSpeed': customSpeed,
      ':groupByDay': groupByDay,
      ':onlyWithActivity': onlyWithActivity,
      ':onlyWithStop': onlyWithStop
    },
    ExpressionAttributeNames: {
      '#name': 'name',
      '#users': 'users'
    }
  }

  try {
    res.json(await docClient.update(params).promise())
  } catch (e) {
    logAndReply(e, res, req)
  }
})

app.post('/scheduler/executed/:id', async (req, res) => {
  const dynamodb = require('aws-sdk/clients/dynamodb')
  const docClient = new dynamodb.DocumentClient()
  const user = await new SessionApi(apiConfig).sessionGet(null, { headers: { cookie: req.header('cookie') } }).then(d => d.data)
  const id = req.params.id

  const params = {
    TableName: schedulerTable,
    Key: {
      id
    },
    UpdateExpression: 'set lastExecutionDate = :lastExecutionDate',
    ConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {
      ':userId': user.id,
      ':lastExecutionDate': new Date(Date.now()).toLocaleString(user.attributes.lang, {
        timeZone: user.attributes.timezone,
        hour12: false
      })
    }
  }

  res.json(await docClient.update(params).promise())
})

app.get('/pinmeapi/:deviceId', async (req, res) => {
  const dynamodb = require('aws-sdk/clients/dynamodb')
  const docClient = new dynamodb.DocumentClient()
  const user = await new SessionApi(apiConfig).sessionGet(null, { headers: { cookie: req.header('cookie') } }).then(d => d.data)

  console.log(req.path, user)

  const id = parseInt(req.params.deviceId)
  await new DevicesApi(apiConfig).devicesGet(false, undefined, id, undefined, { headers: { cookie: req.header('cookie') } })

  const params = {
    TableName: process.env.DEVICE_IGNITION_OFF_TABLE,
    FilterExpression: 'deviceId = :deviceId',
    ExpressionAttributeValues: {
      ':deviceId': id
    }
  }

  const data = await docClient.scan(params).promise()
  const items = data.Items

  res.json(items)
})

app.get('/pinmeapi/devices/ignitionOff', async (req, res) => {
  try {
    await new SessionApi(apiConfig).sessionGet(null, { headers: { cookie: req.header('cookie') } }).then(d => d.data)
  } catch (e) {
    console.error(req.path, req.method, req.header('cookie'), e.message, e.response && e.response.data)
    return res.status(500).end()
  }

  const positions = await new PositionsApi(apiConfig).positionsGet(undefined, undefined, undefined, undefined, { headers: { cookie: req.header('cookie') } }).then(d => d.data)

  const keys = positions.filter(p => !p.attributes.ignition).map(p => {
    return { deviceId: parseInt(p.deviceId) }
  })

  if (keys.length > 0) {
    res.json(await batchGet(process.env.DEVICE_IGNITION_OFF_TABLE, keys))
  } else {
    res.json([])
  }
})

async function putDeviceAccumulators (req, res) {
  const user = await new SessionApi(apiConfig).sessionGet(null, { headers: { cookie: req.header('cookie') } }).then(d => d.data)
  if (user.readonly || user.deviceReadonly) {
    res.status(500).send('Manager access required')
    return
  }
  const id = parseInt(req.params.deviceId)
  const [device] = await new DevicesApi(apiConfig).devicesGet(false, undefined, id, undefined, { headers: { cookie: req.header('cookie') } }).then(d => d.data)
  const auth = await secrets.getSecret('traccar')
  res.json(await new DevicesApi(apiConfig).devicesIdAccumulatorsPut(req.body, device.id, { auth })
    .then(d => d.data)
    .catch(e => console.error('putDeviceAccumulators', e.message, req.params.deviceId))
  )
}

app.put('/pinmeapi/devices/:deviceId/accumulators', async (req, res) => {
  try { await putDeviceAccumulators(req, res) } catch (e) {
    console.error('putDeviceAccumulators, deviceId', req.params.deviceId, req.body, e.message)
  }
})

app.get('/pinmeapi/streetview/:image', async (req, res) => {
  switch (req.params.image) {
    case 'image':
      res.redirect(await require('./streetview').get(req.query))
      break
    case 'imageUrl':
      res.redirect(await require('./streetview').imageUrl(req.query))
      break
    default:
      res.status(500).end()
  }
})

app.post('/pinmeapi/driver/tempPassword', async (req, res) => {
  console.log(req.path, req.body)
  const driver = require('./driver')
  const TemporaryPassword = await driver.createTempPassword(req.body)
  res.json({ TemporaryPassword })
})

app.post('/pinmeapi/driver/setCognitoPhoneNumber', async (req, res) => {
  console.log(req.path, req.body)
  try {
    const driver = require('./driver')
    res.json(await driver.setCognitoPhoneNumber(req.body))
  } catch (e) {
    console.error('setCognitoPhoneNumber', e.message, req.body)
    res.status(400)
  }
})

app.get('/pinmeapi/uniqueId/:driverId', async (req, res) => {
  if (req.params.driverId !== 'all') {
    res.json(await uniqueId.get([req.params.driverId]))
  } else {
    const user = await new SessionApi(apiConfig).sessionGet(null, { headers: { cookie: req.header('cookie') } }).then(d => d.data)
    res.json(await uniqueId.getByCompanyId(user.attributes.companyId))
  }
})

app.put('/pinmeapi/uniqueId', async (req, res) => {
  const user = await new SessionApi(apiConfig).sessionGet(null, { headers: { cookie: req.header('cookie') } }).then(d => d.data)
  const newUniqueId = req.body
  newUniqueId.userId = user.id
  newUniqueId.companyId = user.attributes.companyId
  res.json(await uniqueId.add(newUniqueId))
})

app.post('/pinmeapi/uniqueId', async (req, res) => {
  res.json(await uniqueId.update(req.body.id, req.body))
})

app.post('/pinmeapi/drivers/uniqueId', async (req, res) => {
  const user = await new SessionApi(apiConfig).sessionGet(null, { headers: { cookie: req.header('cookie') } }).then(d => d.data)
  res.json(await uniqueId.getByCompanyIdAndDates(user.attributes.companyId, req.body))
})

app.delete('/pinmeapi/uniqueId/:id', async (req, res) => {
  res.json(await uniqueId.delete(req.params.id))
})

async function getManagedUserId (userId, managedUserId) {
  const auth = await secrets.getSecret('traccar')
  const users = await new UsersApi(apiConfig).usersGet(userId, { auth }).then(d => d.data)
  return users.find(u => u.id === parseInt(managedUserId))
}

async function getDriver (userId, driverId) {
  const auth = await secrets.getSecret('traccar')
  const drivers = await new DriversApi(apiConfig).driversGet(false, userId, undefined, undefined, false, { auth }).then(d => d.data)
  return drivers.find(d => d.id === parseInt(driverId))
}

async function getDevice (req) {
  const user = await new SessionApi(apiConfig).sessionGet(null, { headers: { cookie: req.header('cookie') } }).then(d => d.data)
  console.log('getDevice', user)
  const id = parseInt(req.params.deviceId || req.query.deviceId || req.body.deviceId)
  const [device] = await new DevicesApi(apiConfig).devicesGet(false, undefined, id, undefined, { headers: { cookie: req.header('cookie') } }).then(d => d.data)
  return device
}

async function getGroup (req) {
  const user = await new SessionApi(apiConfig).sessionGet(null, { headers: { cookie: req.header('cookie') } }).then(d => d.data)
  console.log('getGroup', user)
  const id = parseInt(req.params.groupId || req.query.groupId || req.body.groupId)
  const groups = await new GroupsApi(apiConfig).groupsGet(false, undefined, { headers: { cookie: req.header('cookie') } }).then(d => d.data)
  return groups.find(g => g.id === id)
}

async function validateUser (req, userId) {
  const users = await new UsersApi(apiConfig).usersGet(undefined, { headers: { cookie: req.header('cookie') } }).then(d => d.data)
  return users.find(u => u.id === parseInt(userId))
}

app.post('/pinmeapi/driverAttribute/:deviceId', async (req, res) => {
  let device
  try { device = await getDevice(req) } catch (e) {
    console.error('deviceId', req.params.deviceId, e.message, e.response && e.response.data)
    res.status(500).end()
    return
  }
  const auth = await secrets.getSecret('traccar')
  const attributes = await new AttributesApi(apiConfig).attributesComputedGet(false, undefined, device.id, undefined, undefined, { auth }).then(d => d.data)
  const computedAttribute = attributes.find(a => a.id === 37)

  const permission = {
    deviceId: device.id,
    attributeId: 37
  }

  if (device.attributes.driverUniqueId && !computedAttribute) {
    // Add permission
    console.log('Add', permission)
    await new PermissionsApi(apiConfig).permissionsPost(permission, { auth })
  } else if (!device.attributes.driverUniqueId && computedAttribute) {
    // Delete permission
    console.log('Delete', permission)
    await new PermissionsApi(apiConfig).permissionsDelete(permission, { auth })
  }

  res.end()
})

app.get('/pinmeapi/tokens/:deviceId', async (req, res) => {
  const traccarDevice = await getDevice(req)
  console.log('traccarDevice', traccarDevice)
  const devices = require('./devices')
  let device = await devices.getIgnitionOff(traccarDevice.id)
  if (!device) { device = { deviceId: traccarDevice.id } }
  if (!device.token) {
    device.token = Math.random().toString(36).substr(2) + Math.random().toString(36).substr(2)
    await devices.put(device)
  }
  res.json(device.token)
})

app.put('/pinmeapi/users/:userId', async (req, res) => {
  try {
    const user = await new SessionApi(apiConfig).sessionGet(null, { headers: { cookie: req.header('cookie') } }).then(d => d.data)
    const validUser = await validateUser(req, req.params.userId)
    if (validUser && user.userLimit === -1) {
      const auth = await secrets.getSecret('traccar')
      res.json(await new UsersApi(apiConfig).usersIdPut(req.body, req.params.userId, { auth })
        .then(d => d.data)
        .catch(e => {
          console.error(e.message, req.method, req.path, req.body, req.params.userId)
          res.status(500).end()
        })
      )
    } else {
      res.status(500).end()
    }
  } catch (e) {
    console.error(e.message, req.body, req.params.userId)
    res.status(500).end()
  }
})

app.get('/pinmeapi/users/:userId', async (req, res) => {
  let validUser
  try { validUser = await validateUser(req, req.params.userId) } catch (e) {
    await logException({ message: e.message }, req, 'invalid session', 'userId', req.params.userId, 'cookie:', req.header('cookie'))
  }

  if (validUser) {
    const auth = await secrets.getSecret('traccar')
    res.json(await new UsersApi(apiConfig).usersGet(req.params.userId, { auth }).then(d => d.data))
  } else {
    res.status(401).end()
  }
})

app.post('/pinmeapi/syncdata/:userId', async (req, res) => {
  res.status(200).end()
})

app.post('/pinmeapi/users/firebase', async (req, res) => {
  const users = require('./users')
  let user
  try {
    user = await new SessionApi(apiConfig).sessionGet(null, { headers: { cookie: req.header('cookie') } }).then(d => d.data)
    let dUser = await users.get(user.email)
    if (!dUser) { dUser = { user: user.email } }
    if (!dUser.firebaseTokens) { dUser.firebaseTokens = [] }
    if (!dUser.firebaseTokens.includes(req.body.token)) {
      dUser.firebaseTokens.push(req.body.token)
      await users.put(dUser)
    }
  } catch (e) {
    await logException(e, req, req.header('cookie'))
    return res.status(500).end()
  }
  res.status(200).end()
})

app.get('/pinmeapi/attributes/computed', async (req, res) => {
  const device = await getDevice(req)
  const auth = await secrets.getSecret('traccar')
  res.json(await new AttributesApi(apiConfig).attributesComputedGet(false, undefined, device.id, undefined, false, { auth }).then(d => d.data))
})

app.post('/pinmeapi/permissions', async (req, res) => {
  try {
    if (req.params.deviceId || req.query.deviceId || req.body.deviceId) {
      const device = await getDevice(req)
      if (!device) {
        return res.status(500).send(JSON.stringify(req.body))
      }
    } else if (req.body.managedUserId || req.body.driverId) {
      let user
      try {
        user = await new SessionApi(apiConfig).sessionGet(null, { headers: { cookie: req.header('cookie') } }).then(d => d.data)
      } catch (e) {
        console.error(req.body, e.message, e.response && e.response.data)
        return res.status(500).send(JSON.stringify(req.body))
      }
      if (!user || user.id !== req.body.userId) {
        return res.status(500).send(JSON.stringify(req.body))
      }
      const subUser = getManagedUserId(req.body.userId, req.body.subUserId)
      if (!subUser) {
        return res.status(500).send(JSON.stringify(req.body))
      }

      if (req.body.managedUserId) {
        const managedUser = getManagedUserId(req.body.subUserId, req.body.managedUserId)
        if (!managedUser) {
          return res.status(500).send(JSON.stringify(req.body))
        }
      } else if (req.body.driverId) {
        const driver = getDriver(req.body.subUserId, req.body.driverId)
        if (!driver) {
          return res.status(500).send(JSON.stringify(req.body))
        }
      }
      delete req.body.subUserId
    }
    const auth = await secrets.getSecret('traccar')
    res.json(await new PermissionsApi(apiConfig).permissionsPost(req.body, { auth }).then(d => d.data))
  } catch (e) {
    logException(e, req)
    res.status(500).send(e.message).end()
  }
})

app.delete('/reports/geofences/:groupId', async (req, res) => {
  try {
    const group = await getGroup(req)
    if (group) {
      const geofencesToDelete = await new GeofencesApi(apiConfig).geofencesGet(false, undefined, undefined, group.id, false, { headers: { cookie: req.header('cookie') } }).then(d => d.data)
      if (geofencesToDelete.length) {
        const lastGeofence = geofencesToDelete.pop()
        await deleteGeofences(geofencesToDelete.map(g => g.id))
        console.log('invoke api to delete', lastGeofence.id)
        await new GeofencesApi(apiConfig).geofencesIdDelete(lastGeofence.id, { headers: { cookie: req.header('cookie') } })
      }
    }
    res.status(200).end()
  } catch (e) {
    logAndReply(e, res, req)
  }
})

app.get('/pinmeapi/oauth2/userInfo', async (req, res) => {
  await validate(req, res)
})

app.post('/pinmeapi/whatsappreceive', async (req, res) => {
  console.error('whatsapp', req.body)
  res.status(200).end()
})

app.get('/pinmeapi/whatsappreceive', async (req, res) => {
  console.error('whatsapp', req.query)
  res.status(200).end()
})

app.post('/pinmeapi/whatsapp', async (req, res) => {
  const user = await new SessionApi(apiConfig).sessionGet(null, { headers: { cookie: req.header('cookie') } }).then(d => d.data)
  await whatsapp.send(user, req.body.message)
  res.status(200).end()
})

app.get('/pinmeapi/redirect/:param', async (req, res) => {
  res.redirect(`${req.query.redirectUrl}${req.params.param}${
        req.header('cookie').split(';').find(c => c.includes('JSESSIONID')).trim()}`)
})

const { v1: uuidv1 } = require('uuid')
const { send } = require('./sqs')
const { checkReport } = require('./quicksight')

app.post('/pinmeapi/reports/quicksight/:report', async (req, res) => {
  console.info('/pinmeapi/reports/quicksight', req.params.report)
  const ingestionId = uuidv1()
  await send(JSON.stringify({
    report: req.params.report,
    ingestionId,
    params: req.body,
    cookie: req.body.cookie || req.header('cookie')
  }), process.env.REPORTS_QUEUE2)
  res.json({ ingestionId })
})

app.get('/pinmeapi/reports/quicksight/:report', async (req, res) => {
  res.json(await checkReport(req.params.report, req.query.ingestionId))
})

app.post('/pinmeapi/reports/speeding-report/getEvents', async (req, res) => {
  const axios = require('axios').create({ headers: { cookie: req.header('cookie') }, baseURL: apiConfig.basePath })
  const traccar = { reports: new ReportsApi(apiConfig, null, axios), axios }
  try {
    res.redirect(await require('./reports/speeding-report').getEvents(traccar, req.body))
  } catch (e) {
    logAndReply(e, res, req, 'getEvents')
  }
})

app.get('/pinmeapi/reports/speeding-report/getEvents', async (req, res) => {
  res.send(req.path).end()
})

function logAndReply (e, res, req, args) {
  logException(e, req, args)
  res.status(500).send(e.message).end()
}

app.post('/pinmeapi/reports/:report', async (req, res) => {
  try {
    const axios = require('axios').create({ headers: { cookie: req.header('cookie') }, baseURL: apiConfig.basePath })
    const traccar = { reports: new ReportsApi(apiConfig, null, axios), axios }
    res.redirect(await require('./reports').getReport(req.params.report, traccar, req.body))
  } catch (e) {
    logAndReply(e, res, req)
  }
})

app.get('/pinmeapi/traccar/*', async (req, res) => {
  try {
    const axios = require('axios').create({ headers: { cookie: 'JSESSIONID=' + req.query.sessionid } })
    const redirect = req.originalUrl.replace('pinmeapi/traccar', 'api')
    const resp = await axios.get(`https://api.pinme.io${redirect}`).then(d => d.data)
    console.log(resp)
    res.json(resp)
  } catch (e) {
    await logException(e, req)
    res.status(500).send(e.message)
  }
})
app.post('/pinmeapi/image/:key', upload.single('file'), async (req, res, next) => {
  const sharp = require('sharp')
  try {
    console.log(req.file)
    const key = 'image' + req.params.key
    await put(key, await sharp(req.file.buffer).resize(30, 30).toBuffer(), req.file.mimetype, false)
    res.status(200).send(`${process.env.CLOUDFRONT_URL}/${key}`)
    next()
  } catch (e) {
    console.error(e.message, e.response && e.response.data)
    res.status(500).send(e.message)
  }
})

app.post('/pinmeapi/commands', async (req, res) => {
  const device = req.body
  const user = await new SessionApi(apiConfig).sessionGet(null, {
    headers: { cookie: req.header('cookie') }
  }).then(d => d.data)
  await sendSms(device.phone, '09000120', user.email)
  res.status(200).end()
})

app.get('/pinmeapi/geofences/withGroup', async (req, res) => {
  return processRequest(geofencesWIthGroup, res, req.header('cookie'))
})

function geofencesWIthGroup (cookie) {
  console.log('geofencesWithGroup', cookie)
}

app.get('/pinmeapi/cookie/get', async (req, res) => {
  res.json(req.header('cookie').split(';').find(c => c.includes('JSESSIONID')).trim())
})

exports.main = serverlessExpress({ app })
