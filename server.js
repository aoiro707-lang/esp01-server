const express = require('express');
const session = require('express-session'); // Thêm dòng này
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const https = require('https');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Để đọc dữ liệu từ form login

// --- CẤU HÌNH ĐĂNG NHẬP ---
const ADMIN_USER = "admin";     // Tên đăng nhập của bạn
const ADMIN_PASS = "123456";    // Mật khẩu của bạn (Hãy đổi lại cho an toàn)

app.use(session({
    secret: 'secret-key-esp01', // Chuỗi ký tự bất kỳ để mã hóa session
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 3600000 } // Thời gian duy trì đăng nhập (1 tiếng)
}));

// Middleware kiểm tra quyền truy cập
const checkAuth = (req, res, next) => {
    if (req.session.isLoggedIn) {
        next(); // Đã đăng nhập thì cho qua
    } else {
        res.redirect('/login'); // Chưa đăng nhập thì bắt quay lại trang login
    }
};

const DATA_FILE = path.join(__dirname, 'devices_data.json');
let devices = {}; 

// ... (Giữ nguyên các hàm loadData, saveData và logic Keep-Alive) ...

// --- TRANG ĐĂNG NHẬP (HTML) ---
app.get('/login', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Đăng nhập hệ thống</title>
            <style>
                body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #f4f7f6; margin: 0; }
                .login-card { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); width: 300px; }
                input { width: 100%; padding: 10px; margin: 10px 0; border: 1px solid #ddd; border-radius: 5px; box-sizing: border-box; }
                button { width: 100%; padding: 10px; background: #3498db; color: white; border: none; border-radius: 5px; cursor: pointer; }
                button:hover { background: #2980b9; }
                .error { color: red; font-size: 13px; text-align: center; }
            </style>
        </head>
        <body>
            <div class="login-card">
                <h3 style="text-align:center;">Hệ thống ESP01</h3>
                <form action="/login" method="POST">
                    <input type="text" name="user" placeholder="Tên đăng nhập" required>
                    <input type="password" name="pass" placeholder="Mật khẩu" required>
                    <button type="submit">Đăng nhập</button>
                </form>
                ${req.query.error ? '<p class="error">Sai tài khoản hoặc mật khẩu!</p>' : ''}
            </div>
        </body>
        </html>
    `);
});

// Xử lý logic đăng nhập
app.post('/login', (req, res) => {
    const { user, pass } = req.body;
    if (user === ADMIN_USER && pass === ADMIN_PASS) {
        req.session.isLoggedIn = true;
        res.redirect('/');
    } else {
        res.redirect('/login?error=1');
    }
});

// Đăng xuất
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// --- CÁC API CẦN BẢO MẬT (Thêm checkAuth vào trước) ---
// Chỉ áp dụng cho người dùng (Web), ESP01 vẫn có thể gọi API /status bình thường để không bị gián đoạn.

app.get('/', checkAuth, (req, res) => {
    // Nội dung file HTML trang chủ của bạn (Thêm nút Đăng xuất ở cuối nếu muốn)
    // res.send(...)
});

app.get('/relay', checkAuth, (req, res) => { /* logic xử lý */ });
app.get('/add-sched', checkAuth, (req, res) => { /* logic xử lý */ });
app.get('/del-sched', checkAuth, (req, res) => { /* logic xử lý */ });
app.get('/rename', checkAuth, (req, res) => { /* logic xử lý */ });
app.get('/all-data', checkAuth, (req, res) => res.json(devices));

// Riêng API cho ESP thì KHÔNG dùng checkAuth để ESP không bị chặn khi gửi data
app.get('/status', (req, res) => {
    // logic status cũ của bạn
});

app.listen(10000, '0.0.0.0', () => console.log("Server running on port 10000"));
