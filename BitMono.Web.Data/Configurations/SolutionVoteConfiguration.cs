using BitMono.Web.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BitMono.Web.Data.Configurations;

public sealed class SolutionVoteConfiguration : IEntityTypeConfiguration<SolutionVote>
{
    public void Configure(EntityTypeBuilder<SolutionVote> builder)
    {
        // One vote of each kind per user per writeup — DB-enforced de-dupe.
        builder.HasIndex(x => new { x.SolutionId, x.VoterUserId, x.Kind }).IsUnique();

        builder.HasOne(x => x.Solution).WithMany().HasForeignKey(x => x.SolutionId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
