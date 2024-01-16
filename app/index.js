const { pushEvents } = require('./event')
const { pushPositions } = require('./push')
exports.eventsAndPositionsConsumer = (e, context) => {
  console.log(context, e.Records.length, 'records')
  return Promise.all(e.Records.map(event => event.eventSourceARN === process.env.QUEUE_POSITIONS ? pushPositions(event)
      : pushEvents(event)))
}
