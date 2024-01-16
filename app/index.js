const { pushEvents } = require('./event')
const { pushPositions } = require('./push')
exports.eventsAndPositionsConsumer = (e) => {
  console.log(e.Records.length, 'records')
  return Promise.all(e.Records.map(event => event.eventSourceARN === process.env.QUEUE_LOCATIONS_ARN
      ? pushPositions(event)
      : pushEvents(event)))
}
