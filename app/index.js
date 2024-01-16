const { pushEvents } = require('./event')
exports.eventsAndPositionsConsumer = (e) => {
  console.log(e.Records, 'records')
  return Promise.all(e.Records.map(event => pushEvents(event)))
}
