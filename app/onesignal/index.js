const axios = require('axios')
const { getOneSignalTokens, getPartnerHost, getPartnerId } = require('fleetmap-partners')
const url = 'https://onesignal.com/api/v1/notifications'

// eslint-disable-next-line camelcase
async function sendOneSignalPush (user, message, title, app, web_url) {
  const data = {
    app_id: app.appId,
    contents: { en: message || title },
    headings: { en: title },
    filters: [{ field: 'email', value: user.email }],
    web_url
  }
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    Authorization: 'Basic ' + app.token
  }
  try {
    await axios.post(url, data, { headers: headers }).then(r => r.data)
  } catch (e) {
    // try using externalid
    console.warn('trying with externalid',
      e.message,
      (e.response && (e.response.data || e.response.status)) || e)
    delete data.filters
    data.include_external_user_ids = [user.id]
    await axios.post(url, data, { headers: headers })
  }
}

const createNotification = async (user, title, message, position) => {
  let partner
  try {
    const lastHost = user.attributes.clientId ? getPartnerHost(getPartnerId(user.attributes.clientId)) : user.attributes.lastHost
    partner = getOneSignalTokens(lastHost)
    const url = position ? `https://${partner.host}/#/map?vehicleName=${title}&date=${new Date(position.fixTime).toISOString()}&user=${user.email}` : ''
    await sendOneSignalPush(user, title, message, partner, url)
  } catch (e) {
    console.error(e.message, user.email, partner && partner.title, (e.config && e.config.url) || e)
  }
}

exports.createNotification = createNotification
