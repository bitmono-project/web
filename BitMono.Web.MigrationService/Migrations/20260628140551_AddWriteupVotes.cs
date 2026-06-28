using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BitMono.Web.MigrationService.Migrations
{
    /// <inheritdoc />
    public partial class AddWriteupVotes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "HelpedCount",
                table: "Solutions",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "IsAuthorPick",
                table: "Solutions",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "SolutionVotes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SolutionId = table.Column<Guid>(type: "uuid", nullable: false),
                    VoterUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SolutionVotes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SolutionVotes_Solutions_SolutionId",
                        column: x => x.SolutionId,
                        principalTable: "Solutions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SolutionVotes_SolutionId_VoterUserId_Kind",
                table: "SolutionVotes",
                columns: new[] { "SolutionId", "VoterUserId", "Kind" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SolutionVotes");

            migrationBuilder.DropColumn(
                name: "HelpedCount",
                table: "Solutions");

            migrationBuilder.DropColumn(
                name: "IsAuthorPick",
                table: "Solutions");
        }
    }
}
