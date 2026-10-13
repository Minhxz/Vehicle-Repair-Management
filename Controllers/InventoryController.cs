using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Quản_Lý_Cửa_Hàng_Sửa_Xe.Models;
using Quản_Lý_Cửa_Hàng_Sửa_Xe.Services;

namespace Quản_Lý_Cửa_Hàng_Sửa_Xe.Controllers;

[ApiController, Authorize, Route("api/inventory")]
public sealed class InventoryController(InventoryStore store) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken cancellationToken) => Ok(new { items = await store.ListAsync(cancellationToken) });

    [HttpPost]
    public async Task<IActionResult> Create(InventoryRequest request, CancellationToken cancellationToken)
    {
        try { return StatusCode(StatusCodes.Status201Created, await store.SaveAsync(null, request, cancellationToken)); }
        catch (ArgumentException error) { return Conflict(new { message = error.Message }); }
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(string id, InventoryRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var item = await store.SaveAsync(id, request, cancellationToken);
            return item is null ? NotFound(new { message = "Không tìm thấy phụ tùng." }) : Ok(item);
        }
        catch (ArgumentException error) { return Conflict(new { message = error.Message }); }
    }
}
