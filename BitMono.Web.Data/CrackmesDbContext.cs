using BitMono.Web.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace BitMono.Web.Data;

// The crackmes gallery schema, on the separate `appdb` Postgres (Hangfire keeps `db`).
// Soft-delete-via-takedown is the norm; hard delete only on admin purge (cascades then fire).
public class CrackmesDbContext(DbContextOptions<CrackmesDbContext> options) : DbContext(options)
{
    public DbSet<Crackme> Crackmes => Set<Crackme>();
    public DbSet<Solution> Solutions => Set<Solution>();
    public DbSet<Comment> Comments => Set<Comment>();
    public DbSet<Rating> Ratings => Set<Rating>();
    public DbSet<Tag> Tags => Set<Tag>();
    public DbSet<CrackmeTag> CrackmeTags => Set<CrackmeTag>();
    public DbSet<ModerationReview> ModerationReviews => Set<ModerationReview>();
    public DbSet<Report> Reports => Set<Report>();
    public DbSet<TermsAcceptance> TermsAcceptances => Set<TermsAcceptance>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Crackme>(e =>
        {
            e.HasIndex(x => x.Slug).IsUnique();
            e.HasIndex(x => x.Sha256);
            e.HasIndex(x => new { x.Status, x.PublishedAt });
            e.HasIndex(x => x.TargetPlatform);
            e.HasIndex(x => x.IsBitMonoObfuscated);
            e.HasIndex(x => x.UploaderUserId);
            e.HasIndex(x => x.CreatedAt);
            e.OwnsMany(x => x.ProtectionsApplied, p => p.ToJson());
            e.HasOne(x => x.TermsAcceptance).WithMany().HasForeignKey(x => x.TermsAcceptanceId)
                .OnDelete(DeleteBehavior.Restrict); // keep the legal record
        });

        b.Entity<Solution>(e =>
        {
            e.HasIndex(x => new { x.CrackmeId, x.Status });
            e.HasIndex(x => x.CreatedAt);
            e.HasOne(x => x.Crackme).WithMany(c => c.Solutions).HasForeignKey(x => x.CrackmeId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<Comment>(e =>
        {
            e.HasIndex(x => new { x.CrackmeId, x.CreatedAt });
            e.HasIndex(x => x.ParentCommentId);
            e.HasOne(x => x.Crackme).WithMany(c => c.Comments).HasForeignKey(x => x.CrackmeId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.ParentComment).WithMany().HasForeignKey(x => x.ParentCommentId)
                .OnDelete(DeleteBehavior.Restrict); // Postgres rejects multiple cascade paths
        });

        b.Entity<Rating>(e =>
        {
            e.HasIndex(x => new { x.CrackmeId, x.VoterUserId }).IsUnique()
                .HasFilter("\"VoterUserId\" IS NOT NULL");
            e.HasIndex(x => new { x.CrackmeId, x.VoterIpHash }).IsUnique()
                .HasFilter("\"VoterIpHash\" IS NOT NULL");
            e.HasOne(x => x.Crackme).WithMany(c => c.Ratings).HasForeignKey(x => x.CrackmeId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<Tag>(e => e.HasIndex(x => x.Slug).IsUnique());

        b.Entity<CrackmeTag>(e =>
        {
            e.HasKey(x => new { x.CrackmeId, x.TagId });
            e.HasIndex(x => x.TagId);
            e.HasOne(x => x.Crackme).WithMany(c => c.Tags).HasForeignKey(x => x.CrackmeId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Tag).WithMany(t => t.Crackmes).HasForeignKey(x => x.TagId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<ModerationReview>(e =>
        {
            e.HasIndex(x => new { x.TargetType, x.TargetId });
            e.HasIndex(x => x.CrackmeId);
            e.HasIndex(x => x.Verdict);
            e.HasIndex(x => x.CreatedAt);
            e.HasOne(x => x.Crackme).WithMany(c => c.Reviews).HasForeignKey(x => x.CrackmeId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<Report>(e =>
        {
            e.HasIndex(x => new { x.TargetType, x.TargetId });
            e.HasIndex(x => x.IsResolved);
            e.HasOne(x => x.Crackme).WithMany().HasForeignKey(x => x.CrackmeId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<TermsAcceptance>(e => e.HasIndex(x => x.AcceptedAt));
    }
}
