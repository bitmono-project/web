using BitMono.Web.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BitMono.Web.Data.Configurations;

public sealed class ModerationReviewConfiguration : IEntityTypeConfiguration<ModerationReview>
{
    public void Configure(EntityTypeBuilder<ModerationReview> builder)
    {
        builder.HasIndex(x => new { x.TargetType, x.TargetId });
        builder.HasIndex(x => x.CrackmeId);
        builder.HasIndex(x => x.Verdict);
        builder.HasIndex(x => x.CreatedAt);

        builder.HasOne(x => x.Crackme).WithMany(c => c.Reviews).HasForeignKey(x => x.CrackmeId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
