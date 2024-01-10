const { GetItemCommand, PutItemCommand, DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const dynamo = new DynamoDBClient({ region: 'us-east-1' })
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb')
const devicesIgnitionOffTable = 'DevicesIgnitionOff'

exports.get = async (deviceId) => {
  const device = await dynamo.send(new GetItemCommand({
    TableName: devicesIgnitionOffTable,
    Key: marshall({ deviceId })
  }))
  if (device.Item) { return unmarshall(device.Item) }
  return null
}

exports.put = (device) => {
  const put = new PutItemCommand({
    TableName: devicesIgnitionOffTable,
    Item: marshall(device, { removeUndefinedValues: true })
  })
  return dynamo.send(put)
}
