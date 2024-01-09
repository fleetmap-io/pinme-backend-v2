const axios = require('axios')
const parser = require('ua-parser-js')

const logException = (e, ...args) => {
  console.error(...args, e.message, e.response && e.response.data, (e.config && e.config.method), (e.config && e.config.url) || e)
}
exports.logException = logException


exports.logError = async (e, req, ...args) => {
  try {
    console.error(
        req.headers['X-Forwarded-For'] && (await this.getCity(req.headers['X-Forwarded-For'].split(',')[0])).region,
        ...args,
        req.httpMethod,
        req.headers.host,
        req.path,
        e.message,
        e.response && e.response.data, (e.config && e.config.url) || e,
    )
  } catch (ex) {
    logException(e, ...args)
  }
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
