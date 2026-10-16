using System.ComponentModel.DataAnnotations;

namespace Quản_Lý_Cửa_Hàng_Sửa_Xe.Models;

public sealed class AppUser
{
    public int Id { get; set; }
    [Required, MaxLength(100)] public string Username { get; set; } = "";
    [Required, MaxLength(500)] public string PasswordHash { get; set; } = "";
    [Required, MaxLength(20)] public string Role { get; set; } = "Customer";
}
