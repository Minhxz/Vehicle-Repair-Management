using System.ComponentModel.DataAnnotations;

namespace Quản_Lý_Cửa_Hàng_Sửa_Xe.Models;

public sealed class InventoryRequest
{
    [Required(ErrorMessage = "Vui lòng nhập mã phụ tùng."), StringLength(30)]
    public string Sku { get; set; } = "";
    [Required(ErrorMessage = "Vui lòng nhập tên phụ tùng."), StringLength(120)]
    public string Name { get; set; } = "";
    [Required(ErrorMessage = "Vui lòng nhập nhóm phụ tùng."), StringLength(60)]
    public string Category { get; set; } = "";
    [Range(typeof(decimal), "0", "1000000", ErrorMessage = "Tồn kho không hợp lệ.")]
    public decimal Stock { get; set; }
    [Range(typeof(decimal), "0", "1000000000", ErrorMessage = "Đơn giá không hợp lệ.")]
    public decimal UnitPrice { get; set; }
    [Required(ErrorMessage = "Vui lòng nhập đơn vị tính."), StringLength(20)]
    public string Unit { get; set; } = "Cái";
    [Range(typeof(decimal), "0", "1000000", ErrorMessage = "Mức tồn kho tối thiểu không hợp lệ.")]
    public decimal ReorderLevel { get; set; }
}

public sealed class InventoryItem
{
    public string Id { get; set; } = "";
    public string Sku { get; set; } = "";
    public string Name { get; set; } = "";
    public string Category { get; set; } = "";
    public decimal Stock { get; set; }
    public decimal UnitPrice { get; set; }
    public string Unit { get; set; } = "Cái";
    public decimal ReorderLevel { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
