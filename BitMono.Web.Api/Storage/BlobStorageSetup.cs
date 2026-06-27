namespace BitMono.Web.Api.Storage;

public static class BlobStorageSetup
{
    // Local disk store. Prod points Storage:Disk:Path at a mounted Docker volume; dev uses App_Data.
    public static void AddBlobStorage(this WebApplicationBuilder builder)
    {
        var path = builder.Configuration["Storage:Disk:Path"]
            ?? Path.Combine(builder.Environment.ContentRootPath, "App_Data", "blobs");
        builder.Services.AddSingleton(new BlobStorage(path));
        builder.Services.AddSingleton<IMalwareScanner, NoOpMalwareScanner>();
    }
}
