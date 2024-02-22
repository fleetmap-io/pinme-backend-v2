const { getPositions } = require('./api/traccar')

exports.get = async (body) => {
  console.log('Positions', body)
  return getPositions(body)
}
