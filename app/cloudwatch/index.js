const moment = require('moment')
const { getRowsArray } = require('../mysql')
const { CloudWatchClient, PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch')
const { checkCountries } = require('../scheduledtasks')

// Create CloudWatch service client object
const cw = new CloudWatchClient({ region: process.env.AWS_REGION })

function getCountByCountry () {
  return getRowsArray(`
  SELECT
SUBSTRING_INDEX(p.address,',',-1) country, count(*) count
  FROM tc_positions_last p
 WHERE p.fixtime > DATE_ADD(CURRENT_TIMESTAMP, INTERVAL -2 MINUTE)
   group by SUBSTRING_INDEX(p.address,',',-1)
  `, process.env.DB_HOST_READER)
}

function getCountByAPN () {
  return getRowsArray(`

    SELECT convert(replace(trim(lower(attributes->>"$.apn")), CHAR(9), '') using ascii) apn, partnerid, count(*) count
    FROM tc_devices d
    WHERE attributes->>"$.apn" is not null and d.lastupdate > DATE_ADD(CURRENT_TIMESTAMP, INTERVAL -5 MINUTE) and d.disabled=0 and d.partnerid=10
    group by replace(trim(lower(attributes->>"$.apn")), CHAR(9), '')

  `, process.env.DB_HOST_READER)
}

function getDelayByPartner () {
  return getRowsArray(`
    SELECT
        TIMESTAMPDIFF(minute, d.lastupdate, CURRENT_TIMESTAMP) delay, 
        d.partnerid, count(*) count
    FROM tc_devices d
      where d.disabled=0
    group by delay, partnerid
  `, process.env.DB_HOST_READER)
}

function extractMetricData (m, name, dimensions) {
  return {
    MetricName: name + '',
    Unit: 'Count',
    Value: m.count,
    Dimensions: dimensions
      ? Object.keys(m).filter(k => k !== 'count' && k !== name).map(k => { return { Name: k, Value: (m[k] + '').toLowerCase() } })
      : []
  }
}

async function addDBDefinedMetrics (host, metricsData) {
  const metrics = await getMetrics(host)
  // console.log(metrics)
  for (const m of metrics) {
    try {
      const rows = await getRowsArray(m.query, host)
      const keyValue = rows[0][0] || rows[0]
      const value = keyValue[Object.keys(keyValue)[0]]
      if (!isNaN(value)) {
        metricsData.push({
          MetricName: m.metricname,
          Unit: 'Count',
          Value: value
        })
      }
    } catch (error) {
      console.error(m.query, error)
    }
  }
}

exports.putMetrics = async (e) => {
  let metricsData = []
  let metrics
  if (e.resources[0].split('rule/')[1] === 'everyMinute') {
    await addDBDefinedMetrics(process.env.DB_HOST_READER, metricsData)
    await addDBDefinedMetrics(process.env.DB_HOST_POSITIONS_READER, metricsData)
  } else {
    await checkCountries()
    metrics = await getCountByCountry()
    metricsData = metricsData.concat(metrics.map(m => {
      return {
        // eslint-disable-next-line no-control-regex
        MetricName: m.country ? m.country.replace(/[^\x00-\x7F]/g, '_').replace('\\n', '').trim() : 'unknown',
        Unit: 'Count',
        Value: m.count
      }
    }).filter(m => m.MetricName))
    metrics = await getCountByAPN()
    // eslint-disable-next-line no-control-regex
    metrics.forEach(m => { m.apn = m.apn && m.apn.replace && m.apn.replace(/[^\x00-\x7F]/g, '').trim().toLowerCase() })
    metricsData = metricsData.concat(metrics.filter(m => m.apn)
      .map(m => extractMetricData(m, '_' + m.apn, true)))

    // console.log(metrics)
    metrics = await getDelayByPartner()

    metrics.forEach(m => {
      if (m.delay === 1) {
        m.delay = 'a few seconds ago'
      } else if (m.delay >= 10 && m.delay < 15) {
        m.delay = 'between 10 and 15 minutes'
      } else if (m.delay >= 15 && m.delay <= 45) {
        m.delay = 'between 15 and 45 minutes'
      } else if (m.delay >= 60 * 3 && m.delay < 60 * 12) {
        m.delay = 'between 3 and 12 hours'
      } else if (m.delay >= 60 * 12 && m.delay <= 60 * 24) {
        m.delay = 'between 12 and 24 hours'
      } else if (m.delay >= 60 * 24 * 3 && m.delay < 60 * 24 * 15) {
        m.delay = 'between 3 and 15 days'
      } else if (m.delay >= 60 * 24 * 15 && m.delay <= 60 * 24 * 30) {
        m.delay = 'between 15 days and 1 month'
      } else if (m.delay >= 60 * 24 * 30 * 3 && m.delay <= 60 * 24 * 30 * 12) {
        m.delay = 'between 3 and 12 months'
      } else {
        m.delay = moment(new Date().getTime() - m.delay * 60 * 1000).fromNow()
      }
    })

    metrics = metrics.reduce((acc, cur) => {
      const grouped = acc.find(m => m.delay === cur.delay && m.partnerid === cur.partnerid)
      if (grouped) { grouped.count += cur.count } else { acc.push(cur) }
      return acc
    }, [])
    metricsData = metricsData.concat(metrics.map(m => extractMetricData(m, m.delay, true)))
  }
  const promises = []
  for (let i = 0; i < metricsData.length; i += 20) {
    const metricData = {
      MetricData: metricsData.slice(i, i + 20),
      Namespace: 'DBMetrics'
    }
    promises.push(putMetricData(metricData))
  }
  await Promise.all(promises)
}

async function getMetrics (host = process.env.DB_HOST_READER) {
  // noinspection SqlResolve
  return getRowsArray('SELECT metricname, query FROM _cw', host)
}

async function putMetricData (metricsData) {
  try {
    await cw.send(new PutMetricDataCommand(metricsData))
  } catch (e) {
    console.error(metricsData, e)
  }
}

exports.putMetricData = putMetricData
