const NodeCache = require('node-cache')
const _timeout = 10000
const cache = new NodeCache({ stdTTL: 600, useClones: false, checkperiod: 120 })
const baseURL = process.env.TRACCAR_API_BASE_PATH || 'https://api2.pinme.io/api'
const baseUrlReports = process.env.TRACCAR_API_REPORTS || 'https://0uu3hlen0d.execute-api.us-east-1.amazonaws.com/Prod/api'

const conf = {
  auth: { username: process.env.TRACCAR_ADMIN_USER, password: process.env.TRACCAR_ADMIN_PASS },
  baseURL,
  headers: { 'User-Agent': 'pinme-backend' }
}

const axios = require('axios').create(conf)

exports.apiConfig = {
  basePath: baseURL,
  baseOptions: { withCredentials: true }
}

exports.create = (cookie) => {
  return require('axios').create({ headers: { cookie }, baseURL: conf.baseURL })
}

exports.createReports = (cookie) => {
  return require('axios').create({ headers: { cookie }, baseURL: baseUrlReports })
}

exports.getNotifications = (userId, deviceId) => {
  return get(`/notifications?userId=${userId}` + (deviceId ? `&deviceId=${deviceId}` : ''))
}

exports.getUser = (id) => {
  const url = '/users/' + id
  return get(url)
}

exports.getUsers = (userId) => {
  const url = '/users?userId=' + userId
  return get(url)
}

exports.getAllDrivers = () => {
  const url = '/drivers?all=true'
  console.log(url)
  return get(url)
}

exports.getDrivers = (userId) => {
  const url = '/drivers?userId=' + userId
  return get(url)
}

exports.getMaintenancesByDevice = (deviceId) => {
  const url = '/maintenance?deviceId=' + deviceId
  return axios.get(url, { withCredentials: true }).then(r => r.data)
}

exports.getMaintenancesByUser = (userId) => {
  const url = '/maintenance?userId=' + userId
  console.log(url)
  return get(url)
}

exports.getAllMaintenances = () => {
  const url = '/maintenance?all=true'
  console.log(url)
  return get(url)
}

exports.updateMaintenance = (maintenance) => {
  return put('/maintenance/' + maintenance.id, maintenance)
}

exports.getGeofences = (userId) => {
  const url = '/geofences?userId=' + userId
  console.log(url)
  return get(url)
}

exports.getGroups = (userId, timeout) => {
  return get('/groups?userId=' + userId, timeout)
}

exports.createUser = (user) => {
  return post('/users', user)
}
const createDevice = (device) => {
  return post('/devices', device)
}

exports.createDevice = createDevice

exports.createGroup = (device) => {
  return post('/groups', device)
}

exports.createDriver = (driver) => {
  return post('/drivers', driver)
}

exports.updateDriver = (driver) => {
  return put('/drivers/' + driver.id, driver)
}

exports.deleteDriver = (driverId) => {
  return axios.delete('/drivers/' + driverId)
}

exports.createGeofence = (geofence) => {
  return post('/geofences', geofence)
}

exports.updateDevice = (deviceId, device) => {
  return put('/devices/' + deviceId, device)
}

function tryGet (path, timeout = _timeout) {
  return new Promise((resolve, reject) => {
    const date = new Date()
    const id = setTimeout(() => reject(new Error(`${path} timed out after  ${new Date() - date} ms`)), timeout)
    axios.get(path).then(r => {
      clearTimeout(id)
      resolve(r.data)
    }).catch(e => reject(e))
  })
}
async function get (path, timeout = _timeout, retries = 3) {
  if (!cache.get(path)) {
    try {
      cache.set(path, await tryGet(path, timeout))
    } catch (e) {
      if (--retries) {
        return get(path, timeout, retries)
      } else {
        console.error(path, e.message, 'retried from 3 to ', retries)
        throw e
      }
    }
  }
  return cache.get(path)
}

function post (url, data) {
  return axios.post(url, data)
}

function del (url) {
  return axios.delete(url)
}

function put (url, data) {
  return axios.put(url, data)
}

exports.deleteDevice = (deviceId) => {
  console.warn('deleting deviceId', deviceId)
  return axios.delete('/devices/' + deviceId)
}

exports.getDevice = async (id) => {
  const [device] = await get(`/devices?id=${id}`)
  return device
}

const getDevices = (uniqueId) => {
  let url = '/devices'
  if (uniqueId) { url += '?uniqueId=' + uniqueId }
  console.log(url)
  return get(url)
}
exports.getDevices = getDevices

exports.getDevicesById = (deviceIds) => {
  const url = '/devices?' + deviceIds.map(d => 'id=' + d).join('&')
  return get(url)
}

exports.getDevicesByUserId = (userId) => {
  const url = '/devices?'
  return get(url + 'userId=' + userId)
}

exports.updateUser = (user) => {
  return put('/users/' + user.id, user)
}

exports.createSession = (user, password = process.env.TRACCAR_ADMIN_PASS) => {
  const body = 'email=' + encodeURIComponent(user) + '&password=' + encodeURIComponent(password)
  return axios.post('/session', body, {
    headers: {
      'user-agent': 'pinme-backend',
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  })
}

exports.logout = () => {
  return axios.delete('/session', {
    withCredentials: true,
    headers: {
      'user-agent': 'pinme-backend',
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  })
}

exports.createPermission = (permission) => {
  return post('/permissions', permission)
}

exports.reportTrip = (from, to, groupId, deviceIds) => {
  let url
  if (groupId) {
    url = '/reports/trips?from=' + from + '&to=' + to + '&groupId=' + groupId
  } else {
    url = '/reports/trips?from=' + from + '&to=' + to + '&' + deviceIds.map(d => 'deviceId=' + d).join('&')
  }
  console.log(url)
  return get(url)
}

exports.reportLocations = (from, to, groupId, deviceIds) => {
  const url = groupId
    ? '/reports/route?from=' + from + '&to=' + to + '&groupId=' + groupId
    : '/reports/route?from=' + from + '&to=' + to + '&' + deviceIds.map(d => 'deviceId=' + d).join('&')

  return get(url)
}

exports.reportEvents = (from, to, groupId, deviceIds, types) => {
  types = types.map(n => 'type=' + encodeURI(n)).join('&')
  const url = '/reports/events?from=' + from + '&to=' + to + '&' + types + '&' + deviceIds.map(d => 'deviceId=' + d).join('&')
  console.log(url)
  return get(url)
}

exports.reportEventsSession = (from, to, groupId, deviceIds, types, session) => {
  types = types.map(n => 'type=' + encodeURI(n)).join('&')
  let url
  if (groupId) {
    url = '/reports/events?from=' + from + '&to=' + to + '&' + types + '&groupId=' + groupId
  } else {
    url = '/reports/events?from=' + from + '&to=' + to + '&' + types + '&' + deviceIds.map(d => 'deviceId=' + d).join('&')
  }
  console.log(url)
  return axios.get(url, {
    headers: {
      cookie: session,
      'user-agent': 'pinme-backend'
    },
    withCredentials: true
  })
}

exports.getPosition = (positionId, deviceId) => {
  return get(`/positions?id=${positionId}&deviceId=${deviceId}`)
}

exports.getPositions = async (body) => {
  if (body.from && body.to) {
    return await tryGet(`/reports/route?deviceId=${body.deviceId}&from=${body.from}${body.from.includes('T') ? '' : 'T00:00:00Z'}&to=${body.to}${body.to.includes('T') ? '' : 'T23:59:59Z'}`)
  }
  return []
}

exports.getPositionsByDevice = (deviceId, from, to) => {
  const url = '/positions' + '?deviceId=' + deviceId + '&from=' + from + '&to=' + to
  return get(url)
}

exports.updateDeviceAccumulators = (deviceId, accumulators) => {
  const body = {
    deviceId,
    totalDistance: accumulators.totalDistance,
    hours: accumulators.hours
  }
  return put('/devices/' + deviceId + '/accumulators', body)
}

exports.get = (path) => axios.get(path).then(d => d.data)

exports.getComputed = async (deviceId) => {
  return await get(`/attributes/computed?deviceId=${deviceId}`)
}

exports.removeComputed = (deviceId, attributeId) => {
  return axios.delete('/permissions',
    {
      headers: { 'user-agent': 'pinme-backend' },
      data: { deviceId, attributeId },
      auth: { username: process.env.TRACCAR_ADMIN_USER, password: process.env.TRACCAR_ADMIN_PASS }
    })
}

exports.sendCommand = (deviceId, data) => {
  return post('/commands/send', { deviceId, type: 'custom', attributes: { data }, description: 'pinme-backend' }).then(r => r.data)
}

exports.getCommands = (deviceId) => {
  const url = `/commands?deviceId=${deviceId}`
  return tryGet(url)
}

exports.addPermission = async (permission) => {
  return await post('/permissions', permission).then(r => r.data)
}

exports.deletePermission = async (permission) => {
  return del('/permissions', { data: permission }).then(r => r.data)
}

exports.postUser = (body) => post('/users', body)

exports.deleteUser = (id) => del(`/users/${id}`).then(r => r.data)

exports.putDevice = async (device) => {
  try {
    const newDevice = await createDevice(device).then(r => r.data)
    console.log(newDevice)
    return newDevice
  } catch (e) {
    return e.message
  }
}
