using BitMono.Web.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BitMono.Web.Data.Configurations;

public sealed class RatingConfiguration : IEntityTypeConfiguration<Rating>
{
    public void Configure(EntityTypeBuilder<Rating> builder)
    {
        // One vote per identity (filtered so anon + logged-in are deduped separately).
        builder.HasIndex(x => new { x.CrackmeId, x.VoterUserId }).IsUnique()
            .HasFilter("\"VoterUserId\" IS NOT NULL");
        builder.HasIndex(x => new { x.CrackmeId, x.VoterIpHash }).IsUnique()
            .HasFilter("\"VoterIpHash\" IS NOT NULL");

        builder.HasOne(x => x.Crackme).WithMany(c => c.Ratings).HasForeignKey(x => x.CrackmeId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
