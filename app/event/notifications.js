const traccar = require('../api/traccar')
const messages = require('../lang')
const email = require('../email/email')
const moment = require('moment-timezone')
const { validateEmail } = require('../email/email')
const sms = require('../sms')
const onesignal = require('../onesignal')
const admin = require('firebase-admin')
const here = require('../api/here')
const { getUserPartner } = require('fleetmap-partners')
const dynamo = require('../dynamo')
const whatsapp = require('../whatsapp')
const { getImageUrl } = require('../api/google')
const { logException } = require('../utils')
const integration = require('../integration')
const { getSecretValue } = require('../secrets')

let firebaseInitialized

async function sendEmailNotification (event, user, notification) {
  const senderEmail = 'no-reply@gpsmanager.io'
  const driver = await getDriver(event, user)
  const group = await getGroup(event, user)
  const maintenance = await getMaintenance(event, user)

  const body = await getEventEmailMessage(event, user, driver, group, maintenance)

  const subject = getEventEmailSubject(event, user, driver, maintenance)

  const emailTo = []
  if (validateEmail(event.users[user].email)) {
    emailTo.push(event.users[user].email.trim().toLowerCase())
  }
  if (notification.attributes.otherEmails && notification.attributes.otherEmails.length > 0) {
    const otherEmailsList = notification.attributes.otherEmails.split(',')
    otherEmailsList.forEach(e => {
      if (validateEmail(e) && !emailTo.includes(e.trim().toLowerCase())) {
        emailTo.push(e.trim().toLowerCase())
      }
    })
  }
  if (emailTo.length) {
    for (const e of emailTo) {
      try {
        await email.email([e], [], body, subject, senderEmail)
      } catch (err) {
        console.error(err)
      }
    }
  } else {
    console.log('no valid emails')
  }
}

async function getEventEmailMessage (event, user, driver, group, maintenance) {
  const lang = event.users[user].attributes.lang ? event.users[user].attributes.lang : 'en-GB'
  const type = getEventType(lang, event)

  const messageLang = messages[lang] ? messages[lang] : messages['en-GB']

  const speed = await getSpeed(event)
  const momentTime = getMoment(event, user)

  let body = `<!DOCTYPE html>
<html lang="pt">
<head>
<style>
p {
  font-family: verdana,serif;
  font-size: 16px;
}
</style><title>${event.device.name}</title>
</head>
<body>
<h1>${event.device.name} - ${type}</h1>`

  if (group) {
    body += `<p><b>${messageLang.layout.group}: </b> ${group.name}</p>`
  }

  if (event.position && event.position.attributes.driverUniqueId) {
    body += `<p><b>${messageLang.layout.driver}:</b> ${driver ? driver.name : event.position.attributes.driverUniqueId}</p>`
  }

  if (speed && event.geofence) {
    body += `<p><b>${type}:</b> ${speed} ${messageLang.layout.in} ${event.geofence.name}</p>`
  } else if (speed) {
    body += `<p><b>${type}:</b> ${speed}<p/>`
  } else if (event.geofence) {
    body += `<p><b>${type}:</b> ${event.geofence.name}<p/>`
  }

  if (event.event.type === 'deviceFuelDrop') {
    body += `${messageLang.layout.fuelDropInfo}${event.device.attributes.fuelDropThreshold}%<br/>`
  }

  if (event.event.type === 'maintenance') {
    if (maintenance) {
      body += `<b>${messageLang.layout.maintenance}:</b> ${maintenance.name}<br/>`
    }

    if (event.event.attributes.totalDistance) {
      const totalDistance = Math.round(event.event.attributes.totalDistance / 1000)
      body += `<b>${messageLang.layout.currentKms}:</b> ${totalDistance}<br/>`
    } else {
      body += `<b>${messageLang.layout.maintenanceDate}:</b> ${event.event.attributes.maintenanceDate && event.event.attributes.maintenanceDate.toLocaleDateString(lang)}<br/>`
    }
  }

  if (event.position) {
    const partner = getUserPartner(event.users[user])
    const host = partner && partner.host
    const href = `https://${host || 'fleetmap.io'}/#/map?vehicleName=${event.device.name}&date=${new Date(event.position.fixTime).toISOString()}`
    body += `<p><b>${messageLang.layout.time}:</b> ${momentTime}<p/>`
    body += `<p><b>${messageLang.layout.address}:</b>
    <a target=_blank href="${href}">
      ${event.position.address}
    </a>
    </p>
    <a target=_blank href="${href}">
      <img src="${await getImageUrl('' + event.position.latitude + ',' + event.position.longitude)}" alt="Activate images...">
    </a>`
  }

  return body + '</body></html>'
}

async function getEventMessage (event, i) {
  const lang = event.users && (
    event.users[i].attributes.lang || (getUserPartner(event.users[i]) && getUserPartner(event.users[i]).lang))
  let message = ''

  if (event.position) {
    const position = event.position
    if (position.attributes.driverUniqueId) {
      try {
        const driver = await getDriver(event, i)
        message += ` ${driver ? driver.name.replace('#', '') : position.attributes.driverUniqueId}`
      } catch (e) {
        console.error(e)
      }
    }
  }

  const alarmType = event.event.type === 'alarm' ? event.event.attributes.alarm : event.event.type
  message += ` ${messages[lang] && messages[lang].layout && messages[lang].layout[alarmType]
        ? messages[lang].layout[alarmType]
: alarmType}`

  if (event.event.attributes.speed) {
    try {
      const speed = await getSpeed(event)
      message += ` ${speed}`
    } catch (e) {
      console.error(e)
    }
  }
  if (event.geofence) {
    message += ` ${event.geofence.name}`
  }

  try {
    if (event.users) {
      const momentTime = getMoment(event, i)
      message += ` - ${momentTime}`
    }
  } catch (e) {
    console.error(e)
  }
  return message
}

function getEventEmailSubject (event, user, driver, maintenance) {
  const lang = event.users[user].attributes.lang ? event.users[user].attributes.lang : 'en-GB'

  const type = (event.event.type === 'maintenance' && maintenance) ? maintenance.name : getEventType(lang, event)

  return `${event.device.name}${driver ? ' (' + driver.name + ')' : ''} - ${type} - ${event.position.address}`
}

function getEventType (lang, event) {
  const alarmType = event.event.type === 'alarm' ? event.event.attributes.alarm : event.event.type

  return messages[lang] && messages[lang].layout && messages[lang].layout[alarmType]
    ? messages[lang].layout[alarmType]
    : alarmType
}

async function getSpeed (event) {
  if (event.event.attributes.speed) {
    try {
      const speed = Math.round(event.event.attributes.speed * 1.852)
      const speedLimit = event.device.attributes.overspeedByRoad
        ? await here.getSpeedLimit(event.position, event.event)
        : Math.round(event.event.attributes.speedLimit * 1.852)
      return ` ${speed + ' km/h (' + speedLimit + ' km/h)'}`
    } catch (e) {
      console.error('getSpeed', e)
    }
  }
}

const driverCache = {}

async function getDriver (event, user) {
  if (event.position) {
    const position = event.position
    if (position.attributes.driverUniqueId) {
      try {
        if (!driverCache[position.attributes.driverUniqueId]) {
          const drivers = await traccar.getDrivers(event.users[user].id)
          driverCache[position.attributes.driverUniqueId] = drivers.find(d => d.uniqueId === position.attributes.driverUniqueId)
        }
        return driverCache[position.attributes.driverUniqueId]
      } catch (e) {
        logException(e, undefined, 'getDriver')
      }
    }
  }
}

async function getGroup (event, user) {
  const start = new Date()
  if (event.device) {
    try {
      const groups = await traccar.getGroups(event.users[user].id, 2000)
      return groups.find(g => g.id === event.device.groupId)
    } catch (e) {
      await logException(e, undefined, 'getGroup after', new Date() - start, 'ms', event.event, user)
    }
  }
}

async function getMaintenance (event, user) {
  if (event.event.maintenance) {
    return event.event.maintenance
  }

  if (event.event.maintenanceId) {
    try {
      const maintenances = await traccar.getMaintenancesByUser(event.users[user].id)
      return maintenances.find(m => m.id === event.event.maintenanceId)
    } catch (e) {
      console.error(e)
    }
  }
}

function getMoment (event, user, format = 'YYYY-MM-DD HH:mm:ss') {
  return _getMoment(event, event.users[user], format)
}

function _getMoment (event, user, format) {
  if (event.position) {
    const momentFixTime = moment(event.position.fixTime)
    try {
      const timezone = user.attributes.timezone || (getUserPartner(user) && getUserPartner(user).timezone)
      return timezone ? momentFixTime.tz(timezone).format(format) : momentFixTime.format(format)
    } catch (e) {
      console.error(e)
    }
  }
  return ''
}

exports.getMoment = _getMoment

async function getDeviceGroup (event, i) {
  const group = await getGroup(event, i)
  return group ? ` (${group.name})` : ''
}

async function removeToken (token, email, user) {
  if (user) {
    if (user.attributes.firebaseToken === token) {
      const tUser = await traccar.getUser(user.id)
      delete tUser.attributes.firebaseToken
      console.log('traccar.updateUser', user.email, await traccar.updateUser(tUser).then(d => d.data))
    }
  }
  const dUser = await dynamo.get({ user: email })
  if (dUser && dUser.firebaseTokens) {
    const tokens = dUser.firebaseTokens
    if (tokens.includes(token)) {
      console.log('tokens:', tokens)
      console.log('removed', tokens.splice(tokens.indexOf(token), 1))
      console.log('dynamo put', await dynamo.put(dUser))
    }
  }
}

let firebaseSecret

async function sendFirebase (notification, token, email, user, retries = 3) {
  if (!firebaseSecret) {
    firebaseSecret = getSecretValue('firebase-key')
  }
  const certificate = await firebaseSecret
  if (!firebaseInitialized) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert(certificate),
        databaseURL: 'https://pinme-9e6a3.firebaseio.com'
      })
      firebaseInitialized = true
    } catch (e) {
      console.error(e)
    }
  }
  notification.token = token
  try {
    console.log('sent firebase', email, notification.notification && notification.notification.body, await admin.messaging().send(notification))
  } catch (e) {
    switch (e.errorInfo && e.errorInfo.code) {
      case 'messaging/registration-token-not-registered':
      case 'messaging/third-party-auth-error':
        console.log('removing', token, 'from user', email)
        await removeToken(token, email, user)
        break
      case 'messaging/internal-error':
        if (--retries) {
          await sendFirebase(notification, token, email, user, retries)
        }
        break
      default:
        console.error('firebase', email, e.errorInfo, notification)
    }
  }
}

function filterSmsNotification (event, phone) {
  return phone && phone.length >= 9
}

async function processEvent (event) {
  const users = event.users
  for (let i = 0; i < users.length; i++) {
    const notification = await alertActiveForUser(users[i], event)
    if (notification && notificationIsActive(notification, event)) {
      // console.log('processing', event)
      const message = await getEventMessage(event, i)
      if (notification.notificators.includes('sms') && filterSmsNotification(event, users[i].phone)) {
        let msg
        try {
          const deviceGroup = await getDeviceGroup(event, i)
          msg = `${event.device.name}${deviceGroup}${message}`
          console.log('sendSms', users[i].email, users[i].phone, msg)
          await sms.sendSms(users[i].phone, msg)
        } catch (e) {
          await logException(e, undefined, 'sendSms', users[i].phone, msg)
        }
      }
      if (notification.notificators.includes('mail')) {
        try {
          console.log('sendEmail', users[i].email)
          await sendEmailNotification(event, i, notification)
        } catch (e) {
          await logException(e, undefined, 'sendEmailNotification', users[i].email)
        }
      }
      if (notification.notificators.includes('web')) {
        try {
          await onesignal.createNotification(users[i], event.device.name, message, event.position)
          const notification = {
            notification: {
              title: event.device.name,
              body: message
            },
            apns: {
              payload: {
                aps: {
                  sound: 'default'
                }
              }
            }
          }
          if (users[i].attributes.firebaseToken) {
            await sendFirebase(notification, users[i].attributes.firebaseToken, users[i].email, users[i])
          }
          const dUser = await dynamo.get({ user: users[i].email })
          if (dUser && dUser.firebaseTokens) {
            for (const t of dUser.firebaseTokens) {
              if (t !== users[i].attributes.firebaseToken) {
                await sendFirebase(notification, t, users[i].email)
              }
            }
          }
        } catch (e) {
          console.error('error in firebase / onesignal', users[i].email, users[i].attributes.firebaseToken, event.device.name, message, e)
        }
      }
      if (notification.notificators.includes('whatsapp')) {
        await whatsapp.send(users[i], event)
      }
      if (notification.notificators.includes('driver')) {
        if (event.position.attributes.driverUniqueId) {
          try {
            const driver = await getDriver(event, i)
            if (driver && driver.attributes && driver.attributes.phone) {
              await whatsapp.send({ ...users[i], phone: driver.attributes.phone }, event)
            }
          } catch (e) {
            console.error(e.message, (e.response && e.response.data) || e)
          }
        }
      }
      if (notification.attributes.integration) {
        if (integration[notification.attributes.integration.toLowerCase()]) {
          await integration[notification.attributes.integration.toLowerCase()](event)
        } else {
          console.warn('unknown integration', users[i] && users[i].email, notification.attributes.integration)
        }
      }
    }
  }
  return event
}

function notificationIsActive (notification, event) {
  if (notification.attributes.checkGeofences === 'onlyInside' &&
      !event.event.geofenceId) {
    return false
  }

  return !(notification.attributes.checkGeofences === 'onlyOutside' &&
      event.event.geofenceId)
}

async function aboveSpeedLimit (position, event, device) {
  const maxSpeed = await here.getSpeedLimit(position, event)
  if (maxSpeed) {
    return position.speed * 1.852 > maxSpeed + parseInt(device.attributes.overspeedThreshold || 0)
  }
  return false
}

async function updateEvent (event, speedLimit) {
  try {
    if (event.event) {
      event = event.event
    }
    if (event.attributes.speedLimit !== speedLimit / 1.852) {
      event.attributes.speedLimit = speedLimit / 1.852
      console.log('updating event id', event, speedLimit / 1.852)
    }
  } catch (e) {
    console.error(e)
  }
}

async function filterNotification (notification, position, user, device, event) {
  try {
    if (notification.attributes.timetable && !notification.attributes.timetable.allWeek) {
      const eventDate = new Date(new Date(position.fixTime).toLocaleString(undefined, { timeZone: user.attributes.timezone }))
      const startDate = new Date(eventDate.toISOString().split('T')[0] + ' ' + notification.attributes.timetable.startTime)
      const endDate = new Date(eventDate.toISOString().split('T')[0] + ' ' + notification.attributes.timetable.endTime)

      if ((eventDate.getDay() === 0 && notification.attributes.timetable.weekDays.sunday) ||
          (eventDate.getDay() === 1 && notification.attributes.timetable.weekDays.monday) ||
          (eventDate.getDay() === 2 && notification.attributes.timetable.weekDays.tuesday) ||
          (eventDate.getDay() === 3 && notification.attributes.timetable.weekDays.wednesday) ||
          (eventDate.getDay() === 4 && notification.attributes.timetable.weekDays.thursday) ||
          (eventDate.getDay() === 5 && notification.attributes.timetable.weekDays.friday) ||
          (eventDate.getDay() === 6 && notification.attributes.timetable.weekDays.saturday)) {
        const result = startDate.getTime() < endDate.getTime()
          ? eventDate.getTime() > startDate.getTime() && eventDate.getTime() < endDate.getTime()
          : eventDate.getTime() < endDate.getTime() || eventDate.getTime() > startDate.getTime()

        console.log(user.email, 'checking if fixTime (utc):', position.fixTime,
          'converted to', user.attributes.timezone, eventDate, 'is between', startDate, 'and', endDate, 'returns', result)
        return result
      }

      return false
    }
    if (event.type === 'deviceOverspeed' && device.attributes.overspeedByRoad) {
      const _aboveSpeedLimit = await aboveSpeedLimit(position, event, device)
      if (_aboveSpeedLimit) {
        await updateEvent(event, await here.getSpeedLimit(position, event))
      }
      return _aboveSpeedLimit
    }
  } catch (e) {
    console.error(user, e)
  }
  return true
}

async function alertActiveForUser (user, { event, position, device, notifications }) {
  for (const a of notifications) {
    if (a.always && alertActive(a, event)) {
      if (await filterNotification(a, position, user, device, event)) {
        return a
      } else {
        console.log('Ignore event notification', a)
        if (event.type === 'deviceOverspeed') {
          event.delete = true
        }
      }
    }
  }
  for (const a of notifications) {
    if (alertActive(a, event)) {
      if (await filterNotification(a, position, user, device, event)) {
        return a
      } else {
        console.log('Ignore event notification', a)
      }
    }
  }

  return false
}

function alertActive (notification, event) {
  const alertActive = notification.type === event.type
  if (notification.type === 'alarm' && notification.attributes.alarms) {
    return alertActive && notification.attributes.alarms.includes(event.attributes.alarm)
  }
  return alertActive
}

exports.processEvent = processEvent
