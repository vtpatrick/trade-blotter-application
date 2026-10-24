using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using TradeBlotter.Api.Data;
using TradeBlotter.Api.Hubs;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

// Enums travel as names ("Buy"/"Sell"), and numeric values are rejected.
var enumConverter = new JsonStringEnumConverter(allowIntegerValues: false);

builder.Services.AddControllers()
    .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(enumConverter));
builder.Services.AddSignalR()
    .AddJsonProtocol(o => o.PayloadSerializerOptions.Converters.Add(enumConverter));

// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddSingleton(TimeProvider.System);

builder.Services.AddDbContext<TradeBlotterDbContext>(o =>
    o.UseSqlite(builder.Configuration.GetConnectionString("TradeBlotter")));

// Register dependency checks here; they are aggregated by GET /api/health.
builder.Services.AddHealthChecks()
    .AddCheck("self", () => HealthCheckResult.Healthy("API process is running"))
    .AddDbContextCheck<TradeBlotterDbContext>("database");

var app = builder.Build();

// Create or upgrade the SQLite database on startup so a fresh clone runs with no setup step.
using (var scope = app.Services.CreateScope())
{
    scope.ServiceProvider.GetRequiredService<TradeBlotterDbContext>().Database.Migrate();
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();
app.MapHub<TradesHub>("/hubs/trades");

app.Run();

// Exposed for WebApplicationFactory in integration tests.
public partial class Program;
