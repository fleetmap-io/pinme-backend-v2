const { pushEvents } = require('./event')
exports.eventsAndPositionsConsumer = (e, context) => {
  console.log(context, e.Records.length, 'records')
  return Promise.all(e.Records.map(event => pushEvents(event)))
}
