namespace GeofenceDeleteLambda
{
    public static class Settings
    {
        public static string mysqlcs = $"server={Environment.GetEnvironmentVariable("DB_HOST")};database=traccar;userid={Environment.GetEnvironmentVariable("DB_USER")};password={Environment.GetEnvironmentVariable("DB_PASSWORD")};maxpoolsize=1";

        public static string TraccarUser = Environment.GetEnvironmentVariable("TRACCAR_ADMIN_USER");
        public static string TraccarPass = Environment.GetEnvironmentVariable("TRACCAR_ADMIN_PASS");
    }
}
