const notifications = require('../event/notifications')
const secrets = require('../secrets')
const here = require('../api/here')
const messages = require('../lang')
let _axios

function axiosReady () {
  if (!_axios) {
    _axios = secrets.getSecretValue('whatsapp').then(s =>
      require('axios').create({
        headers: { Authorization: 'Bearer ' + s.WHATSAPP_TOKEN },
        baseURL: `https://graph.facebook.com/v13.0/${s.WHATSAPP_PNI}/messages`
      }))
  }
}

function getLanguageCode (user) {
  return (user.attributes.lang && user.attributes.lang
    .replace('-', '_')
    .replace('pt_PT', 'pt_BR')
    .replace('es_CL', 'ES')
    .replace('fr_FR', 'FR')) ||
      'pt_BR'
}

function getEventTitle (user, event) {
  const lang = user.attributes.lang
  const alarmType = event.event.type === 'alarm' ? event.event.attributes.alarm : event.event.type
  return `${messages[lang] && messages[lang].layout && messages[lang].layout[alarmType]
      ? messages[lang].layout[alarmType]
      : alarmType}`
}
const geofenceAlert = async (user, event) => {
  const code = getLanguageCode(user)
  const body = {
    messaging_product: 'whatsapp',
    to: user.phone.replace('+', ''),
    type: 'template',
    template: {
      name: code === 'FR' ? whatsappTemplates[event.event.type].replace('4', '5') : whatsappTemplates[event.event.type],
      language: {
        code
      },
      components: [{
        type: 'body',
        parameters: [
          { type: 'text', text: event.device.name },
          { type: 'text', text: event.geofence.name },
          { type: 'text', text: notifications.getMoment(event, user, 'HH:mm') || '.' }
        ]
      },
      {
        type: 'header',
        parameters: [{
          type: 'location',
          location: {
            longitude: event.position.longitude,
            latitude: event.position.latitude,
            name: event.device.name,
            address: event.position.address
          }
        }]
      }]
    }
  }
  console.dir(body, { depth: null })
  axiosReady()
  return (await _axios).post('/', body)
}

const genericAlert = async (user, event) => {
  const code = getLanguageCode(user)
  const name = (event.device.name && event.device.name.replaceAll('*', '')) ||
      event.device.attributes.license_plate
  const body = {
    messaging_product: 'whatsapp',
    to: user.phone.replace('+', ''),
    type: 'template',
    template: {
      name: 'platform_events9',
      language: {
        code
      },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: getEventTitle(user, event) },
            { type: 'text', text: notifications.getMoment(event, user, 'HH:mm') || '.' }
          ]
        },
        {
          type: 'header',
          parameters: [{
            type: 'location',
            location: {
              longitude: event.position.longitude,
              latitude: event.position.latitude,
              name,
              address: event.position.address
            }
          }]
        }
      ]
    }
  }
  console.dir(body, { depth: null })
  axiosReady()
  return (await _axios).post('/', body)
}

const events = {
  deviceOverspeed: async (user, event) => {
    let speed = 0
    let speedLimit = 0
    if (event.event.attributes.speed) {
      try {
        speed = Math.round(event.event.attributes.speed * 1.852)
        speedLimit = event.device.attributes.overspeedByRoad
          ? await here.getSpeedLimit(event.position, event.event)
          : Math.round(event.event.attributes.speedLimit * 1.852)
      } catch (e) {
        console.error(e)
      }
    }
    const code = getLanguageCode(user)
    const body = {
      messaging_product: 'whatsapp',
      to: user.phone.replace('+', ''),
      type: 'template',
      template: {
        name: 'platform_speed_alert',
        language: {
          code
        },
        components: [{
          type: 'body',
          parameters: [
            { type: 'text', text: event.device.name },
            { type: 'text', text: speed + '' },
            { type: 'text', text: event.position.address || '.' },
            { type: 'text', text: notifications.getMoment(event, user, 'HH:mm') || '.' },
            { type: 'text', text: speedLimit + '.' }
          ]
        }]
      }
    }
    console.log(body)
    axiosReady()
    return (await _axios).post('/', body)
  },
  geofenceExit: geofenceAlert,
  geofenceEnter: genericAlert,
  deviceOffline: genericAlert,
  ignitionOn: genericAlert
}

const whatsappTemplates = {
  geofenceExit: 'platform_geofence_exit4',
  geofenceEnter: 'platform_geofence_enter2'
}

async function sendWhatsapp (event, user, retries = 2) {
  user.phone = user.phone.replace(/[+\s-]/g, '')
  try {
    if (events[event.event.type]) {
      await events[event.event.type](user, event)
    } else {
      await genericAlert(user, event)
    }
  } catch (e) {
    if (--retries) {
      if (e.response && e.response.status === 400) {
        if (user.email.endsWith('.com.br') && !user.phone.replace('+', '').startsWith('55')) {
          user.phone = '55' + user.phone.replace('+', '')
        }
        if (user.email.endsWith('.es') && !user.phone.replace('+', '').startsWith('34')) {
          user.phone = '34' + user.phone.replace('+', '')
        }
        if (e.response.data && e.response.data.error && e.response.data.error.code === 131009) {
          console.warn('invalid whatsapp number', user.email, user.phone)
          return
        }
      }
      await sendWhatsapp(event, user, retries)
    } else {
      console.error('whatsapp', user.email, user.phone, event.event.type, event.device.name,
        e.message, e.response && e.response.data && e.response.data.error)
    }
  }
}

exports.send = async (user, event) => {
  if (!user.phone) {
    console.warn('no phone on', user.email, 'ignoring')
    return
  }
  await sendWhatsapp(event, user)
}

async function sendSlack (m, value) {
  const from = `${m.from} -> ${value.contacts[0].profile.name}`
  switch (m.type) {
    case 'text':
      await sendText(from, m.text.body)
      break
    case 'image':
      await sendImage(from, await exports.getMediaUrl(m.image.id, m.image.mime_type))
      break
    case 'audio':
      await sendText(from, await exports.getMediaUrl(m.audio.id, m.audio.mime_type))
      break
    default:
      console.error('ignoring', m)
  }
}

async function sendMessages (value) {
  for (const m of value.messages) {
    await sendSlack(m, value)
    await setDoc(m, value.metadata.display_phone_number, m.from, 'messages', m.id)
  }
}

async function updateContacs (value) {
  for (const c of value.contacts) {
    await setDoc({ ...c.profile, wa_id: c.wa_id }, value.metadata.display_phone_number, c.wa_id)
  }
}

exports.whatsapp = async (e) => {
  try {
    const body = JSON.parse(e.body)
    for (const e of body.entry) {
      for (const { value } of e.changes) {
        console.log(value)
        if (value.statuses) {
          value.statuses.forEach(s => s.errors && console.log(s.errors))
        }
        // if (value.contacts) { value.contacts.forEach(s => console.log(s)) }
        if (value.messages) { await sendMessages(value) }
        if (value.contacts) { await updateContacs(value) }
      }
    }
  } catch (e) {
    console.error(e)
  }
  return { statusCode: 200 }
}

// eslint-disable-next-line camelcase
async function sendText (from, text, image_url) {
  const blocks = {
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${from}\n>${text || ''}`,
          // eslint-disable-next-line camelcase
          ...(image_url ? { attachments: [{ image_url }] } : {})
        }
      }
    ]
  }
  console.log(blocks, await require('axios').post(process.env.SLACK_WEB_HOOK, blocks).then(d => d.data))
}
exports.sendText = sendText
const s3 = require('../s3')
const { setDoc } = require('../firebase')

async function getWhatsApp () {
  // TODO:
}

exports.getMediaUrl = async (id, mimeType) => {
  const axios = await getWhatsApp()
  const imageData = await axios.get('/' + id).then(d => d.data)
  const image = await axios.get(imageData.url, { responseType: 'arraybuffer' }).then(d => d.data)
  await s3.put(id, image, mimeType, false)
  return `${process.env.CLOUDFRONT_URL}/${id}`
}

// eslint-disable-next-line camelcase
async function sendImage (from, image_url) {
  const blocks = {
    blocks: [
      {
        type: 'image',
        title: {
          type: 'plain_text',
          text: from
        },
        // eslint-disable-next-line camelcase
        image_url,
        alt_text: 'image'
      }
    ]
  }
  await require('axios').post(process.env.SLACK_WEB_HOOK, blocks).then(d => d.data)
}
exports.sendImage = sendImage

// eslint-disable-next-line camelcase
async function sendVideo (from, url) {
  const blocks = {
    blocks: [
      {
        title: {
          type: 'plain_text',
          text: from
        },
        // eslint-disable-next-line camelcase
        video_url: url,
        thumbnail_url: url,
        alt_text: 'video'
      }
    ]
  }
  await require('axios').post(process.env.SLACK_WEB_HOOK, blocks).then(d => d.data)
}
exports.sendVideo = sendVideo
