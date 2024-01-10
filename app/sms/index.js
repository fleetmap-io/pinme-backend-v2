const axios = require('axios')

exports.sendSms = (phone, message) => {
  return axios.get(
      `https://api.pinme.io/gateway/?token=${process.env.SMS_GATEWAY_TOKEN}&msisdn=${
        phone}&message=${
        encodeURIComponent(message.replaceAll('\'', ' '))}`
  ).then(d => d.data)
}
