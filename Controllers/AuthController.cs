using System.Security.Claims;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Quản_Lý_Cửa_Hàng_Sửa_Xe.Models;
using Quản_Lý_Cửa_Hàng_Sửa_Xe.Services;

namespace Quản_Lý_Cửa_Hàng_Sửa_Xe.Controllers;

[ApiController, Route("api/auth")]
public sealed class AuthController(AutoFixDbContext database, IPasswordHasher<AppUser> hasher) : ControllerBase
{
    [HttpGet("csrf"), ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public IActionResult Csrf([FromServices] IAntiforgery antiforgery) =>
        Ok(new { token = antiforgery.GetAndStoreTokens(HttpContext).RequestToken });

    [HttpPost("login"), EnableRateLimiting("login")]
    public async Task<IActionResult> Login(ManagerLoginRequest request, CancellationToken cancellationToken)
    {
        var account = await database.Users.SingleOrDefaultAsync(user => user.Username == request.Username.Trim(), cancellationToken);
        if (account is null) return Unauthorized(new { message = "Tên đăng nhập hoặc mật khẩu chưa đúng." });
        var verification = hasher.VerifyHashedPassword(account, account.PasswordHash, request.Password);
        if (verification == PasswordVerificationResult.Failed)
            return Unauthorized(new { message = "Tên đăng nhập hoặc mật khẩu chưa đúng." });
        if (verification == PasswordVerificationResult.SuccessRehashNeeded)
        {
            account.PasswordHash = hasher.HashPassword(account, request.Password);
            await database.SaveChangesAsync(cancellationToken);
        }
        HttpContext.Session.Clear();
        var identity = new ClaimsIdentity([
            new Claim(ClaimTypes.NameIdentifier, account.Id.ToString()),
            new Claim(ClaimTypes.Name, account.Username),
            new Claim(ClaimTypes.Role, account.Role)
        ], CookieAuthenticationDefaults.AuthenticationScheme);
        await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme,
            new ClaimsPrincipal(identity), new AuthenticationProperties { IsPersistent = false });
        return Ok(new { authenticated = true, username = account.Username, role = account.Role,
            redirectUrl = account.Role == "Manager" ? "/Management/Workflow" : "/Home/Booking" });
    }

    [HttpGet("me"), ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public IActionResult Me() => Ok(new
    {
        authenticated = User.Identity?.IsAuthenticated == true,
        username = User.Identity?.IsAuthenticated == true ? User.Identity.Name : null,
        role = User.FindFirstValue(ClaimTypes.Role)
    });

    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        HttpContext.Session.Clear();
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return Ok(new { authenticated = false });
    }
}
