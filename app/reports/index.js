const s3 = require('../s3')
const automaticReport = require('./automaticReports')
const { getAllSchedules } = require('../api/dynamo')
const { sendMessage } = require('./automaticReports')

exports.getReport = async (report, traccar, { from, to, userData }) => {
  console.log('getReport', report, new Date(from), to, userData)
  const key = report + '_' + new Date().getTime()
  let body
  switch (report) {
    case 'zone-report':
      body = await require('fleetmap-reports/src/zone-report').createZoneReport(new Date(from), new Date(to), userData, traccar)
      break
    case 'activity-report':
      body = await require('fleetmap-reports/src/activity-report').createActivityReport(new Date(from), new Date(to), userData, traccar)
      break
    case 'kms-report':
      body = await require('fleetmap-reports/src/kms-report').createKmsReport(new Date(from), new Date(to), userData, traccar)
      break
    default:
  }
  await s3.put(key, JSON.stringify(body))
  return `${process.env.CLOUDFRONT_URL}/${key}`
}

exports.consumeMessage = async (e) => {
  for (const r of e.Records) {
    console.log('processing', r)
    const reportData = JSON.parse(r.body)
    if (reportData.userId) {
      if (r.eventSourceARN.substring(r.eventSourceARN.lastIndexOf(':') + 1) ===
          process.env.REPORTS_QUEUE_DLQ.substring(process.env.REPORTS_QUEUE_DLQ.lastIndexOf('/') + 1)) {
        await automaticReport.splitMessage(reportData.items[0], reportData.userId, 'splitted by timeout')
      } else {
        await automaticReport.processUserSchedules(reportData)
      }
    } else {
      const { report, cookie, params, ingestionId } = reportData
      const _report = require('../partnerReports/' + report)
      if (report) {
        await _report.ingestReport(params, ingestionId, cookie)
      }
    }
  }
}

exports.sendSchedulerReports = async (e) => {
  const items = await getAllSchedules()
  const users = [...new Set(items.map(i => i.userId))]
  const filterClientId = e.filterClientId
  console.log('Total users', users.length, filterClientId)
  for (const userId of users) {
    try {
      const reportsToProcess = items.filter(i => i.userId === userId)
      console.log('sending', reportsToProcess.length, 'reports for user', userId)
      for (const item of reportsToProcess) {
        await sendMessage(userId, [item], filterClientId)
      }
    } catch (e) {
      console.error('sendSchedulerReports', e, 'moving on')
    }
  }
}
