const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs')
const { get } = require('./dynamo')
const sqsClient = new SQSClient({ region: 'us-east-1' })

exports.sendReport = async (req) => {
  // const user = await new SessionApi(apiConfig).sessionGet(null, {headers: {cookie: req.header('cookie')}}).then(d => d.data)
  const id = req.params.id
  const { Item } = await get({ id }, 'scheduler-1')
  console.log('data', Item)
  sqsClient.send(new SendMessageCommand({
    MessageBody: JSON.stringify({ userId: Item.userId, items: [Item] }),
    QueueUrl: process.env.REPORTS_QUEUE1
  }))
}
