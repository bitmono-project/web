using BitMono.Web.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BitMono.Web.Data.Configurations;

public sealed class BadgeConfiguration : IEntityTypeConfiguration<Badge>
{
    public void Configure(EntityTypeBuilder<Badge> builder)
    {
        builder.HasKey(x => x.Code);
    }
}

public sealed class UserBadgeConfiguration : IEntityTypeConfiguration<UserBadge>
{
    public void Configure(EntityTypeBuilder<UserBadge> builder)
    {
        builder.HasIndex(x => new { x.UserId, x.BadgeCode }).IsUnique(); // one award per user per badge
        builder.HasIndex(x => x.UserId);
    }
}
