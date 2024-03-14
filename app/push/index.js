exports.pushPositions = async (e) => {
  let devPosition
  try {
    if (e && e.body) {
      const { device, position } = JSON.parse(e.body)
      if (device.attributes.integration) {
        for (const target of device.attributes.integration.split(',')) {
          try {
            const integration = require('../integration/' + target.trim().toLowerCase())
            await integration({ device, position })
          } catch (e) {
            if (e.message.startsWith('Cannot find module') && position.address && position.address.endsWith('Brazil')) {
              // default integration for Brazil
              await require('../integration/monitrip')({ device, position })
            }
            console.warn(e.message, device.attributes.integration, device.name)
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
    console.warn(integration, deviceName, err.message && err.message,
      err.response && err.response.data)
    // don't send 500, it will put weight on traccar
    return { statusCode: 200 }
  }
  return { statusCode: 200 }
}
