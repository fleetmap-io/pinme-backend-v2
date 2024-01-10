const { GetItemCommand, BatchGetItemCommand, UpdateItemCommand, PutItemCommand, DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const dynamo = new DynamoDBClient({ region: 'us-east-1' })
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb')

exports.batchGet = (TableName, Keys) => {
  const params = {RequestItems: {}}
  params.RequestItems[TableName] = {Keys: Keys.slice(0, 100).map(k => marshall(k))}
  return dynamo.send(new BatchGetItemCommand(params)).then(d => d.Responses[TableName])
}

exports.get = async (item, TableName = 'TraccarUserLogins') => {
  const user = await dynamo.send(new GetItemCommand({
    TableName,
    Key: marshall(item)
  }))
  if (user.Item) { return unmarshall(user.Item) }
  return null
}

exports.put = (item, TableName = 'TraccarUserLogins') => {
  const put = new PutItemCommand({
    TableName,
    Item: marshall(item, { removeUndefinedValues: true, convertClassInstanceToMap: true })
  })
  return dynamo.send(put)
}

exports.putItem = async function (params) {
  return new Promise((resolve, reject) => {
    ddb.putItem(params, function (err, data) {
      if (err) {
        reject(err)
      } else {
        resolve(data)
      }
    })
  })
}

exports.getItem = async function (params) {
  return new Promise((resolve, reject) => {
    ddb.getItem(params, function (err, data) {
      if (err) {
        reject(err)
      } else {
        resolve(data)
      }
    })
  })
}

exports.updateIgnitionOff = (deviceId, ignitionOffDate) => {
  const params = {
    TableName: process.env.DEVICE_IGNITION_OFF_TABLE,
    Key: marshall({deviceId}),
    UpdateExpression: 'set ignitionOffDate = :ignitionOffDate',
    ExpressionAttributeValues: marshall({':ignitionOffDate': ignitionOffDate})
  }
  return dynamo.send(new UpdateItemCommand(params))
}


exports.getDeviceIgnitionOff = (deviceId) => {
  const params = {
    TableName: deviceIgnitionOffTable,
    Key: {
      deviceId
    }
  }

  return docClient.get(params).promise()
}

