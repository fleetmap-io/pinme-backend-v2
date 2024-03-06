const { GetItemCommand, PutItemCommand, UpdateItemCommand, DeleteItemCommand, DynamoDBClient } = require('@aws-sdk/client-dynamodb')
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

exports.getSchedules = async (user) => {
  const next = new Date(Date.now())
  next.setUTCHours(23, 59, 59, 59)
  const last = new Date(Date.now())
  last.setUTCHours(0, 0, 0, 0)
  const params = {
    TableName: schedulerTable,
    FilterExpression: 'userId = :userId and (lastExecutionDate < :lastExecutionDate or attribute_not_exists(lastExecutionDate) or lastExecutionDate = :emptyLastExecutionDate) and (nextExecution <= :nextExecution or attribute_not_exists(nextExecution) or nextExecution = :nullNextExecution)',
    ExpressionAttributeValues: {
      ':userId': user.id,
      ':nextExecution': next.toISOString(),
      ':nullNextExecution': null,
      ':lastExecutionDate': last.toISOString(),
      ':emptyLastExecutionDate': ''
    }
  }
  return await scan(params)
}

async function scan (params) {
  let lastEvaluatedKey = null
  let result = []
  do {
    if (lastEvaluatedKey) {
      params.ExclusiveStartKey = lastEvaluatedKey
    }
    const data = await scan(params).promise()
    result = result.concat(data.Items)
    lastEvaluatedKey = data.LastEvaluatedKey
  } while (lastEvaluatedKey)
  return result
}

exports.getAllSchedules = async () => {
  const next = new Date(Date.now())
  next.setUTCHours(23, 59, 59, 59)
  const last = new Date(Date.now())
  last.setUTCHours(0, 0, 0, 0)
  const params = {
    TableName: schedulerTable,
    FilterExpression: '(lastExecutionDate < :lastExecutionDate or attribute_not_exists(lastExecutionDate) or lastExecutionDate = :emptyLastExecutionDate) and (nextExecution <= :nextExecution or attribute_not_exists(nextExecution) or nextExecution = :nullNextExecution)',
    ExpressionAttributeValues: {
      ':lastExecutionDate': last.toISOString(),
      ':emptyLastExecutionDate': '',
      ':nextExecution': next.toISOString(),
      ':nullNextExecution': null
    }
  }
  return await scan(params)
}

exports.updateSchedule = async (id, userId, nextExecutionDate) => {
  console.log('Update nextExecutionDate', id, userId, nextExecutionDate)
  const update = new UpdateItemCommand({
    TableName: schedulerTable,
    Key: { id },
    UpdateExpression: 'set lastExecutionDate = :lastExecutionDate, nextExecution = :nextExecution',
    ConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {
      ':userId': userId,
      ':lastExecutionDate': new Date(Date.now()).toISOString(),
      ':nextExecution': nextExecutionDate.toISOString()
    }
  })

  await dynamo.send(update)
}

exports.deleteSchedule = async (id) => {
  console.log('deleteSchedule', id)
  const deleteCommand = new DeleteItemCommand({
    TableName: schedulerTable,
    Key: { id }
  })
  await dynamo.send(deleteCommand)
}
