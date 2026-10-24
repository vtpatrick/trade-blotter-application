using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using TradeBlotter.Api.Data;

namespace TradeBlotter.Api.Tests;

/// <summary>The API running in-process against an in-memory SQLite database.</summary>
public sealed class ApiFactory : IDisposable
{
    // An in-memory SQLite database lives as long as its connection stays open.
    private readonly SqliteConnection _connection = new("Data Source=:memory:");

    public WebApplicationFactory<Program> Factory { get; }

    /// <param name="environment">"Testing" by default, so the development seed data stays out.</param>
    public ApiFactory(string environment = "Testing")
    {
        _connection.Open();
        Factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder => builder
            .UseEnvironment(environment)
            .ConfigureTestServices(services =>
            {
                services.RemoveAll<DbContextOptions<TradeBlotterDbContext>>();
                services.AddDbContext<TradeBlotterDbContext>(o => o.UseSqlite(_connection));
            }));
    }

    public void Dispose()
    {
        Factory.Dispose();
        _connection.Dispose();
    }
}
