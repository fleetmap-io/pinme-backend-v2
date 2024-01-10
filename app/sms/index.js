const axios = require('axios')

exports.sendSms = (phone, message) => {
  return axios.get(
      `https://api.pinme.io/gateway/?token=uCQ3HxR5d87gvSRIPcjm&msisdn=${
        phone}&message=${
        encodeURIComponent(message.replaceAll('\'', ' '))}`
  ).then(d => d.data)
}
