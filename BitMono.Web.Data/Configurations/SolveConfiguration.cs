using BitMono.Web.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BitMono.Web.Data.Configurations;

public sealed class SolveConfiguration : IEntityTypeConfiguration<Solve>
{
    public void Configure(EntityTypeBuilder<Solve> builder)
    {
        builder.HasIndex(x => new { x.UserId, x.CrackmeId }).IsUnique(); // one solve per user per crackme
        builder.HasIndex(x => x.CrackmeId);                              // solver list / count
        builder.HasIndex(x => x.SolvedAt);                              // monthly leaderboard window
    }
}
