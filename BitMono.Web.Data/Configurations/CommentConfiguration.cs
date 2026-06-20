using BitMono.Web.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BitMono.Web.Data.Configurations;

public sealed class CommentConfiguration : IEntityTypeConfiguration<Comment>
{
    public void Configure(EntityTypeBuilder<Comment> builder)
    {
        builder.HasIndex(x => new { x.CrackmeId, x.CreatedAt });
        builder.HasIndex(x => x.ParentCommentId);

        builder.HasOne(x => x.Crackme).WithMany(c => c.Comments).HasForeignKey(x => x.CrackmeId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(x => x.ParentComment).WithMany().HasForeignKey(x => x.ParentCommentId)
            .OnDelete(DeleteBehavior.Restrict); // Postgres rejects multiple cascade paths
    }
}
