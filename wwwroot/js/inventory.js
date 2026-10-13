(() => {
    'use strict';

    const $ = (selector) => document.querySelector(selector);
    const { api, escape, money, toast } = window.AutoFix;
    const formatNumber = (value) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(Number(value) || 0);
    const normalize = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
    const form = $('#inventory-form');
    const modal = bootstrap.Modal.getOrCreateInstance($('#inventory-modal'));
    const pageSize = 10;
    let items = [];
    let page = 1;
    let selectedId = null;
    let loading = false;
    let saving = false;
    let loaded = false;

    const isLow = (item) => Number(item.stock) <= Number(item.reorderLevel);
    const visibleItems = () => {
        const search = normalize($('#inventory-search').value.trim());
        const category = $('#inventory-category').value;
        return items.filter((item) => (!search || normalize(`${item.sku} ${item.name}`).includes(search))
            && (!category || item.category === category)
            && (!$('#inventory-low-only').checked || isLow(item)));
    };

    function setError(selector, message = '') {
        const element = $(selector);
        element.textContent = message;
        element.hidden = !message;
    }

    function statusBadge(item) {
        if (Number(item.stock) <= 0) return '<span class="badge rounded-pill bg-danger bg-opacity-10 text-danger px-3 py-2">Hết hàng</span>';
        if (isLow(item)) return '<span class="badge rounded-pill bg-warning bg-opacity-10 text-dark px-3 py-2">Sắp hết</span>';
        return '<span class="badge rounded-pill bg-success bg-opacity-10 text-success px-3 py-2">Còn hàng</span>';
    }

    function render() {
        const filtered = visibleItems();
        const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
        page = Math.min(page, pages);
        const start = (page - 1) * pageSize;
        const currentItems = filtered.slice(start, start + pageSize);
        $('#inventory-body').innerHTML = currentItems.length ? currentItems.map((item) => `
            <tr>
                <td class="ps-4 text-nowrap"><span class="fw-semibold text-primary">${escape(item.sku)}</span></td>
                <td><span class="fw-semibold">${escape(item.name)}</span></td>
                <td><span class="text-muted small">${escape(item.category)}</span></td>
                <td class="text-end text-nowrap">${escape(money(item.unitPrice))}</td>
                <td class="text-end text-nowrap"><span class="fw-semibold">${formatNumber(item.stock)}</span> <span class="text-muted small">${escape(item.unit)}</span><div class="text-muted small">Tối thiểu: ${formatNumber(item.reorderLevel)}</div></td>
                <td class="text-nowrap">${statusBadge(item)}</td>
                <td class="text-end pe-4"><button type="button" class="btn btn-sm btn-outline-primary text-nowrap" data-edit-part="${escape(item.id)}" aria-label="Chỉnh sửa ${escape(item.name)}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="me-1" aria-hidden="true"><path d="m16 3 5 5-12 12-6 1 1-6L16 3ZM14 5l5 5" /></svg>Sửa</button></td>
            </tr>`).join('') : `<tr><td colspan="7" class="text-center py-5"><div class="text-muted mb-2">${items.length ? 'Không có phụ tùng phù hợp với bộ lọc.' : 'Kho phụ tùng chưa có dữ liệu.'}</div><span class="small text-muted">${items.length ? 'Thử tìm kiếm hoặc chọn nhóm khác.' : 'Chọn “Thêm phụ tùng” để bắt đầu quản lý kho.'}</span></td></tr>`;
        $('#inventory-count').textContent = filtered.length ? `Hiển thị ${start + 1}–${Math.min(start + pageSize, filtered.length)} / ${filtered.length} phụ tùng` : '0 phụ tùng';
        $('#inventory-page').textContent = `${page} / ${pages}`;
        $('#inventory-prev').disabled = page <= 1;
        $('#inventory-next').disabled = page >= pages;
        $('#inventory-export').disabled = !filtered.length;
    }

    function updateSummary() {
        const categories = [...new Set(items.map((item) => item.category))].sort((a, b) => a.localeCompare(b, 'vi'));
        const category = $('#inventory-category').value;
        $('#inventory-total').textContent = formatNumber(items.length);
        $('#inventory-low').textContent = formatNumber(items.filter(isLow).length);
        $('#inventory-categories').textContent = formatNumber(categories.length);
        $('#inventory-value').textContent = money(items.reduce((total, item) => total + Number(item.stock) * Number(item.unitPrice), 0));
        $('#inventory-category').innerHTML = '<option value="">Tất cả nhóm</option>' + categories.map((name) => `<option value="${escape(name)}">${escape(name)}</option>`).join('');
        $('#inventory-category').value = categories.includes(category) ? category : '';
        $('#part-categories').innerHTML = categories.map((name) => `<option value="${escape(name)}"></option>`).join('');
    }

    async function loadInventory() {
        if (loading) return;
        loading = true;
        $('#inventory-refresh').disabled = true;
        setError('#inventory-error');
        try {
            const data = await api('/api/inventory');
            items = Array.isArray(data.items) ? data.items : [];
            loaded = true;
            updateSummary();
            render();
        } catch (error) {
            setError('#inventory-error', error.message || 'Không thể tải kho phụ tùng. Vui lòng thử lại.');
            if (!loaded) {
                $('#inventory-body').innerHTML = '<tr><td colspan="7" class="text-muted text-center py-5">Chưa tải được dữ liệu kho phụ tùng.</td></tr>';
                $('#inventory-count').textContent = 'Dữ liệu chưa khả dụng';
            }
        } finally {
            loading = false;
            $('#inventory-refresh').disabled = false;
        }
    }

    function openForm(item = null) {
        if (saving) return;
        selectedId = item ? item.id : null;
        form.reset();
        form.classList.remove('was-validated');
        setError('#inventory-form-error');
        $('#inventory-modal-title').textContent = item ? 'Chỉnh sửa phụ tùng' : 'Thêm phụ tùng';
        $('#part-sku').value = item?.sku ?? '';
        $('#part-name').value = item?.name ?? '';
        $('#part-category').value = item?.category ?? '';
        $('#part-unit').value = item?.unit ?? 'Cái';
        $('#part-price').value = item?.unitPrice ?? 0;
        $('#part-stock').value = item?.stock ?? 0;
        $('#part-reorder').value = item?.reorderLevel ?? 5;
        modal.show();
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (saving) return;
        ['#part-sku', '#part-name', '#part-category', '#part-unit'].forEach((selector) => { $(selector).value = $(selector).value.trim(); });
        form.classList.add('was-validated');
        if (!form.checkValidity()) {
            form.querySelector(':invalid')?.focus();
            return;
        }
        saving = true;
        setError('#inventory-form-error');
        const saveButton = $('#inventory-save');
        saveButton.disabled = true;
        saveButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Đang lưu…';
        const payload = {
            sku: $('#part-sku').value,
            name: $('#part-name').value,
            category: $('#part-category').value,
            unit: $('#part-unit').value,
            unitPrice: Number($('#part-price').value),
            stock: Number($('#part-stock').value),
            reorderLevel: Number($('#part-reorder').value)
        };
        const editing = selectedId !== null;
        try {
            const saved = await api(editing ? `/api/inventory/${encodeURIComponent(selectedId)}` : '/api/inventory', {
                method: editing ? 'PUT' : 'POST',
                body: JSON.stringify(payload)
            });
            if (saved?.id) {
                const index = items.findIndex((item) => item.id === saved.id);
                if (index < 0) items.push(saved); else items[index] = saved;
                loaded = true;
                updateSummary();
                render();
            }
            modal.hide();
            toast(editing ? 'Đã cập nhật phụ tùng.' : 'Đã thêm phụ tùng vào kho.');
            await loadInventory();
        } catch (error) {
            setError('#inventory-form-error', error.message || 'Không thể lưu phụ tùng. Vui lòng thử lại.');
        } finally {
            saving = false;
            saveButton.disabled = false;
            saveButton.textContent = 'Lưu phụ tùng';
        }
    });

    $('#inventory-modal').addEventListener('shown.bs.modal', () => $('#part-sku').focus());
    $('#inventory-add').addEventListener('click', () => openForm());
    $('#inventory-refresh').addEventListener('click', loadInventory);
    $('#inventory-body').addEventListener('click', (event) => {
        const button = event.target.closest('[data-edit-part]');
        if (!button) return;
        const item = items.find((entry) => entry.id === button.dataset.editPart);
        if (item) openForm(item);
    });
    $('#inventory-search').addEventListener('input', () => { if (loaded) { page = 1; render(); } });
    ['#inventory-category', '#inventory-low-only'].forEach((selector) => $(selector).addEventListener('change', () => { if (loaded) { page = 1; render(); } }));
    $('#inventory-prev').addEventListener('click', () => { page--; render(); });
    $('#inventory-next').addEventListener('click', () => { page++; render(); });
    $('#inventory-export').addEventListener('click', () => {
        const filtered = visibleItems();
        if (!filtered.length) return;
        const cell = (value) => {
            const content = String(value ?? '');
            const safe = /^[\t\r\n]/.test(content) || /^\s*[=+\-@]/.test(content) ? `'${content}` : content;
            return `"${safe.replace(/"/g, '""')}"`;
        };
        const rows = [['Mã phụ tùng', 'Tên phụ tùng', 'Nhóm', 'Đơn giá (VNĐ)', 'Tồn kho', 'Đơn vị', 'Mức tồn tối thiểu', 'Tình trạng'], ...filtered.map((item) => [item.sku, item.name, item.category, item.unitPrice, item.stock, item.unit, item.reorderLevel, Number(item.stock) <= 0 ? 'Hết hàng' : isLow(item) ? 'Sắp hết' : 'Còn hàng'])];
        const blob = new Blob(['\uFEFF' + rows.map((row) => row.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Bangkok' }).format(new Date());
        link.download = `autofix-kho-phu-tung-${date}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast(`Đã xuất ${filtered.length} phụ tùng.`);
    });

    loadInventory();
})();
