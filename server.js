const express = require('express');
const session = require('express-session');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const https = require('https');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- CẤU HÌNH BẢO MẬT ---
const ADMIN_USER = "admin";     // Tên đăng nhập
const ADMIN_PASS = "123456";    // Mật khẩu (Hãy đổi lại cho an toàn)

app.use(session({
    secret: 'secret-key-esp01',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 3600000 } // Đăng nhập có hiệu lực trong 1 giờ
}));

// Middleware kiểm tra đăng nhập
const checkAuth = (req, res, next) => {
    if (req.session.isLoggedIn) next();
    else res.redirect('/login');
};

// --- QUẢN LÝ DỮ LIỆU ---
const DATA_FILE = path.join(__dirname, 'devices_data.json');
let devices = {};

const loadData = () => {
    try {
        if (fs.existsSync(DATA_FILE)) {
            devices = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            console.log("-> Data loaded from file.");
        }
    } catch (err) { devices = {}; }
};

const saveData = () => {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(devices, null, 2), 'utf8');
    } catch (err) { console.error("Save error:", err); }
};

loadData();

// Tự động giữ server không ngủ (Keep-alive)
setInterval(() => {
    https.get("https://esp01-server-1.onrender.com", (res) => {}).on('error', (e) => {});
}, 600000);

// --- CÁC ROUTE ĐĂNG NHẬP ---
app.get('/login', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Login - ESP Control</title>
            <style>
                body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #f4f7f6; margin: 0; }
                .login-card { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); width: 300px; }
                input { width: 100%; padding: 12px; margin: 10px 0; border: 1px solid #ddd; border-radius: 6px; box-sizing: border-box; }
                button { width: 100%; padding: 12px; background: #3498db; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; }
                .error { color: red; font-size: 13px; text-align: center; }
            </style>
        </head>
        <body>
            <div class="login-card">
                <h3 style="text-align:center;">ESP Control Panel</h3>
                <form action="/login" method="POST">
                    <input type="text" name="user" placeholder="Username" required>
                    <input type="password" name="pass" placeholder="Password" required>
                    <button type="submit">Login</button>
                </form>
                ${req.query.error ? '<p class="error">Sai tài khoản hoặc mật khẩu!</p>' : ''}
            </div>
        </body>
        </html>
    `);
});

app.post('/login', (req, res) => {
    const { user, pass } = req.body;
    if (user === ADMIN_USER && pass === ADMIN_PASS) {
        req.session.isLoggedIn = true;
        res.redirect('/');
    } else res.redirect('/login?error=1');
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// --- API CHO ESP (KHÔNG CẦN LOGIN) ---
app.get('/status', (req, res) => {
    const { id, wifi, state: espPhysState } = req.query;
    if (!id) return res.json({ error: "No ID" });

    if (!devices[id]) {
        devices[id] = { name: "New Device", state: "OFF", schedules: [], wifi: wifi || "Unknown", lastUserAction: 0 };
    }

    devices[id].lastPing = Date.now();
    if (wifi) devices[id].wifi = wifi;

    const timeSinceLastClick = Date.now() - (devices[id].lastUserAction || 0);
    // Nếu không có thao tác Web trong 30s, cập nhật trạng thái thực tế từ ESP lên
    if (espPhysState && timeSinceLastClick > 30000) {
        if (devices[id].state !== espPhysState) {
            devices[id].state = espPhysState;
            saveData();
        }
    }
    res.json(devices[id]);
});

// --- API ĐIỀU KHIỂN WEB (CẦN LOGIN) ---
app.get('/relay', checkAuth, (req, res) => {
    const { id, state } = req.query;
    if(devices[id]) {
        devices[id].state = state;
        devices[id].lastUserAction = Date.now();
        saveData();
    }
    res.send("OK");
});

app.get('/all-data', checkAuth, (req, res) => res.json(devices));

app.get('/add-sched', checkAuth, (req, res) => {
    const { id, on, off, days } = req.query;
    if(devices[id]) {
        devices[id].schedules.push({ on, off, days });
        saveData();
    }
    res.send("OK");
});

app.get('/del-sched', checkAuth, (req, res) => {
    const { id, idx } = req.query;
    if(devices[id]) {
        devices[id].schedules.splice(idx, 1);
        saveData();
    }
    res.send("OK");
});

app.get('/rename', checkAuth, (req, res) => {
    const { id, name } = req.query;
    if(devices[id]) {
        devices[id].name = name;
        saveData();
    }
    res.send("OK");
});

// --- GIAO DIỆN CHÍNH (CẦN LOGIN) ---
app.get('/', checkAuth, (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Smart Hub</title>
    <style>
        body { font-family: sans-serif; background: #f4f7f6; padding: 20px; color: #333; margin: 0; }
        .container { max-width: 500px; margin: auto; }
        .card { background: white; padding: 15px; border-radius: 12px; margin-bottom: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
        .flex { display: flex; justify-content: space-between; align-items: center; }
        .btn-toggle { padding: 12px 24px; border-radius: 8px; border: none; cursor: pointer; font-weight: bold; }
        .ON { background: #2ecc71; color: white; }
        .OFF { background: #bdc3c7; color: white; }
        .sched-item { display: flex; justify-content: space-between; padding: 8px; background: #f9f9f9; border-radius: 6px; margin-top: 5px; font-size: 13px; }
        .input-area { margin-top: 15px; padding: 10px; border-top: 1px solid #eee; }
        .logout { text-align: center; margin-top: 20px; }
        .logout a { color: #95a5a6; text-decoration: none; font-size: 13px; }
    </style>
</head>
<body>
    <div class="container">
        <h3 style="text-align:center;">ESP Control Panel</h3>
        <div id="list">Loading...</div>
        <div class="logout"><a href="/logout">Đăng xuất</a></div>
    </div>

    <script>
        let openId = null;
        async function load() {
            const r = await fetch('/all-data');
            const devices = await r.json();
            const container = document.getElementById('list');
            let h = "";
            Object.keys(devices).forEach(id => {
                const d = devices[id];
                const isOff = (Date.now() - d.lastPing > 20000);
                h += '<div class="card"><div class="flex"><div>';
                h += '<b style="font-size:16px;">'+d.name+'</b><br>';
                h += '<small style="color:'+(isOff?'red':'green')+'">● '+(isOff?'Offline':'Online')+'</small></div>';
                h += '<div><button class="btn-toggle '+d.state+'" onclick="toggle(\\''+id+'\\',\\''+(d.state==='ON'?'OFF':'ON')+'\\')">'+d.state+'</button>';
                h += '<button onclick="toggleIn(\\''+id+'\\')" style="margin-left:10px; border:none; background:none; font-size:18px; cursor:pointer;">⚙</button></div></div>';
                
                (d.schedules || []).forEach((s, i) => {
                    h += '<div class="sched-item">🕒 '+s.on+' - '+s.off+' <b onclick="del(\\''+id+'\\','+i+')" style="color:red; cursor:pointer;">✕</b></div>';
                });

                if(openId === id) {
                    h += '<div class="input-area">Add: <input type="time" id="t1-'+id+'"> to <input type="time" id="t2-'+id+'"> ';
                    h += '<button onclick="add(\\''+id+'\\')">Save</button></div>';
                }
                h += '</div>';
            });
            container.innerHTML = h;
        }

        async function toggle(id, st) { await fetch('/relay?id='+id+'&state='+st); load(); }
        function toggleIn(id) { openId = (openId === id) ? null : id; load(); }
        async function add(id) {
            const t1 = document.getElementById('t1-'+id).value, t2 = document.getElementById('t2-'+id).value;
            if(t1 && t2) { await fetch('/add-sched?id='+id+'&on='+t1+'&off='+t2+'&days=1111111'); openId=null; load(); }
        }
        async function del(id, i) { if(confirm("Xóa lịch?")) { await fetch('/del-sched?id='+id+'&idx='+i); load(); } }
        
        setInterval(load, 5000); load();
    </script>
</body>
</html>
    `);
});

app.listen(10000, '0.0.0.0', () => console.log("Server running on port 10000"));
