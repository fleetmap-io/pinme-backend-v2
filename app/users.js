const { GetItemCommand, PutItemCommand, DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const dynamo = new DynamoDBClient({ region: 'us-east-1' })
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb')
const secrets = require("./secrets");
const {UsersApi} = require("traccar-api");
const TableName = process.env.USERS

exports.get = async (email) => {
  const user = await dynamo.send(new GetItemCommand({
    TableName,
    Key: marshall({ user: email })
  }))
  if (user.Item) { return unmarshall(user.Item) }
  return null
}

exports.put = (user) => {
  const put = new PutItemCommand({
    TableName,
    Item: marshall(user, { removeUndefinedValues: true })
  })
  return dynamo.send(put)
}

exports.getTraccarUser = async (userId)  => {
  const auth = await secrets.getSecret('traccar')
  auth.username = auth.user
  return new UsersApi({
    basePath: 'https://api.pinme.io/api'
  }).usersGet(userId, {auth}).then(d => d.data)
}
