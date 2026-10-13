using Microsoft.AspNetCore.Mvc;
using Quản_Lý_Cửa_Hàng_Sửa_Xe.Models;
using System.Diagnostics;

namespace Quản_Lý_Cửa_Hàng_Sửa_Xe.Controllers
{
    public class HomeController : Controller
    {
        public IActionResult Index()
        {
            return View();
        }

        public IActionResult Privacy()
        {
            return View();
        }

        public IActionResult Services() => View();
        public IActionResult Vehicles() => View();
        public IActionResult Process() => View();
        public IActionResult Booking() => View();
        public IActionResult Tracking() => View();

        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult Error()
        {
            return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
        }
    }
}
