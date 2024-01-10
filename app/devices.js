const { GetItemCommand, PutItemCommand, DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const dynamo = new DynamoDBClient({ region: 'us-east-1' })
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb')

exports.get = async (deviceId) => {
  const device = await dynamo.send(new GetItemCommand({
    TableName: process.env.DEVICE_IGNITION_OFF_TABLE,
    Key: marshall({ deviceId })
  }))
  if (device.Item) { return unmarshall(device.Item) }
  return null
}

exports.put = (device) => {
  const put = new PutItemCommand({
    TableName: process.env.DEVICE_IGNITION_OFF_TABLE,
    Item: marshall(device, { removeUndefinedValues: true })
  })
  return dynamo.send(put)
}
