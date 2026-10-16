(() => {
    'use strict';
    let toastTimer;
    const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
    const statuses = { Pending: 'Chờ xác nhận', Confirmed: 'Đã tiếp nhận', InProgress: 'Đang sửa chữa', Completed: 'Đã hoàn thành', Cancelled: 'Đã hủy' };
    async function api(url, options = {}) {
        try { return await window.AutoFixHttp.request(url, options); }
        catch (error) {
            if (error.status === 401) window.location.assign(`/Account/Login?returnUrl=${encodeURIComponent(location.pathname + location.search)}`);
            throw error;
        }
    }
    function toast(message) {
        const element = document.querySelector('#erp-toast');
        clearTimeout(toastTimer);
        element.textContent = message;
        element.hidden = false;
        toastTimer = setTimeout(() => { element.hidden = true; }, 4000);
    }
    function date(value) {
        if (!value) return '—';
        const dateValue = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
        return Number.isNaN(dateValue.getTime()) ? String(value) : new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(dateValue);
    }
    const money = (value) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value) || 0);
    const normalize = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
    const icon = (name) => `<svg class="erp-icon" aria-hidden="true"><use href="#icon-${escape(name)}"></use></svg>`;
    const badge = (status) => `<span class="status-pill status-${Object.hasOwn(statuses, status) ? status : ''}">${escape(statuses[status] || status)}</span>`;
    window.AutoFix = { api, escape, money, date, toast, normalize, icon, statuses, badge };
    const dateElement = document.querySelector('#workspace-date');
    if (dateElement) dateElement.textContent = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
    document.querySelector('#logout-button')?.addEventListener('click', async (event) => {
        const button = event.currentTarget;
        button.disabled = true;
        try { await api('/api/auth/logout', { method: 'POST' }); window.location.assign('/Account/Login'); }
        catch (error) { toast(error.message); button.disabled = false; }
    });
    const toggle = document.querySelector('#sidebar-toggle');
    const backdrop = document.querySelector('#sidebar-backdrop');
    function setSidebar(open) {
        document.body.classList.toggle('sidebar-open', open);
        if (backdrop) backdrop.hidden = !open;
        toggle?.setAttribute('aria-expanded', String(open));
    }
    toggle?.addEventListener('click', () => setSidebar(!document.body.classList.contains('sidebar-open')));
    backdrop?.addEventListener('click', () => setSidebar(false));
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') setSidebar(false); });
})();
