using BitMono.Web.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BitMono.Web.Data.Configurations;

public sealed class CommentEditConfiguration : IEntityTypeConfiguration<CommentEdit>
{
    public void Configure(EntityTypeBuilder<CommentEdit> builder)
    {
        builder.HasIndex(x => new { x.CommentId, x.EditedAt });
        builder.HasOne(x => x.Comment).WithMany().HasForeignKey(x => x.CommentId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
