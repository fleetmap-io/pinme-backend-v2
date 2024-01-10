const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs')
const sqsClient = new SQSClient({ region: 'us-east-1' })
const dynamodb = require('aws-sdk/clients/dynamodb')
const docClient = new dynamodb.DocumentClient()

exports.sendReport = async (req) => {
  // const user = await new SessionApi(apiConfig).sessionGet(null, {headers: {cookie: req.header('cookie')}}).then(d => d.data)
  const id = req.params.id
  const params = {
    TableName: 'scheduler-1',
    Key: { id }
  }
  const { Item } = await docClient.get(params).promise()
  console.log('data', Item)
  sqsClient.send(new SendMessageCommand({
    MessageBody: JSON.stringify({ userId: Item.userId, items: [Item] }),
    QueueUrl: process.env.REPORTS_QUEUE1
  }))
}
