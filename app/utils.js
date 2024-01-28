const axios = require('axios')

function _logException (e, req, ...args) {
  console.error(
    req && req.headers && req.headers.host,
    req && req.method,
    req && req.path
  )
  logError(e, ...args)
}

function logError (e, ...args) {
  console.error(
    e.message,
    ...args,
    e.response && e.response.data,
    (e.config && e.config.url) || e)
}

exports.logException = async (e, req, ...args) => {
  let city = req && req.headers && req.headers['X-Forwarded-For']
  if (city) {
    try {
      city = await this.getCity(req.headers['X-Forwarded-For'].split(',')[0]).region
      _logException(e, req, ...args, city)
    } catch (ex) {
      console.error(ex)
    }
  } else { logError(e, ...args) }
}

exports.getCity = (ip) => {
  return axios.get(`https://ipinfo.io/${ip}?token=${process.env.IPINFO_TOKEN}`, { timeout: 1000 }).then(d => d.data)
}
