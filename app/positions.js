const { getPositions } = require('./api/traccar')

exports.get = async (body) => {
  return getPositions(body)
}
