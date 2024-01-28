const integration = require('../integration')
exports.pushPositions = async (e) => {
  let devPosition
  try {
    if (e && e.body) {
      devPosition = JSON.parse(e.body)
      if (devPosition.device.attributes.integration) {
        for (const target of devPosition.device.attributes.integration.split(',')) {
          if (integration[target.toLowerCase()]) {
            await integration[target.toLowerCase()](devPosition)
          } else {
            console.warn('no integration for', devPosition.device.attributes.integration, devPosition.device.name)
          }
        }
      } else {
        console.error('no integration', e.Body)
      }
    } else {
      console.warn('received event without data: ', e)
    }
  } catch (err) {
    const deviceName = devPosition && devPosition.device && devPosition.device.name
    const integration = devPosition && devPosition.device && devPosition.device.attributes.integration
    console.warn(integration, deviceName, err.message, err.response && err.response.data)
    // don't send 500, it will put weight on traccar
    return { statusCode: 200 }
  }
  return { statusCode: 200 }
}
