const axios = require('axios')
const mysql = require('../mysql')
const emnify = require('./index')

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

async function getGateway (to) {
  // try gateway_msisdn / partner gateway_mask / general gateway_mask
  try {
    return await mysql.query(`SELECT gateway
                              FROM sms_rule_gateway_msisdn
                              WHERE msisdn = '${to}'
                              LIMIT 1`) ||
        await mysql.query(`SELECT gateway
                           FROM sms_rule_gateway_mask
                           WHERE number_start = LEFT('${to}', LENGTH(number_start))
                             AND number_length = LENGTH('${to}')
                             AND partnerid = (SELECT partnerid FROM tc_devices WHERE phone = '${to}' LIMIT 1)
                           LIMIT 1`) ||
        await mysql.query(`SELECT gateway
                           FROM sms_rule_gateway_mask
                           WHERE number_start = LEFT('${to}', LENGTH(number_start))
                             AND number_length = LENGTH('${to}')
                             AND partnerid IS NULL
                           LIMIT 1`)
  } catch (e) {
    console.error(e)
  }
}

exports.getReceived = async (phone) => {
  const gateway = await getGateway(phone)
  switch (gateway && gateway.name) {
    case 'emnify':
      return emnify.getReceived(gateway, phone)
    default:
      return [await mysql.query(`SELECT * from traccar.sms_received WHERE gsm = '${phone}'`)]
  }
}
