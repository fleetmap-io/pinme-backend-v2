const {
  QuickSightClient, GetDashboardEmbedUrlCommand, DescribeIngestionCommand,
  GenerateEmbedUrlForAnonymousUserCommand, CreateIngestionCommand
} = require('@aws-sdk/client-quicksight')
const client = new QuickSightClient({ region: 'eu-west-3' })
const AwsAccountId = '925447205804'
const baseArn = `arn:aws:quicksight:us-east-1:${AwsAccountId}:`
const userArn = baseArn + `user/default/${AwsAccountId}`
const s3 = require('./s3')
const partnerReports = require('./partnerReports')

function GetDashboardEmbedUrl (DashboardId) {
  return client.send(new GetDashboardEmbedUrlCommand({
    AwsAccountId,
    DashboardId,
    IdentityType: 'QUICKSIGHT',
    UserArn: userArn,
    SessionLifetimeInMinutes: 100
  }))
}
exports.GetDashboardEmbedUrl = GetDashboardEmbedUrl

function GenerateEmbedUrlForAnonymousUser (DashboardId) {
  return client.send(new GenerateEmbedUrlForAnonymousUserCommand({
    AuthorizedResourceArns: ['arn:aws:quicksight:us-east-1:903002861645:dashboard/' + DashboardId],
    ExperienceConfiguration: {
      Dashboard: {
        InitialDashboardId: DashboardId
      }
    },
    Namespace: 'default',
    AllowedDomains: ['https://localhost:8080'],
    SessionLifetimeInMinutes: 100,
    AwsAccountId
  }))
}
exports.GenerateEmbedUrlForAnonymousUser = GenerateEmbedUrlForAnonymousUser
function createIngestion (params) {
  params.AwsAccountId = AwsAccountId
  return client.send(new CreateIngestionCommand(params))
}
exports.describeIngestionCommand = (params) => {
  params.AwsAccountId = AwsAccountId
  return client.send(new DescribeIngestionCommand(params))
}

exports.getEmbeddedDashboard = async (user, parameters, report = '', traccar, axios) => {
  return partnerReports.getReport(user, parameters, report, traccar, axios)
}

exports.createManifest = async () => {
  const manifest = {
    fileLocations: [{
      URIs: ['s3://alb-reports-bucket/afriquia.csv']
    }],
    globalUploadSettings: {
      format: 'CSV'
    }
  }

  process.env.S3_BUCKET = 'alb-reports-bucket'
  const data = await s3.put('afriquia.manifest', JSON.stringify(manifest))
  console.log(data)
}

exports.checkReport = async (_report, IngestionId) => {
  try {
    const { DataSetId, DashboardId } = require('./partnerReports/' + _report)
    const ingestion = await client.send(new DescribeIngestionCommand({
      AwsAccountId,
      IngestionId,
      DataSetId
    }))
    console.log(ingestion && ingestion.Ingestion)
    if (ingestion.Ingestion.IngestionStatus === 'RUNNING') {
      return { ...ingestion.Ingestion, ingestionId: IngestionId }
    }
    return GetDashboardEmbedUrl(DashboardId)
  } catch (e) {
    console.warn(e)
    return { ingestionId: IngestionId, ...e }
  }
}

exports.datasetIngestion = async (datasetId, IngestionId) => {
  const dataset = {
    DataSetId: datasetId,
    IngestionId
  }

  await createIngestion({
    IngestionId: dataset.IngestionId,
    DataSetId: dataset.DataSetId
  })

  let ingestion
  while (!ingestion || ingestion.Ingestion.IngestionStatus === 'RUNNING') {
    await new Promise(resolve => setTimeout(resolve, 3000))
    ingestion = await client.send(new DescribeIngestionCommand({
      AwsAccountId,
      IngestionId: dataset.IngestionId,
      DataSetId: dataset.DataSetId
    }))
    console.log(ingestion && ingestion.Ingestion)
  }
}
