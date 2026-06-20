using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BitMono.Web.MigrationService.Migrations
{
    /// <inheritdoc />
    public partial class Initial : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Tags",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Slug = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Name = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    UsageCount = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Tags", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TermsAcceptances",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: true),
                    TermsVersion = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    AcceptedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Ip = table.Column<string>(type: "character varying(45)", maxLength: 45, nullable: true),
                    UserAgent = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TermsAcceptances", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Crackmes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Slug = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Title = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Description = table.Column<string>(type: "character varying(8000)", maxLength: 8000, nullable: true),
                    AuthorDifficulty = table.Column<int>(type: "integer", nullable: false),
                    TargetPlatform = table.Column<int>(type: "integer", nullable: false),
                    DotnetRuntime = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Language = table.Column<int>(type: "integer", nullable: false),
                    Preset = table.Column<int>(type: "integer", nullable: false),
                    IsBitMonoObfuscated = table.Column<bool>(type: "boolean", nullable: false),
                    StorageKey = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    Sha256 = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    SizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    OriginalFileName = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: true),
                    ContentType = table.Column<string>(type: "character varying(127)", maxLength: 127, nullable: true),
                    DownloadCount = table.Column<long>(type: "bigint", nullable: false),
                    SolvedCount = table.Column<int>(type: "integer", nullable: false),
                    DifficultySum = table.Column<int>(type: "integer", nullable: false),
                    DifficultyCount = table.Column<int>(type: "integer", nullable: false),
                    QualitySum = table.Column<int>(type: "integer", nullable: false),
                    QualityCount = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CurrentVerdict = table.Column<int>(type: "integer", nullable: true),
                    PublicModeratorMessage = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    IsTakenDown = table.Column<bool>(type: "boolean", nullable: false),
                    TakenDownAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    TakedownReason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    PublishedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UploaderUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    AnonymousHandle = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    UploaderIp = table.Column<string>(type: "character varying(45)", maxLength: 45, nullable: true),
                    TermsAcceptanceId = table.Column<Guid>(type: "uuid", nullable: true),
                    ProtectionsApplied = table.Column<string>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Crackmes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Crackmes_TermsAcceptances_TermsAcceptanceId",
                        column: x => x.TermsAcceptanceId,
                        principalTable: "TermsAcceptances",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Comments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CrackmeId = table.Column<Guid>(type: "uuid", nullable: false),
                    ParentCommentId = table.Column<Guid>(type: "uuid", nullable: true),
                    AuthorUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    AnonymousHandle = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    Body = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    IsSpoiler = table.Column<bool>(type: "boolean", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    IsHidden = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Comments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Comments_Comments_ParentCommentId",
                        column: x => x.ParentCommentId,
                        principalTable: "Comments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Comments_Crackmes_CrackmeId",
                        column: x => x.CrackmeId,
                        principalTable: "Crackmes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CrackmeTags",
                columns: table => new
                {
                    CrackmeId = table.Column<Guid>(type: "uuid", nullable: false),
                    TagId = table.Column<Guid>(type: "uuid", nullable: false),
                    AddedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CrackmeTags", x => new { x.CrackmeId, x.TagId });
                    table.ForeignKey(
                        name: "FK_CrackmeTags_Crackmes_CrackmeId",
                        column: x => x.CrackmeId,
                        principalTable: "Crackmes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CrackmeTags_Tags_TagId",
                        column: x => x.TagId,
                        principalTable: "Tags",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ModerationReviews",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TargetType = table.Column<int>(type: "integer", nullable: false),
                    TargetId = table.Column<Guid>(type: "uuid", nullable: false),
                    CrackmeId = table.Column<Guid>(type: "uuid", nullable: true),
                    ReviewerId = table.Column<Guid>(type: "uuid", nullable: false),
                    Verdict = table.Column<int>(type: "integer", nullable: false),
                    PublicMessage = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    InternalNotes = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    TakedownReason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    IsTakedown = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ModerationReviews", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ModerationReviews_Crackmes_CrackmeId",
                        column: x => x.CrackmeId,
                        principalTable: "Crackmes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Ratings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CrackmeId = table.Column<Guid>(type: "uuid", nullable: false),
                    VoterUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    VoterIpHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    Difficulty = table.Column<byte>(type: "smallint", nullable: false),
                    Quality = table.Column<byte>(type: "smallint", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Ratings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Ratings_Crackmes_CrackmeId",
                        column: x => x.CrackmeId,
                        principalTable: "Crackmes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Reports",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TargetType = table.Column<int>(type: "integer", nullable: false),
                    TargetId = table.Column<Guid>(type: "uuid", nullable: false),
                    CrackmeId = table.Column<Guid>(type: "uuid", nullable: true),
                    ReporterUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    ReporterIp = table.Column<string>(type: "character varying(45)", maxLength: 45, nullable: true),
                    Reason = table.Column<int>(type: "integer", nullable: false),
                    Details = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    IsResolved = table.Column<bool>(type: "boolean", nullable: false),
                    ResolvedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ResolvedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Reports", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Reports_Crackmes_CrackmeId",
                        column: x => x.CrackmeId,
                        principalTable: "Crackmes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Solutions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CrackmeId = table.Column<Guid>(type: "uuid", nullable: false),
                    AuthorUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    AnonymousHandle = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    Title = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    BodyMarkdown = table.Column<string>(type: "character varying(40000)", maxLength: 40000, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    HasAttachment = table.Column<bool>(type: "boolean", nullable: false),
                    StorageKey = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    Sha256 = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    SizeBytes = table.Column<long>(type: "bigint", nullable: true),
                    UpvoteCount = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Solutions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Solutions_Crackmes_CrackmeId",
                        column: x => x.CrackmeId,
                        principalTable: "Crackmes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Comments_CrackmeId_CreatedAt",
                table: "Comments",
                columns: new[] { "CrackmeId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Comments_ParentCommentId",
                table: "Comments",
                column: "ParentCommentId");

            migrationBuilder.CreateIndex(
                name: "IX_Crackmes_CreatedAt",
                table: "Crackmes",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_Crackmes_IsBitMonoObfuscated",
                table: "Crackmes",
                column: "IsBitMonoObfuscated");

            migrationBuilder.CreateIndex(
                name: "IX_Crackmes_Sha256",
                table: "Crackmes",
                column: "Sha256");

            migrationBuilder.CreateIndex(
                name: "IX_Crackmes_Slug",
                table: "Crackmes",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Crackmes_Status_PublishedAt",
                table: "Crackmes",
                columns: new[] { "Status", "PublishedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Crackmes_TargetPlatform",
                table: "Crackmes",
                column: "TargetPlatform");

            migrationBuilder.CreateIndex(
                name: "IX_Crackmes_TermsAcceptanceId",
                table: "Crackmes",
                column: "TermsAcceptanceId");

            migrationBuilder.CreateIndex(
                name: "IX_Crackmes_UploaderUserId",
                table: "Crackmes",
                column: "UploaderUserId");

            migrationBuilder.CreateIndex(
                name: "IX_CrackmeTags_TagId",
                table: "CrackmeTags",
                column: "TagId");

            migrationBuilder.CreateIndex(
                name: "IX_ModerationReviews_CrackmeId",
                table: "ModerationReviews",
                column: "CrackmeId");

            migrationBuilder.CreateIndex(
                name: "IX_ModerationReviews_CreatedAt",
                table: "ModerationReviews",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_ModerationReviews_TargetType_TargetId",
                table: "ModerationReviews",
                columns: new[] { "TargetType", "TargetId" });

            migrationBuilder.CreateIndex(
                name: "IX_ModerationReviews_Verdict",
                table: "ModerationReviews",
                column: "Verdict");

            migrationBuilder.CreateIndex(
                name: "IX_Ratings_CrackmeId_VoterIpHash",
                table: "Ratings",
                columns: new[] { "CrackmeId", "VoterIpHash" },
                unique: true,
                filter: "\"VoterIpHash\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Ratings_CrackmeId_VoterUserId",
                table: "Ratings",
                columns: new[] { "CrackmeId", "VoterUserId" },
                unique: true,
                filter: "\"VoterUserId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Reports_CrackmeId",
                table: "Reports",
                column: "CrackmeId");

            migrationBuilder.CreateIndex(
                name: "IX_Reports_IsResolved",
                table: "Reports",
                column: "IsResolved");

            migrationBuilder.CreateIndex(
                name: "IX_Reports_TargetType_TargetId",
                table: "Reports",
                columns: new[] { "TargetType", "TargetId" });

            migrationBuilder.CreateIndex(
                name: "IX_Solutions_CrackmeId_Status",
                table: "Solutions",
                columns: new[] { "CrackmeId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_Solutions_CreatedAt",
                table: "Solutions",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_Tags_Slug",
                table: "Tags",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TermsAcceptances_AcceptedAt",
                table: "TermsAcceptances",
                column: "AcceptedAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Comments");

            migrationBuilder.DropTable(
                name: "CrackmeTags");

            migrationBuilder.DropTable(
                name: "ModerationReviews");

            migrationBuilder.DropTable(
                name: "Ratings");

            migrationBuilder.DropTable(
                name: "Reports");

            migrationBuilder.DropTable(
                name: "Solutions");

            migrationBuilder.DropTable(
                name: "Tags");

            migrationBuilder.DropTable(
                name: "Crackmes");

            migrationBuilder.DropTable(
                name: "TermsAcceptances");
        }
    }
}
