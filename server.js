const express = require('express');
const session = require('express-session');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- 1. CẤU HÌNH TÀI KHOẢN VÀ THIẾT BỊ ---
const USERS = {
    "admin1": { pass: "111", ownedDevices: ["AABBCCDDEE01"] },
    "admin2": { pass: "222", ownedDevices: ["AABBCCDDEE02"] },
    "aoiro707": { pass: "251587", ownedDevices: ["MAC_CUA_BAN"] }
};

app.use(session({
    secret: 'secret-key-esp01',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 3600000 }
}));

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

// --- 2. ROUTES LOGIN ---
app.get('/login', (req, res) => {
    res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;background:#f4f7f6;margin:0}.login-card{background:white;padding:30px;border-radius:12px;box-shadow:0 4px 10px rgba(0,0,0,0.1);width:300px}input{width:100%;padding:12px;margin:10px 0;border:1px solid #ddd;border-radius:6px;box-sizing:border-box}button{width:100%;padding:12px;background:#3498db;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold}</style></head><body><div class="login-card"><h3 style="text-align:center">Smart Hub Login</h3><form action="/login" method="POST"><input type="text" name="user" placeholder="Username" required><input type="password" name="pass" placeholder="Password" required><button type="submit">Login</button></form></div></body></html>`);
});

app.post('/login', (req, res) => {
    const { user, pass } = req.body;
    if (USERS[user] && USERS[user].pass === pass) {
        req.session.isLoggedIn = true;
        req.session.username = user;
        res.redirect('/');
    } else res.redirect('/login?error=1');
});

app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/login'); });

// --- 3. API CHO ESP ---
app.get('/status', (req, res) => {
    const { id, wifi, state: espPhysState } = req.query;
    if (!id) return res.json({ error: "No ID" });
    if (!devices[id]) devices[id] = { name: "Thiết bị mới", state: "OFF", schedules: [], wifi: wifi || "Unknown", lastUserAction: 0 };
    devices[id].lastPing = Date.now();
    if (wifi) devices[id].wifi = wifi;
    const timeSinceLastClick = Date.now() - (devices[id].lastUserAction || 0);
    if (espPhysState && timeSinceLastClick > 30000) {
        if (devices[id].state !== espPhysState) { devices[id].state = espPhysState; saveData(); }
    }
    res.json(devices[id]);
});

// --- 4. API ĐIỀU KHIỂN & PHÂN QUYỀN ---
app.get('/all-data', checkAuth, (req, res) => {
    const currentUser = req.session.username;
    const owned = USERS[currentUser].ownedDevices;
    let filtered = {};
    owned.forEach(id => { if (devices[id]) filtered[id] = devices[id]; });
    res.json(filtered);
});

const checkOwner = (req, res, next) => {
    const { id } = req.query;
    const currentUser = req.session.username;
    if (USERS[currentUser].ownedDevices.includes(id)) next();
    else res.status(403).send("No Permission");
};

app.get('/relay', checkAuth, checkOwner, (req, res) => {
    const { id, state } = req.query;
    if(devices[id]) { devices[id].state = state; devices[id].lastUserAction = Date.now(); saveData(); }
    res.send("OK");
});

app.get('/add-sched', checkAuth, checkOwner, (req, res) => {
    const { id, on, off, days } = req.query;
    if(devices[id]) { devices[id].schedules.push({ on, off, days: days || "1111111" }); saveData(); }
    res.send("OK");
});

app.get('/del-sched', checkAuth, checkOwner, (req, res) => {
    const { id, idx } = req.query;
    if(devices[id]) { devices[id].schedules.splice(idx, 1); saveData(); }
    res.send("OK");
});

app.get('/rename', checkAuth, checkOwner, (req, res) => {
    const { id, name } = req.query;
    if(devices[id]) { devices[id].name = name; saveData(); }
    res.send("OK");
});

// --- 5. GIAO DIỆN CHÍNH ---
app.get('/', checkAuth, (req, res) => {
    const user = req.session.username;
    res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Hub - ${user}</title><style>body{font-family:sans-serif;background:#f4f7f6;padding:15px;color:#333;margin:0}.container{max-width:500px;margin:auto}.card{background:white;padding:15px;border-radius:12px;margin-bottom:15px;box-shadow:0 2px 5px rgba(0,0,0,0.1)}.flex{display:flex;justify-content:space-between;align-items:center}.btn-toggle{padding:12px 24px;border-radius:8px;border:none;cursor:pointer;font-weight:bold}.ON{background:#2ecc71;color:white}.OFF{background:#bdc3c7;color:white}.sched-item{display:flex;justify-content:space-between;padding:8px;background:#f9f9f9;border-radius:6px;margin-top:5px;font-size:13px;align-items:center}.day-tag{font-size:10px;background:#3498db;color:white;padding:1px 4px;border-radius:3px;margin-left:2px}.input-area{margin-top:15px;padding:10px;border-top:1px solid #eee;background:#fff}.btn-save{background:#3498db;color:white;border:none;padding:8px 15px;border-radius:5px;cursor:pointer;width:100%;margin-top:10px}</style></head>
    <body><div class="container"><h3 style="text-align:center">Xin chào, ${user}</h3><div id="list">Đang tải...</div><p style="text-align:center"><a href="/logout">Thoát</a></p></div>
    <script>
    let openId=null;const dayNames=["T2","T3","T4","T5","T6","T7","CN"];
    async function load(){try{const r=await fetch('/all-data');const d=await r.json();render(d)}catch(e){}}
    function render(devices){const container=document.getElementById('list');let h="";const ids=Object.keys(devices);if(ids.length===0){container.innerHTML="Trống";return}
    ids.forEach(id=>{const d=devices[id];const isOff=(Date.now()-d.lastPing>25000);h+='<div class="card"><div class="flex"><div><b onclick="rename(\\''+id+'\\')">'+d.name+'</b><br><small>'+(isOff?'Mất kết nối':'Trực tuyến')+'</small></div><div><button class="btn-toggle '+d.state+'" onclick="toggle(\\''+id+'\\',\\''+(d.state==='ON'?'OFF':'ON')+'\\')">'+d.state+'</button><button onclick="toggleIn(\\''+id+'\\')">⚙</button></div></div>';
    (d.schedules||[]).forEach((s,i)=>{h+='<div class="sched-item">'+s.on+'-'+s.off+' <b onclick="del(\\''+id+'\\','+i+')">✕</b></div>'});
    if(openId===id){h+='<div class="input-area"><input type="time" id="t1-'+id+'"><input type="time" id="t2-'+id+'"><button class="btn-save" onclick="add(\\''+id+'\\')">Lưu</button></div>'}h+='</div>'});container.innerHTML=h}
    async function toggle(id,st){await fetch('/relay?id='+id+'&state='+st);load()}
    function toggleIn(id){openId=(openId===id)?null:id;load()}
    async function add(id){const t1=document.getElementById('t1-'+id).value,t2=document.getElementById('t2-'+id).value;await fetch('/add-sched?id='+id+'&on='+t1+'&off='+t2);openId=null;load()}
    async function del(id,i){await fetch('/del-sched?id='+id+'&idx='+i);load()}
    async function rename(id){const n=prompt("Tên:");if(n)await fetch('/rename?id='+id+'&name='+n);load()}
    setInterval(()=>{if(!openId)load()},5000);load();
    </script></body></html>`);
});

app.listen(10000, '0.0.0.0', () => console.log("Server running"));
