using Npgsql;

namespace BitMono.Web.MigrationService;

// Aspire creates AddDatabase() catalogs during `aspire run` (ResourceReadyEvent), but not on
// `aspire deploy` when the orchestrator is absent — see dotnet/aspire#14695 and #15795.
internal static class PostgresDatabaseBootstrap
{
    public static async Task EnsureExistsAsync(
        string connectionString,
        ILogger logger,
        CancellationToken cancellationToken)
    {
        var target = new NpgsqlConnectionStringBuilder(connectionString);
        var databaseName = target.Database
            ?? throw new InvalidOperationException("Connection string must specify a Database.");

        if (!IsValidDatabaseName(databaseName))
            throw new InvalidOperationException($"Invalid database name '{databaseName}'.");

        target.Database = "postgres";
        await using var connection = new NpgsqlConnection(target.ConnectionString);
        await connection.OpenAsync(cancellationToken);

        await using var check = connection.CreateCommand();
        check.CommandText = "SELECT 1 FROM pg_database WHERE datname = @name";
        check.Parameters.AddWithValue("name", databaseName);
        if (await check.ExecuteScalarAsync(cancellationToken) is not null)
        {
            logger.LogInformation("Database {Database} already exists.", databaseName);
            return;
        }

        logger.LogInformation("Creating database {Database}.", databaseName);
        await using var create = connection.CreateCommand();
        create.CommandText = $"CREATE DATABASE \"{databaseName}\"";
        await create.ExecuteNonQueryAsync(cancellationToken);
        logger.LogInformation("Database {Database} created.", databaseName);
    }

    private static bool IsValidDatabaseName(string name) =>
        !string.IsNullOrEmpty(name) && name.All(static c => char.IsAsciiLetterOrDigit(c) || c == '_');
}
