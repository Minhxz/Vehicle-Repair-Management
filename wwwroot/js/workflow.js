(() => {
    'use strict';
    const { api, escape, date, money, toast, normalize, badge } = window.AutoFix;
    const $ = (selector) => document.querySelector(selector);
    const columns = ['Pending', 'Confirmed', 'InProgress', 'Completed'];
    const colors = { Pending: '#5caac4', Confirmed: '#e2b45b', InProgress: '#708ee1', Completed: '#6db38a', Cancelled: '#d9948d' };
    let appointments = [], selectedReference = null, draggedReference = null, loadTask = null, dragEndedAt = 0, revision = 0;
    let mutationTask = Promise.resolve();
    const detailModal = new bootstrap.Modal($('#detail-modal'));
    const initials = (name) => String(name || '—').trim().split(/\s+/).slice(-2).map((part) => part[0]).join('').toUpperCase();
    function filtered() {
        const query = normalize($('#workflow-search').value.trim());
        const vehicle = $('#vehicle-filter').value, technician = $('#technician-filter').value;
        return appointments.filter((a) => (!vehicle || a.vehicleType === vehicle) && (!technician || (technician === '__unassigned' ? !a.jobCard?.technician : a.jobCard?.technician === technician)) && (!query || normalize([a.reference, a.customerName, a.phone, a.brand, a.licensePlate, a.service].join(' ')).includes(query)));
    }
    function card(appointment) {
        const technician = appointment.jobCard?.technician;
        return `<button type="button" draggable="true" class="kanban-card mb-3" data-reference="${escape(appointment.reference)}" style="border-left-color:${colors[appointment.status] || colors.Pending}" aria-label="Xem phiếu ${escape(appointment.reference)}"><div class="d-flex justify-content-between align-items-center gap-2"><span class="card-reference">${escape(appointment.reference)}</span><span class="card-time">${escape(date(appointment.date))} · ${escape(appointment.time)}</span></div><h3>${escape(appointment.brand)}</h3><p>${escape(appointment.licensePlate || 'Chưa có biển số')} · ${escape(appointment.service)}<br />${escape(appointment.customerName)}</p><div class="card-footer-line"><span class="d-flex align-items-center gap-2"><span class="avatar-sm">${escape(initials(technician))}</span>${escape(technician || 'Chưa phân công')}</span><span>${appointment.jobCard ? escape(money(appointment.jobCard.total)) : escape(appointment.vehicleType)}</span></div></button>`;
    }
    function render() {
        const visible = filtered();
        columns.forEach((status) => {
            const items = visible.filter((a) => a.status === status);
            $(`#count-${status}`).textContent = items.length;
            $(`#cards-${status}`).innerHTML = items.length ? items.map(card).join('') : '<div class="kanban-empty">Chưa có xe trong trạng thái này.</div>';
        });
        const cancelled = visible.filter((a) => a.status === 'Cancelled');
        $('#cancelled-section').hidden = cancelled.length === 0;
        $('#cancelled-count').textContent = `(${cancelled.length})`;
        $('#cancelled-cards').innerHTML = cancelled.map((a) => `<div class="col-md-6 col-xl-3">${card(a)}</div>`).join('');
        $('#workflow-summary').textContent = `Hiển thị ${visible.length} / ${appointments.length} lịch hẹn · Mở thẻ để xem chi tiết và phân công kỹ thuật viên.`;
        renderTechnicians();
    }
    function renderTechnicians() {
        const names = [...new Set(appointments.map((a) => a.jobCard?.technician).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'));
        const oldValue = $('#technician-filter').value;
        $('#technician-filter').innerHTML = `<option value="">Tất cả kỹ thuật viên</option><option value="__unassigned">Chưa phân công</option>${names.map((name) => `<option value="${escape(name)}">${escape(name)}</option>`).join('')}`;
        $('#technician-filter').value = oldValue;
        $('#technicians-empty').hidden = names.length > 0;
        $('#technicians-grid').innerHTML = names.map((name) => {
            const jobs = appointments.filter((a) => a.jobCard?.technician === name);
            const done = jobs.filter((a) => a.status === 'Completed').length;
            const active = jobs.filter((a) => !['Completed', 'Cancelled'].includes(a.status)).length;
            return `<article class="tech-card"><span class="tech-avatar">${escape(initials(name))}</span><h3>${escape(name)}</h3><p>Kỹ thuật viên phụ trách</p><div class="tech-stats"><span>Hoàn thành<strong>${done}</strong></span><span>Đang phụ trách<strong>${active}</strong></span><span>Tổng phiếu<strong>${jobs.length}</strong></span></div><button type="button" class="btn btn-outline-primary" data-technician="${escape(name)}">Xem công việc</button></article>`;
        }).join('');
    }
    async function load() {
        if (loadTask) return loadTask;
        loadTask = (async () => {
        const loadRevision = revision;
        $('#workflow-refresh').disabled = true;
        $('#workflow-message').hidden = true;
        try { const data = await api('/api/appointments'); if (loadRevision === revision) { appointments = data.appointments || []; render(); } }
        catch (error) { $('#workflow-message').textContent = error.message; $('#workflow-message').hidden = false; $('#workflow-summary').textContent = 'Chưa thể tải dữ liệu. Nhấn Làm mới để thử lại.'; }
        finally { $('#workflow-refresh').disabled = false; loadTask = null; }
        })();
        return loadTask;
    }
    function updateStatus(reference, status) {
        const task = mutationTask.then(async () => {
        if (loadTask) await loadTask;
        const updated = await api(`/api/appointments/${encodeURIComponent(reference)}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
        revision += 1;
        appointments = appointments.map((item) => item.reference === reference ? updated : item);
        render();
        toast('Đã cập nhật tiến độ sửa chữa.');
        });
        mutationTask = task.catch(() => {});
        return task;
    }
    function openDetail(reference) {
        const a = appointments.find((item) => item.reference === reference);
        if (!a) return;
        selectedReference = reference;
        $('#detail-title').textContent = a.brand;
        const field = (label, value) => `<div class="col-5 text-muted">${label}</div><div class="col-7">${escape(value || 'Chưa cung cấp')}</div>`;
        $('#detail-content').innerHTML = `<div class="d-flex justify-content-between align-items-center mb-4"><span class="small text-primary">${escape(a.reference)}</span>${badge(a.status)}</div><div class="row g-3 small">${field('Khách hàng', a.customerName)}${field('Điện thoại', a.phone)}${field('Phương tiện', a.vehicleType)}${field('Biển số', a.licensePlate)}${field('Dịch vụ', a.service)}${field('Ngày hẹn', `${date(a.date)} · ${a.time}`)}${field('Kỹ thuật viên', a.jobCard?.technician || 'Chưa phân công')}</div><div class="mt-4 bg-light p-3 rounded small text-muted" style="white-space:pre-wrap;overflow-wrap:anywhere">${escape(a.note || 'Chưa có ghi chú từ khách hàng.')}</div>`;
        $('#detail-status').value = a.status;
        $('#detail-message').textContent = '';
        $('#detail-job-link').href = `/Management/JobCard?reference=${encodeURIComponent(reference)}`;
        detailModal.show();
    }
    document.addEventListener('click', (event) => {
        const element = event.target.closest('[data-reference]');
        if (element && Date.now() - dragEndedAt > 200) openDetail(element.dataset.reference);
    });
    $('#detail-save').addEventListener('click', async (event) => {
        const button = event.currentTarget;
        button.disabled = true;
        try { await updateStatus(selectedReference, $('#detail-status').value); detailModal.hide(); }
        catch (error) { $('#detail-message').textContent = error.message; }
        finally { button.disabled = false; }
    });
    $('#kanban-board').addEventListener('dragstart', (event) => {
        const element = event.target.closest('[data-reference]');
        if (!element) return;
        draggedReference = element.dataset.reference;
        element.classList.add('dragging');
        event.dataTransfer.setData('text/plain', draggedReference);
        event.dataTransfer.effectAllowed = 'move';
    });
    $('#kanban-board').addEventListener('dragend', (event) => { event.target.classList.remove('dragging'); document.querySelectorAll('.drag-over').forEach((column) => column.classList.remove('drag-over')); draggedReference = null; dragEndedAt = Date.now(); });
    document.querySelectorAll('.kanban-column').forEach((column) => {
        column.addEventListener('dragover', (event) => { if (draggedReference) { event.preventDefault(); column.classList.add('drag-over'); } });
        column.addEventListener('dragleave', (event) => { if (!column.contains(event.relatedTarget)) column.classList.remove('drag-over'); });
        column.addEventListener('drop', async (event) => {
            event.preventDefault(); column.classList.remove('drag-over');
            const reference = event.dataTransfer.getData('text/plain');
            const item = appointments.find((a) => a.reference === reference);
            if (!item || item.status === column.dataset.status) return;
            try { await updateStatus(reference, column.dataset.status); } catch (error) { toast(error.message); }
        });
    });
    $('#technicians-grid').addEventListener('click', (event) => { const button = event.target.closest('[data-technician]'); if (button) { $('#technician-filter').value = button.dataset.technician; render(); $('#workflow-search').scrollIntoView({ behavior: 'smooth', block: 'center' }); } });
    $('#workflow-search').addEventListener('input', render);
    $('#vehicle-filter').addEventListener('change', render);
    $('#technician-filter').addEventListener('change', render);
    $('#workflow-refresh').addEventListener('click', load);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    $('#new-date').value = today;
    $('#new-date').min = today;
    const maxDate = new Date(); maxDate.setDate(maxDate.getDate() + 90);
    $('#new-date').max = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(maxDate);
    const times = []; for (let h = 8; h <= 17; h += 1) { times.push(`${String(h).padStart(2, '0')}:00`, `${String(h).padStart(2, '0')}:30`); }
    $('#new-time').innerHTML = times.map((time) => `<option value="${time}">${time}</option>`).join('');
    $('#new-job-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        $('#new-job-save').disabled = true;
        $('#new-job-message').textContent = '';
        try {
            const values = Object.fromEntries(new FormData(event.currentTarget).entries());
            await api('/api/appointments', { method: 'POST', body: JSON.stringify(values) });
            bootstrap.Modal.getInstance($('#new-job-modal')).hide();
            event.target.reset(); $('#new-date').value = today;
            toast('Đã tạo yêu cầu tiếp nhận phương tiện.');
            if (loadTask) await loadTask;
            await load();
        } catch (error) { $('#new-job-message').textContent = error.message; }
        finally { $('#new-job-save').disabled = false; }
    });
    load();
})();
