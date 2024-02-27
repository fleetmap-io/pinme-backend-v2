const traccar = require('../api/traccar')
const { getDriver } = require('../drivers')
const { logException } = require('../utils')

async function processDriverChanged (event, retries = 3) {
  const date = new Date()
  try {
    if (event.position) {
      if (!event.position.attributes.driverUniqueId || event.position.attributes.driverUniqueId === '0') {
        return
      }

      const driver = await getDriver(event.position.attributes.driverUniqueId)

      if (driver) {
        if (driver.attributes.deviceId !== event.position.deviceId) {
          console.log('update driver', driver.name, 'from device id', driver.attributes.deviceId, 'to', event.position.deviceId)
          driver.attributes.deviceId = event.position.deviceId
          await traccar.updateDriver(driver)
        }
      }

      const device = event.device
      if (device) {
        if (device.attributes.lastDriverUniqueId !== event.position.attributes.driverUniqueId) {
          device.attributes.lastDriverUniqueId = event.position.attributes.driverUniqueId
          await traccar.updateDevice(device.id, device)
        }
      }
    } else {
      console.log('ignoring driverChanged, no position', event)
    }
  } catch (e) {
    if (e.response && e.response.data && e.response.data.startsWith('ConcurrentModificationException') && retries) {
      console.warn('concurrent exception trying again', retries, event.event)
      return processDriverChanged(event, retries--)
    } else {
      await logException(e, undefined, 'processDriverChanged', event.event && event.event.attributes,
        'after', new Date() - date, 'ms')
    }
  }
}

exports.processDriverChanged = processDriverChanged
