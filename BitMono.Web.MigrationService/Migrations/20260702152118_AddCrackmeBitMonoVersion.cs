using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BitMono.Web.MigrationService.Migrations
{
    /// <inheritdoc />
    public partial class AddCrackmeBitMonoVersion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BitMonoVersion",
                table: "Crackmes",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "BitMonoVersionPacked",
                table: "Crackmes",
                type: "bigint",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BitMonoVersion",
                table: "Crackmes");

            migrationBuilder.DropColumn(
                name: "BitMonoVersionPacked",
                table: "Crackmes");
        }
    }
}
