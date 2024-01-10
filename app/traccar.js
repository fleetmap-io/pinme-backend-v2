const apiUrl = 'https://slowreports.pinme.io/api'
const osmAndUrl = 'http://server.pinme.io:5055/?'
const axios = require('axios')
const querystring = require('querystring')
const {wrapper} = require('axios-cookiejar-support')
const tough = require('tough-cookie')
const NodeCache = require('node-cache')
const cookieJar = new tough.CookieJar()
wrapper(axios)
const _timeout = 10000
exports.basePath = apiUrl
exports.axios = axios
exports.cookieJar = cookieJar
const cache = new NodeCache({ stdTTL: 600, useClones: false, checkperiod: 120 })

const config = {
  auth: { username: process.env.TRACCAR_ADMIN_USER, password: process.env.TRACCAR_ADMIN_PASSWORD },
  headers: { 'User-Agent': 'pinme-backend' }
}

exports.getNotifications = (userId, deviceId) => {
  return get(`/notifications?userId=${userId}` + (deviceId ? `&deviceId=${deviceId}` : ''))
}

exports.sendPosition = (position) => {
  const url = osmAndUrl + querystring.stringify(position)
  console.log(url)
  return axios.get(url)
}

exports.getUser = (id) => {
  const url = '/users/' + id
  return get(url)
}

exports.getUsers = (userId) => {
  const url = '/users?userId=' + userId
  console.log(url)
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
  const url = apiUrl + '/maintenance?deviceId=' + deviceId
  return axios.get(url, {
    jar: cookieJar,
    withCredentials: true
  }).then(r => r.data)
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
  return put(apiUrl + '/maintenance/' + maintenance.id, maintenance)
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
  return post(apiUrl + '/users', user)
}

exports.createDevice = (device) => {
  return post(apiUrl + '/devices', device)
}

exports.createGroup = (device) => {
  return post(apiUrl + '/groups', device)
}

exports.createDriver = (driver) => {
  return post(apiUrl + '/drivers', driver)
}

exports.updateDriver = (driver) => {
  return put(apiUrl + '/drivers/' + driver.id, driver)
}

exports.createGeofence = (geofence) => {
  return post(apiUrl + '/geofences', geofence)
}

exports.updateDevice = (deviceId, device) => {
  return put(apiUrl + '/devices/' + deviceId, device)
}

exports.deleteGeofence = (geofenceId) => {
  console.warn('deleting geofenceId', geofenceId)
  return axios.delete(apiUrl + '/geofences/' + geofenceId,
    {
      auth: { username: constants.traccarUser, password: constants.traccarPass }
    })
}

function tryGet (path, timeout = _timeout) {
  return new Promise((resolve, reject) => {
    const date = new Date()
    const id = setTimeout(() => reject(new Error(`${path} timed out after  ${new Date() - date} ms`)), timeout)
    axios.get(apiUrl + path, config).then(r => {
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
  return axios.post(url, data,
    config)
}

function put (url, data) {
  return axios.put(url, data,
    config)
}

exports.deleteDevice = (deviceId) => {
  console.warn('deleting deviceId', deviceId)
  return axios.delete(apiUrl + '/devices/' + deviceId,
    config)
}

exports.getDevices = (uniqueId) => {
  let url = '/devices'
  if (uniqueId) { url += '?uniqueId=' + uniqueId }
  console.log(url)
  return get(url)
}

exports.getDevicesById = (deviceIds) => {
  const url = '/devices?' + deviceIds.map(d => 'id=' + d).join('&')
  return get(url)
}

exports.getDevicesByUserId = (userId) => {
  const url = '/devices?'
  return get(url + 'userId=' + userId)
}

exports.updateUser = (user) => {
  return put(apiUrl + '/users/' + user.id, user)
}

exports.createSession = (user) => {
  const body = 'email=' + encodeURIComponent(user) + '&password=' + encodeURIComponent(process.env.TRACCAR_ADMIN_PASSWORD)
  console.log(body)
  cookieJar.removeAllCookies()
  return axios.post(apiUrl + '/session', body, {
    withCredentials: true,
    jar: cookieJar,
    headers: {
      'user-agent': 'pinme-backend',
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  })
}

exports.logout = () => {
  return axios.delete(apiUrl + '/session', '', {
    withCredentials: true,
    jar: cookieJar,
    headers: {
      'user-agent': 'pinme-backend',
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  })
}

exports.createPermission = (permission) => {
  return post(apiUrl + '/permissions', permission)
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
  return axios.get(apiUrl + url,
    {
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

exports.getPositions = (positionIds) => {
  positionIds = positionIds.map(id => 'id=' + id).join('&')
  const url = '/positions' + '?' + positionIds
  console.log(url)
  return get(url)
}

exports.getPositionsByDevice = (deviceId, from, to) => {
  const url = '/positions' + '?deviceId=' + deviceId + '&from=' + from + '&to=' + to
  return get(url)
}

exports.updateDeviceAccumulators = (deviceId, accumulators) => {
  const body = {
    deviceId: deviceId,
    totalDistance: accumulators.totalDistance,
    hours: accumulators.hours
  }
  return put(apiUrl + '/devices/' + deviceId + '/accumulators', body)
}

exports.getComputed = (deviceId) => {
  return get(`/permissions?deviceid=${deviceId}`)
}

exports.removeComputed = (deviceId, attributeId) => {
  return axios.delete(apiUrl + '/permissions',
    {
      headers: { 'user-agent': 'pinme-backend' },
      data: { deviceId, attributeId },
      auth: { username: constants.traccarUser, password: constants.traccarPass }
    })
}

exports.sendCommand = (deviceId, data) => {
  return post(apiUrl + '/commands/send', { deviceId, type: 'custom', attributes: { data }, description: 'pinme-backend' }).then(r => r.data)
}
