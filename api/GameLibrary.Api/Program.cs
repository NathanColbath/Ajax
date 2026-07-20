using GameLibrary.Api;
using GameLibrary.Api.Auth;
using GameLibrary.Api.Data;
using GameLibrary.Api.Jobs;
using GameLibrary.Api.Middleware;
using GameLibrary.Api.Services;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.HttpLogging;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

var uploadsOptions = builder.Configuration.GetSection(UploadsOptions.SectionName).Get<UploadsOptions>()
    ?? new UploadsOptions();
var maxRequestBytes = Math.Clamp(uploadsOptions.MaxRequestBytes, 1_048_576, 2L * 1024 * 1024 * 1024);

builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = maxRequestBytes;
});

builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = maxRequestBytes;
});

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddHttpLogging(options =>
{
    options.LoggingFields = HttpLoggingFields.RequestPropertiesAndHeaders
        | HttpLoggingFields.ResponsePropertiesAndHeaders
        | HttpLoggingFields.Duration;
    options.RequestHeaders.Add("User-Agent");
    options.RequestHeaders.Remove("Authorization");
});

var connectionString = builder.Configuration.GetConnectionString("Default")
    ?? "Data Source=../data/gamelibrary.db";

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(connectionString));

builder.Services.Configure<StorageOptions>(
    builder.Configuration.GetSection(StorageOptions.SectionName));
builder.Services.Configure<HasheousOptions>(
    builder.Configuration.GetSection(HasheousOptions.SectionName));
builder.Services.Configure<IgdbOptions>(
    builder.Configuration.GetSection(IgdbOptions.SectionName));
builder.Services.Configure<DeepSeekOptions>(
    builder.Configuration.GetSection(DeepSeekOptions.SectionName));
builder.Services.Configure<UploadsOptions>(
    builder.Configuration.GetSection(UploadsOptions.SectionName));
builder.Services.Configure<HttpClientOptions>(
    builder.Configuration.GetSection(HttpClientOptions.SectionName));
builder.Services.Configure<JobsOptions>(
    builder.Configuration.GetSection(JobsOptions.SectionName));

builder.Services.AddGameLibraryAuth(builder.Configuration);
builder.Services.AddBackgroundJobQueue();
builder.Services.AddGameLibraryServices();

var corsOrigins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>()
    ?? ["http://localhost:4200"];

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins(corsOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials());
});

var app = builder.Build();

HasheousMetadataClient.ConfigureHttpHelper(
    app.Configuration.GetSection(HasheousOptions.SectionName).Get<HasheousOptions>()
    ?? new HasheousOptions());

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
    app.UseHttpLogging();
}

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<RequestLoggingMiddleware>();
app.MapControllers();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();
    await SchemaPatches.ApplyAsync(db);
    await DbSeeder.SeedAsync(db);
}

app.Run();
