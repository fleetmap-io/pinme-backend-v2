using System.Globalization;
using System.IO.Compression;
using System.Net;
using Amazon;
using Amazon.Lambda.Core;
using Amazon.SQS;
using Amazon.SQS.Model;
using MySql.Data.MySqlClient;
using System.Text;
using Amazon.Lambda.SQSEvents;
using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;

// Assembly attribute to enable the Lambda function's JSON input to be converted into a .NET class.
[assembly: LambdaSerializer(typeof(Amazon.Lambda.Serialization.SystemTextJson.DefaultLambdaJsonSerializer))]

namespace S3DailyMigrator;

public class Function
{
    static AmazonS3Client s3Client = new(Amazon.RegionEndpoint.USEast1);

    public string FunctionHandler(dynamic input, ILambdaContext context)
    {
        CreateTables();

        MigrateTables();

        return "ok";
    }

    public string FunctionHandlerSQS(SQSEvent sqsEvent, ILambdaContext context)
    {
        foreach (var message in sqsEvent.Records)
        {
            Migrate(message.Body);
        }
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
    
    private void Migrate(string unit)
    {
        var start = DateTime.Now;

        var unitFields = unit.Split('|');
        var table = unitFields[0];
        if (unitFields[1] == "delete") //tc_positions_yyyyMMdd|delete
        {
            DeleteTable(table);
            return;
        }

        //tc_positions_yyyyMMdd|deviceid/year/month/day.gz
        var key = unitFields[1];
        var keyFields = key.Split("/");
        var deviceid = int.Parse(keyFields[0]);
        var year = int.Parse(keyFields[1]);
        var month = int.Parse(keyFields[2]);
        var day = int.Parse(keyFields[3].Split('.')[0]);

        var lines = GetExistingFile(key);
        var s3rows = lines.Count;
        JoinSqlPositions(lines, table, deviceid, year, month, day);
        var sqlrows = lines.Count - s3rows;
        SendToS3(key, lines);
        var seconds = Convert.ToInt32((DateTime.Now - start).TotalSeconds);
        MySqlHelper.ExecuteNonQuery(Settings.mysqlcs, $"UPDATE {table}_migration_control SET done = 1, s3rows={s3rows}, sqlrows={sqlrows}, seconds={seconds} WHERE s3key='{key}'");
    }

    private Dictionary<long, string> GetExistingFile(string key)
    {
        var result = new Dictionary<long, string>();

        GetObjectResponse response;
        try
        {
            response = s3Client.GetObjectAsync(Settings.bucket, key).GetAwaiter().GetResult();
        }
        catch (AmazonServiceException ase)
        {
            if (ase.StatusCode == HttpStatusCode.NotFound)
            {
                return result;
            }
            throw ase;
        }

        string brokenLine = null;
        string line;
        using (var decompressionStream = new GZipStream(response.ResponseStream, CompressionMode.Decompress))
        {
            using StreamReader reader = new StreamReader(decompressionStream, Encoding.UTF8);
            while ((line = reader.ReadLine()) != null)
            {
                var fields = line.Split('\t');

                if (fields.Length < 16)
                {
                    //broken line
                    if (brokenLine == null)
                    {
                        //beginning of broken line. just store it to see if we can complete it with the next one
                        brokenLine = line;
                        continue;
                    }

                    //try to complete the broken line
                    brokenLine = brokenLine + line;
                    fields = brokenLine.Split('\t');
                    if (fields.Length < 16)
                    {
                        //broken line is still not completed. continue trying with the next line
                        continue;
                    }
                    //we have recovered the broken line. we are good to proceed
                    line = brokenLine;
                }

                //even if we had a broken line that was not completed
                // if we have a complete line to process we just discard the broken line
                brokenLine = null;

                if (long.TryParse(fields[0], NumberStyles.None, CultureInfo.InvariantCulture, out var positionid))
                {
                    result[positionid] = line;
                }
            }
        }

        return result;
    }

    private void JoinSqlPositions(Dictionary<long, string> lines, string table, int deviceid, int year, int month, int day)
    {
        Console.WriteLine($"Migrating deviceid:{deviceid} year:{year} month:{month} day:{day}");
        var q = $"SELECT * FROM {table} WHERE deviceid = {deviceid} AND fixtime BETWEEN '{year}-{month}-{day}' AND '{new DateOnly(year, month, day).AddDays(1):yyyy-MM-dd}'";

        StringBuilder csvBuilder = new StringBuilder();

        using (var connection = new MySqlConnection(Settings.mysqlcsread))
        {
            connection.Open();
            using (var command = new MySqlCommand(q, connection))
            {
                command.CommandTimeout = 600;
                using (var reader = command.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        var id = reader.GetInt64(0);
                        if (lines.ContainsKey(id))
                            continue;
                        csvBuilder.Append(id).Append('\t'); //id
                        csvBuilder.Append(ReadString(reader, 1)).Append('\t'); //protocol
                        csvBuilder.Append(reader.GetInt32(2)).Append('\t'); //deviceid
                        csvBuilder.Append(reader.GetDateTime(3).ToString("yyyy-MM-dd HH:mm:ss")).Append('\t'); //servertime

                        var fixtime = reader.GetDateTime(5);
                        DateTime devicetime; try { devicetime = reader.GetDateTime(4); } catch { devicetime = fixtime; }

                        csvBuilder.Append(devicetime.ToString("yyyy-MM-dd HH:mm:ss")).Append('\t'); //devicetime
                        csvBuilder.Append(fixtime.ToString("yyyy-MM-dd HH:mm:ss")).Append('\t'); //fixtime
                        csvBuilder.Append(ReadBit(reader, 6)).Append('\t'); //valid
                        csvBuilder.Append(reader.GetDouble(7)).Append('\t'); //latitude
                        csvBuilder.Append(reader.GetDouble(8)).Append('\t'); //longitude
                        csvBuilder.Append(reader.GetFloat(9)).Append('\t'); //altitude
                        csvBuilder.Append(reader.GetFloat(10)).Append('\t'); //speed
                        csvBuilder.Append(reader.GetFloat(11)).Append('\t'); //course
                        csvBuilder.Append(ReadString(reader, 12)).Append('\t'); //address
                        csvBuilder.Append(ReadString(reader, 13)).Append('\t'); //attributes
                        csvBuilder.Append(reader.GetDouble(14)).Append('\t'); //accuracy
                        csvBuilder.Append(ReadString(reader, 15)); //network

                        lines[id] = csvBuilder.ToString();
                        csvBuilder.Length = 0;
                    }
                }
            }
        }
    }

    private static object ReadBit(MySqlDataReader r, int index)
    {
        return r.GetBoolean(index) ? (char)0x01 : (char)0x00;
    }

    private static object ReadString(MySqlDataReader r, int index)
    {
        return r.IsDBNull(index) ? "\\N" : r[index];
    }

    private void SendToS3(string key, Dictionary<long, string> lines)
    {
        using var ms = new MemoryStream();
        using (var gzipStream = new GZipStream(ms, CompressionMode.Compress, true))
        {
            var first = true;
            foreach (var line in lines.Values)
            {
                if (first)
                {
                    first = false;
                }
                else
                {
                    gzipStream.WriteByte((byte)'\n');
                }
                gzipStream.Write(Encoding.UTF8.GetBytes(line));
            }
        }

        if (ms.Length > 0)
        {
            var putObjectRequest = new PutObjectRequest()
            {
                BucketName = Settings.bucket,
                Key = key,
                InputStream = ms
            };

            s3Client.PutObjectAsync(putObjectRequest).GetAwaiter().GetResult();
        }
    }

    private void DeleteTable(string table)
    {
        //check if all files are done
        while (Convert.ToInt32(MySqlHelper.ExecuteScalar(Settings.mysqlcsread, $"SELECT COUNT(0) FROM {table}_migration_control WHERE done = 0")) > 0)
        {
            //Not all tasks are done. Wait 5 seconds and check again
            Thread.Sleep(Settings.sleepTime);
        }
        //all done -> we are ready to delete/rename table

        //Rename instead of delete so we can analyze it
        if(TableExists(table))
            MySqlHelper.ExecuteNonQuery(Settings.mysqlcs, $"RENAME TABLE {table} TO _droped_{table}");

        //rename control table as well
        if (TableExists(table + "_migration_control"))
            MySqlHelper.ExecuteNonQuery(Settings.mysqlcs, $"RENAME TABLE {table}_migration_control TO _droped_{table}_migration_control");
    }
}
