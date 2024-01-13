namespace S3DailyMigratorUnit
{
    public static class Settings
    {
        public static string mysqlcs = "server=dbpositions.pinme.io;database=traccar;userid=s3dailymigratorunit;password=s3d41lym1gr4t0r5n1t;maxpoolsize=1";

        public static string mysqlcsread = "server=dbpositions-read.pinme.io;database=traccar;userid=s3dailymigratorunit;password=s3d41lym1gr4t0r5n1t;maxpoolsize=1";

        public static string bucket = "traccar-rds-archived-v3";

        public static int sleepTime = 5000;
    }
}
