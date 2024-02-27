const axios = require('axios')
const mysql = require('../mysql')

exports.sendSms = (phone, message) => {
  return axios.get(
      `${process.env.SMS_GATEWAY_URL}?token=${process.env.SMS_GATEWAY_TOKEN}&msisdn=${
        phone}&message=${
        encodeURIComponent(message.replaceAll('\'', ' '))}`
  ).then(d => d.data)
}

exports.get = async (phone) => {
  const query = `SELECT * from traccar.sms_sent WHERE gsm = '${phone}'`
  const [result] = await mysql.query(query)
  return result
}

exports.getReceived = async (phone) => {
  const query = `SELECT * from traccar.sms_received WHERE gsm = '${phone}'`
  const [result] = await mysql.query(query)
  return result
}
