const axios = require('axios')
const parser = require('ua-parser-js')

function _logException (e, req, ...args) {
  console.error(
    req && req.headers && req.headers.host,
    req && req.method,
    req && req.path,
    e.message,
    ...args,
    e.response && e.response.data,
    (e.config && e.config.url) || e)
}

exports.logException = async (e, req, ...args) => {
  let city
  try {
    city = req && req.headers && req.headers['X-Forwarded-For'] &&
      (await this.getCity(req.headers['X-Forwarded-For'].split(',')[0])).region
  } catch (ex) { console.error(ex) }
  _logException(e, req, ...args, city)
}

exports.getCity = (ip) => {
  return axios.get(`https://ipinfo.io/${ip}?token=${process.env.IPINFO_TOKEN}`, { timeout: 1000 }).then(d => d.data)
}

exports.logRequest = async (event) => {
  try {
    const city = await this.getCity(event.headers['x-forwarded-for'].split(',')[0])
    const device = parser(event.headers['user-agent']).device
    console.log(device, city)
  } catch (e) {
    console.log(e.message, 'headers', event.headers, 'query', event.queryStringParameters)
  }
}
