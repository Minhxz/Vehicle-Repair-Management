(() => {
    'use strict';
    const form = document.querySelector('#login-form');
    const password = document.querySelector('#password');
    document.querySelector('#password-toggle').addEventListener('click', (event) => {
        const visible = password.type === 'password';
        password.type = visible ? 'text' : 'password';
        event.currentTarget.textContent = visible ? 'Ẩn' : 'Hiện';
        event.currentTarget.setAttribute('aria-label', visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
    });
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const button = document.querySelector('#login-button');
        const message = document.querySelector('#login-message');
        button.disabled = true;
        message.textContent = '';
        try {
            const response = await fetch('/api/auth/login', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: document.querySelector('#username').value.trim(), password: password.value }) });
            const result = await response.json();
            if (!response.ok || !result.authenticated) throw new Error(result.message || 'Tên đăng nhập hoặc mật khẩu chưa đúng.');
            const returnUrl = form.dataset.returnUrl;
            window.location.assign(returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : '/Management/Workflow');
        } catch (error) { message.textContent = error.message || 'Không thể kết nối. Vui lòng thử lại.'; button.disabled = false; }
    });
})();
