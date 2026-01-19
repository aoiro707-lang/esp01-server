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

// --- 1. TỰ ĐỘNG NGĂN SERVER SLEEP (TỐI ƯU 10 PHÚT) ---
const SERVER_URL = "https://esp01-server-1.onrender.com"; 
setInterval(() => {
    https.get(SERVER_URL, (res) => {
        // Chỉ log khi cần thiết để tránh đầy log trên Render
    }).on('error', (e) => {
        console.log("[Self-Ping] Server is starting or network busy.");
    });
}, 600000); 

// --- 2. QUẢN LÝ DỮ LIỆU TỐI ƯU ---
const loadData = () => {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const raw = fs.readFileSync(DATA_FILE, 'utf8');
            devices = JSON.parse(raw);
            console.log("-> Data loaded.");
        }
    } catch (err) { devices = {}; }
};

const saveData = () => {
    try { 
        // Ghi file đồng bộ để đảm bảo dữ liệu an toàn khi server restart
        fs.writeFileSync(DATA_FILE, JSON.stringify(devices, null, 2), 'utf8'); 
    } catch (err) { console.error("Save Error:", err); }
};

loadData();

// --- 3. API ĐỒNG BỘ THÔNG MINH ---
app.get('/ping', (req, res) => {
    const { id, wifi, name, state: espPhysState } = req.query;
    if (!id) return res.send("No ID");
    
    let changed = false;
    if (!devices[id]) {
        devices[id] = { name: name || "Relay", state: "OFF", schedules: [], wifi: wifi || "Unknown", lastUserAction: 0 };
        changed = true;
    }
    
    if (devices[id].wifi !== wifi) { devices[id].wifi = wifi; changed = true; }
    devices[id].lastPing = Date.now(); 

    const serverWebState = devices[id].state;
    const timeSinceLastClick = Date.now() - (devices[id].lastUserAction || 0);

    if (espPhysState) {
        if (timeSinceLastClick < 15000) { // Ưu tiên lệnh từ Web trong 15s đầu
            if (serverWebState !== espPhysState) {
                return res.send(serverWebState === "ON" ? "TURN_ON" : "TURN_OFF");
            }
        } else {
            if (serverWebState !== espPhysState) {
                devices[id].state = espPhysState;
                changed = true;
            }
        }
    }
    if (changed) saveData();
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

// --- 4. GIAO DIỆN NGƯỜI DÙNG TỐI ƯU ---
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
        .days-picker { display: flex; justify-content: space-between; margin-top: 12px; background: #fff; padding: 10px; border-radius: 6px; border: 1px solid #eee; }
        .day-box { text-align: center; font-size: 11px; flex: 1; }
        .offline-text { color: #e74c3c !important; }
        .online-text { color: #2c3e50; }
        .dot { height: 8px; width: 8px; border-radius: 50%; display: inline-block; margin-right: 5px; }
        @keyframes blink { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
        .blink { animation: blink 2s infinite; }
    </style>
</head>
<body>
    <h3 style="text-align:center; color: #2c3e50;">ESP01s Smart Hub</h3>
    <div id="list">Đang kết nối server...</div>

    <script>
        let devices = {};
        let openInputId = null; 
        const dayNames = ["T2","T3","T4","T5","T6","T7","CN"];

        async function load() {
            if (openInputId !== null) return;
            try {
                const r = await fetch('/all-data');
                devices = await r.json();
                render();
            } catch(e) {}
        }

        function render() {
            const container = document.getElementById('list');
            const ids = Object.keys(devices);
            if(ids.length === 0) { container.innerHTML = "<p style='text-align:center;'>Chưa có thiết bị. Chờ ESP gửi Ping...</p>"; return; }
            let h = "";
            const now = Date.now();

            ids.forEach(id => {
                const d = devices[id];
                const isOffline = !d.lastPing || (now - d.lastPing > 15000);
                const nameClass = isOffline ? 'offline-text' : 'online-text';

                h += '<div class="card">';
                h += '<div class="flex"><div>';
                h += '<b class="'+nameClass+'" style="font-size:18px; cursor:pointer;" onclick="renameDevice(\\''+id+'\\',\\''+d.name+'\\')">'+d.name+' ✎</b><br>';
                h += '<small style="color:gray"><span class="dot blink" style="background-color:'+(isOffline?'#e74c3c':'#2ecc71')+'"></span>WiFi: '+d.wifi+'</small></div>';
                h += '<div><button class="btn-toggle '+d.state+'" onclick="toggle(\\''+id+'\\',\\''+(d.state==='ON'?'OFF':'ON')+'\\')">'+d.state+'</button>';
                h += '<span onclick="toggleInput(\\''+id+'\\')" style="cursor:pointer; margin-left:15px; font-size:20px;">⚙</span></div></div>';
                
                h += '<div style="margin-top:15px;"><b style="font-size:13px;">Lịch trình hệ thống:</b>';
                if (!(d.schedules && d.schedules.length)) h += '<p style="font-size:12px; color:gray;">Chưa có lịch hẹn.</p>';
                (d.schedules || []).forEach((s, i) => {
                    h += '<div class="sched-item"><div style="font-size:13px;">🕒 '+s.on+' - '+s.off;
                    if(s.days) for(let j=0; j<7; j++) if(s.days[j] === '1') h += '<span class="day-label">'+dayNames[j]+'</span>';
                    h += '</div><b onclick="del(\\''+id+'\\','+i+')" style="color:#e74c3c; cursor:pointer; padding:5px;">✕</b></div>';
                });
                h += '</div>';

                if(openInputId === id) {
                    h += '<div class="input-area"><b>Thêm lịch mới:</b><br><input type="time" id="t1-'+id+'" style="padding:5px;"> to <input type="time" id="t2-'+id+'" style="padding:5px;"> ';
                    h += '<button style="background:#3498db; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;" onclick="add(\\''+id+'\\')">Lưu</button>';
                    h += '<div class="days-picker">';
                    dayNames.forEach((name, index) => {
                        h += '<div class="day-box">'+name+'<br><input type="checkbox" class="day-check-'+id+'" value="'+index+'" checked></div>';
                    });
                    h += '</div></div>';
                }
                h += '</div>';
            });
            container.innerHTML = h;
        }

        async function toggle(id, st) { 
            devices[id].state = st; render();
            await fetch('/relay?id='+id+'&state='+st); 
        }
        async function renameDevice(id, oldName) {
            let n = prompt("Đổi tên thiết bị:", oldName);
            if(n && n !== oldName) { await fetch('/rename?id='+id+'&name='+encodeURIComponent(n)); load(); }
        }
        async function add(id) {
            let t1 = document.getElementById('t1-'+id).value, t2 = document.getElementById('t2-'+id).value;
            let daysArr = ["0","0","0","0","0","0","0"];
            document.querySelectorAll('.day-check-'+id).forEach(el => { if(el.checked) daysArr[el.value] = "1"; });
            if(t1 && t2) { 
                await fetch('/add-sched?id='+id+'&on='+t1+'&off='+t2+'&days='+daysArr.join("")); 
                openInputId = null; load(); 
            }
        }
        async function del(id, i) { if(confirm("Xóa lịch này?")) { await fetch('/del-sched?id='+id+'&idx='+i); load(); } }
        function toggleInput(id) { openInputId = (openInputId === id) ? null : id; render(); }
        
        setInterval(load, 3000); 
        load();
    </script>
</body>
</html>
    `);
});

app.listen(10000, () => console.log("Server running on port 10000"));
