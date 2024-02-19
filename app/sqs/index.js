const { SendMessageCommand } = require('@aws-sdk/client-sqs')
const { SQSClient } = require('@aws-sdk/client-sqs')
const sqsClient = new SQSClient({ region: 'us-east-1' })

exports.send = (MessageBody, QueueUrl) => {
  return sqsClient.send(new SendMessageCommand({
    MessageBody,
    QueueUrl
  }))
}
