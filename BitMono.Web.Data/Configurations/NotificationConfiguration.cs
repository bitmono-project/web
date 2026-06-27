using BitMono.Web.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BitMono.Web.Data.Configurations;

public sealed class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> builder)
    {
        builder.HasIndex(x => new { x.RecipientUserId, x.CreatedAt }); // the feed
        builder.HasIndex(x => new { x.RecipientUserId, x.IsRead });    // the unread badge count
    }
}
