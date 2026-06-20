using BitMono.Web.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BitMono.Web.Data.Configurations;

public sealed class CrackmeConfiguration : IEntityTypeConfiguration<Crackme>
{
    public void Configure(EntityTypeBuilder<Crackme> builder)
    {
        builder.HasIndex(x => x.Slug).IsUnique();
        builder.HasIndex(x => x.Sha256);
        builder.HasIndex(x => new { x.Status, x.PublishedAt });
        builder.HasIndex(x => x.TargetPlatform);
        builder.HasIndex(x => x.IsBitMonoObfuscated);
        builder.HasIndex(x => x.UploaderUserId);
        builder.HasIndex(x => x.CreatedAt);

        builder.OwnsMany(x => x.ProtectionsApplied, p => p.ToJson());

        builder.HasOne(x => x.TermsAcceptance).WithMany().HasForeignKey(x => x.TermsAcceptanceId)
            .OnDelete(DeleteBehavior.Restrict); // keep the legal record
    }
}
