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

// --- KEEP-ALIVE ---
const SERVER_URL = "https://esp01-server-1.onrender.com"; 
setInterval(() => {
    https.get(SERVER_URL, (res) => {}).on('error', (e) => {});
}, 600000); 

const loadData = () => {
    try {
        if (fs.existsSync(DATA_FILE)) {
            devices = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            console.log("-> Dữ liệu đã nạp.");
        }
    } catch (err) { devices = {}; }
};

const saveData = () => {
    try { 
        fs.writeFileSync(DATA_FILE, JSON.stringify(devices, null, 2), 'utf8'); 
    } catch (err) { console.error("Lỗi lưu file:", err); }
};

loadData();

// --- API ---
app.get('/status', (req, res) => {
    const { id, wifi, state: espState } = req.query;
    if (!id) return res.json({ error: "No ID" });

    if (!devices[id]) {
        devices[id] = { name: "Thiết bị mới", state: "OFF", schedules: [], wifi: wifi || "Unknown", lastUserAction: 0 };
    }

    devices[id].lastPing = Date.now();
    if (wifi) devices[id].wifi = wifi;

    const timeSinceLastAction = Date.now() - (devices[id].lastUserAction || 0);
    if (espState && timeSinceLastAction > 30000) {
        if (devices[id].state !== espState) {
            devices[id].state = espState;
            saveData();
        }
    }
    res.json(devices[id]);
});

app.get('/relay', (req, res) => { 
    const { id, state } = req.query;
    if(devices[id]) {
        devices[id].state = state; 
        devices[id].lastUserAction = Date.now();
        saveData();
    }
    res.send("OK"); 
});

app.get('/all-data', (req, res) => res.json(devices));

app.get('/add-sched', (req, res) => { 
    const { id, on, off, days } = req.query;
    if(devices[id]) {
        devices[id].schedules.push({ on, off, days }); 
        saveData();
    }
    res.send("OK"); 
});

app.get('/del-sched', (req, res) => { 
    const { id, idx } = req.query;
    if(devices[id]) {
        devices[id].schedules.splice(idx, 1); 
        saveData();
    }
    res.send("OK"); 
});

app.get('/rename', (req, res) => { 
    const { id, name } = req.query;
    if(devices[id]) {
        devices[id].name = name; 
        saveData();
    }
    res.send("OK"); 
});

// --- GIAO DIỆN NGƯỜI DÙNG (NHÚNG TRỰC TIẾP HTML) ---
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <title>ESP Control Smart</title>
    <style>
        body { font-family: sans-serif; background: #f4f7f6; padding: 20px; color: #333; }
        .card { background: white; padding: 15px; border-radius: 12px; margin-bottom: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #eee; }
        .flex { display: flex; justify-content: space-between; align-items: center; }
        .btn-toggle { padding: 12px 24px; border-radius: 8px; border: none; cursor: pointer; font-weight: bold; transition: 0.3s; font-size: 14px; }
        .ON { background: #2ecc71; color: white; box-shadow: 0 4px 10px rgba(46, 204, 113, 0.4); }
        .OFF { background: #bdc3c7; color: white; }
        .input-area { margin-top: 15px; padding: 15px; background: #f9f9f9; border-radius: 8px; border: 1px dashed #ccc; }
        .sched-item { display: flex; justify-content: space-between; padding: 10px; background: #fff; border-radius: 6px; margin-top: 5px; border: 1px solid #f0f0f0; align-items: center; }
        .day-label { background: #3498db; color: white; font-size: 10px; padding: 2px 6px; border-radius: 4px; margin-left: 3px; }
        .offline-text { color: #e74c3c !important; }
        .blink { animation: blink 2s infinite; }
        @keyframes blink { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
    </style>
</head>
<body>
    <h3 style="text-align:center;">ESP01s Smart Hub</h3>
    <div id="list">Đang tải...</div>
    <script>
        let devices = {};
        let openInputId = null; 
        const dayNames = ["T2","T3","T4","T5","T6","T7","CN"];

        async function load() {
            if (openInputId !== null) return;
            const r = await fetch('/all-data');
            devices = await r.json();
            render();
        }

        function render() {
            const container = document.getElementById('list');
            const ids = Object.keys(devices);
            if(ids.length === 0) { container.innerHTML = "<p>Đang chờ thiết bị...</p>"; return; }
            let h = "";
            ids.forEach(id => {
                const d = devices[id];
                const isOffline = (Date.now() - d.lastPing > 30000);
                h += '<div class="card"><div class="flex"><div>';
                h += '<b style="font-size:18px;" onclick="renameDevice(\\''+id+'\\',\\''+d.name+'\\')">'+d.name+' ✎</b><br>';
                h += '<small style="color:'+(isOffline?'red':'green')+'">WiFi: '+d.wifi+'</small></div>';
                h += '<div><button class="btn-toggle '+d.state+'" onclick="toggle(\\''+id+'\\',\\''+(d.state==='ON'?'OFF':'ON')+'\\')">'+d.state+'</button>';
                h += '<span onclick="toggleInput(\\''+id+'\\')" style="cursor:pointer; margin-left:15px;">⚙</span></div></div>';
                
                (d.schedules || []).forEach((s, i) => {
                    h += '<div class="sched-item"><span>🕒 '+s.on+'-'+s.off+'</span><b onclick="del(\\''+id+'\\','+i+')" style="color:red; cursor:pointer;">✕</b></div>';
                });

                if(openInputId === id) {
                    h += '<div class="input-area"><input type="time" id="t1-'+id+'"><input type="time" id="t2-'+id+'">';
                    h += '<button onclick="add(\\''+id+'\\')">Lưu</button></div>';
                }
                h += '</div>';
            });
            container.innerHTML = h;
        }

        async function toggle(id, st) { await fetch('/relay?id='+id+'&state='+st); load(); }
        async function toggleInput(id) { openInputId = (openInputId === id) ? null : id; render(); }
        async function add(id) {
            let t1 = document.getElementById('t1-'+id).value, t2 = document.getElementById('t2-'+id).value;
            await fetch('/add-sched?id='+id+'&on='+t1+'&off='+t2+'&days=1111111');
            openInputId = null; load();
        }
        async function del(id, i) { await fetch('/del-sched?id='+id+'&idx='+i); load(); }
        async function renameDevice(id, n) { let nn = prompt("Tên mới:", n); if(nn) { await fetch('/rename?id='+id+'&name='+nn); load(); } }
        
        setInterval(load, 5000); load();
    </script>
</body>
</html>
    `);
});

app.listen(10000, '0.0.0.0', () => console.log("Server running on port 10000"));
