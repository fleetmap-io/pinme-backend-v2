const { getPositions } = require('./api/traccar')

exports.get = async (body) => {
  return await getPositions(body)
}
