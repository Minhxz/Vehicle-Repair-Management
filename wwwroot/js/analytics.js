(() => {
    'use strict';
    const $ = (selector) => document.querySelector(selector);
    const { api, escape, money, toast } = window.AutoFix;
    const timeZone = 'Asia/Bangkok';
    const dayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
    const dateFormatter = new Intl.DateTimeFormat('vi-VN', { timeZone, day: '2-digit', month: '2-digit', year: 'numeric' });
    const percentFormatter = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });
    const numberFormatter = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });
    const amount = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
    const toDay = (value) => {
        if (!value) return null;
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) return null;
        const parts = dayFormatter.formatToParts(date);
        return ['year', 'month', 'day'].map((type) => parts.find((part) => part.type === type).value).join('-');
    };
    const dayDate = (key) => new Date(`${key}T12:00:00+07:00`);
    const dayLabel = (key) => dateFormatter.format(dayDate(key));
    const shiftDay = (key, difference) => {
        const date = new Date(`${key}T00:00:00Z`);
        date.setUTCDate(date.getUTCDate() + difference);
        return date.toISOString().slice(0, 10);
    };
    const lineAmount = (item) => amount(item.lineTotal ?? (amount(item.quantity) * amount(item.unitPrice)));
    const itemTotal = (row, type) => (row.jobCard.items || []).filter((item) => item.type === type).reduce((total, item) => total + lineAmount(item), 0);
    let invoices = [];
    let loading = false;
    let loaded = false;

    function period() {
        const today = toDay(new Date());
        const selection = $('#analytics-period').value;
        const start = selection === 'week' ? shiftDay(today, -6) : selection === 'month' ? `${today.slice(0, 7)}-01` : selection === 'year' ? `${today.slice(0, 4)}-01-01` : null;
        return { selection, today, start };
    }

    function rowsForPeriod() {
        const { start, today } = period();
        return invoices.filter((row) => row.reportDay && (!start || row.reportDay >= start) && row.reportDay <= today);
    }

    function seriesFor(rows) {
        const { selection, start, today } = period();
        const byMonth = selection === 'year' || selection === 'all';
        const paid = rows.filter((row) => row.jobCard.paymentStatus === 'Paid');
        const first = selection === 'all' ? rows.reduce((oldest, row) => row.reportDay < oldest ? row.reportDay : oldest, today) : start;
        const series = [];
        if (byMonth) {
            let cursor = `${first.slice(0, 7)}-01`;
            const end = today.slice(0, 7);
            while (cursor.slice(0, 7) <= end) {
                const key = cursor.slice(0, 7);
                series.push({ key, label: `${key.slice(5, 7)}/${key.slice(0, 4)}`, value: 0 });
                const date = new Date(`${cursor}T00:00:00Z`);
                date.setUTCMonth(date.getUTCMonth() + 1);
                cursor = date.toISOString().slice(0, 10);
            }
        } else {
            for (let cursor = first; cursor <= today; cursor = shiftDay(cursor, 1)) {
                series.push({ key: cursor, label: `${cursor.slice(8, 10)}/${cursor.slice(5, 7)}`, value: 0 });
            }
        }
        const lookup = new Map(series.map((entry) => [entry.key, entry]));
        paid.forEach((row) => {
            const key = byMonth ? row.reportDay.slice(0, 7) : row.reportDay;
            const entry = lookup.get(key);
            if (entry) entry.value += amount(row.jobCard.total);
        });
        return { series, byMonth, paidCount: paid.length };
    }

    function shortMoney(value) {
        if (value >= 1000000000) return `${numberFormatter.format(value / 1000000000)} tỷ`;
        if (value >= 1000000) return `${numberFormatter.format(value / 1000000)} tr`;
        if (value >= 1000) return `${numberFormatter.format(value / 1000)} nghìn`;
        return numberFormatter.format(value);
    }

    function renderChart(rows) {
        const { series, byMonth, paidCount } = seriesFor(rows);
        const width = 820, height = 290;
        const left = 80, right = 24, top = 20, bottom = 48;
        const plotWidth = width - left - right;
        const plotHeight = height - top - bottom;
        const maxValue = Math.max(...series.map((entry) => entry.value), 0);
        const maximum = maxValue ? maxValue * 1.15 : 1;
        const point = (entry, index) => ({ x: left + (series.length === 1 ? plotWidth / 2 : index * plotWidth / (series.length - 1)), y: top + plotHeight * (1 - entry.value / maximum) });
        const points = series.map(point);
        const grid = Array.from({ length: 5 }, (_, index) => {
            const y = top + plotHeight * index / 4;
            const value = maximum * (1 - index / 4);
            return `<line x1="${left}" y1="${y}" x2="${width - right}" y2="${y}" stroke="#e8edf3" stroke-dasharray="4 5"/><text x="${left - 12}" y="${y + 4}" text-anchor="end" fill="#8996a8" font-size="11">${escape(maxValue ? shortMoney(value) : index === 4 ? '0' : '')}</text>`;
        }).join('');
        const labelStep = Math.max(1, Math.ceil(series.length / 7));
        const labels = series.map((entry, index) => index % labelStep === 0 || index === series.length - 1 ? `<text x="${points[index].x}" y="${height - 18}" text-anchor="middle" fill="#8996a8" font-size="11">${escape(entry.label)}</text>` : '').join('');
        const path = points.map((position, index) => `${index === 0 ? 'M' : 'L'}${position.x.toFixed(2)},${position.y.toFixed(2)}`).join(' ');
        const area = points.length > 1 ? `<path d="${path} L${points.at(-1).x},${top + plotHeight} L${points[0].x},${top + plotHeight} Z" fill="url(#revenue-fill)"/>` : '';
        const markers = series.map((entry, index) => `<circle cx="${points[index].x}" cy="${points[index].y}" r="${series.length > 50 ? 2 : 4}" fill="#4e73df" stroke="white" stroke-width="2"><title>${escape(entry.label)}: ${escape(money(entry.value))}</title></circle>`).join('');
        const total = rows.filter((row) => row.jobCard.paymentStatus === 'Paid').reduce((sum, row) => sum + amount(row.jobCard.total), 0);
        $('#analytics-chart').innerHTML = `<svg viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-labelledby="analytics-svg-title analytics-svg-description"><title id="analytics-svg-title">Doanh thu đã thanh toán theo ${byMonth ? 'tháng' : 'ngày'}</title><desc id="analytics-svg-description">${escape(`${paidCount} phiếu đã thanh toán, tổng doanh thu ${money(total)} trong kỳ.`)}</desc><defs><linearGradient id="revenue-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#4e73df" stop-opacity=".18"/><stop offset="100%" stop-color="#4e73df" stop-opacity=".01"/></linearGradient></defs>${grid}${area}<path d="${path}" fill="none" stroke="#4e73df" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${markers}${labels}</svg>`;
        $('#analytics-series-label').textContent = byMonth ? 'Doanh thu theo tháng' : 'Doanh thu theo ngày';
        $('#analytics-chart-note').textContent = paidCount ? 'Di chuột vào điểm trên biểu đồ để xem số tiền. Doanh thu được nhóm theo ngày cập nhật phiếu.' : 'Chưa có phiếu đã thanh toán trong kỳ này.';
    }

    function renderInvoices(rows) {
        const recent = [...rows].sort((a, b) => new Date(b.reportAt) - new Date(a.reportAt)).slice(0, 10);
        $('#analytics-invoice-count').textContent = rows.length > 10 ? `10 phiếu gần nhất / ${rows.length} phiếu trong kỳ` : `${rows.length} phiếu trong kỳ`;
        $('#analytics-invoices').innerHTML = recent.length ? recent.map((row) => {
            const paid = row.jobCard.paymentStatus === 'Paid';
            const href = `/Management/JobCard?reference=${encodeURIComponent(row.reference)}`;
            return `<tr><td class="ps-4 text-nowrap"><a class="fw-semibold text-primary" href="${escape(href)}">${escape(row.reference)}</a></td><td><strong class="d-block">${escape(row.customerName)}</strong><span class="text-muted small">${escape(row.licensePlate || row.brand || row.vehicleType)}</span></td><td class="text-muted text-nowrap">${escape(dayLabel(row.reportDay))}</td><td class="text-end text-nowrap fw-semibold">${escape(money(row.jobCard.total))}</td><td class="text-nowrap"><span class="badge rounded-pill bg-${paid ? 'success' : 'warning'} bg-opacity-10 text-${paid ? 'success' : 'dark'} px-3 py-2">${paid ? 'Đã thanh toán' : 'Chưa thanh toán'}</span></td><td class="text-end pe-4"><a class="btn btn-sm btn-light border text-nowrap" href="${escape(href)}" aria-label="Xem phiếu sửa chữa ${escape(row.reference)}">Xem phiếu ↗</a></td></tr>`;
        }).join('') : '<tr><td colspan="6" class="text-center text-muted py-5">Chưa có phiếu sửa chữa trong kỳ báo cáo này.</td></tr>';
    }

    function render() {
        const rows = rowsForPeriod();
        const paidRows = rows.filter((row) => row.jobCard.paymentStatus === 'Paid');
        const unpaidRows = rows.filter((row) => row.jobCard.paymentStatus === 'Unpaid');
        const paidTotal = paidRows.reduce((total, row) => total + amount(row.jobCard.total), 0);
        const service = paidRows.reduce((total, row) => total + itemTotal(row, 'Service'), 0);
        const parts = paidRows.reduce((total, row) => total + itemTotal(row, 'Part'), 0);
        const gross = service + parts;
        const discount = paidRows.reduce((total, row) => total + amount(row.jobCard.discount), 0);
        const outstanding = unpaidRows.reduce((total, row) => total + amount(row.jobCard.total), 0);
        const servicePercent = gross ? service / gross * 100 : 0;
        const partsPercent = gross ? parts / gross * 100 : 0;
        $('#analytics-paid').textContent = money(paidTotal);
        $('#analytics-service').textContent = money(service);
        $('#analytics-parts').textContent = money(parts);
        $('#analytics-outstanding').textContent = money(outstanding);
        $('#analytics-paid-count').textContent = `${paidRows.length} phiếu đã thanh toán`;
        $('#analytics-unpaid-count').textContent = `${unpaidRows.length} phiếu chưa thanh toán`;
        $('#analytics-gross').textContent = money(gross);
        $('#analytics-service-share').textContent = `${percentFormatter.format(servicePercent)}%`;
        $('#analytics-parts-share').textContent = `${percentFormatter.format(partsPercent)}%`;
        $('#analytics-donut').style.background = gross ? `conic-gradient(#4e73df 0% ${servicePercent}%, #1cc88a ${servicePercent}% 100%)` : '#edf0f5';
        $('#analytics-donut').setAttribute('aria-label', gross ? `Tiền công sửa chữa ${percentFormatter.format(servicePercent)}%, phụ tùng ${percentFormatter.format(partsPercent)}%. Tổng trước giảm giá ${money(gross)}.` : 'Chưa có nguồn thu từ phiếu đã thanh toán trong kỳ.');
        $('#analytics-source-note').textContent = gross ? `Tiền công: ${money(service)}. Phụ tùng: ${money(parts)}. Cơ cấu từ các hạng mục đã thanh toán, trước giảm giá.` : 'Chưa có doanh thu từ tiền công hoặc phụ tùng trong kỳ này.';
        $('#analytics-calculation-note').textContent = `Doanh thu đã thu tính sau giảm giá; tiền công và phụ tùng thể hiện giá trị trước giảm giá. Giảm giá trên phiếu đã thu trong kỳ: ${money(discount)}. Kỳ báo cáo dựa trên ngày cập nhật phiếu (UTC+7).`;
        const { start, today, selection } = period();
        $('#analytics-period-label').textContent = selection === 'all' ? `Tất cả dữ liệu đến ${dayLabel(today)}` : `${dayLabel(start)} – ${dayLabel(today)}`;
        $('#analytics-export').disabled = !rows.length;
        renderChart(rows);
        renderInvoices(rows);
    }

    async function loadAnalytics() {
        if (loading) return;
        loading = true;
        $('#analytics-refresh').disabled = true;
        $('#analytics-error').hidden = true;
        try {
            const data = await api('/api/appointments');
            invoices = (Array.isArray(data.appointments) ? data.appointments : []).filter((row) => row.jobCard).map((row) => {
                const reportAt = toDay(row.jobCard.updatedAt) ? row.jobCard.updatedAt : row.createdAt;
                return { ...row, reportAt, reportDay: toDay(reportAt) };
            });
            loaded = true;
            render();
            $('#analytics-updated').textContent = `Cập nhật lúc ${new Intl.DateTimeFormat('vi-VN', { timeZone, hour: '2-digit', minute: '2-digit' }).format(new Date())} · Báo cáo từ các lịch hẹn đã có phiếu sửa chữa.`;
        } catch (error) {
            $('#analytics-error').textContent = error.message || 'Không thể tải báo cáo. Vui lòng thử lại.';
            $('#analytics-error').hidden = false;
            if (!loaded) {
                $('#analytics-period-label').textContent = 'Chưa tải được dữ liệu';
                $('#analytics-chart').innerHTML = '<p class="text-center text-muted py-5 mb-0">Chưa tải được biểu đồ doanh thu.</p>';
                $('#analytics-invoices').innerHTML = '<tr><td colspan="6" class="text-center text-muted py-5">Chưa tải được phiếu sửa chữa.</td></tr>';
                $('#analytics-invoice-count').textContent = 'Dữ liệu chưa khả dụng';
            }
        } finally {
            loading = false;
            $('#analytics-refresh').disabled = false;
        }
    }

    $('#analytics-period').addEventListener('change', () => { if (loaded) render(); });
    $('#analytics-refresh').addEventListener('click', loadAnalytics);
    $('#analytics-export').addEventListener('click', () => {
        const rows = [...rowsForPeriod()].sort((a, b) => new Date(b.reportAt) - new Date(a.reportAt));
        if (!rows.length) return;
        const cell = (value) => {
            const content = String(value ?? '');
            const safe = /^[\t\r\n]/.test(content) || /^\s*[=+\-@]/.test(content) ? `'${content}` : content;
            return `"${safe.replace(/"/g, '""')}"`;
        };
        const table = [['Mã phiếu', 'Khách hàng', 'Biển số', 'Ngày cập nhật', 'Tiền công trước giảm giá (VNĐ)', 'Phụ tùng trước giảm giá (VNĐ)', 'Giảm giá (VNĐ)', 'Tổng thanh toán (VNĐ)', 'Thanh toán'], ...rows.map((row) => [row.reference, row.customerName, row.licensePlate, row.reportDay, itemTotal(row, 'Service'), itemTotal(row, 'Part'), amount(row.jobCard.discount), amount(row.jobCard.total), row.jobCard.paymentStatus === 'Paid' ? 'Đã thanh toán' : 'Chưa thanh toán'])];
        const blob = new Blob(['\uFEFF' + table.map((row) => row.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `autofix-bao-cao-${$('#analytics-period').value}-${toDay(new Date())}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast(`Đã xuất báo cáo ${rows.length} phiếu sửa chữa.`);
    });

    loadAnalytics();
})();
