const { GetQueryResultsCommand } = require('@aws-sdk/client-cloudwatch-logs')
const { StartQueryCommand } = require('@aws-sdk/client-cloudwatch-logs')
const { CloudWatchLogsClient, DescribeSubscriptionFiltersCommand, PutSubscriptionFilterCommand, DeleteSubscriptionFilterCommand } = require('@aws-sdk/client-cloudwatch-logs')
const cwlClient = new CloudWatchLogsClient({ region: 'us-east-1' })
const { CloudWatchClient, GetMetricWidgetImageCommand } = require('@aws-sdk/client-cloudwatch')
const cwClient = new CloudWatchClient({ region: 'us-east-1' })
const users = require('./users')

function getWidget1Metrics (dbUser) {
  return [
    ['DBMetrics', '0', 'delay', '0', 'partnerid', dbUser.partnerid + '', { label: '0' }],
    ['.', '5', '.', '5', '.', '.', { label: '5' }],
    ['.', '10', '.', '10', '.', '.', { label: '10' }],
    ['.', '15', '.', '15', '.', '.', { label: '15' }],
    ['.', '20', '.', '20', '.', '.', { label: '20' }],
    ['.', '25', '.', '25', '.', '.', { label: '25' }],
    ['.', '30', '.', '30', '.', '.', { label: '30' }],
    ['.', '35', '.', '35', '.', '.', { label: '35' }],
    ['.', '40', '.', '40', '.', '.', { label: '40' }],
    ['.', '45', '.', '45', '.', '.', { label: '45' }],
    ['.', '50', '.', '50', '.', '.', { label: '50' }],
    ['.', '55', '.', '55', '.', '.', { label: '55' }],
    ['.', '60', '.', '60', '.', '.', { label: '60' }],
    ['.', 'null', '.', 'null', '.', '.']
  ]
}
function getWidget2Metrics (dbUser) {
  return [
    ['DBMetrics', '0', 'delay', '0', 'partnerid', dbUser.partnerid + '', { label: '0' }],
    ['.', '5', '.', '5', '.', '.', { label: '5' }],
    ['.', '10', '.', '10', '.', '.', { label: '10' }],
    ['.', '15', '.', '15', '.', '.', { label: '15' }],
    ['.', '20', '.', '20', '.', '.', { label: '20' }],
    ['.', '25', '.', '25', '.', '.', { label: '25' }],
    ['.', '30', '.', '30', '.', '.', { label: '30' }],
    ['.', '35', '.', '35', '.', '.', { label: '35' }],
    ['.', '40', '.', '40', '.', '.', { label: '40' }],
    ['.', '45', '.', '45', '.', '.', { label: '45' }],
    ['.', '50', '.', '50', '.', '.', { label: '50' }],
    ['.', '55', '.', '55', '.', '.', { label: '55' }],
    ['.', '60', '.', '60', '.', '.', { label: '60' }],
    ['.', 'null', '.', 'null', '.', '.']
  ]
}

exports.getWidget = async (user, dates, widget2) => {
  const [dbUser] = await users.getUser(user)
  console.log('user', user, 'dbuser', dbUser)
  const widget = {
    MetricWidget: JSON.stringify({
      metrics: widget2 ? getWidget2Metrics(dbUser) : getWidget1Metrics(dbUser),
      view: 'timeSeries',
      stacked: true,
      region: 'us-east-1',
      period: 300,
      title: 'Delay',
      stat: 'Average',
      width: 1150,
      height: 400,
      start: dates[0] || '-PT6H',
      end: dates[1] || 'P0D'
    })
  }

  const command = new GetMetricWidgetImageCommand(widget)
  console.log('widget', widget)
  const result = await cwClient.send(command)
  console.log('result', result)
  const b64 = Buffer.from(result.MetricWidgetImage).toString('base64')
  console.log('b64', b64)
  return { b64 }
}

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

exports.post = async (device, logGroupName = '/aws/lambda/pinme-backend-ProcessLocationsQueue-zP9J0B6u7WGk') => {
  console.log(device)
  return await startQuery(logGroupName, device)
}
