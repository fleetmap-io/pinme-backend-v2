const Papa = require('papaparse')
const s3 = require('../s3')

exports.getReport = (user, parameters, report, traccar, axios) => {
  try {
    const _report = require('./' + report)
    return _report && _report.getReport(user, parameters, traccar, axios)
  } catch (e) {
    console.log(e.message)
    return null
  }
}

function getPositionsUrl (devices, dateRange) {
  return `/reports/route?${devices.map(d => 'deviceId=' + d.id).join('&')
  }&from=${new Date(dateRange[0]).toISOString()
  }&to=${new Date(dateRange[1]).toISOString()
  }`
}

exports.getPositions = getPositions

async function getPositions ({ dateRange, selectedDevices }, axios) {
  const allDevices = await axios.get('/devices').then(d => d.data)
  const devices = selectedDevices.map(deviceId => allDevices.find(d => d.id === deviceId)).filter(d => d)
  const maxDevices = 4
  const promises = []
  for (let i = 0; i < devices.length; i += maxDevices) {
    promises.push(axios.get(getPositionsUrl(devices.slice(i, i + maxDevices), dateRange)).then(d => {
      console.log('got', d.data.length, 'from', i, 'to', i + maxDevices)
      return d.data
    }))
  }
  const results = await Promise.all(promises)
  const result = results.flat()
  console.log('got', result.length, 'positions')
  result.forEach(p => { p.Temperatura = p.attributes.temp1 ? parseFloat(p.attributes.temp1) : 0 })
  return result
}

exports.getUserData = async (user, traccar, parameters) => {
  return {
    user,
    devices: await traccar.devices.devicesGet().then(d => d.data.filter(d => parameters.selectedDevices.includes(d.id))),
    groups: await traccar.groups.groupsGet().then(d => d.data),
    drivers: await traccar.drivers.driversGet().then(d => d.data),
    geofences: await traccar.geofences.geofencesGet().then(d => d.data)
  }
}

exports.saveToS3 = async (key, reportData) => {
  const body = Papa.unparse(reportData)
  return await s3.put(key, body, 'application/json', true, process.env.S3_BUCKET)
}
