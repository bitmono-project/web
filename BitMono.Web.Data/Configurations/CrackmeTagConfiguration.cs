using BitMono.Web.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BitMono.Web.Data.Configurations;

public sealed class CrackmeTagConfiguration : IEntityTypeConfiguration<CrackmeTag>
{
    public void Configure(EntityTypeBuilder<CrackmeTag> builder)
    {
        builder.HasKey(x => new { x.CrackmeId, x.TagId });
        builder.HasIndex(x => x.TagId);

        builder.HasOne(x => x.Crackme).WithMany(c => c.Tags).HasForeignKey(x => x.CrackmeId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(x => x.Tag).WithMany(t => t.Crackmes).HasForeignKey(x => x.TagId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
