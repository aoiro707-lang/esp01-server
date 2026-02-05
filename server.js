const express = require('express');
const session = require('express-session');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- CẤU HÌNH TÀI KHOẢN VÀ PHÂN QUYỀN THIẾT BỊ ---
const USERS = {
    "admin1": { 
        pass: "111", 
        ownedDevices: ["AABBCCDDEE01", "AABBCCDDEE02"] // Thay bằng MAC ID thực tế của ESP
    },
    "admin2": { 
        pass: "222", 
        ownedDevices: ["AABBCCDDEE03", "AABBCCDDEE04"] 
    },
    "aoiro707": { 
        pass: "251587", 
        ownedDevices: ["84F3EBXXXXXXXX"] // MAC ID của bạn
    }
};

app.use(session({
    secret: 'secret-key-esp01',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 3600000 }
}));

// Middleware kiểm tra đăng nhập và quyền sở hữu
const checkAuth = (req, res, next) => {
    if (req.session.isLoggedIn && req.session.username) next();
    else res.redirect('/login');
};

const DATA_FILE = path.join(__dirname, 'devices_data.json');
let devices = {};

const loadData = () => {
    try {
        if (fs.existsSync(DATA_FILE)) {
            devices = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        }
    } catch (err) { devices = {}; }
};

const saveData = () => {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(devices, null, 2), 'utf8');
    } catch (err) { console.error("Save error:", err); }
};

loadData();

// --- ROUTES ĐĂNG NHẬP ---
app.get('/login', (req, res) => {
    res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;background:#f4f7f6;margin:0}.login-card{background:white;padding:30px;border-radius:12px;box-shadow:0 4px 10px rgba(0,0,0,0.1);width:300px}input{width:100%;padding:12px;margin:10px 0;border:1px solid #ddd;border-radius:6px;box-sizing:border-box}button{width:100%;padding:12px;background:#3498db;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold}</style></head><body><div class="login-card"><h3 style="text-align:center">Smart Hub Login</h3><form action="/login" method="POST"><input type="text" name="user" placeholder="Username" required><input type="password" name="pass" placeholder="Password" required><button type="submit">Login</button></form></div></body></html>`);
});

app.post('/login', (req, res) => {
    const { user, pass } = req.body;
    if (USERS[user] && USERS[user].pass === pass) {
        req.session.isLoggedIn = true;
        req.session.username = user; // Lưu user vào session để lọc data
        res.redirect('/');
    } else res.redirect('/login?error=1');
});

app.get('/logout', (req, res) =>
