using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BitMono.Web.MigrationService.Migrations
{
    /// <inheritdoc />
    public partial class AddHintsAndCommentThreads : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CrackmeHints",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CrackmeId = table.Column<Guid>(type: "uuid", nullable: false),
                    Order = table.Column<int>(type: "integer", nullable: false),
                    Body = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    CostPercent = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CrackmeHints", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CrackmeHints_Crackmes_CrackmeId",
                        column: x => x.CrackmeId,
                        principalTable: "Crackmes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "HintUnlocks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    HintId = table.Column<Guid>(type: "uuid", nullable: false),
                    CrackmeId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CostPercent = table.Column<int>(type: "integer", nullable: false),
                    UnlockedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HintUnlocks", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CrackmeHints_CrackmeId_Order",
                table: "CrackmeHints",
                columns: new[] { "CrackmeId", "Order" });

            migrationBuilder.CreateIndex(
                name: "IX_HintUnlocks_UserId_CrackmeId",
                table: "HintUnlocks",
                columns: new[] { "UserId", "CrackmeId" });

            migrationBuilder.CreateIndex(
                name: "IX_HintUnlocks_UserId_HintId",
                table: "HintUnlocks",
                columns: new[] { "UserId", "HintId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CrackmeHints");

            migrationBuilder.DropTable(
                name: "HintUnlocks");
        }
    }
}
