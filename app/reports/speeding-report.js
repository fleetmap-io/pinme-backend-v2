const s3 = require('../s3')

exports.getEvents = async (traccar, { from, to, devices, userData, deviceCount, totalDevices, sliceSize }) => {
  const { hereSpeedLimits } = await require('../secrets').getSecret('hereSpeedLimits')
  process.env.HERE_API_KEY = hereSpeedLimits
  console.log('getEvents', new Date(from), to, devices.length, userData.user)
  const key = new Date().getTime() + '_' + devices.map(d => d.id).join('_')
  let body
  try {
    body = await require('fleetmap-reports/src/speeding-report').getEvents(traccar, new Date(from), new Date(to), devices, userData, deviceCount, totalDevices, sliceSize)
    await s3.put(key, JSON.stringify(body))
    return `${process.env.CLOUDFRONT_URL}/${key}`
  } catch (e) {
    console.error('getEvents', from, to, userData.user && userData.user.email, e.message, (e.response && e.response.data) || e)
  }
}
