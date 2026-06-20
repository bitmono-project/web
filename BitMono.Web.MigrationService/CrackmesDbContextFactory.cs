using BitMono.Web.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace BitMono.Web.MigrationService;

// Design-time only: lets `dotnet ef migrations add` build the model. The connection is a
// placeholder (migrations don't connect); migrations are emitted into this assembly.
public class CrackmesDbContextFactory : IDesignTimeDbContextFactory<CrackmesDbContext>
{
    public CrackmesDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<CrackmesDbContext>()
            .UseNpgsql("Host=localhost;Database=appdb",
                npgsql => npgsql.MigrationsAssembly("BitMono.Web.MigrationService"))
            .Options;
        return new CrackmesDbContext(options);
    }
}
