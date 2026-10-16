using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Quản_Lý_Cửa_Hàng_Sửa_Xe.Controllers;

public class AccountController : Controller
{
    [AllowAnonymous]
    public IActionResult Login(string? returnUrl = null)
    {
        if (User.Identity?.IsAuthenticated == true)
            return User.IsInRole("Manager") ? RedirectToAction("Workflow", "Management") : RedirectToAction("Booking", "Home");
        ViewData["ReturnUrl"] = Url.IsLocalUrl(returnUrl) ? returnUrl : "/Management/Workflow";
        return View();
    }

    public IActionResult Denied()
    {
        Response.StatusCode = StatusCodes.Status403Forbidden;
        return View();
    }
}
