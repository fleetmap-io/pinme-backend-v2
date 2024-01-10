const { GetItemCommand, PutItemCommand, DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const dynamo = new DynamoDBClient({ region: 'us-east-1' })
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb')

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
