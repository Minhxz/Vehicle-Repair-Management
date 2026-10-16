(() => {
    'use strict';
    const { api, escape, money, toast } = window.AutoFix;
    const $ = (selector) => document.querySelector(selector);
    const editModal = new bootstrap.Modal($('#inventory-edit-modal'));
    const deleteModal = new bootstrap.Modal($('#inventory-delete-modal'));
    let items = [], page = 1, totalPages = 1, requestNumber = 0;
    let editId = null, deleteItem = null, saving = false, deleting = false;

    function message(selector, text) {
        $(selector).textContent = text;
        $(selector).hidden = !text;
    }
    function render(data) {
        items = Array.isArray(data.items) ? data.items : [];
        page = Number(data.page) || 1;
        totalPages = Math.max(1, Number(data.totalPages) || 1);
        const total = Number(data.total) || 0;
        const start = (page - 1) * (Number(data.pageSize) || 10) + 1;
        $('#inventory-rows').innerHTML = items.length ? items.map((item) => `<tr><td><strong>${escape(item.sku)}</strong></td><td>${escape(item.name)}</td><td>${escape(item.unit)}</td><td class="text-end">${Number(item.stock).toLocaleString('vi-VN')}</td><td class="text-end inventory-price">${escape(money(item.unitPrice))}</td><td><div class="inventory-row-actions"><button class="btn btn-outline-primary btn-sm" type="button" data-edit="${escape(item.id)}" aria-label="Sửa ${escape(item.name)}">Sửa</button><button class="btn btn-outline-danger btn-sm" type="button" data-delete="${escape(item.id)}" aria-label="Xóa ${escape(item.name)}">Xóa</button></div></td></tr>`).join('') : '<tr><td colspan="6" class="empty-block"><strong>Chưa có phụ tùng phù hợp</strong>Thêm phụ tùng mới hoặc thay đổi từ khóa tìm kiếm.</td></tr>';
        $('#inventory-summary').textContent = items.length ? `Hiển thị ${start}–${start + items.length - 1} / ${total} phụ tùng` : '0 phụ tùng';
        $('#inventory-page').textContent = `Trang ${page} / ${totalPages}`;
    }
    async function load() {
        const request = ++requestNumber;
        const query = new URLSearchParams({ q: $('#inventory-search').value.trim(), page: String(page), pageSize: '10' });
        $('#inventory-table').setAttribute('aria-busy', 'true');
        $('#inventory-prev').disabled = true;
        $('#inventory-next').disabled = true;
        $('#inventory-summary').textContent = 'Đang tải dữ liệu…';
        message('#inventory-message', '');
        try {
            const data = await api(`/api/inventory?${query}`);
            if (request === requestNumber) render(data);
        } catch (error) {
            if (request !== requestNumber) return;
            message('#inventory-message', error.message);
            $('#inventory-summary').textContent = 'Không tải được danh sách. Nhấn Tìm kiếm để thử lại.';
            if (!items.length) $('#inventory-rows').innerHTML = '<tr><td colspan="6" class="empty-block">Chưa tải được dữ liệu phụ tùng.</td></tr>';
        } finally {
            if (request === requestNumber) {
                $('#inventory-table').setAttribute('aria-busy', 'false');
                $('#inventory-prev').disabled = page <= 1;
                $('#inventory-next').disabled = page >= totalPages;
            }
        }
    }
    function openEditor(item = null) {
        editId = item?.id ?? null;
        $('#inventory-edit-title').textContent = item ? 'Sửa phụ tùng' : 'Thêm phụ tùng';
        $('#inventory-sku').value = item?.sku ?? '';
        $('#inventory-name').value = item?.name ?? '';
        $('#inventory-unit').value = item?.unit ?? 'Cái';
        $('#inventory-stock').value = item?.stock ?? 0;
        $('#inventory-price').value = item?.unitPrice ?? 0;
        message('#inventory-form-message', '');
        editModal.show();
    }
    $('#inventory-add').addEventListener('click', () => openEditor());
    $('#inventory-edit-modal').addEventListener('shown.bs.modal', () => $('#inventory-sku').focus());
    $('#inventory-edit-modal').addEventListener('hide.bs.modal', (event) => { if (saving) event.preventDefault(); });
    $('#inventory-delete-modal').addEventListener('hide.bs.modal', (event) => { if (deleting) event.preventDefault(); });
    $('#inventory-search-form').addEventListener('submit', (event) => { event.preventDefault(); page = 1; load(); });
    $('#inventory-clear').addEventListener('click', () => { $('#inventory-search-form').reset(); page = 1; load(); });
    $('#inventory-prev').addEventListener('click', () => { if (page > 1) { page -= 1; load(); } });
    $('#inventory-next').addEventListener('click', () => { if (page < totalPages) { page += 1; load(); } });
    $('#inventory-rows').addEventListener('click', (event) => {
        const editButton = event.target.closest('[data-edit]');
        if (editButton) {
            const item = items.find((entry) => entry.id === Number(editButton.dataset.edit));
            if (item) openEditor(item);
        }
        const deleteButton = event.target.closest('[data-delete]');
        if (deleteButton) {
            deleteItem = items.find((entry) => entry.id === Number(deleteButton.dataset.delete));
            if (!deleteItem) return;
            $('#inventory-delete-name').textContent = `${deleteItem.sku} — ${deleteItem.name}`;
            message('#inventory-delete-message', '');
            deleteModal.show();
        }
    });
    $('#inventory-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        if (saving || !event.currentTarget.reportValidity()) return;
        const data = {
            sku: $('#inventory-sku').value.trim(), name: $('#inventory-name').value.trim(),
            unit: $('#inventory-unit').value.trim(), stock: Number($('#inventory-stock').value),
            unitPrice: Number($('#inventory-price').value)
        };
        if (!data.sku || !data.name || !data.unit) {
            message('#inventory-form-message', 'Vui lòng nhập mã, tên và đơn vị tính.');
            return;
        }
        if (!Number.isInteger(data.stock) || !Number.isInteger(data.unitPrice) || data.stock < 0 || data.stock > 1000000 || data.unitPrice < 0 || data.unitPrice > 100000000) {
            message('#inventory-form-message', 'Nhập tồn kho từ 0 đến 1.000.000 và đơn giá từ 0 đến 100.000.000 đồng, dùng số nguyên.');
            return;
        }
        saving = true;
        $('#inventory-form').querySelectorAll('input, button').forEach((element) => { element.disabled = true; });
        message('#inventory-form-message', '');
        try {
            const isNew = editId === null;
            await api(isNew ? '/api/inventory' : `/api/inventory/${editId}`, { method: isNew ? 'POST' : 'PUT', body: JSON.stringify(data) });
            saving = false;
            editModal.hide();
            toast(isNew ? 'Đã thêm phụ tùng.' : 'Đã cập nhật phụ tùng và số lượng tồn.');
            load();
        } catch (error) {
            message('#inventory-form-message', error.message);
        } finally {
            saving = false;
            $('#inventory-form').querySelectorAll('input, button').forEach((element) => { element.disabled = false; });
        }
    });
    $('#inventory-delete-confirm').addEventListener('click', async () => {
        if (!deleteItem || deleting) return;
        deleting = true;
        $('#inventory-delete-modal').querySelectorAll('button').forEach((button) => { button.disabled = true; });
        message('#inventory-delete-message', '');
        try {
            await api(`/api/inventory/${deleteItem.id}`, { method: 'DELETE' });
            deleting = false;
            deleteModal.hide();
            toast('Đã xóa phụ tùng.');
            load();
        } catch (error) {
            message('#inventory-delete-message', error.message);
        } finally {
            deleting = false;
            $('#inventory-delete-modal').querySelectorAll('button').forEach((button) => { button.disabled = false; });
        }
    });
    load();
})();
