using Amazon;
using Amazon.Lambda.Core;
using Amazon.SQS;
using Amazon.SQS.Model;
using MySql.Data.MySqlClient;
using System.Text;

// Assembly attribute to enable the Lambda function's JSON input to be converted into a .NET class.
[assembly: LambdaSerializer(typeof(Amazon.Lambda.Serialization.SystemTextJson.DefaultLambdaJsonSerializer))]

namespace S3DailyMigrator;

public class Function
{
    public string FunctionHandler(dynamic input, ILambdaContext context)
    {
        CreateTables();

        MigrateTables();

        return "ok";
    }

    private void CreateTables()
    {
        for(var i = 0; i <= 7; i++)
        {
            MySqlHelper.ExecuteNonQuery(Settings.mysqlcs, $"CREATE TABLE IF NOT EXISTS tc_positions_{DateTime.UtcNow.AddDays(i):yyyyMMdd} LIKE tc_positions_template");
        }
    }

    private void MigrateTables()
    {
        for (var i = -7; i <= -1; i++)
        {
            MigrateTable($"tc_positions_{DateTime.UtcNow.AddDays(i):yyyyMMdd}");
        }
    }

    private bool TableExists(string table)
    {
        return Convert.ToInt32(MySqlHelper.ExecuteScalar(Settings.mysqlcsread, "SELECT count(0) FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'traccar' AND TABLE_NAME = '" + table + "'")) > 0;
    }

    private void MigrateTable(string table)
    {
        if (!TableExists(table))
            return;

        var keys = new List<string>();

        using (var connection = new MySqlConnection(Settings.mysqlcsread))
        {
            connection.Open();
            using (var command = new MySqlCommand($"SELECT deviceid, DATE(fixtime) date FROM {table} GROUP BY deviceid, DATE(fixtime)", connection))
            {
                command.CommandTimeout = 600;
                using (var reader = command.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        var deviceid = reader.GetInt32(0);
                        var date = reader.GetDateTime(1);
                        var key = $"{deviceid}/{date.Year}/{date.Month}/{date.Day}.gz";
                        keys.Add(key);
                    }
                }
            }
        }

        MySqlHelper.ExecuteNonQuery(Settings.mysqlcs, $"CREATE TABLE IF NOT EXISTS {table}_migration_control LIKE tc_positions_migration_control_template");
        if (keys.Count > 0)
        {
            var sb = new StringBuilder($"INSERT IGNORE INTO ").Append(table).Append("_migration_control(s3key) VALUES ");
            foreach(var key in keys)
            {
                sb.Append($"('").Append(key).Append("'),");
            }
            MySqlHelper.ExecuteNonQuery(Settings.mysqlcs, sb.ToString(0, sb.Length-1));
        }

        keys.Add("delete");
        SendToSqs(table, keys);
    }

    private void SendToSqs(string table, List<string> keys)
    {
        AmazonSQSClient sqsClient = new AmazonSQSClient(RegionEndpoint.USEast1);
        var entries = new List<SendMessageBatchRequestEntry>();
        foreach (var key in keys)
        {
            entries.Add(new SendMessageBatchRequestEntry { MessageGroupId = $"{key.Replace('/', '_').Replace('.', '_')}", Id = $"{key.Replace('/','_').Replace('.', '_')}",  MessageBody = $"{table}|{key}" });

            if (entries.Count == 10)
            {
                var messageRequest = new SendMessageBatchRequest
                {
                    QueueUrl = Settings.sqsUrl,
                    Entries = entries
                };
                sqsClient.SendMessageBatchAsync(messageRequest).GetAwaiter().GetResult();
                entries.Clear();
            }
        }
        if (entries.Count > 0)
        {
            var messageRequest = new SendMessageBatchRequest
            {
                QueueUrl = Settings.sqsUrl,
                Entries = entries
            };
            sqsClient.SendMessageBatchAsync(messageRequest).GetAwaiter().GetResult();
        }
    }
}
