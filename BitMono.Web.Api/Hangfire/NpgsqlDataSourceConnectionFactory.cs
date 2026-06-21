using Hangfire.PostgreSql;
using Npgsql;

namespace BitMono.Web.Api.Hangfire;

// Hangfire.PostgreSql wants a connection string; Aspire's NpgsqlDataSource keeps credentials
// in the pool instead. Open connections from the data source so enqueue works in deploy.
public sealed class NpgsqlDataSourceConnectionFactory(NpgsqlDataSource dataSource) : IConnectionFactory
{
    public NpgsqlConnection GetOrCreateConnection() => dataSource.OpenConnection();
}
