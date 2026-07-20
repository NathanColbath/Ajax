namespace GameLibrary.Api.Services;

public class UploadsOptions
{
    public const string SectionName = "Uploads";

    /// <summary>Max multipart / request body size in bytes (Kestrel + form).</summary>
    public long MaxRequestBytes { get; set; } = 536_870_912;
}

public class HttpClientOptions
{
    public const string SectionName = "Http";

    public int DefaultTimeoutSeconds { get; set; } = 30;
    public int EnrichmentTimeoutSeconds { get; set; } = 90;
}

public class JobsOptions
{
    public const string SectionName = "Jobs";

    /// <summary>Optional deploy override for upload concurrency (1–8). Null = use SystemConfig.</summary>
    public int? MaxParallelUploadJobs { get; set; }

    public bool? BackgroundJobsEnabled { get; set; }
}
