const { pushEvents } = require('./event')
exports.eventsAndPositionsConsumer = (e) => {
  console.log(e, e.Records.length, 'records')
  return Promise.all(e.Records.map(event => pushEvents(event)))
}
