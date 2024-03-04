const axios = require('axios')
const path = require('path')

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
    (e.response && e.response.data) || e,
    e.config)
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

exports.getFilePath = (fileName) => {
  if (process.env.LAMBDA_TASK_ROOT) {
    return path.resolve(process.env.LAMBDA_TASK_ROOT, fileName)
  } else {
    return path.resolve(__dirname, fileName)
  }
}
