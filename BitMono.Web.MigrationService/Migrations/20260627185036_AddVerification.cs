using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BitMono.Web.MigrationService.Migrations
{
    /// <inheritdoc />
    public partial class AddVerification : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "VerificationHash",
                table: "Crackmes",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "VerificationKind",
                table: "Crackmes",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "VerificationPattern",
                table: "Crackmes",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "VerificationSalt",
                table: "Crackmes",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "VerificationHash",
                table: "Crackmes");

            migrationBuilder.DropColumn(
                name: "VerificationKind",
                table: "Crackmes");

            migrationBuilder.DropColumn(
                name: "VerificationPattern",
                table: "Crackmes");

            migrationBuilder.DropColumn(
                name: "VerificationSalt",
                table: "Crackmes");
        }
    }
}
