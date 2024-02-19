const quicksight = require('../quicksight')
const secrets = require('../secrets')
const { getPositions, saveToS3 } = require('./index')
const { create } = require('../api/traccar')
const { createReports } = require('../api/traccar')
const DataSetId = '3d2ec6ce-e62e-40fd-b8f8-4a8fa6fdcc72'
const DashboardId = '28d3425c-fa2a-46d4-a8de-fab448a4cb93'

exports.ingestReport = async (parameters, ingestionId, cookie) => {
  await saveToS3('passenger.csv', await createReport(parameters, cookie))
  await quicksight.datasetIngestion(DataSetId, ingestionId)
}

exports.DataSetId = DataSetId
exports.DashboardId = DashboardId

async function getEvents (cookie, eventsUrl, retries = 5) {
  try {
    return createReports(cookie).get(eventsUrl).then(d => d.data)
  } catch (e) {
    if (retries--) {
      console.error(e.message, eventsUrl, 'retry', retries)
      return getEvents(cookie, eventsUrl, retries)
    } else {
      throw e
    }
  }
}

async function createReport ({ dateRange, selectedDevices }, cookie) {
  const axios = create(cookie)
  const allDevices = await axios.get('/devices').then(d => d.data)
  const devices = selectedDevices.map(deviceId => allDevices.find(d => d.id === deviceId)).filter(d => d)
  const auth = await secrets.getSecret('traccar')
  const drivers = await axios.get('/drivers', auth).then(d => d.data)
  const groups = await axios.get('/groups').then(d => d.data)
  await Promise.all(groups.map(async g => {
    const driversByGroup = await axios.get(`/drivers?groupId=${g.id}`).then(d => d.data)
    driversByGroup.forEach(d => {
      const _driver = drivers.find(a => a.id === d.id)
      if (_driver) {
        _driver.groupName = g.name
      }
    })
  }))
  const promises = selectedDevices.map(async deviceId => {
    const allDevices = await axios.get('/devices').then(d => d.data)
    const positions = await getPositions({ dateRange, selectedDevices: [deviceId] }, createReports(cookie), allDevices)
    const eventsUrl = `/reports/events?deviceId=${deviceId
      }&from=${new Date(dateRange[0]).toISOString()
      }&to=${new Date(dateRange[1]).toISOString()
      }`
    const events = await getEvents(cookie, eventsUrl)
    events.forEach(e => {
      delete e.attributes
      const position = positions.find(p => p.id === e.positionId)
      const driver = getDriver(e, position, drivers)
      e.deviceName = devices.find(d => d.id === e.deviceId).name
      e.groupName = driver.groupName || ''
      e.fixtime = position && new Date(position.fixTime)
      e.notes = driver && driver.attributes.notes
      e.driverName = (driver && driver.name) || (position && position.attributes.driverUniqueId)
    })
    console.log('returning', events.length, 'events')
    return events
  })
  const events = []
  const maxParallelRequests = 4
  for (let i = 0; i < promises.length; i += maxParallelRequests) {
    const slice = await Promise.all(promises.slice(i, i + maxParallelRequests))
    events.push(slice.flat())
  }
  return events.flat()
}

function getDriver (event, p, drivers) {
  if (!p) { return '' }
  const d = drivers.find(d => d.uniqueId === p.attributes.driverUniqueId)
  if (!d) { return '' }
  return d
}
