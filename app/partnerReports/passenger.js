const index = require('./index')
const quicksight = require('../quicksight')
const secrets = require('../secrets')
const { getPositions } = require('./index')

exports.getReport = async (user, parameters, traccar, axios) => {
  await index.saveToS3('passenger.csv', await createReport(user, parameters, axios))
  await quicksight.datasetIngestion('0e2a6ed7-2be1-4c0f-931e-b6f7d008756d')
  return quicksight.GetDashboardEmbedUrl('9a17358e-8caa-46f9-a653-276b36735114')
}

async function createReport (user, { dateRange, selectedDevices }, axios) {
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
    const positions = await getPositions(user, { dateRange, selectedDevices: [deviceId] }, axios)
    const eventsUrl = `/reports/events?deviceId=${deviceId
      }&from=${new Date(dateRange[0]).toISOString()
      }&to=${new Date(dateRange[1]).toISOString()
      }`
    const events = await axios.get(eventsUrl).then(d => d.data)
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
