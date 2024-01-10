const secrets = require('../secrets')
const axios = require('axios')

const speedLimitsCache = {}
let _apiKey
exports.getSpeedLimit = async (position, event) => {
  if (!_apiKey) { _apiKey = secrets.getSecretValue('hereSpeedLimits')}
  if (!speedLimitsCache[position.id]) {
    const { hereSpeedLimits } = await _apiKey
    const url = `https://m.fleet.ls.hereapi.com/2/calculateroute.json?apiKey=${hereSpeedLimits}&routeMatch=1&mode=fastest;car;traffic:disabled&waypoint0=${position.latitude},${position.longitude}&attributes=SPEED_LIMITS_FCn(*)`
    const r = await axios.get(url).then(r => r.data).catch(e => console.error(url, e.message, e.response && e.response.data))
    const links = r && r.response && r.response.route && r.response.route[0] && r.response.route[0].leg[0].link
    if (links) {
      const speeds = []
      links.map(x => x.attributes).filter(x => x).forEach(a => {
        speeds.push(parseInt(a.SPEED_LIMITS_FCN[0].FROM_REF_SPEED_LIMIT))
        speeds.push(parseInt(a.SPEED_LIMITS_FCN[0].TO_REF_SPEED_LIMIT))
      })
      const speedLimit = speeds.length ? Math.max(...speeds) : Number.MAX_SAFE_INTEGER
      speedLimitsCache[position.id] = speedLimit
      return speedLimit
    } else {
      console.log('no links on', position, event)
    }
  }
  return speedLimitsCache[position.id]
}
