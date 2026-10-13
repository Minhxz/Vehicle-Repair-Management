(() => {
    "use strict";
    window.AutoFix = {
        async request(url, options = {}) {
            let response;
            try { response = await fetch(url, { credentials: "same-origin", ...options, headers: { "Content-Type": "application/json", ...options.headers } }); }
            catch { throw new Error("Không thể kết nối tới máy chủ. Vui lòng thử lại."); }
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                const details = Object.values(data.errors || {}).flat().slice(0, 2).join(" ");
                const error = new Error(details || data.message || "Không thể xử lý yêu cầu. Vui lòng thử lại.");
                error.fields = data.errors || {};
                throw error;
            }
            return data;
        },
        escape(value) { return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch])); },
        date(value) { const parts = String(value || "").split("-"); return parts.length === 3 ? parts.reverse().join("/") : value; },
        today() { return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Bangkok" }).format(new Date()); }
    };
    const toggle = document.querySelector(".menu-toggle");
    const menu = document.getElementById("main-nav");
    if (toggle && menu) {
        const close = () => { menu.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); toggle.setAttribute("aria-label", "Mở menu"); };
        toggle.addEventListener("click", () => {
            const open = menu.classList.toggle("open");
            toggle.setAttribute("aria-expanded", String(open));
            toggle.setAttribute("aria-label", open ? "Đóng menu" : "Mở menu");
        });
        document.addEventListener("keydown", event => { if (event.key === "Escape") close(); });
        menu.querySelectorAll("a").forEach(link => link.addEventListener("click", close));
        window.addEventListener("resize", () => { if (window.innerWidth > 720) close(); });
        menu.querySelectorAll("a").forEach(link => {
            if (link.pathname.toLowerCase() === location.pathname.toLowerCase()) link.setAttribute("aria-current", "page");
        });
    }
})();