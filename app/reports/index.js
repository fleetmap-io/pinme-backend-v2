const s3 = require('../s3')
const { DevicesApi, GroupsApi, DriversApi, GeofencesApi, SessionApi } = require('traccar-api')
const quicksight = require('../quicksight')
const apiConfig = {
  basePath: process.env.TRACCAR_API_BASE_PATH || 'https://api2.pinme.io/api',
  baseOptions: { withCredentials: true }
}

exports.getReport = async (report, traccar, { from, to, userData }) => {
  console.log('getReport', report, new Date(from), to, userData)
  const key = report + '_' + new Date().getTime()
  let body
  switch (report) {
    case 'zone-report':
      body = await require('fleetmap-reports/src/zone-report').createZoneReport(new Date(from), new Date(to), userData, traccar)
      break
    case 'activity-report':
      body = await require('fleetmap-reports/src/activity-report').createActivityReport(new Date(from), new Date(to), userData, traccar)
      break
    case 'kms-report':
      body = await require('fleetmap-reports/src/kms-report').createKmsReport(new Date(from), new Date(to), userData, traccar)
      break
    default:
  }
  await s3.put(key, JSON.stringify(body))
  return `${process.env.CLOUDFRONT_URL}/${key}`
}

async function process (report, req) {
  const axios = require('axios').create({ headers: { cookie: req.header('cookie') }, baseURL: apiConfig.basePath })
  const traccar = {
    devices: new DevicesApi(apiConfig, null, axios),
    groups: new GroupsApi(apiConfig, null, axios),
    drivers: new DriversApi(apiConfig, null, axios),
    geofences: new GeofencesApi(apiConfig, null, axios),
    axios
  }
  const user = await new SessionApi(apiConfig).sessionGet(null, {
    headers: { cookie: req.header('cookie') }
  }).then(d => d.data)
  return quicksight.getEmbeddedDashboard(user, req.body, req.params.report, traccar, axios)
}
