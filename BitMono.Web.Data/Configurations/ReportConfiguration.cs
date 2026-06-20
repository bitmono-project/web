using BitMono.Web.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BitMono.Web.Data.Configurations;

public sealed class ReportConfiguration : IEntityTypeConfiguration<Report>
{
    public void Configure(EntityTypeBuilder<Report> builder)
    {
        builder.HasIndex(x => new { x.TargetType, x.TargetId });
        builder.HasIndex(x => x.IsResolved);

        builder.HasOne(x => x.Crackme).WithMany().HasForeignKey(x => x.CrackmeId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
