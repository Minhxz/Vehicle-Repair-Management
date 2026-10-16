using System.ComponentModel.DataAnnotations;

namespace Quản_Lý_Cửa_Hàng_Sửa_Xe.Models;

public sealed class InventoryItem
{
    public int Id { get; set; }
    [Required, MaxLength(30)] public string Sku { get; set; } = "";
    [Required, MaxLength(120)] public string Name { get; set; } = "";
    [Required, MaxLength(20)] public string Unit { get; set; } = "";
    public int Stock { get; set; }
    public decimal UnitPrice { get; set; }
}

public sealed class InventoryRequest
{
    [Required(ErrorMessage = "Vui lòng nhập mã phụ tùng."), StringLength(30)]
    public string Sku { get; set; } = "";
    [Required(ErrorMessage = "Vui lòng nhập tên phụ tùng."), StringLength(120)]
    public string Name { get; set; } = "";
    [Required(ErrorMessage = "Vui lòng nhập đơn vị tính."), StringLength(20)]
    public string Unit { get; set; } = "";
    [Range(0, 1000000, ErrorMessage = "Số lượng phải từ 0 đến 1.000.000.")]
    public int Stock { get; set; }
    [Range(typeof(decimal), "0", "100000000", ErrorMessage = "Đơn giá phải từ 0 đến 100 triệu đồng.")]
    public decimal UnitPrice { get; set; }
}
