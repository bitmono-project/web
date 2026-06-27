using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BitMono.Web.MigrationService.Migrations
{
    /// <inheritdoc />
    public partial class AddProgression : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Points",
                table: "Users",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "Solves",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CrackmeId = table.Column<Guid>(type: "uuid", nullable: false),
                    Source = table.Column<int>(type: "integer", nullable: false),
                    PointsAwarded = table.Column<int>(type: "integer", nullable: false),
                    IsFirstBlood = table.Column<bool>(type: "boolean", nullable: false),
                    SolvedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Solves", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Solves_CrackmeId",
                table: "Solves",
                column: "CrackmeId");

            migrationBuilder.CreateIndex(
                name: "IX_Solves_SolvedAt",
                table: "Solves",
                column: "SolvedAt");

            migrationBuilder.CreateIndex(
                name: "IX_Solves_UserId_CrackmeId",
                table: "Solves",
                columns: new[] { "UserId", "CrackmeId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Solves");

            migrationBuilder.DropColumn(
                name: "Points",
                table: "Users");
        }
    }
}
