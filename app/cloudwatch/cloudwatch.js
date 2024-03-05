const { GetQueryResultsCommand } = require('@aws-sdk/client-cloudwatch-logs')
const { StartQueryCommand } = require('@aws-sdk/client-cloudwatch-logs')
const { CloudWatchLogsClient, DescribeSubscriptionFiltersCommand, PutSubscriptionFilterCommand, DeleteSubscriptionFilterCommand } = require('@aws-sdk/client-cloudwatch-logs')
const cwlClient = new CloudWatchLogsClient({ region: 'us-east-1' })

exports.describe = async (logGroupName) => {
  const { subscriptionFilters } = await cwlClient.send(new DescribeSubscriptionFiltersCommand({ logGroupName }))
  return subscriptionFilters
}

exports.put = async (destinationArn, filterName, filterPattern, logGroupName) => {
  return cwlClient.send(new PutSubscriptionFilterCommand({
    destinationArn,
    filterName,
    logGroupName,
    filterPattern
  }))
}

exports.delete = async (filterName, logGroupName) => {
  return cwlClient.send(new DeleteSubscriptionFilterCommand({
    filterName,
    logGroupName
  }))
}

const startQuery = async (logGroupName, device) => {
  return await cwlClient.send(new StartQueryCommand({
    logGroupName,
    limit: 50,
    startTime: Math.round(new Date().setHours(new Date().getHours() - 24) / 1000),
    endTime: Math.round(new Date().getTime() / 1000),
    queryString: `fields @timestamp, @message
                  | filter @message like /${device}/ or @message like /${device.replace('-', '')}/`
  })).then(d => d.queryId)
}
exports.startQuery = startQuery

const getQueryResults = async (queryId) => {
  return cwlClient.send(new GetQueryResultsCommand({
    queryId
  }))
}
exports.getQueryResults = getQueryResults

exports.logsReceiver = async (e) => {
  console.log(e)
}

exports.get = async (query) => {
  console.log(query)
  return await getQueryResults(query)
}

exports.post = async (device, logGroupName = '/aws/lambda/pinme-backend-event-and-locations-consumer') => {
  console.log(device)
  return await startQuery(logGroupName, device)
}
