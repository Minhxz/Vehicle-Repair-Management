using System.Globalization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Quản_Lý_Cửa_Hàng_Sửa_Xe.Models;
using Quản_Lý_Cửa_Hàng_Sửa_Xe.Services;

namespace Quản_Lý_Cửa_Hàng_Sửa_Xe.Controllers;

[ApiController, Authorize(Roles = "Manager"), Route("api/revenue")]
public sealed class RevenueController(AutoFixDbContext db) : ControllerBase
{
    private static DateOnly Today => DateOnly.FromDateTime(DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(7)).DateTime);

    [HttpGet, ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public async Task<IActionResult> List([FromQuery] string? from, [FromQuery] string? to,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 10, CancellationToken cancellationToken = default)
    {
        if (page < 1 || pageSize is < 1 or > 100) return BadRequest(new { message = "Số trang không hợp lệ." });
        DateOnly? start = null, end = null;
        if (!string.IsNullOrWhiteSpace(from))
        {
            if (!DateOnly.TryParseExact(from, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var value))
                return BadRequest(new { message = "Ngày bắt đầu không hợp lệ." });
            start = value;
        }
        if (!string.IsNullOrWhiteSpace(to))
        {
            if (!DateOnly.TryParseExact(to, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var value))
                return BadRequest(new { message = "Ngày kết thúc không hợp lệ." });
            end = value;
        }
        var today = Today;
        var monthStart = new DateOnly(today.Year, today.Month, 1);
        if (start is null && end is null) { start = monthStart; end = today; }
        if (start > end) return BadRequest(new { message = "Ngày bắt đầu không được sau ngày kết thúc." });
        var query = db.RevenueEntries.AsNoTracking();
        if (start is not null) query = query.Where(entry => entry.PaidOn >= start.Value);
        if (end is not null) query = query.Where(entry => entry.PaidOn <= end.Value);
        var total = await query.CountAsync(cancellationToken);
        var totalAmount = await query.SumAsync(entry => (decimal?)entry.Amount, cancellationToken) ?? 0m;
        var todayAmount = await db.RevenueEntries.Where(entry => entry.PaidOn == today).SumAsync(entry => (decimal?)entry.Amount, cancellationToken) ?? 0m;
        var nextMonth = monthStart.AddMonths(1);
        var monthAmount = await db.RevenueEntries.Where(entry => entry.PaidOn >= monthStart && entry.PaidOn < nextMonth)
            .SumAsync(entry => (decimal?)entry.Amount, cancellationToken) ?? 0m;
        var totalPages = Math.Max(1, (int)Math.Ceiling(total / (double)pageSize));
        page = Math.Min(page, totalPages);
        var entries = await (from entry in query
                join appointment in db.Appointments.AsNoTracking() on entry.Reference equals appointment.Reference
                select new { entry.Reference, appointment.CustomerName, appointment.Service, entry.Amount, entry.PaidOn, entry.Note })
            .OrderByDescending(entry => entry.PaidOn).ThenBy(entry => entry.Reference)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(cancellationToken);
        return Ok(new { entries, total, page, pageSize, totalPages, totalAmount, todayAmount, monthAmount,
            appliedFrom = start?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), appliedTo = end?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) });
    }

    [HttpGet("eligible"), ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public async Task<IActionResult> Eligible(CancellationToken cancellationToken)
    {
        var appointments = await db.Appointments.AsNoTracking()
            .Where(appointment => appointment.Status == AppointmentStatus.Completed && !db.RevenueEntries.Any(entry => entry.Reference == appointment.Reference))
            .OrderByDescending(appointment => appointment.UpdatedAt)
            .Select(appointment => new { appointment.Reference, appointment.CustomerName, appointment.Service }).ToListAsync(cancellationToken);
        return Ok(new { appointments });
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateRevenueRequest request, CancellationToken cancellationToken)
    {
        var error = ValidatePayment(request.Amount, request.PaidOn);
        if (error is not null) return BadRequest(new { message = error });
        var reference = request.Reference.Trim();
        var appointment = await db.Appointments.AsNoTracking().SingleOrDefaultAsync(item => item.Reference == reference, cancellationToken);
        if (appointment is null) return NotFound(new { message = "Không tìm thấy lịch hẹn." });
        if (appointment.Status != AppointmentStatus.Completed) return Conflict(new { message = "Chỉ ghi nhận tiền cho lịch hẹn đã hoàn thành." });
        if (await db.RevenueEntries.AnyAsync(entry => entry.Reference == reference, cancellationToken))
            return Conflict(new { message = "Lịch hẹn đã được ghi nhận tiền. Hãy sửa khoản thu hiện có." });
        var entry = new RevenueEntry { Reference = appointment.Reference, Amount = request.Amount, PaidOn = request.PaidOn!.Value, Note = request.Note?.Trim() ?? "" };
        db.RevenueEntries.Add(entry);
        try { await db.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateException) { return Conflict(new { message = "Lịch hẹn vừa được ghi nhận tiền. Vui lòng tải lại." }); }
        return StatusCode(StatusCodes.Status201Created, ToResponse(entry, appointment));
    }

    [HttpPut("{reference}")]
    public async Task<IActionResult> Update(string reference, UpdateRevenueRequest request, CancellationToken cancellationToken)
    {
        var error = ValidatePayment(request.Amount, request.PaidOn);
        if (error is not null) return BadRequest(new { message = error });
        var entry = await db.RevenueEntries.SingleOrDefaultAsync(item => item.Reference == reference.Trim(), cancellationToken);
        if (entry is null) return NotFound(new { message = "Chưa có khoản thu cho lịch hẹn này." });
        var appointment = await db.Appointments.AsNoTracking().SingleAsync(item => item.Reference == entry.Reference, cancellationToken);
        if (appointment.Status != AppointmentStatus.Completed) return Conflict(new { message = "Chỉ sửa khoản thu của lịch hẹn đã hoàn thành." });
        entry.Amount = request.Amount; entry.PaidOn = request.PaidOn!.Value; entry.Note = request.Note?.Trim() ?? "";
        try { await db.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateException) { return Conflict(new { message = "Khoản thu vừa thay đổi. Vui lòng tải lại." }); }
        return Ok(ToResponse(entry, appointment));
    }

    private static string? ValidatePayment(decimal amount, DateOnly? paidOn)
    {
        if (amount != decimal.Truncate(amount)) return "Số tiền cần là số nguyên đồng.";
        if (paidOn is null || paidOn > Today) return "Ngày thu tiền phải là hôm nay hoặc ngày trước đó.";
        return null;
    }

    private static object ToResponse(RevenueEntry entry, Appointment appointment) => new
    {
        entry.Reference, appointment.CustomerName, appointment.Service, entry.Amount, entry.PaidOn, entry.Note
    };
}
