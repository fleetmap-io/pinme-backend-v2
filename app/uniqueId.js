const { DeleteItemCommand, UpdateItemCommand, PutItemCommand, DynamoDBClient, ScanCommand } = require('@aws-sdk/client-dynamodb')
const dynamo = new DynamoDBClient({ region: 'us-east-1' })
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb')

exports.get = async (driverIds) => {
  console.log('Get driver uniqueId history', driverIds)
  const values = {}
  const expression = driverIds.map((driverId, index) => {
    values[':driverId' + index] = { N: driverId.toString() }
    return 'driverId = :driverId' + index
  }).join(' or ')

  const data = await dynamo.send(new ScanCommand({
    TableName: 'DriverUniqueIdTimeline',
    FilterExpression: expression,
    ExpressionAttributeValues: values
  }))
  return data.Items.map(i => unmarshall(i))
}

exports.getByCompanyId = async (companyId) => {
  console.log('Get driver uniqueId history by companyid', companyId)
  if (!companyId) return []

  const data = await dynamo.send(new ScanCommand({
      TableName: 'DriverUniqueIdTimeline',
      FilterExpression: 'companyId = :companyId',
      ExpressionAttributeValues: { ':companyId': { N: companyId.toString()  } }
  }))
  const data2 = await dynamo.send(new ScanCommand({
    TableName: 'DriverUniqueIdTimeline',
    FilterExpression: 'companyId = :companyId',
    ExpressionAttributeValues: { ':companyId': { S: companyId.toString()  } }
  }))
  return data.Items.concat(data2.Items).map(i => unmarshall(i))
}

exports.getByCompanyIdAndDates = async (companyId, { from, to }) => {
  console.log('Get driver uniqueId history between dates and by companyid', companyId)
  if (!companyId) return []

  const data = await dynamo.send(new ScanCommand({
    TableName: 'DriverUniqueIdTimeline',
    FilterExpression: 'companyId = :companyId and (endDate > :from or attribute_not_exists(endDate) or endDate = :null) and (startDate < :to or attribute_not_exists(startDate) or startDate = :null)',
    ExpressionAttributeValues: {
      ':companyId': { N: companyId.toString()  },
      ':from': { S: from  },
      ':to': { S: to  },
      ':null': { NULL: true }
    }
  }))
  return data.Items.map(i => unmarshall(i))
}

exports.add = async (uniqueId) => {
  console.log('Add driver uniqueId', uniqueId)
  const put = new PutItemCommand({
    TableName: process.env.DRIVER_UNIQUEID_TABLE,
    Item: marshall(uniqueId, { removeUndefinedValues: true })
  })
  return dynamo.send(put)
}

exports.update = async (id, data) => {
  console.log('Update driver uniqueId', data)
  const update = new UpdateItemCommand({
    TableName: process.env.DRIVER_UNIQUEID_TABLE,
    Key: marshall({ id }),
    UpdateExpression: 'set driverId = :driverId, driverName = :driverName, uniqueId = :uniqueId, startDate = :startDate, endDate = :endDate',
    ExpressionAttributeValues: {
      ':driverId': { N: data.driverId.toString() },
      ':driverName': { S: data.driverName },
      ':uniqueId': { S: data.uniqueId },
      ':startDate': { S: data.startDate },
      ':endDate': { S: data.endDate }
    }
  })
  return dynamo.send(update)
}

exports.delete = async (id) => {
  console.log('Delete id', id)
  const deleteItem = new DeleteItemCommand({
    TableName: process.env.DRIVER_UNIQUEID_TABLE,
    Key: marshall({ id })
  })
  return dynamo.send(deleteItem)
}
