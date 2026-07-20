using GameLibrary.Api.Data;
using GameLibrary.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace GameLibrary.Api.Engines;

public class CheckoutEngine(AppDbContext db)
{
    public async Task<PhysicalItem?> ToggleCheckoutAsync(
        string itemId,
        string? borrower,
        CancellationToken cancellationToken = default)
    {
        var item = await db.PhysicalItems
            .Include(p => p.Location)
            .FirstOrDefaultAsync(p => p.Id == itemId, cancellationToken);

        if (item is null)
        {
            return null;
        }

        item.CheckedOut = !item.CheckedOut;
        item.Borrower = item.CheckedOut ? borrower ?? "Guest" : null;

        await db.SaveChangesAsync(cancellationToken);
        return item;
    }
}
