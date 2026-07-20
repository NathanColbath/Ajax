using GameLibrary.Api.Engines;
using GameLibrary.Api.Services;
using GameLibrary.Api.Workers;

namespace GameLibrary.Api;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddGameLibraryServices(this IServiceCollection services)
    {
        services.AddScoped<FileStorageService>();
        services.AddScoped<FileDownloadService>();
        services.AddScoped<ArtworkService>();
        services.AddSingleton<HasheousMetadataClient>();
        services.AddHttpClient<RedditPublicFeedbackClient>();
        services.AddHttpClient<IgdbRatingClient>();
        services.AddHttpClient<DeepSeekChatClient>();
        services.AddScoped<AuthService>();
        services.AddScoped<GamesService>();
        services.AddScoped<SystemsService>();
        services.AddScoped<PhysicalService>();
        services.AddScoped<LocationsService>();
        services.AddScoped<UploadsService>();
        services.AddScoped<MetadataService>();
        services.AddScoped<PublicEnrichmentService>();
        services.AddScoped<DuplicatesService>();
        services.AddScoped<ExportsService>();
        services.AddScoped<GameListsService>();
        services.AddScoped<UsersService>();
        services.AddScoped<ConfigService>();
        services.AddScoped<DashboardService>();
        services.AddScoped<LogsService>();
        services.AddScoped<IAppEventLogger, AppEventLogger>();
        services.AddHttpClient();

        services.AddScoped<UploadProcessingEngine>();
        services.AddScoped<MetadataMatchEngine>();
        services.AddScoped<PublicEnrichmentEngine>();
        services.AddScoped<ExportEngine>();
        services.AddScoped<GameListZipEngine>();
        services.AddScoped<DuplicateEngine>();
        services.AddScoped<CheckoutEngine>();

        services.AddHostedService<QueuedWorkProcessor>();
        services.AddHostedService<JobSchedulerHostedService>();
        services.AddHostedService<JobRecoveryHostedService>();

        return services;
    }
}
