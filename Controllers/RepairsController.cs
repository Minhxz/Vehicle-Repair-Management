using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Quản_Lý_Cửa_Hàng_Sửa_Xe.Models;
using Quản_Lý_Cửa_Hàng_Sửa_Xe.Services;

namespace Quản_Lý_Cửa_Hàng_Sửa_Xe.Controllers;

[ApiController, Route("api/repairs")]
public sealed class RepairsController(AppointmentStore store) : ControllerBase
{
    [HttpGet("lookup"), EnableRateLimiting("public-api")]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public async Task<IActionResult> Lookup([FromQuery] string reference, [FromQuery] string phone, CancellationToken cancellationToken)
    {
        var appointment = await store.FindAsync(reference, phone, cancellationToken);
        return appointment is null
            ? NotFound(new { message = "Không tìm thấy lịch hẹn khớp mã và số điện thoại. Vui lòng kiểm tra lại." })
            : Ok(AppointmentStore.Response(appointment));
    }

    [HttpPost("/api/appointments/{reference}/cancel"), EnableRateLimiting("public-api")]
    public async Task<IActionResult> Cancel(string reference, CancelAppointmentRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await store.CancelAsync(reference, request.Phone, cancellationToken);
            if (result.Appointment is null) return NotFound(new { message = "Không tìm thấy lịch hẹn khớp mã và số điện thoại." });
            if (result.CannotCancel) return Conflict(new { message = "Xe đã được tiếp nhận sửa chữa. Vui lòng liên hệ cửa hàng để thay đổi lịch." });
            return Ok(AppointmentStore.Response(result.Appointment));
        }
        catch (DbUpdateConcurrencyException) { return Conflict(new { message = "Lịch hẹn vừa được cập nhật. Vui lòng tra cứu lại." }); }
    }
}
