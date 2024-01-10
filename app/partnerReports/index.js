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
  return await s3.put(key, body, 'application/json', true, 'alb-reports-bucket')
}
