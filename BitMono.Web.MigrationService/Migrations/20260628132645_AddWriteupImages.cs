using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BitMono.Web.MigrationService.Migrations
{
    /// <inheritdoc />
    public partial class AddWriteupImages : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Images",
                table: "Solutions",
                type: "jsonb",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Images",
                table: "Solutions");
        }
    }
}
