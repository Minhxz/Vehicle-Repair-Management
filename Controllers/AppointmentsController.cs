using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Quản_Lý_Cửa_Hàng_Sửa_Xe.Models;
using Quản_Lý_Cửa_Hàng_Sửa_Xe.Services;

namespace Quản_Lý_Cửa_Hàng_Sửa_Xe.Controllers;

[ApiController, Route("api/appointments")]
public sealed class AppointmentsController(AppointmentStore store) : ControllerBase
{
    [Authorize(Roles = "Manager"), HttpGet]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public async Task<IActionResult> List([FromQuery] string? q, [FromQuery] string? status, [FromQuery] string? date,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 10, CancellationToken cancellationToken = default)
    {
        if (page < 1 || pageSize is < 1 or > 100 || q?.Length > 100 || (!string.IsNullOrEmpty(status) && !AppointmentStatus.All.Contains(status)))
            return BadRequest(new { message = "Bộ lọc hoặc số trang không hợp lệ." });
        if (!string.IsNullOrEmpty(date) && !DateOnly.TryParseExact(date, "yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.None, out _))
            return BadRequest(new { message = "Ngày lọc không hợp lệ." });
        return Ok(await store.ListAsync(q, status, date, page, pageSize, cancellationToken));
    }

    [Authorize(Roles = "Manager"), HttpGet("{reference}")]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public async Task<IActionResult> Detail(string reference, CancellationToken cancellationToken)
    {
        var appointment = await store.GetAsync(reference, cancellationToken);
        return appointment is null ? NotFound(new { message = "Không tìm thấy lịch hẹn." }) : Ok(AppointmentStore.Response(appointment, true));
    }

    [Authorize(Roles = "Manager"), HttpPut("{reference}/status")]
    public async Task<IActionResult> UpdateStatus(string reference, UpdateAppointmentStatusRequest request, CancellationToken cancellationToken)
    {
        if (!AppointmentStatus.All.Contains(request.Status)) return BadRequest(new { message = "Trạng thái không hợp lệ." });
        try
        {
            var result = await store.UpdateStatusAsync(reference, request, cancellationToken);
            if (result.Appointment is null) return NotFound(new { message = "Không tìm thấy lịch hẹn." });
            if (result.InvalidTransition) return Conflict(new { message = "Không thể chuyển sang trạng thái này. Hãy cập nhật theo thứ tự tiếp nhận → sửa chữa → hoàn thành." });
            return Ok(AppointmentStore.Response(result.Appointment, true));
        }
        catch (DbUpdateConcurrencyException) { return Conflict(new { message = "Lịch hẹn vừa được cập nhật ở nơi khác. Vui lòng tải lại." }); }
    }
}
