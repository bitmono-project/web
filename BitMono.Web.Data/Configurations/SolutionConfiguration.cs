using BitMono.Web.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BitMono.Web.Data.Configurations;

public sealed class SolutionConfiguration : IEntityTypeConfiguration<Solution>
{
    public void Configure(EntityTypeBuilder<Solution> builder)
    {
        builder.HasIndex(x => new { x.CrackmeId, x.Status });
        builder.HasIndex(x => x.CreatedAt);

        builder.OwnsMany(x => x.Images, i => i.ToJson());

        builder.HasOne(x => x.Crackme).WithMany(c => c.Solutions).HasForeignKey(x => x.CrackmeId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
