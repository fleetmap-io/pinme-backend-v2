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
    (e.response && e.response.data) || (e.response && e.response.config && e.response.config.url) || e,
    (e.response && e.response.config && e.response.config.data))
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

exports.camelCaseToKebabCase = (str) => {
  return str.split('').map((letter, idx) => {
    return letter.toUpperCase() === letter
      ? `${idx !== 0 ? '-' : ''}${letter.toLowerCase()}`
      : letter
  }).join('')
}

exports.processRequest = async (method, res, ...args) => {
  try {
    res.json(await method(...args))
  } catch (e) {
    logAndSendError(e, res)
  }
}

const logAndSendError = (err, res) => {
  console.error(res.locals.user, err.message, (err.response && err.response.data) || err, (err.config && err.config.url) || err)
  res.status(500).send(err.message)
}
exports.logAndSendError = logAndSendError
