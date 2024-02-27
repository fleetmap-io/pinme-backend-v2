const ignition = require('./ignition')
const driverChanged = require('./driverChanged')
const notifications = require('./notifications')
const { logException } = require('../utils')
const axios = require('axios')

async function sendToRabbit (body, retry = 3) {
  try {
    return await axios.post('http://forward.pinme.io/pushRabbit', body)
  } catch (e) {
    if (--retry) { return await sendToRabbit(body, retry) } else { throw e }
  }
}

exports.pushEvents = async (event) => {
  try {
    event = JSON.parse(event.body)

    if (!event.event) {
      console.warn('ignoring empty event', event)
      return
    }

    switch (event.event.type) {
      case 'deviceOnline':
      case 'deviceOffline':
      case 'deviceMoving':
      case 'deviceStopped':
      case 'deviceUnknown':
        return
    }

    let deleteEvent = false
    if (!event.notifications) {
      if (event.event.type === 'ignitionOff') {
        await ignition.processIgnitionOff(event)
      }
      if (event.event.type === 'driverChanged') {
        await driverChanged.processDriverChanged(event)
      }
    } else {
      const body = await notifications.processEvent(event)
      deleteEvent = body.event.delete
    }
    if (!deleteEvent) {
      try {
        await sendToRabbit(event)
      } catch (e) {
        console.error(e)
      }
    } else {
      // console.log('deleting event', event)
    }
    return { statusCode: 200 }
  } catch (err) {
    await logException(err, undefined, 'pushEvents', event.event)
    throw err
  }
}
