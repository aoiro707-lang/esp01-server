const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const https = require('https');
const app = express();

app.use(cors());
app.use(express.json());

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
    try { fs.writeFileSync(DATA_FILE, JSON.stringify(devices, null, 2), 'utf8'); } 
    catch (err) { console.error("Error saving data:", err); }
};

loadData();

// Anti-Sleep Render
setInterval(() => {
    https.get("https://esp01-server-1.onrender.com", (res) => {}).on('error', (e) => {});
}, 600000); 

app.get('/ping', (req, res) => {
    const { id, wifi, state: espPhysState } = req.query;
    if (!id || !devices[id]) return res.send("OK");
    
    devices[id].wifi = wifi;
    devices[id].lastPing = Date.now();

    const serverWebState = devices[id].state;
    const timeSinceLastClick = Date.now() - (devices[id].lastUserAction || 0);

    if (espPhysState) {
        // Nếu người dùng vừa bấm web trong 20s -> Ép ESP theo Web
        if (timeSinceLastClick < 20000) {
            if (serverWebState !== espPhysState) {
                return res.send(serverWebState === "ON" ? "TURN_ON" : "TURN_OFF");
            }
        } 
        // Nếu do lịch trình tự chạy -> Cập nhật Web theo ESP
        else {
            if (serverWebState !== espPhysState) {
                devices[id].state = espPhysState;
                saveData();
            }
        }
    }
    res.send("OK");
});

app.get('/all-data', (req, res) => res.json(devices));
app.get('/status', (req, res) => res.json(devices[req.query.id] || {}));

app.get('/relay', (req, res) => { 
    if(devices[req.query.id]) {
        devices[req.query.id].state = req.query.state; 
        devices[req.query.id].lastUserAction = Date.now(); 
        saveData();
    }
    res.send("OK"); 
});

app.get('/add-sched', (req, res) => { 
    if(devices[req.query.id]) {
        devices[req.query.id].schedules.push({on:req.query.on, off:req.query.off, days:req.query.days}); 
        saveData();
    }
    res.send("OK"); 
});

app.get('/del-sched', (req, res) => { 
    if(devices[req.query.id]) {
        devices[req.query.id].schedules.splice(req.query.idx, 1); 
        saveData();
    }
    res.send("OK"); 
});

app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <title>ESP Smart Control</title>
    <style>
        body { font-family: sans-serif; background: #f4f7f6; padding: 20px; }
        .card { background: white; padding: 15px; border-radius: 12px; margin-bottom: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .flex { display: flex; justify-content: space-between; align-items: center; }
        .btn-toggle { padding: 12px 24px; border-radius: 8px; border: none; cursor: pointer; font-weight: bold; width: 100px; }
        .ON { background: #2ecc71; color: white; box-shadow: 0 0 12px #2ecc71; }
        .OFF { background: #95a5a6; color: white; }
        .input-area { margin-top: 15px; padding: 15px; background: #f0f4f8; border-radius: 8px; border: 1px solid #dce4ec; }
        .sched-item { display: flex; justify-content: space-between; padding: 10px; background: #fff; border-radius: 6px; margin-top: 5px; border: 1px solid #eee; }
        input[type="time"] { padding: 10px; border-radius: 6px; border: 1px solid #ccc; font-size: 16px; width: 40%; }
        .save-btn { background: #3498db; color: white; border: none; padding: 10px; border-radius: 6px; cursor: pointer; margin-top: 10px; width: 100%; font-weight: bold; }
    </style>
</head>
<body>
    <h3 style="text-align:center;">ESP01s Smart System</h3>
    <div id="list">Đang tải...</div>
    <script>
        let openId = null; 
        async function load() {
            if (openId !== null) return; 
            try {
                const r = await fetch('/all-data');
                const data = await r.json();
                render(data);
            } catch(e) {}
        }
        function render(devices) {
            const container = document.getElementById('list');
            let h = "";
            Object.keys(devices).forEach(id => {
                const d = devices[id];
                h += '<div class="card"><div class="flex"><div>';
                h += '<b>'+d.name+'</b><br><small>WiFi: '+d.wifi+'</small></div>';
                h += '<div><button class="btn-toggle '+d.state+'" onclick="toggle(\\''+id+'\\',\\''+(d.state==='ON'?'OFF':'ON')+'\\')">'+d.state+'</button>';
                h += '<span onclick="setOpen(\\''+id+'\\')" style="cursor:pointer; margin-left:15px; font-size:24px;">⚙</span></div></div>';
                h += '<div style="margin-top:10px;">';
                (d.schedules || []).forEach((s, i) => {
                    h += '<div class="sched-item"><span>🕒 '+s.on+' - '+s.off+'</span><b onclick="del(\\''+id+'\\','+i+')" style="color:#e74c3c; cursor:pointer">✕</b></div>';
                });
                if(openId === id) {
                    h += '<div class="input-area"><b>Cài giờ:</b><br><div style="display:flex; justify-content:space-between; margin-top:8px;">';
                    h += '<input type="time" id="t1"> <input type="time" id="t2"></div>';
                    h += '<button class="save-btn" onclick="add(\\''+id+'\\')">LƯU LỊCH HẸN</button></div>';
                }
                h += '</div></div>';
            });
            container.innerHTML = h || "Chưa có thiết bị";
        }
        function setOpen(id) { openId = (openId === id) ? null : id; load(); }
        async function toggle(id, st) { await fetch('/relay?id='+id+'&state='+st); load(); }
        async function add(id) {
            const t1 = document.getElementById('t1').value, t2 = document.getElementById('t2').value;
            if(t1 && t2) { await fetch('/add-sched?id='+id+'&on='+t1+'&off='+t2+'&days=1111111'); openId = null; load(); }
        }
        async function del(id, i) { await fetch('/del-sched?id='+id+'&idx='+i); load(); }
        setInterval(load, 3000); load();
    </script>
</body>
</html>
    `);
});
app.listen(10000);
