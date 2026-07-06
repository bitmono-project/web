using System.Text.Json;
using System.Text.Json.Serialization;
using ICSharpCode.Decompiler;
using ICSharpCode.Decompiler.CSharp;
using ICSharpCode.Decompiler.TypeSystem;

namespace BitMono.Web.Api.Obfuscation;

// What a decompiler (the ILSpy engine) makes of the OUTPUT assembly, so the UI can show before → after.
// Ok = clean C# recovered; Degraded = decompiled but ~nothing readable; Defeated = the decompiler threw
// (metadata/IL it can't parse) — the honest "your code is a black box now" state. Append-only.
public enum DecompileOutcome { Ok, Degraded, Defeated }

// Before = the clean input decompiled (a bounded sample). After/Error depend on Outcome. Responsible =
// the applied protections known to break decompilers, so the UI can name the culprit truthfully.
public sealed record DecompilePreview(
    string? Before,
    DecompileOutcome Outcome,
    string? After,
    string? ErrorType,
    string? ErrorMessage,
    IReadOnlyList<string> ResponsibleProtections,
    IReadOnlyList<string> ProtectionsApplied);

// Decompiles a bounded sample of the input and the output so the obfuscate flow can show what a reverser
// sees. Runs inside ObfuscateJob (the only moment both byte arrays exist), never on the request path.
public static class DecompilerPreviewer
{
    private const int MaxLines = 60; // a sample — the point lands in a screenful, and it bounds the payload

    // Protections that visibly break/degrade a decompiler — vs renaming/strings, which still decompile.
    // Names match the engine's protection ids; used only to name the culprit in the "defeated" caption.
    private static readonly HashSet<string> DecompilerBreakers = new(StringComparer.OrdinalIgnoreCase)
    {
        "AntiILdasm", "AntiDe4dot", "CallToCalli", "UnmanagedString", "BillionNops", "DotNetHook",
    };

    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) },
    };

    public static string AnalyzeToJson(byte[] input, byte[] output, IReadOnlyList<string> protections) =>
        JsonSerializer.Serialize(Analyze(input, output, protections), Json);

    public static DecompilePreview Analyze(byte[] input, byte[] output, IReadOnlyList<string> protections)
    {
        // The input is the user's clean code — if it won't decompile (rare) we just show no "before".
        string? before = null;
        try { before = Decompile(input, out _); } catch { }

        var responsible = protections.Where(DecompilerBreakers.Contains).ToList();
        try
        {
            var after = Decompile(output, out var realTypes);
            var outcome = realTypes <= 0 || string.IsNullOrWhiteSpace(after) ? DecompileOutcome.Degraded : DecompileOutcome.Ok;
            return new DecompilePreview(before, outcome, after, null, null, responsible, protections.ToList());
        }
        catch (Exception ex)
        {
            // The decompiler threw — the money shot. Surface the real exception so the UI reads authentic.
            return new DecompilePreview(before, DecompileOutcome.Defeated, null, ex.GetType().Name, Clip(ex.Message, 200), responsible, protections.ToList());
        }
    }

    // Decompile the first user type (bounded), or the whole module if there's no obvious main type.
    // Throws when the assembly can't be read — the caller turns that into DecompileOutcome.Defeated.
    private static string Decompile(byte[] assembly, out int realTypes)
    {
        // CSharpDecompiler wants a path (it sets up assembly resolution from it); write a throwaway temp.
        var tmp = Path.Combine(Path.GetTempPath(), $"bm-decomp-{Guid.NewGuid():N}.dll");
        File.WriteAllBytes(tmp, assembly);
        try
        {
            var settings = new DecompilerSettings { ThrowOnAssemblyResolveErrors = false };
            var decompiler = new CSharpDecompiler(tmp, settings);
            // Top-level, user-defined types only — the synthetic "<Module>" type is excluded by the '<' filter.
            var types = decompiler.TypeSystem.MainModule.TypeDefinitions
                .Where(t => t.DeclaringTypeDefinition == null && !t.Name.StartsWith('<'))
                .ToList();
            realTypes = types.Count;
            var code = types.Count > 0
                ? decompiler.DecompileTypeAsString(types[0].FullTypeName)
                : decompiler.DecompileWholeModuleAsString();
            return Cap(code);
        }
        finally { try { File.Delete(tmp); } catch { } }
    }

    private static string Cap(string code)
    {
        var lines = code.Replace("\r\n", "\n").Split('\n');
        return lines.Length <= MaxLines
            ? code
            : string.Join('\n', lines.Take(MaxLines)) + $"\n// … +{lines.Length - MaxLines} more lines";
    }

    private static string Clip(string s, int max) => s.Length <= max ? s : s[..max] + "…";
}
