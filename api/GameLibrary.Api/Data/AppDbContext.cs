using System.Text.Json;
using GameLibrary.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace GameLibrary.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<Game> Games => Set<Game>();
    public DbSet<GameFile> GameFiles => Set<GameFile>();
    public DbSet<UserGameState> UserGameStates => Set<UserGameState>();
    public DbSet<GameSystem> Systems => Set<GameSystem>();
    public DbSet<PhysicalLocation> Locations => Set<PhysicalLocation>();
    public DbSet<PhysicalItem> PhysicalItems => Set<PhysicalItem>();
    public DbSet<UploadJob> UploadJobs => Set<UploadJob>();
    public DbSet<MetadataProvider> MetadataProviders => Set<MetadataProvider>();
    public DbSet<MetadataReviewItem> MetadataReviewItems => Set<MetadataReviewItem>();
    public DbSet<DuplicateGroup> DuplicateGroups => Set<DuplicateGroup>();
    public DbSet<DuplicateFile> DuplicateFiles => Set<DuplicateFile>();
    public DbSet<ExportJob> ExportJobs => Set<ExportJob>();
    public DbSet<SystemConfigEntity> SystemConfig => Set<SystemConfigEntity>();
    public DbSet<StoragePathEntity> StoragePaths => Set<StoragePathEntity>();
    public DbSet<BackgroundJob> BackgroundJobs => Set<BackgroundJob>();
    public DbSet<LogEntry> LogEntries => Set<LogEntry>();
    public DbSet<GameReview> GameReviews => Set<GameReview>();
    public DbSet<GameCuratedReview> GameCuratedReviews => Set<GameCuratedReview>();
    public DbSet<PublicEnrichmentState> PublicEnrichmentStates => Set<PublicEnrichmentState>();
    public DbSet<UserGameList> UserGameLists => Set<UserGameList>();
    public DbSet<UserGameListItem> UserGameListItems => Set<UserGameListItem>();
    public DbSet<GameListDownloadJob> GameListDownloadJobs => Set<GameListDownloadJob>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var stringListConverter = CreateStringListConverter();
        var stringDictConverter = CreateStringDictionaryConverter();

        var stringListComparer = new ValueComparer<List<string>>(
            (left, right) => left!.SequenceEqual(right!),
            value => value.Aggregate(0, (hash, item) => HashCode.Combine(hash, item.GetHashCode())),
            value => value.ToList());

        var stringDictComparer = new ValueComparer<Dictionary<string, string>>(
            (left, right) =>
                left!.Count == right!.Count && left.OrderBy(kv => kv.Key).SequenceEqual(right.OrderBy(kv => kv.Key)),
            value => value.Aggregate(0, (hash, kv) => HashCode.Combine(hash, kv.Key.GetHashCode(), kv.Value.GetHashCode())),
            value => new Dictionary<string, string>(value, StringComparer.OrdinalIgnoreCase));

        modelBuilder.Entity<AppUser>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Email).IsUnique();
        });

        modelBuilder.Entity<Game>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Genres).HasConversion(stringListConverter, stringListComparer);
            entity.Property(e => e.Tags).HasConversion(stringListConverter, stringListComparer);
            entity.Property(e => e.Languages).HasConversion(stringListConverter, stringListComparer);
            entity.Property(e => e.Screenshots).HasConversion(stringListConverter, stringListComparer);
            entity.Property(e => e.CreatedAt).HasConversion(
                v => v.ToString("O"),
                v => string.IsNullOrWhiteSpace(v)
                    ? DateTimeOffset.UtcNow
                    : DateTimeOffset.Parse(v, null, System.Globalization.DateTimeStyles.RoundtripKind));
        });

        modelBuilder.Entity<GameFile>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasOne(e => e.Game)
                .WithMany(g => g.Files)
                .HasForeignKey(e => e.GameId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<UserGameState>(entity =>
        {
            entity.HasKey(e => new { e.UserId, e.GameId });
            entity.Property(e => e.LastPlayedAt).HasConversion(
                v => v.HasValue ? v.Value.ToString("O") : null,
                v => string.IsNullOrWhiteSpace(v)
                    ? null
                    : DateTimeOffset.Parse(v, null, System.Globalization.DateTimeStyles.RoundtripKind));
            entity.HasOne(e => e.User)
                .WithMany(u => u.GameStates)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Game)
                .WithMany(g => g.UserStates)
                .HasForeignKey(e => e.GameId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<GameReview>(entity =>
        {
            entity.ToTable("GameReviews");
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.UserId, e.GameId }).IsUnique();
            entity.Property(e => e.CreatedAt).HasConversion(
                v => v.ToString("O"),
                v => DateTimeOffset.Parse(v, null, System.Globalization.DateTimeStyles.RoundtripKind));
            entity.Property(e => e.UpdatedAt).HasConversion(
                v => v.ToString("O"),
                v => DateTimeOffset.Parse(v, null, System.Globalization.DateTimeStyles.RoundtripKind));
            entity.HasOne(e => e.User)
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Game)
                .WithMany()
                .HasForeignKey(e => e.GameId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<GameCuratedReview>(entity =>
        {
            entity.ToTable("GameCuratedReviews");
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.GameId, e.Provider });
            entity.Property(e => e.CreatedAt).HasConversion(
                v => v.ToString("O"),
                v => DateTimeOffset.Parse(v, null, System.Globalization.DateTimeStyles.RoundtripKind));
            entity.HasOne(e => e.Game)
                .WithMany()
                .HasForeignKey(e => e.GameId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PublicEnrichmentState>(entity =>
        {
            entity.ToTable("PublicEnrichmentStates");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.UpdatedAt).HasConversion(
                v => v.ToString("O"),
                v => DateTimeOffset.Parse(v, null, System.Globalization.DateTimeStyles.RoundtripKind));
        });

        modelBuilder.Entity<GameSystem>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Extensions).HasConversion(stringListConverter, stringListComparer);
            entity.Property(e => e.MetadataProviderIds).HasConversion(stringDictConverter, stringDictComparer);
        });

        modelBuilder.Entity<PhysicalLocation>(entity =>
        {
            entity.HasKey(e => e.Id);
        });

        modelBuilder.Entity<PhysicalItem>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.GameId);
            entity.HasOne(e => e.Location)
                .WithMany(l => l.Items)
                .HasForeignKey(e => e.LocationId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(e => e.Game)
                .WithMany()
                .HasForeignKey(e => e.GameId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<UploadJob>(entity =>
        {
            entity.HasKey(e => e.Id);
        });

        modelBuilder.Entity<MetadataProvider>(entity =>
        {
            entity.HasKey(e => e.Id);
        });

        modelBuilder.Entity<MetadataReviewItem>(entity =>
        {
            entity.HasKey(e => e.Id);
        });

        modelBuilder.Entity<DuplicateGroup>(entity =>
        {
            entity.HasKey(e => e.Id);
        });

        modelBuilder.Entity<DuplicateFile>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasOne(e => e.DuplicateGroup)
                .WithMany(g => g.Files)
                .HasForeignKey(e => e.DuplicateGroupId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ExportJob>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Scopes).HasConversion(stringListConverter, stringListComparer);
        });

        modelBuilder.Entity<SystemConfigEntity>(entity =>
        {
            entity.HasKey(e => e.Id);
        });

        modelBuilder.Entity<StoragePathEntity>(entity =>
        {
            entity.HasKey(e => e.Id);
        });

        modelBuilder.Entity<BackgroundJob>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Status);
        });

        modelBuilder.Entity<LogEntry>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedOnAdd();
            entity.HasIndex(e => e.Timestamp);
            entity.HasIndex(e => new { e.Category, e.Timestamp });
            entity.HasIndex(e => e.CorrelationId);
        });

        modelBuilder.Entity<UserGameList>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.UserId);
            entity.Property(e => e.CreatedAt).HasConversion(
                v => v.ToString("O"),
                v => DateTimeOffset.Parse(v, null, System.Globalization.DateTimeStyles.RoundtripKind));
            entity.Property(e => e.UpdatedAt).HasConversion(
                v => v.ToString("O"),
                v => DateTimeOffset.Parse(v, null, System.Globalization.DateTimeStyles.RoundtripKind));
            entity.HasOne(e => e.User)
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<UserGameListItem>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.ListId, e.GameId }).IsUnique();
            entity.Property(e => e.AddedAt).HasConversion(
                v => v.ToString("O"),
                v => DateTimeOffset.Parse(v, null, System.Globalization.DateTimeStyles.RoundtripKind));
            entity.HasOne(e => e.List)
                .WithMany(l => l.Items)
                .HasForeignKey(e => e.ListId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Game)
                .WithMany()
                .HasForeignKey(e => e.GameId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<GameListDownloadJob>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.Status);
            entity.Property(e => e.CreatedAt).HasConversion(
                v => v.ToString("O"),
                v => DateTimeOffset.Parse(v, null, System.Globalization.DateTimeStyles.RoundtripKind));
            entity.Property(e => e.CompletedAt).HasConversion(
                v => v.HasValue ? v.Value.ToString("O") : null,
                v => string.IsNullOrWhiteSpace(v)
                    ? null
                    : DateTimeOffset.Parse(v, null, System.Globalization.DateTimeStyles.RoundtripKind));
        });
    }

    private static readonly JsonSerializerOptions JsonOptions = new();

    private static ValueConverter<List<string>, string> CreateStringListConverter() =>
        new(
            v => JsonSerializer.Serialize(v, JsonOptions),
            v => DeserializeStringList(v));

    private static List<string> DeserializeStringList(string json) =>
        JsonSerializer.Deserialize<List<string>>(json, JsonOptions) ?? [];

    private static ValueConverter<Dictionary<string, string>, string> CreateStringDictionaryConverter() =>
        new(
            v => JsonSerializer.Serialize(v, JsonOptions),
            v => DeserializeStringDictionary(v));

    private static Dictionary<string, string> DeserializeStringDictionary(string json) =>
        JsonSerializer.Deserialize<Dictionary<string, string>>(json, JsonOptions)
        ?? new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
}

