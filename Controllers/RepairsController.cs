using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
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
}
