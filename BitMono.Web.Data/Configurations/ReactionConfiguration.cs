using BitMono.Web.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BitMono.Web.Data.Configurations;

public sealed class ReactionConfiguration : IEntityTypeConfiguration<Reaction>
{
    public void Configure(EntityTypeBuilder<Reaction> builder)
    {
        builder.HasIndex(x => new { x.TargetType, x.TargetId, x.UserId, x.Emoji }).IsUnique();
        builder.HasIndex(x => new { x.TargetType, x.TargetId });
    }
}
