using BitMono.Web.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BitMono.Web.Data.Configurations;

public sealed class CrackmeHintConfiguration : IEntityTypeConfiguration<CrackmeHint>
{
    public void Configure(EntityTypeBuilder<CrackmeHint> builder)
    {
        builder.HasIndex(x => new { x.CrackmeId, x.Order });
        builder.HasOne(x => x.Crackme).WithMany().HasForeignKey(x => x.CrackmeId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class HintUnlockConfiguration : IEntityTypeConfiguration<HintUnlock>
{
    public void Configure(EntityTypeBuilder<HintUnlock> builder)
    {
        builder.HasIndex(x => new { x.UserId, x.HintId }).IsUnique(); // one unlock per user per hint
        builder.HasIndex(x => new { x.UserId, x.CrackmeId });         // solve path: max cost on this crackme
    }
}
