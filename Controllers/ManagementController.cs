using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Quản_Lý_Cửa_Hàng_Sửa_Xe.Controllers;

[Authorize(Roles = "Manager")]
public class ManagementController : Controller
{
    public IActionResult Index() => RedirectToAction(nameof(Workflow));
    public IActionResult Workflow() => View();
    public IActionResult Services() => View();
    public IActionResult JobCard() => RedirectToAction(nameof(Workflow));
    public IActionResult Inventory() => View();
    public IActionResult Analytics() => View();
}
