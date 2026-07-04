using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BitMono.Web.MigrationService.Migrations
{
    /// <inheritdoc />
    public partial class ReleaseScanStatusToEnum : Migration
    {
        // ReleaseScans.Status moves from free-text ('pending'/'done') to the int-backed ScanStatus enum
        // (house style — enums persist as int). EF's scaffolded AlterColumn would emit `USING "Status"::integer`,
        // which throws on the existing text rows, so convert by hand with a CASE. Ordinals must match the enum:
        // Pending = 0, Done = 1, Skipped = 2.
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "ReleaseScans" ALTER COLUMN "Status" TYPE integer
                USING (CASE "Status" WHEN 'done' THEN 1 WHEN 'skipped' THEN 2 ELSE 0 END);
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "ReleaseScans" ALTER COLUMN "Status" TYPE character varying(16)
                USING (CASE "Status" WHEN 1 THEN 'done' WHEN 2 THEN 'skipped' ELSE 'pending' END);
                """);
        }
    }
}
