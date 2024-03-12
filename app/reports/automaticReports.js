const Vue = require('vue')
const renderer = require('vue-server-renderer')
const secrets = require('../secrets')
const MJML = require('mjml')
const { getFilePath, logException, camelCaseToKebabCase } = require('../utils')
const dynamo = require('../api/dynamo')
const traccar = require('../api/traccar')
const { getUserSession } = require('../auth')
const { SendMessageCommand, SQSClient } = require('@aws-sdk/client-sqs')
const { validateEmail, emailWithAttachment } = require('../email/email')
const xlsx = require('json-as-xlsx')
const fs = require('fs')
const { getUserPartner } = require('fleetmap-partners')
const sqsClient = new SQSClient({ region: 'us-east-1' })
const messages = require('../lang')
const bcc = ['reports.fleetmap@gmail.com']
const senderEmail = 'no-reply@gpsmanager.io'
const automaticReportSendMetric = 'AutomaticReportSend'
const automaticReportErrorMetric = 'AutomaticReportError'
const apiUrl = 'https://api2.pinme.io/api'
const FleetmapReports = require('fleetmap-reports')
const { putMetricData } = require('../cloudwatch')
const config = {
  basePath: apiUrl,
  baseOptions: {
    withCredentials: true
  }
}

const maxLocationReportRows = 40000
async function processUserSchedules ({ userId, items, filterClientId }) {
  const { hereSpeedLimits } = await secrets.getSecretValue('hereSpeedLimits')
  process.env.HERE_API_KEY = hereSpeedLimits
  const reportsToProcess = items
  let user
  try {
    user = await traccar.getUser(userId)
    if (filterClientId && user.attributes.clientId !== filterClientId) {
      console.log('ignoring', user.id, user.attributes.clientId, filterClientId)
      return
    }
  } catch (e) {
    if (e.response && e.response.status === 404) {
      for (const report of reportsToProcess) {
        console.log('delete scheduler item', userId, report.id)
        await dynamo.deleteSchedule(report.id)
      }
    } else { await logException(e, 'processUserSchedules, userId:', userId) }
    return
  }
  if (user.disabled) {
    console.log('disabled user', userId)
    for (const report of reportsToProcess) {
      await dynamo.updateSchedule(report.id, user.id, calculateNextExecution(report.periodicity))
    }
  } else {
    if (reportsToProcess.length > 0) {
      const response = await traccar.getDevicesByUserId(user.id)
      const devices = response.filter(d => !d.disabled)
      const groups = await traccar.getGroups(user.id)
      const drivers = await traccar.getDrivers(user.id)

      devices.forEach(d => {
        const group = groups.find(g => g.id === d.groupId)
        if (group) {
          d.groupName = group.name
        }
      })

      const userData = {
        user,
        devices,
        groups,
        drivers
      }

      for (const report of reportsToProcess) {
        try {
          console.log('processUserSchedules', userId, user.email, report.name, report.reportType)
          const [cookie] = await getUserSession(user.email)
          console.log('cookie', cookie)
          require('axios').defaults.headers.get.cookie = cookie
          const rows = await createReport(report, userData)
          if (rows.length > 0) {
            const reportData = rows[0]
            if ((reportData.devices && reportData.devices.length > 0) ||
                                (reportData.drivers && reportData.drivers.length > 0)) {
              if (report.reportType === 'LocationReport') {
                // Check report size
                const totalRows = reportData.devices.reduce((a, b) => a + b.positions.length, 0)
                console.log('totalRows', totalRows)
                if (totalRows > maxLocationReportRows && reportData.devices.length > 1) {
                  await splitMessage(report, userId)
                  continue
                }
              }
              await processReport(report, reportData, { ...report, ...userData })
            } else {
              console.log('Empty Report')
            }
          } else {
            console.log('Empty Report')
          }
          await dynamo.updateSchedule(report.id, user.id, calculateNextExecution(report.periodicity))
        } catch (error) {
          if (canSplit(error)) {
            await splitMessage(report, user.id, error.message)
          } else {
            console.warn(error.message, 'automaticReport', report && report.reportType)
            throw error
          }
          await putReportMetricData(automaticReportErrorMetric)
        }
      }
    }
  }
}

async function createReport (report, userData) {
  const { from, to } = getReportDates(report.nextExecution, report.periodicity, userData.user.attributes.timezone)
  console.log('dates', from, to)
  const geofences = await traccar.getGeofences(userData.user.id)

  const reportDevices = (report.devices || report.groups)
    ? userData.devices.filter(d => (report.devices && report.devices.includes(d.id)) || (report.groups && report.groups.includes(d.groupId)))
    : userData.devices

  const reportDrivers = report.byDriver ? userData.drivers.filter(d => report.drivers && report.drivers.includes(d.id)) : userData.drivers

  const reportData = { ...userData, ...report }

  reportData.byGroup = report.byGroup || false
  reportData.devices = reportDevices
  reportData.drivers = reportDrivers
  reportData.geofences = report.geofences && report.geofences.length > 0 ? geofences.filter(g => report.geofences.includes(g.id)) : geofences

  const fleetmapReport = require('fleetmap-reports/src/' + camelCaseToKebabCase(report.reportType))
  if (fleetmapReport) {
    const Reports = new FleetmapReports(config, require('axios').create({ ...config.baseOptions, baseURL: config.basePath }))
    return fleetmapReport.create(from, to, reportData, Reports.traccar)
  }

  console.log('Unkown ReportType ' + report.reportType)
  return []
}

function getReportDates (nextExecution, periodicity, timezone) {
  const from = nextExecution ? new Date(nextExecution) : new Date()
  const to = nextExecution ? new Date(nextExecution) : new Date()

  if (periodicity === 'daily') {
    to.setDate(to.getDate() - 1)
    from.setTime(to.getTime())
  } else if (periodicity === 'weekly') {
    to.setDate(to.getDate() - 1)
    from.setTime(from.getTime() - (7 * 24 * 60 * 60 * 1000))
  } else if (periodicity === 'monthly') {
    to.setMonth(to.getMonth(), 1)
    to.setDate(to.getDate() - 1)
    from.setMonth(to.getMonth(), 1)
  }

  from.setHours(0, 0, 0, 0)
  to.setHours(23, 59, 59, 999)

  const getOffset = (timeZone = 'UTC', date = new Date()) => {
    const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }))
    const tzDate = new Date(date.toLocaleString('en-US', { timeZone }))
    return (tzDate.getTime() - utcDate.getTime()) / 6e4
  }

  from.setTime(from.getTime() - (getOffset(timezone) * 60 * 1000))
  to.setTime(to.getTime() - (getOffset(timezone) * 60 * 1000))

  return { from, to }
}

function calculateNextExecution (periodicity) {
  const nextExecutionDate = new Date(Date.now())
  if (periodicity === 'daily') {
    nextExecutionDate.setDate(nextExecutionDate.getDate() + 1)
  }

  if (periodicity === 'weekly') {
    nextExecutionDate.setDate(nextExecutionDate.getDate() + 7)
  }

  if (periodicity === 'monthly') {
    nextExecutionDate.setMonth(nextExecutionDate.getMonth() + 1)
  }

  nextExecutionDate.setUTCHours(12, 0, 0, 0)
  return nextExecutionDate
}

async function processReport (report, reportData, userData) {
  const lang = userData.user.attributes.lang
  const translations = messages[lang] ? messages[lang] : messages['en-GB']

  const app = createVueApp(report.reportType, reportData, translations, userData)
  const files = []

  const fleetmapReport = require('fleetmap-reports/src/' + camelCaseToKebabCase(report.reportType))
  const pdfDoc = await fleetmapReport.exportToPDF(userData, reportData)
  const excel = fleetmapReport.exportToExcel(userData, reportData)
  files.push(...addFiles(report.reportType, pdfDoc, excel))

  if (app != null) {
    await renderAndEmail(userData.user, translations, report, reportData, app, files)
  }
}

async function renderAndEmail (user, translations, report, reportData, app, files) {
  const emailTo = []
  if (validateEmail(user.email) && !report.sendOnlyToOther) {
    emailTo.push(user.email)
  }

  if (report.users && !report.sendOnlyToOther) {
    const data = await traccar.getUsers(user.id)
    data.forEach(user => {
      if (report.users.includes(user.id) && validateEmail(user.email)) {
        emailTo.push(user.email)
      }
    })
  }

  if (report.otherEmails && report.otherEmails.length > 0) {
    Array.prototype.push.apply(emailTo, report.otherEmails.split(','))
  }

  if (emailTo.length > 0) {
    let subject = report.name ? report.name : translations.report['title' + report.reportType]

    if (report.byGroup && reportData.group) {
      subject = subject + ' - ' + reportData.group.name
    }

    await renderEmail(emailTo, bcc, subject, app, files)

    console.log('Done')
  } else {
    console.log('Invalid emails')
  }
}

async function renderEmail (to, bcc, subject, app, files) {
  const vueRender = await renderer.createRenderer().renderToString(app)
  const mjmlRender = MJML(vueRender)
  if (mjmlRender.html) {
    const htmlText = mjmlRender.html
    await emailWithAttachment(to, bcc, htmlText, subject, senderEmail, files)
    await putReportMetricData(automaticReportSendMetric)
  }
}

function addFiles (name, pdfDoc, excelDoc) {
  const files = []

  if (pdfDoc) {
    const output = pdfDoc.output('datauristring')
    const pdfData = output.substring(output.lastIndexOf(',') + 1)
    files.push({
      contentType: 'application/pdf',
      content: pdfData,
      filename: name + '.pdf',
      encoding: 'base64'
    })
  }

  if (excelDoc) {
    files.push({
      contentType: 'application/vnd.ms-excel',
      content: xlsx(excelDoc.headers, excelDoc.data, excelDoc.settings, false),
      filename: name + '.xlsx'
    })
  }

  return files
}

function createVueApp (reportType, data, translations, userData) {
  const groupByDay = userData.groupByDay && reportType === 'KmsReport' ? 'GroupByDay' : ''
  const filePath = getFilePath(`${process.env.REPORTS_PATH || 'node_modules/fleetmap-reports/src/templates/'}${reportType}${groupByDay}Template.mjml`)
  const partnerData = getUserPartner(userData.user)

  console.log(`Loading report at: ${filePath}`)
  if (fs.existsSync(filePath)) {
    return new Vue({
      data () {
        return {
          reportData: data,
          translations: translations.report,
          user: userData.user,
          drivers: userData.drivers,
          userData,
          logo: 'img/logos/' + (partnerData && partnerData.host) + '.png',
          url: 'https://' + (partnerData && partnerData.host),
          color: getColor(partnerData),
          weekDays: [
            translations.report.sunday,
            translations.report.monday,
            translations.report.tuesday,
            translations.report.wednesday,
            translations.report.thursday,
            translations.report.friday,
            translations.report.saturday
          ]
        }
      },
      template: fs.readFileSync(filePath, 'utf-8'),
      methods: {
        getStopDuration (trip, index, trips) {
          if (index < trips.length - 1) {
            return (new Date(trips[index + 1].startTime) - new Date(trip.endTime))
          } else {
            return 0
          }
        },
        getDriverName (item) {
          if (item.attributes.driverUniqueId) {
            const driver = this.drivers.find(d => d.uniqueId === item.attributes.driverUniqueId)
            return driver ? driver.name : item.attributes.driverUniqueId
          }

          return ''
        },
        getAlertInfo (alert) {
          if (alert.type === 'deviceOverspeed') {
            return Math.round(alert.attributes.speed * 1.85200) + ' Km/h'
          }
          if (alert.type === 'driverChanged') {
            console.log(this.drivers)
            const driver = this.drivers.find(d => d.uniqueId === alert.attributes.driverUniqueId)
            return driver ? driver.name : alert.attributes.driverUniqueId
          }
          return ''
        },
        convertMS (duration, withSeconds) {
          if (!duration || duration < 0) {
            return withSeconds ? '00:00:00' : '00:00'
          }

          const ms = duration % 1000
          let s = (duration - ms) / 1000
          let seconds = s % 60
          s = (s - seconds) / 60
          let minutes = s % 60
          let hours = (s - minutes) / 60

          hours = (hours < 10) ? '0' + hours : hours
          minutes = (minutes < 10) ? '0' + minutes : minutes
          seconds = (seconds < 10) ? '0' + seconds : seconds

          return withSeconds ? hours + ':' + minutes + ':' + seconds : hours + ':' + minutes
        }
      }
    })
  } else {
    console.log('Could not find template: ' + filePath)
    return null
  }
}

function getColor (partnerData) {
  if (partnerData && partnerData.reports) {
    const mainColor = partnerData.reports.mainColor
    return '#' + ((1 << 24) + (mainColor[0] << 16) + (mainColor[1] << 8) + mainColor[2]).toString(16).slice(1)
  }

  return '#737373'
}

async function splitMessage (report, userId, error) {
  if (report.byDriver) {
    if (report.drivers.length > 1) {
      const half = Math.ceil(report.drivers.length / 2)
      console.log(error, 'trying', report.reportType, 'again with', half, 'drivers')
      await sendMessage(userId, [{ ...report, name: report.name, drivers: report.drivers.slice(0, half), groups: [] }])
      await sendMessage(userId, [{ ...report, name: report.name, drivers: report.drivers.slice(-half), groups: [] }])
    }
  } else {
    if (report.devices.length > 1) {
      const half = Math.ceil(report.devices.length / 2)
      console.log(error, 'trying', report.reportType, 'again with', half, 'devices')
      await sendMessage(userId, [{ ...report, name: report.name, devices: report.devices.slice(0, half), groups: [] }])
      await sendMessage(userId, [{ ...report, name: report.name, devices: report.devices.slice(-half), groups: [] }])
    }
  }
}

function canSplit (error) {
  return (error.message && error.message.startsWith('Message length is more than')) ||
      (error.message && error.message.startsWith('spawn ENOMEM')) ||
      (error.message && error.message.startsWith('Worker died ')) ||
      error.statusCode === 413
}

function sendMessage (userId, reportsToProcess, filterClientId) {
  return sqsClient.send(new SendMessageCommand({
    MessageBody: JSON.stringify({ userId, items: reportsToProcess, filterClientId }),
    QueueUrl: process.env.REPORTS_QUEUE1
  }))
}

function putReportMetricData (name) {
  try {
    const metricsData = [{
      MetricName: name,
      Unit: 'Count',
      Value: 1
    }]

    const metricData = {
      MetricData: metricsData,
      Namespace: 'Reports'
    }

    return putMetricData(metricData)
  } catch (error) {
    console.log(error)
  }
}

exports.processUserSchedules = processUserSchedules
exports.sendMessage = sendMessage
