const dynamo = require('../dynamo')
const traccar = require('../api/traccar')
const { logException } = require('../utils')

const driverAppCompanies = [] // TODO: [1554, 1159, 2579, 961, 1086]

async function processIgnitionOff (event) {
  try {
    if (event.position) {
      const deviceId = event.device.id
      const positionDate = event.position.fixTime
      await dynamo.updateIgnitionOff(deviceId, positionDate)
      if (driverAppCompanies.find(id => parseInt(event.device.attributes.clientId) === id)) {
        if (!event.users.some(u => u.attributes.driverAppHoldDriver)) {
          if (event.device.attributes.deviceType !== 1) {
            console.log('sending setparam to', event.device.name)
            await traccar.sendCommand(deviceId, event.device.attributes.buzzer ? 'setparam 11700:3' : 'setparam 11700:0')
          }
          if (event.device.attributes.driverUniqueId) {
            const [device] = await traccar.getDevicesById([deviceId])
            console.log('Logout driver', device.name, device.attributes.driverUniqueId)
            delete device.attributes.driverUniqueId
            await traccar.updateDevice(deviceId, device)
          }
        }
      }
    } else {
      console.log('processIgnitionOff ignoring event without position', event)
    }
  } catch (e) {
    logException(e, undefined, 'processIgnitionOff', event.device && event.device.name)
  }
}

exports.processIgnitionOff = processIgnitionOff
