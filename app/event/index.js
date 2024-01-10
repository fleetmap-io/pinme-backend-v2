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

async function pushEvents (event) {
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
        console.warn('ignoring', event)
        return
    }

    if (event.event.type === 'ignitionOff') {
      await ignition.processIgnitionOff(event)
    }

    return

    if (event.event.type === 'driverChanged') {
      await driverChanged.processDriverChanged(event)
    }

    // for tests
    if (!event.device) {
      console.log('setting dummy device id 0 on', event)
      event.device = { id: 0 }
    }

    const body = await notifications.processEvent(event)
    if (!body.event.delete) {
      await sendToRabbit(body)
    } else {
      console.log('deleting event', body.event)
    }
    return { statusCode: 200 }
  } catch (err) {
    logException(err, 'pushEvents', event.event)
    throw err
  }
}

exports.process = async (e) => {
  console.log(e.Records.length, 'records')
  return Promise.all(e.Records.map(event => JSON.parse(event.body).length
    ? Promise.all(JSON.parse(event.body).map(event => pushEvents({ body: JSON.stringify(event) })))
    : pushEvents(event)
  ))
}
