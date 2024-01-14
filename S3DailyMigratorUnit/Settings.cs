namespace S3DailyMigratorUnit
{
    public static class Settings
    {
        public static string mysqlcs = $"server={Environment.GetEnvironmentVariable("DB_HOST_POSITIONS")};database=traccar;userid={Environment.GetEnvironmentVariable("DB_USER")};password={Environment.GetEnvironmentVariable("DB_PASSWORD")};maxpoolsize=1";

        public static string mysqlcsread = $"server={Environment.GetEnvironmentVariable("DB_HOST_POSITIONS_READER")};database=traccar;userid={Environment.GetEnvironmentVariable("DB_USER")};password={Environment.GetEnvironmentVariable("DB_PASSWORD")};maxpoolsize=1";

        public static string bucket = "traccar-rds-archived-v3";

        public static int sleepTime = 5000;
    }
}
