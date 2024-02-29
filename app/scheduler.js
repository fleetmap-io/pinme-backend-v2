const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs')
const dynamo = require('./dynamo')
const sqsClient = new SQSClient({ region: 'us-east-1' })

exports.sendReport = async (req) => {
  // const user = await new SessionApi(apiConfig).sessionGet(null, {headers: {cookie: req.header('cookie')}}).then(d => d.data)
  const id = req.params.id
  const item = await dynamo.get({ id }, 'scheduler-1')
  console.log('data', item)
  sqsClient.send(new SendMessageCommand({
    MessageBody: JSON.stringify({ userId: item.userId, items: [item] }),
    QueueUrl: process.env.REPORTS_QUEUE1
  }))
}
