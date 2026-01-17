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

// --- 1. TỰ ĐỘNG NGĂN SERVER SLEEP ---
const SERVER_URL = "https://esp01-server-1.onrender.com"; 
setInterval(() => {
    https.get(SERVER_URL, (res) => {}).on('error', (e) => {});
}, 600000); 

// --- 2. HÀM HỖ TRỢ ĐỌC/GHI FILE ---
const loadData = () => {
    try {
        if (fs.existsSync(DATA_FILE)) {
            devices = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        }
    } catch (err) { devices = {}; }
};

const saveData = () => {
    try { fs.writeFileSync(DATA_FILE, JSON.stringify(devices, null, 2), 'utf8'); } 
    catch (err) { console.error("Lỗi ghi file:", err); }
};

loadData();

// --- 3. API ĐỒNG BỘ THÔNG MINH ---
app.get('/ping', (req, res) => {
    const { id, wifi, name, state: espPhysState } = req.query;
    if (!id) return res.send("No ID");
    
    if (!devices[id]) {
        devices[id] = { name: name || "Relay", state: "OFF", schedules: [], wifi: wifi || "Unknown", lastUserAction: 0 };
        saveData();
    }
    
    devices[id].wifi = wifi;
    devices[id].lastPing = Date.now();

    const serverWebState = devices[id].state;
    const timeSinceLastClick = Date.now() - (devices[id].lastUserAction || 0);

    if (espPhysState) {
        // Nếu người dùng vừa bấm Web (< 15s) -> Ép ESP theo Web
        if (timeSinceLastClick < 15000) {
            if (serverWebState !== espPhysState) {
                return res.send(serverWebState === "ON" ? "TURN_ON" : "TURN_OFF");
            }
        } 
        // Nếu do Hẹn giờ (không có người bấm) -> Cập nhật Web theo ESP
        else {
            if (serverWebState !== espPhysState) {
                console.log(`[Sync] Nút Web tự nhảy sang ${espPhysState}`);
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

app.get('/rename', (req, res) => { 
    if(devices[req.query.id]) {
        devices[req.query.id].name = req.query.name; 
        saveData();
    }
    res.send("OK"); 
});

// --- 4. GIAO DIỆN HTML (ĐÃ FIX TỰ NHẢY NÚT) ---
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <title>ESP Control Smart</title>
    <style>
        body { font-family: sans-serif; background: #f4f7f6; padding: 20px; }
        .card { background: white; padding: 15px; border-radius: 12px; margin-bottom: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .flex { display: flex; justify-content: space-between; align-items: center; }
        .btn-toggle { padding: 10px 20px; border-radius: 8px; border: none; cursor: pointer; font-weight: bold; transition: 0.3s; }
        .ON { background: #2ecc71; color: white; box-shadow: 0 0 10px #2ecc71; }
        .OFF { background: #95a5a6; color: white; }
        .input-area { margin-top: 15px; padding: 10px; background: #f0f4f8; border-radius: 8px; }
        .sched-item { display: flex; justify-content: space-between; padding: 8px; background: #fff; border-radius: 5px; margin-top: 5px; border: 1px solid #eee; }
        .save-btn { background: #3498db; color: white; border: none; padding: 5px 15px; border-radius: 4px; }
    </style>
</head>
<body>
    <h3 style="text-align:center;">ESP01s Smart Sync</h3>
    <div id="list">Đang tải thiết bị...</div>

    <script>
        let devices = {};
        let openInputId = null; 

        async function load() {
            try {
                const r = await fetch('/all-data');
                devices = await r.json();
                render();
            } catch(e) {}
        }

        function render() {
            const container = document.getElementById('list');
            const ids = Object.keys(devices);
            if(ids.length === 0) { container.innerHTML = "Chưa có thiết bị nào kết nối"; return; }
            
            let h = "";
            ids.forEach(id => {
                const d = devices[id];
                h += '<div class="card">';
                h += '<div class="flex"><div>';
                h += '<b style="color:#2980b9; font-size:18px;" onclick="rename(\\''+id+'\\',\\''+d.name+'\\')">'+d.name+' ✎</b><br>';
                h += '<small style="color:gray">ID: '+id+' | Wifi: '+d.wifi+'</small></div>';
                h += '<div><button class="btn-toggle '+d.state+'" onclick="toggle(\\''+id+'\\',\\''+(d.state==='ON'?'OFF':'ON')+'\\')">'+d.state+'</button>';
                h += '<span onclick="toggleInput(\\''+id+'\\')" style="cursor:pointer; margin-left:15px; font-size:20px;">⚙</span></div></div>';
                
                h += '<div style="margin-top:10px;"><b>Lịch trình:</b>';
                (d.schedules || []).forEach((s, i) => {
                    h += '<div class="sched-item"><span>🕒 '+s.on+' - '+s.off+'</span><b onclick="del(\\''+id+'\\','+i+')" style="color:#e74c3c; cursor:pointer">✕</b></div>';
                });
                h += '</div>';

                if(openInputId === id) {
                    h += '<div class="input-area"><b>Thêm giờ:</b><br><input type="time" id="t1-'+id+'"> sang <input type="time" id="t2-'+id+'">';
                    h += ' <button class="save-btn" onclick="add(\\''+id+'\\')">Lưu</button></div>';
                }
                h += '</div>';
            });
            container.innerHTML = h;
        }

        function toggleInput(id) { openInputId = (openInputId === id) ? null : id; render(); }
        
        async function toggle(id, st) { 
            // Cập nhật giao diện tạm thời để người dùng thấy mượt
            devices[id].state = st; render();
            await fetch('/relay?id='+id+'&state='+st); 
        }

        async function add(id) {
            let t1 = document.getElementById('t1-'+id).value, t2 = document.getElementById('t2-'+id).value;
            if(t1 && t2) { 
                await fetch('/add-sched?id='+id+'&on='+t1+'&off='+t2+'&days=1111111'); 
                openInputId = null; load(); 
            }
        }

        async function del(id, i) { if(confirm("Xóa lịch này?")) { await fetch('/del-sched?id='+id+'&idx='+i); load(); } }
        
        function rename(id, old) { 
            let n = prompt("Tên thiết bị mới:", old); 
            if(n) fetch('/rename?id='+id+'&name='+encodeURIComponent(n)).then(load); 
        }

        // Tự động cập nhật mỗi 3 giây để đồng bộ nút bấm
        setInterval(load, 3000);
        load();
    </script>
</body>
</html>
    `);
});

app.listen(10000);
