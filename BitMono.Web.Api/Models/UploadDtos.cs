using BitMono.Web.Data;
using Microsoft.AspNetCore.Http;

namespace BitMono.Web.Api.Models;

// Multipart submit form (file + metadata + the three terms checkboxes).
public sealed class UploadForm
{
    public IFormFile? File { get; set; }
    public string Title { get; set; } = "";
    public string? Description { get; set; }
    public TargetPlatform Platform { get; set; }
    public string? Runtime { get; set; }
    public SourceLanguage Language { get; set; }
    public Difficulty Difficulty { get; set; }
    public ObfuscationPreset Preset { get; set; } = ObfuscationPreset.Custom;
    public bool IsBitMonoObfuscated { get; set; }
    public string[] Protections { get; set; } = [];

    public bool AcceptOriginal { get; set; } // I made this / have rights to share it
    public bool AcceptLegal { get; set; }    // not malware / commercial crack / DRM bypass
    public bool AcceptVm { get; set; }       // runs, educational, may trip AV

    // Owner reaction toggles (default on; frontend always sends explicit values).
    public bool ReactionsEnabled { get; set; } = true;
    public bool CommentReactionsEnabled { get; set; } = true;
}

public sealed record UploadResponse(Guid Id, string Slug, string Status);
