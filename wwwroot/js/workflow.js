(() => {
    'use strict';
    const { api, escape, date, toast } = window.AutoFix;
    const $ = (selector) => document.querySelector(selector);
    const labels = { Pending: 'Chờ xác nhận', Confirmed: 'Đã tiếp nhận', InProgress: 'Đang sửa', Completed: 'Hoàn thành', Cancelled: 'Đã hủy' };
    const transitions = { Pending: ['Confirmed', 'Cancelled'], Confirmed: ['InProgress', 'Cancelled'], InProgress: ['Completed'], Completed: [], Cancelled: [] };
    const detailModal = new bootstrap.Modal($('#detail-modal'));
    let page = 1, totalPages = 1, listRequest = 0, listAbort, detailRequest = 0, selected = null, saving = false;

    const statusBadge = (status) => `<span class="status-pill status-${Object.hasOwn(labels, status) ? status : ''}">${escape(labels[status] || status)}</span>`;
    function showError(message) {
        $('#workflow-message').textContent = message;
        $('#workflow-message').hidden = !message;
    }
    function row(item) {
        return `<tr><td><strong>${escape(item.reference)}</strong><small>${escape(date(item.date))} · ${escape(item.time)}</small></td><td>${escape(item.customerName)}<small>${escape(item.phone)}</small></td><td>${escape(item.brand)}<small>${escape(item.licensePlate || item.vehicleType)}</small></td><td>${escape(item.service)}</td><td>${statusBadge(item.status)}</td><td><button type="button" class="btn btn-outline-primary btn-sm" data-reference="${escape(item.reference)}" aria-label="Chi tiết lịch ${escape(item.reference)}">Chi tiết</button></td></tr>`;
    }
    function render(data) {
        const items = Array.isArray(data.appointments) ? data.appointments : [];
        const total = Number(data.total) || 0;
        page = Number(data.page) || 1;
        totalPages = Math.max(1, Number(data.totalPages) || 1);
        const pageSize = Number(data.pageSize) || 10;
        $('#workflow-rows').innerHTML = items.length ? items.map(row).join('') : '<tr><td colspan="6" class="empty-block"><strong>Chưa có lịch hẹn phù hợp</strong>Thử thay đổi bộ lọc hoặc tạo một lịch hẹn mới.</td></tr>';
        const start = (page - 1) * pageSize + 1;
        $('#workflow-summary').textContent = items.length ? `Hiển thị ${start}–${start + items.length - 1} / ${total} lịch hẹn` : '0 lịch hẹn';
        $('#workflow-page').textContent = `Trang ${page} / ${totalPages}`;
        const stats = data.stats || {};
        [['total', 'total'], ['pending', 'pending'], ['confirmed', 'confirmed'], ['in-progress', 'inProgress'], ['completed', 'completed']].forEach(([id, key]) => {
            $(`#stat-${id}`).textContent = Number(stats[key]) || 0;
        });
    }
    async function load() {
        listAbort?.abort();
        listAbort = new AbortController();
        const request = ++listRequest;
        const query = new URLSearchParams({ q: $('#workflow-search').value.trim(), status: $('#workflow-status').value, date: $('#workflow-date').value, page: String(page), pageSize: '10' });
        $('#workflow-table').setAttribute('aria-busy', 'true');
        $('#workflow-prev').disabled = true;
        $('#workflow-next').disabled = true;
        $('#workflow-summary').textContent = 'Đang tải dữ liệu…';
        showError('');
        try {
            const data = await api(`/api/appointments?${query}`, { signal: listAbort.signal });
            if (request === listRequest) render(data);
        } catch (error) {
            if (request !== listRequest || error.name === 'AbortError') return;
            showError(error.message);
            $('#workflow-summary').textContent = 'Chưa tải được lịch hẹn. Nhấn Tìm kiếm để thử lại.';
        } finally {
            if (request === listRequest) {
                $('#workflow-table').setAttribute('aria-busy', 'false');
                $('#workflow-prev').disabled = page <= 1;
                $('#workflow-next').disabled = page >= totalPages;
            }
        }
    }
    function renderDetail(item) {
        const field = (label, value) => `<dt>${escape(label)}</dt><dd>${escape(value || 'Chưa cung cấp')}</dd>`;
        $('#detail-title').textContent = `Lịch hẹn ${item.reference}`;
        $('#detail-content').innerHTML = `<div class="mb-3">${statusBadge(item.status)}</div><dl class="appointment-detail">${field('Khách hàng', item.customerName)}${field('Điện thoại', item.phone)}${field('Phương tiện', `${item.vehicleType} · ${item.brand}`)}${field('Biển số', item.licensePlate)}${field('Dịch vụ', item.service)}${field('Ngày hẹn', `${date(item.date)} · ${item.time}`)}</dl><div class="customer-note"><strong>Yêu cầu từ khách hàng</strong><p>${escape(item.note || 'Không có ghi chú.')}</p></div>`;
        const next = transitions[item.status] || [];
        $('#detail-status').innerHTML = [item.status, ...next].map((status) => `<option value="${escape(status)}">${escape(labels[status] || status)}</option>`).join('');
        $('#detail-status').value = item.status;
        $('#detail-status').disabled = next.length === 0;
        $('#detail-status-help').textContent = next.length ? 'Chọn bước tiếp theo hoặc giữ trạng thái hiện tại để lưu ghi chú.' : 'Lịch hẹn đã kết thúc. Bạn có thể bổ sung ghi chú xử lý.';
        $('#detail-note').value = item.processingNote || '';
        $('#detail-note').disabled = false;
        $('#detail-save').disabled = false;
    }
    async function openDetail(reference) {
        const request = ++detailRequest;
        selected = null;
        $('#detail-title').textContent = 'Chi tiết lịch hẹn';
        $('#detail-content').textContent = 'Đang tải thông tin…';
        $('#detail-status').replaceChildren();
        $('#detail-status').disabled = true;
        $('#detail-status-help').textContent = '';
        $('#detail-note').value = '';
        $('#detail-note').disabled = true;
        $('#detail-save').disabled = true;
        $('#detail-message').textContent = '';
        detailModal.show();
        try {
            const item = await api(`/api/appointments/${encodeURIComponent(reference)}`);
            if (request !== detailRequest) return;
            selected = item;
            renderDetail(item);
        } catch (error) {
            if (request === detailRequest) {
                $('#detail-content').textContent = '';
                $('#detail-message').textContent = error.message;
            }
        }
    }
    $('#workflow-filters').addEventListener('submit', (event) => { event.preventDefault(); page = 1; load(); });
    ['#workflow-status', '#workflow-date'].forEach((selector) => $(selector).addEventListener('change', () => { page = 1; load(); }));
    $('#workflow-reset').addEventListener('click', () => { $('#workflow-filters').reset(); page = 1; load(); });
    $('#workflow-prev').addEventListener('click', () => { if (page > 1) { page -= 1; load(); } });
    $('#workflow-next').addEventListener('click', () => { if (page < totalPages) { page += 1; load(); } });
    $('#workflow-rows').addEventListener('click', (event) => {
        const button = event.target.closest('[data-reference]');
        if (button) openDetail(button.dataset.reference);
    });
    $('#detail-modal').addEventListener('hidden.bs.modal', () => { detailRequest += 1; selected = null; });
    $('#detail-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!selected || saving) return;
        const reference = selected.reference;
        const request = detailRequest;
        const status = $('#detail-status').value;
        const processingNote = $('#detail-note').value.trim();
        saving = true;
        $('#detail-save').disabled = true;
        $('#detail-status').disabled = true;
        $('#detail-note').disabled = true;
        $('#detail-message').textContent = '';
        try {
            await api(`/api/appointments/${encodeURIComponent(reference)}/status`, { method: 'PUT', body: JSON.stringify({ status, processingNote }) });
            if (request === detailRequest) detailModal.hide();
            toast('Đã lưu tiến độ và ghi chú xử lý.');
            await load();
        } catch (error) {
            if (request === detailRequest) $('#detail-message').textContent = error.message;
        } finally {
            saving = false;
            if (request === detailRequest && selected) {
                $('#detail-save').disabled = false;
                $('#detail-status').disabled = (transitions[selected.status] || []).length === 0;
                $('#detail-note').disabled = false;
            }
        }
    });
    load();
})();
