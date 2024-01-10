const {
  QuickSightClient, GetDashboardEmbedUrlCommand, CreateDataSetCommand, UpdateDataSetCommand,
  CreateDashboardCommand, UpdateTemplateCommand, DescribeIngestionCommand, CreateTemplateCommand,
  GenerateEmbedUrlForAnonymousUserCommand, CreateIngestionCommand, DescribeDashboardCommand
} = require('@aws-sdk/client-quicksight')
const client = new QuickSightClient({ region: 'us-east-1' })
const AwsAccountId = '903002861645'
const baseArn = `arn:aws:quicksight:us-east-1:${AwsAccountId}:`
const userArn = baseArn + 'user/default/quicksight'
const partnerReports = require('./partnerReports')
const s3 = require('./s3')
const { v1: uuidv1 } = require("uuid")
const quicksight= require("./quicksight");

function DatasetParams (DashboardId, parameters, report = '') {
  const queries = {
    passenger: `
        select d.name deviceName, convert(json_unquote(json_extract(e.attributes, '$.driverUniqueId')), char) driverUniqueId, e.type, p.fixtime, 
        p.address from tc_events e join tc_positions p on e.positionid = p.id and e.deviceid = p.deviceid
        join tc_devices d on e.deviceid=d.id 
        where p.deviceid in (${parameters.selectedDevices.join(',')}) and 
        e.servertime > from_unixtime(${Math.round(parameters.dateRange[0] / 1000)}) and 
        e.servertime < from_unixtime(${Math.round(parameters.dateRange[1] / 1000)})
    `,
    temperature: `
        select 
            json_extract(p.attributes, '$.temp1') Temperatura,
            p.fixTime
        from tc_positions p 
        where p.deviceid in (${parameters.selectedDevices.join(',')}) and 
        p.fixTime > from_unixtime(${Math.round(parameters.dateRange[0] / 1000)}) and 
        p.fixTime < from_unixtime(${Math.round(parameters.dateRange[1] / 1000)})
    `
  }
  const columns = {
    passenger: [
      {
        Name: 'deviceName',
        Type: 'STRING'
      },
      {
        Name: 'driverUniqueId',
        Type: 'STRING'
      },
      {
        Name: 'type',
        Type: 'STRING'
      },
      {
        Name: 'fixtime',
        Type: 'DATETIME'
      },
      {
        Name: 'address',
        Type: 'STRING'
      }
    ],
    temperature: [
      {
        Name: 'Temperatura',
        Type: 'STRING'
      }, {
        Name: 'fixTime',
        Type: 'DATETIME'
      }]
  }
  const logicalTableMaps = {
    passenger: {
      '908cfb94-b469-4350-817e-630a3eb8c4f9': {
        Alias: 'Intermediate Table',
        DataTransforms: [
          {
            ProjectOperation: {
              ProjectedColumns: [
                'deviceName',
                'driverUniqueId',
                'type',
                'fixtime',
                'address',
                'id',
                'name',
                'uniqueid',
                'groupName',
                'notes'
              ]
            }
          }
        ],
        Source: {
          JoinInstruction: {
            LeftOperand: 'id',
            RightOperand: '9efb075a-3abf-4774-ab25-e3bacc1c3787',
            RightJoinKeyProperties: {
              UniqueKey: true
            },
            Type: 'LEFT',
            OnClause: 'driverUniqueId = uniqueid'
          }
        }
      },
      '9efb075a-3abf-4774-ab25-e3bacc1c3787': {
        Alias: 'tc_drivers',
        Source: {
          DataSetArn: 'arn:aws:quicksight:us-east-1:903002861645:dataset/fdf9a979-6ec1-45fb-82a0-432dc4fa7ae4'
        }
      },
      id: {
        Alias: 'joaquimDOTcardeiraATgmailDOTcom',
        Source: {
          PhysicalTableId: 'id'
        }
      }
    },
    temperature: {
      id: {
        Alias: 'joaquimDOTcardeiraATgmailDOTcom',
        Source: {
          PhysicalTableId: 'id'
        },
        DataTransforms: [{
          CastColumnTypeOperation: {
            ColumnName: 'Temperatura',
            NewColumnType: 'DECIMAL'
          }
        }]
      }
    }
  }
  const SqlQuery = queries[report]
  const Columns = columns[report]
  const LogicalTableMap = logicalTableMaps[report]
  console.log(SqlQuery)

  return {
    AwsAccountId,
    ImportMode: 'SPICE',
    PhysicalTableMap: {
      id: {
        CustomSql: {
          DataSourceArn: 'arn:aws:quicksight:us-east-1:903002861645:datasource/e4ac4437-4c4a-4edd-b727-1436df223a73',
          Name: DashboardId,
          SqlQuery,
          Columns
        }
      }
    },
    LogicalTableMap,
    OutputColumns: [
      {
        Name: 'deviceName',
        Type: 'STRING'
      },
      {
        Name: 'driverUniqueId',
        Type: 'STRING'
      },
      {
        Name: 'type',
        Type: 'STRING'
      },
      {
        Name: 'fixtime',
        Type: 'DATETIME'
      },
      {
        Name: 'address',
        Type: 'STRING'
      },
      {
        Name: 'id',
        Type: 'INTEGER'
      },
      {
        Name: 'name',
        Type: 'STRING'
      },
      {
        Name: 'uniqueid',
        Type: 'STRING'
      },
      {
        Name: 'attributes',
        Type: 'STRING'
      }
    ],
    DataSetId: DashboardId,
    Name: DashboardId,
    Permissions: [
      {
        Principal: userArn,
        Actions: [
          'quicksight:UpdateDataSetPermissions',
          'quicksight:DescribeDataSet',
          'quicksight:DescribeDataSetPermissions',
          'quicksight:PassDataSet',
          'quicksight:DescribeIngestion',
          'quicksight:ListIngestions',
          'quicksight:UpdateDataSet',
          'quicksight:DeleteDataSet',
          'quicksight:CreateIngestion',
          'quicksight:CancelIngestion'
        ]
      }
    ]
  }
}

function DashboardParams (DashboardId, report, Parameters = {}) {
  const template = report === 'passenger' ? 'partnerReportsTemplate' : report
  const Arn = baseArn + 'template/' + template
  return {
    Parameters,
    AwsAccountId,
    DashboardId: DashboardId + '-' + new Date().getTime(),
    Name: DashboardId,
    DashboardPublishOptions: {
      AdHocFilteringOption: {
        AvailabilityStatus: 'ENABLED'
      },
      ExportToCSVOption: {
        AvailabilityStatus: 'ENABLED'
      },
      SheetControlsOption: {
        VisibilityState: 'COLLAPSED'
      }
    },
    SourceEntity: {
      SourceTemplate: {
        Arn,
        DataSetReferences: [{
          DataSetArn: baseArn + 'dataset/' + DashboardId,
          DataSetPlaceholder: 'DataSource1'
        }]
      }
    },
    Permissions: [
      {
        Principal: userArn,
        Actions: [
          'quicksight:DescribeDashboard',
          'quicksight:ListDashboardVersions',
          'quicksight:UpdateDashboardPermissions',
          'quicksight:QueryDashboard',
          'quicksight:UpdateDashboard',
          'quicksight:DeleteDashboard',
          'quicksight:DescribeDashboardPermissions',
          'quicksight:UpdateDashboardPublishedVersion'
        ]
      }
    ]
  }
}

exports.updateTemplate = async () => {
  console.log('update template', await client.send(new UpdateTemplateCommand({
    AwsAccountId,
    TemplateId: 'partnerReportsTemplate',
    Name: 'partnerReportsTemplate',
    SourceEntity: {
      SourceAnalysis: {
        Arn: baseArn + 'analysis/53cc5b9b-989c-43fa-b683-fcbccc21ae96',
        DataSetReferences: [{
          DataSetArn: baseArn + 'dataset/admATcandyturDOTcomDOTbr',
          DataSetPlaceholder: 'DataSource1'
        }]
      }
    },
    VersionDescription: '1'
  })))
  console.log('update temperature template', await client.send(new UpdateTemplateCommand({
    AwsAccountId,
    TemplateId: 'temperature',
    Name: 'temperature',
    SourceEntity: {
      SourceAnalysis: {
        Arn: baseArn + 'analysis/0d3f0467-880b-4e9f-b3b0-c65021913d29',
        DataSetReferences: [{
          DataSetArn: baseArn + 'dataset/joaquimDOTcardeiraATgmailDOTcomtemperature',
          DataSetPlaceholder: 'DataSource1'
        }]
      }
    },
    VersionDescription: '1'
  })))
}

exports.createTemplate = async () => {
  /* console.log('update template', await client.send(new UpdateTemplateCommand({
    AwsAccountId,
    TemplateId: 'partnerReportsTemplate',
    Name: 'partnerReportsTemplate',
    SourceEntity: {
      SourceAnalysis: {
        Arn: baseArn + 'analysis/ed287dbe-33fb-4176-8ee5-353ff1854263',
        DataSetReferences: [{
          DataSetArn: baseArn + 'dataset/joaquimDOTcardeiraATgmailDOTcom',
          DataSetPlaceholder: 'DataSource1'
        }]
      }
    },
    VersionDescription: '1'
  }))) */
  console.log('update temperature template', await client.send(new CreateTemplateCommand({
    AwsAccountId,
    TemplateId: 'temperature',
    Name: 'temperature',
    SourceEntity: {
      SourceAnalysis: {
        Arn: baseArn + 'analysis/0d3f0467-880b-4e9f-b3b0-c65021913d29',
        DataSetReferences: [{
          DataSetArn: baseArn + 'dataset/joaquimDOTcardeiraATgmailDOTcomtemperature',
          DataSetPlaceholder: 'DataSource1'
        }]
      }
    },
    VersionDescription: '1'
  })))
}

function getNormalizedEmail (email, report) {
  if (report === 'passenger') { report = '' }
  return email.replace('@', 'AT').replace(/\./g, 'DOT') + report
}

exports.getNormalizedEmail = getNormalizedEmail

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
exports.createIngestion = (params) => {
  params.AwsAccountId = AwsAccountId
  return client.send(new CreateIngestionCommand(params))
}
exports.describeIngestionCommand = (params) => {
  params.AwsAccountId = AwsAccountId
  return client.send(new DescribeIngestionCommand(params))
}
exports.getEmbeddedDashboard = async (user, parameters, report = '', traccar, axios) => {
  const pReport = partnerReports.getReport(user, parameters, report, traccar, axios)
  if (pReport) { return pReport }

  const email = getNormalizedEmail(user.email, report)
  let dataset
  const dataSetParams = DatasetParams(email, parameters, report)
  try {
    dataset = await client.send(new UpdateDataSetCommand(dataSetParams))
  } catch (e) {
    console.error(e)
    dataset = await client.send(new CreateDataSetCommand(dataSetParams))
  }
  console.log(dataset)
  let ingestion
  while (!ingestion || ingestion.Ingestion.IngestionStatus === 'RUNNING') {
    await new Promise(resolve => setTimeout(resolve, 3000))
    ingestion = await client.send(new DescribeIngestionCommand({
      AwsAccountId,
      IngestionId: dataset.IngestionId,
      DataSetId: dataset.DataSetId
    }))
    console.log(ingestion)
  }
  let dashboard = await client.send(new CreateDashboardCommand(DashboardParams(email, report, parameters)))
  console.log('CreateDashboard response', dashboard)
  while (dashboard.CreationStatus === 'CREATION_IN_PROGRESS') {
    await new Promise(resolve => setTimeout(resolve, 3000))
    dashboard = await client.send(new DescribeDashboardCommand({
      AwsAccountId,
      DashboardId: dashboard.DashboardId
    })).then(d => d.Dashboard)
    console.log('DescribeDashboard response:')
    console.dir(dashboard, { depth: null })
  }
  const { DashboardId } = dashboard
  return GetDashboardEmbedUrl(DashboardId)
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

exports.datasetIngestion = async (datasetId) => {
  const dataset = {
    DataSetId: datasetId,
    IngestionId: uuidv1()
  }

  await quicksight.createIngestion({
    IngestionId: dataset.IngestionId,
    DataSetId: dataset.DataSetId
  })

  let ingestion
  while (!ingestion || ingestion.Ingestion.IngestionStatus === 'RUNNING') {
    await new Promise(resolve => setTimeout(resolve, 3000))
    ingestion = await quicksight.describeIngestionCommand({
      IngestionId: dataset.IngestionId,
      DataSetId: dataset.DataSetId
    })
    console.log(ingestion)
  }
}
