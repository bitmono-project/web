using ICSharpCode.SharpZipLib.Zip;

namespace BitMono.Web.Api.Storage;

// Wrap a file in a password-protected zip (crackmes.one convention) so AV / browsers / hosts don't
// auto-scan or detonate obfuscated binaries on download. Traditional ZipCrypto — weak by design,
// but universally extractable; the point is friction, not secrecy.
public static class PasswordZip
{
    public static byte[] Create(string entryName, byte[] data, string password)
    {
        using var output = new MemoryStream();
        using (var zip = new ZipOutputStream(output) { IsStreamOwner = false })
        {
            zip.SetLevel(6);
            zip.Password = password;
            zip.PutNextEntry(new ZipEntry(entryName) { DateTime = DateTime.UtcNow, Size = data.Length });
            zip.Write(data, 0, data.Length);
            zip.CloseEntry();
        }
        return output.ToArray();
    }
}
