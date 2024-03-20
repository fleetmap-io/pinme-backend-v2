const { GetItemCommand, PutItemCommand, UpdateItemCommand, DeleteItemCommand, DynamoDBClient, ScanCommand } = require('@aws-sdk/client-dynamodb')
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb')
const dynamo = new DynamoDBClient({ region: 'us-east-1' })
const schedulerTable = 'scheduler-1'

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

exports.getAllSchedules = async () => {
  const next = new Date(Date.now())
  next.setUTCHours(23, 59, 59, 59)
  const last = new Date(Date.now())
  last.setUTCHours(0, 0, 0, 0)
  const expression = '(lastExecutionDate < :lastExecutionDate or attribute_not_exists(lastExecutionDate) or lastExecutionDate = :emptyLastExecutionDate) and (nextExecution <= :nextExecution or attribute_not_exists(nextExecution) or nextExecution = :nullNextExecution)'
  const values = {
    ':lastExecutionDate': marshall(last.toISOString()),
    ':emptyLastExecutionDate': '',
    ':nextExecution': marshall(next.toISOString()),
    ':nullNextExecution': null
  }
  const data = await dynamo.send(new ScanCommand({
    TableName: schedulerTable,
    FilterExpression: expression,
    ExpressionAttributeValues: values
  }))
  return data.Items.map(i => unmarshall(i))
}

exports.updateSchedule = async (id, userId, nextExecutionDate) => {
  console.log('Update nextExecutionDate', id, userId, nextExecutionDate)
  const update = new UpdateItemCommand({
    TableName: schedulerTable,
    Key: marshall({ id }),
    UpdateExpression: 'set lastExecutionDate = :lastExecutionDate, nextExecution = :nextExecution',
    ConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {
      ':userId': { N: userId.toString() },
      ':lastExecutionDate': { S: new Date(Date.now()).toISOString() },
      ':nextExecution': { S: nextExecutionDate.toISOString() }
    }
  })

  await dynamo.send(update)
}

exports.deleteSchedule = async (id) => {
  console.log('deleteSchedule', id)
  const deleteCommand = new DeleteItemCommand({
    TableName: schedulerTable,
    Key: marshall({ id })
  })
  await dynamo.send(deleteCommand)
}
