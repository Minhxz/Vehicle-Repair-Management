using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Quản_Lý_Cửa_Hàng_Sửa_Xe.Models;

namespace Quản_Lý_Cửa_Hàng_Sửa_Xe.Controllers;

[ApiController, Route("api/auth")]
public sealed class AuthController(IConfiguration configuration, IWebHostEnvironment environment) : ControllerBase
{
    [HttpPost("login"), EnableRateLimiting("login")]
    public async Task<IActionResult> Login(ManagerLoginRequest request)
    {
        var username = configuration["AutoFix:AdminUsername"] ?? (environment.IsDevelopment() ? "admin" : null);
        var password = configuration["AutoFix:AdminPassword"] ?? (environment.IsDevelopment() ? "123" : null);
        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password))
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = "Tài khoản quản trị chưa được cấu hình." });

        var suppliedHash = SHA256.HashData(Encoding.UTF8.GetBytes(request.Password));
        var expectedHash = SHA256.HashData(Encoding.UTF8.GetBytes(password));
        if (!CryptographicOperations.FixedTimeEquals(suppliedHash, expectedHash) || !string.Equals(request.Username.Trim(), username, StringComparison.Ordinal))
            return Unauthorized(new { message = "Tên đăng nhập hoặc mật khẩu chưa đúng." });

        var identity = new ClaimsIdentity([new Claim(ClaimTypes.Name, username), new Claim(ClaimTypes.Role, "Manager")], CookieAuthenticationDefaults.AuthenticationScheme);
        await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(identity), new AuthenticationProperties { IsPersistent = false });
        return Ok(new { authenticated = true, username });
    }

    [HttpGet("me"), ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public IActionResult Me() => Ok(new { authenticated = User.Identity?.IsAuthenticated == true, username = User.Identity?.IsAuthenticated == true ? User.Identity.Name : null });

    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return Ok(new { authenticated = false });
    }
}
