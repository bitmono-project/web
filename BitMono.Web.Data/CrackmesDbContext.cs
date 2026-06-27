using BitMono.Web.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace BitMono.Web.Data;

// The crackmes gallery schema, on the separate `appdb` Postgres (Hangfire keeps `db`).
// Per-entity config lives in Configurations/ (IEntityTypeConfiguration), applied here.
public class CrackmesDbContext(DbContextOptions<CrackmesDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Crackme> Crackmes => Set<Crackme>();
    public DbSet<Solution> Solutions => Set<Solution>();
    public DbSet<Comment> Comments => Set<Comment>();
    public DbSet<Rating> Ratings => Set<Rating>();
    public DbSet<Tag> Tags => Set<Tag>();
    public DbSet<CrackmeTag> CrackmeTags => Set<CrackmeTag>();
    public DbSet<ModerationReview> ModerationReviews => Set<ModerationReview>();
    public DbSet<Report> Reports => Set<Report>();
    public DbSet<TermsAcceptance> TermsAcceptances => Set<TermsAcceptance>();

    protected override void OnModelCreating(ModelBuilder modelBuilder) =>
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(CrackmesDbContext).Assembly);
}
