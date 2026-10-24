using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using TradeBlotter.Api.Domain;

namespace TradeBlotter.Api.Data;

public sealed class TradeBlotterDbContext(DbContextOptions<TradeBlotterDbContext> options) : DbContext(options)
{
    public DbSet<Trade> Trades => Set<Trade>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var trade = modelBuilder.Entity<Trade>();

        trade.HasKey(t => t.Id);
        trade.Property(t => t.Symbol).HasMaxLength(12).IsRequired();
        trade.Property(t => t.Side).HasConversion<string>().HasMaxLength(4);

        // SQLite cannot ORDER BY a DateTimeOffset stored as text; store it as a sortable integer.
        trade.Property(t => t.Timestamp).HasConversion(new DateTimeOffsetToBinaryConverter());
        trade.HasIndex(t => t.Timestamp);

        trade.Ignore(t => t.SignedQuantity);
    }
}
