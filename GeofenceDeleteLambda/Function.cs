using Amazon.Lambda.Core;
using Amazon.Lambda.SQSEvents;
using MySql.Data.MySqlClient;
using Org.BouncyCastle.Utilities;
using System.Net.Http.Headers;
using System.Text;

// Assembly attribute to enable the Lambda function's JSON input to be converted into a .NET class.
[assembly: LambdaSerializer(typeof(Amazon.Lambda.Serialization.SystemTextJson.DefaultLambdaJsonSerializer))]

namespace GeofenceDeleteLambda;

public class Function
{
    public async Task<string> FunctionHandler(SQSEvent sqsEvent, ILambdaContext context)
    {
        var ids = string.Join(',', sqsEvent.Records.Select(r => r.Body));
        var q = $"DELETE FROM tc_geofences WHERE id IN ({ids})";
        Console.WriteLine(q);
        await MySqlHelper.ExecuteNonQueryAsync(Settings.mysqlcs, q);

        var httpClient = new HttpClient();
        httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", Convert.ToBase64String(Encoding.UTF8.GetBytes($"{Settings.TraccarUser}:{Settings.TraccarPass}")));
        var result = await httpClient.GetAsync("https://api.pinme.io/api/geofences?refresh=true");
        result.EnsureSuccessStatusCode();
        return "ok";
    }
}
