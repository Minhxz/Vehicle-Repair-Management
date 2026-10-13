(() => {
    'use strict';
    const { api, escape, date, money, toast } = window.AutoFix;
    const $ = (selector) => document.querySelector(selector);
    let appointments = [], inventory = [], current = null, busy = false;
    const checklistMarker = '\n\nĐã kiểm tra: ';
    const lineTotal = (quantity, price) => Math.round(Math.round(quantity * 100) * Math.round(price) / 100);
    function row(item = {}) {
        const element = document.createElement('tr');
        element.innerHTML = `<td class="line-index"></td><td><input class="form-control line-name" aria-label="Tên hạng mục" maxlength="120" list="inventory-list" placeholder="Chọn phụ tùng hoặc nhập dịch vụ" value="${escape(item.name)}" /></td><td><select class="form-select line-type" aria-label="Loại hạng mục"><option value="Part" ${item.type !== 'Service' ? 'selected' : ''}>Phụ tùng</option><option value="Service" ${item.type === 'Service' ? 'selected' : ''}>Tiền công</option></select></td><td><input class="form-control line-quantity" aria-label="Số lượng" type="number" min="0.01" max="10000" step="0.01" value="${Number(item.quantity) || 1}" /></td><td><input class="form-control line-price" aria-label="Đơn giá" type="number" min="0" max="1000000000" step="1" value="${Number(item.unitPrice) || 0}" /></td><td class="line-total fw-semibold"></td><td><button type="button" class="btn btn-light btn-sm remove-line text-danger" aria-label="Xóa hạng mục">×</button></td>`;
        $('#parts-body').append(element);
        updateTotals();
    }
    function previewItems() {
        return [...$('#parts-body').querySelectorAll('tr')].map((element) => ({ name: element.querySelector('.line-name').value.trim(), type: element.querySelector('.line-type').value, quantity: Number(element.querySelector('.line-quantity').value) || 0, unitPrice: Number(element.querySelector('.line-price').value) || 0 }));
    }
    function updateTotals() {
        const rows = [...$('#parts-body').querySelectorAll('tr')];
        let subtotal = 0;
        rows.forEach((element, index) => {
            const quantity = Math.max(0, Number(element.querySelector('.line-quantity').value) || 0);
            const price = Math.max(0, Number(element.querySelector('.line-price').value) || 0);
            const total = lineTotal(quantity, price);
            element.querySelector('.line-index').textContent = index + 1;
            element.querySelector('.line-total').textContent = money(total);
            subtotal += total;
        });
        const discount = Math.max(0, Math.round(Number($('#job-discount').value) || 0));
        $('#job-discount').max = subtotal;
        $('#bill-subtotal').textContent = money(subtotal);
        $('#bill-discount').textContent = `−${money(discount)}`;
        $('#bill-total').textContent = money(Math.max(0, subtotal - discount));
        $('#job-line-count').textContent = `${rows.length} hạng mục`;
        $('#parts-empty').hidden = rows.length > 0;
        $('#add-line').disabled = rows.length >= 50;
    }
    function render(appointment) {
        current = appointment;
        $('#job-editor').hidden = !appointment;
        $('#job-save').disabled = !appointment;
        $('#job-reset').disabled = !appointment;
        if (!appointment) return;
        $('#job-vehicle').innerHTML = `<strong>${escape(appointment.brand)}</strong><span>Biển số: <b>${escape(appointment.licensePlate || 'Chưa cung cấp')}</b></span><span>${escape(appointment.vehicleType)}</span>`;
        $('#job-customer').innerHTML = `<strong>${escape(appointment.customerName)}</strong><span>${escape(appointment.phone)}</span><span>${escape(date(appointment.date))} · ${escape(appointment.time)}</span>`;
        $('#customer-note').textContent = `Yêu cầu khách hàng: ${appointment.note || appointment.service}`;
        const card = appointment.jobCard || {};
        $('#job-technician').value = card.technician || '';
        $('#job-status').value = appointment.status;
        const diagnosis = card.diagnosis || '';
        const markerIndex = diagnosis.lastIndexOf(checklistMarker);
        $('#job-diagnosis').value = markerIndex < 0 ? diagnosis : diagnosis.slice(0, markerIndex);
        const checked = markerIndex < 0 ? [] : diagnosis.slice(markerIndex + checklistMarker.length).split(' | ');
        document.querySelectorAll('.checklist-label input').forEach((checkbox) => { checkbox.checked = checked.includes(checkbox.value); });
        $('#parts-body').innerHTML = '';
        (card.items || []).forEach(row);
        $('#job-discount').value = card.discount || 0;
        $('#job-payment').value = card.paymentStatus || 'Unpaid';
        $('#job-updated').textContent = card.updatedAt ? `Lần lưu gần nhất: ${date(card.updatedAt)}` : 'Phiếu chưa được lưu. Chi phí hiện tại là dự toán.';
        updateTotals();
    }
    async function load() {
        $('#job-message').hidden = true;
        try {
            const [appointmentData, inventoryData] = await Promise.all([api('/api/appointments'), api('/api/inventory').catch(() => ({ items: [] }))]);
            appointments = appointmentData.appointments || [];
            inventory = inventoryData.items || [];
            $('#inventory-list').innerHTML = inventory.map((item) => `<option value="${escape(item.name)}">${escape(item.sku)} · ${escape(money(item.unitPrice))}</option>`).join('');
            const names = [...new Set(appointments.map((a) => a.jobCard?.technician).filter(Boolean))];
            $('#technician-list').innerHTML = names.map((name) => `<option value="${escape(name)}"></option>`).join('');
            $('#job-reference').innerHTML = `<option value="">Chọn phương tiện cần lập phiếu…</option>${appointments.map((a) => `<option value="${escape(a.reference)}">${escape(a.reference)} · ${escape(a.brand)} · ${escape(a.licensePlate || a.customerName)}</option>`).join('')}`;
            $('#job-empty').hidden = appointments.length > 0;
            const requested = new URLSearchParams(location.search).get('reference');
            const selected = appointments.find((a) => a.reference === requested) || (requested ? null : appointments[0]);
            $('#job-reference').value = selected?.reference || '';
            render(selected);
            if (requested && !selected) { $('#job-message').textContent = 'Không tìm thấy mã phiếu. Vui lòng chọn yêu cầu tiếp nhận khác.'; $('#job-message').hidden = false; }
        } catch (error) { $('#job-message').textContent = error.message; $('#job-message').hidden = false; $('#job-reference').innerHTML = '<option value="">Không thể tải lịch hẹn</option>'; }
    }
    function validateItems() {
        const rows = [...$('#parts-body').querySelectorAll('tr')];
        for (const element of rows) {
            const name = element.querySelector('.line-name'), quantity = element.querySelector('.line-quantity'), price = element.querySelector('.line-price');
            const invalid = !name.value.trim() ? name : (!quantity.value || Number(quantity.value) <= 0 || !quantity.checkValidity()) ? quantity : (!price.value || Number(price.value) < 0 || !price.checkValidity()) ? price : null;
            element.querySelectorAll('input').forEach((input) => input.classList.remove('is-invalid'));
            if (invalid) {
                invalid.classList.add('is-invalid');
                bootstrap.Tab.getOrCreateInstance($('#parts-tab')).show();
                setTimeout(() => invalid.focus(), 150);
                throw new Error('Điền tên hạng mục, số lượng lớn hơn 0 và đơn giá hợp lệ.');
            }
        }
        const items = previewItems();
        const subtotal = items.reduce((sum, item) => sum + lineTotal(item.quantity, item.unitPrice), 0);
        const discount = Number($('#job-discount').value);
        if (!Number.isFinite(discount) || discount < 0 || discount > subtotal || !$('#job-discount').checkValidity()) { bootstrap.Tab.getOrCreateInstance($('#billing-tab')).show(); throw new Error('Giảm giá phải từ 0 đến tổng tạm tính.'); }
        return items;
    }
    function collect() {
        const items = validateItems();
        const checks = [...document.querySelectorAll('.checklist-label input:checked')].map((checkbox) => checkbox.value);
        return { diagnosis: $('#job-diagnosis').value.trim() + (checks.length ? checklistMarker + checks.join(' | ') : ''), technician: $('#job-technician').value.trim(), items, discount: Math.round(Number($('#job-discount').value) || 0), paymentStatus: $('#job-payment').value };
    }
    function renderPrint(appointment) {
        const card = appointment.jobCard;
        $('#print-summary').innerHTML = `<h1>AUTO FIX</h1><p>PHIẾU SỬA CHỮA · ${escape(appointment.reference)}</p><p>Khách hàng: ${escape(appointment.customerName)} · ${escape(appointment.phone)}</p><p>Phương tiện: ${escape(appointment.brand)} · ${escape(appointment.licensePlate || appointment.vehicleType)}</p><p>Kỹ thuật viên: ${escape(card.technician || 'Chưa phân công')}</p><p>Chẩn đoán: ${escape(card.diagnosis || '—').replace(/\n/g, '<br>')}</p><table><thead><tr><th>Hạng mục</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead><tbody>${(card.items || []).map((item) => `<tr><td>${escape(item.name)}</td><td>${escape(item.quantity)}</td><td>${escape(money(item.unitPrice))}</td><td>${escape(money(item.lineTotal))}</td></tr>`).join('')}</tbody></table><div class="print-total"><p>Tạm tính: ${escape(money(card.subtotal))}</p><p>Giảm giá: ${escape(money(card.discount))}</p><strong>Tổng cộng: ${escape(money(card.total))}</strong><p>${card.paymentStatus === 'Paid' ? 'ĐÃ THANH TOÁN' : 'CHƯA THANH TOÁN'}</p></div>`;
    }
    async function save({ pay = false, print = false } = {}) {
        if (!current || busy) return;
        const reference = current.reference;
        $('#job-message').hidden = true;
        let card;
        try { card = collect(); } catch (error) { $('#job-message').textContent = error.message; $('#job-message').hidden = false; return; }
        if (pay) card.paymentStatus = 'Paid';
        busy = true;
        let persisted = null;
        ['job-save', 'job-reset', 'confirm-payment', 'print-job', 'job-reference'].forEach((id) => { $(`#${id}`).disabled = true; });
        $('#job-editor').querySelectorAll('input, select, textarea, button:not([data-bs-toggle="tab"])').forEach((control) => { control.disabled = true; });
        try {
            const nextStatus = $('#job-status').value;
            let updated = await api(`/api/appointments/${encodeURIComponent(reference)}/job-card`, { method: 'PUT', body: JSON.stringify(card) });
            persisted = updated;
            current = updated;
            appointments = appointments.map((a) => a.reference === reference ? updated : a);
            if (updated.status !== nextStatus) updated = await api(`/api/appointments/${encodeURIComponent(reference)}/status`, { method: 'PUT', body: JSON.stringify({ status: nextStatus }) });
            appointments = appointments.map((a) => a.reference === reference ? updated : a);
            render(updated);
            toast(pay ? 'Đã xác nhận thanh toán và lưu phiếu.' : 'Đã lưu phiếu sửa chữa.');
            if (print) { renderPrint(updated); window.print(); }
        } catch (error) { if (persisted) render(persisted); $('#job-message').textContent = persisted ? `Phiếu sửa chữa đã được lưu. Trạng thái chưa được cập nhật: ${error.message}` : error.message; $('#job-message').hidden = false; }
        finally { busy = false; ['job-save', 'job-reset', 'confirm-payment', 'print-job', 'job-reference'].forEach((id) => { $(`#${id}`).disabled = false; }); $('#job-editor').querySelectorAll('input, select, textarea, button:not([data-bs-toggle="tab"])').forEach((control) => { control.disabled = false; }); updateTotals(); }
    }
    $('#job-reference').addEventListener('change', (event) => { render(appointments.find((a) => a.reference === event.target.value)); $('#job-message').hidden = true; const url = new URL(location.href); if (event.target.value) url.searchParams.set('reference', event.target.value); else url.searchParams.delete('reference'); history.replaceState({}, '', url); });
    $('#job-reset').addEventListener('click', () => { render(current); toast('Đã khôi phục nội dung phiếu đã lưu.'); });
    $('#job-save').addEventListener('click', () => save());
    $('#confirm-payment').addEventListener('click', () => save({ pay: true, print: true }));
    $('#print-job').addEventListener('click', () => save({ print: true }));
    $('#add-line').addEventListener('click', () => { if ($('#parts-body').children.length < 50) row(); });
    $('#parts-body').addEventListener('click', (event) => { const button = event.target.closest('.remove-line'); if (button) { button.closest('tr').remove(); updateTotals(); } });
    $('#parts-body').addEventListener('input', updateTotals);
    $('#parts-body').addEventListener('change', (event) => {
        if (!event.target.matches('.line-name')) return;
        const item = inventory.find((part) => part.name === event.target.value);
        if (item) { const element = event.target.closest('tr'); element.querySelector('.line-price').value = item.unitPrice; element.querySelector('.line-type').value = 'Part'; updateTotals(); }
    });
    $('#job-discount').addEventListener('input', updateTotals);
    load();
})();
