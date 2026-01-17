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
        if (timeSinceLastClick < 15000) {
            if (serverWebState !== espPhysState) {
                return res.send(serverWebState === "ON" ? "TURN_ON" : "TURN_OFF");
            }
        } else {
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

app.get('/rename', (req, res) => { 
    if(devices[req.query.id]) {
        devices[req.query.id].name = req.query.name; 
        saveData();
    }
    res.send("OK"); 
});

// --- 4. GIAO DIỆN HTML ---
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
        .input-area { margin-top: 15px; padding: 15px; background: #f0f4f8; border-radius: 8px; }
        .sched-item { display: flex; justify-content: space-between; padding: 8px; background: #fff; border-radius: 5px; margin-top: 5px; border: 1px solid #eee; align-items: center; }
        .save-btn { background: #3498db; color: white; border: none; padding: 8px 20px; border-radius: 4px; cursor: pointer; font-weight: bold; }
        
        /* Style cho nhãn Thứ màu xanh */
        .day-label { background: #3498db; color: white; font-size: 10px; padding: 2px 5px; border-radius: 3px; margin-left: 3px; font-weight: bold; }
        
        /* Style cho phần chọn thứ trong tuần */
        .days-picker { display: flex; justify-content: space-between; margin-top: 12px; margin-bottom: 12px; background: #fff; padding: 10px; border-radius: 6px; }
        .day-box { text-align: center; font-size: 11px; flex: 1; }
        .day-box input { display: block; margin: 5px auto 0; }
    </style>
</head>
<body>
    <h3 style="text-align:center;">ESP01s Smart Control</h3>
    <div id="list">Đang tải thiết bị...</div>

    <script>
        let devices = {};
        let openInputId = null; 
        const dayNames = ["T2","T3","T4","T5","T6","T7","CN"];

        async function load() {
            if (openInputId !== null) return; // Không tải lại khi đang cài đặt để tránh mất tiêu điểm
            try {
                const r = await fetch('/all-data');
                devices = await r.json();
                render();
            } catch(e) {}
        }

        function render() {
            const container = document.getElementById('list');
            const ids = Object.keys(devices);
            if(ids.length === 0) { container.innerHTML = "Chưa có thiết bị nào"; return; }
            
            let h = "";
            ids.forEach(id => {
                const d = devices[id];
                h += '<div class="card">';
                h += '<div class="flex"><div>';
                // Nhấn vào tên để đổi tên
                h += '<b style="color:#2980b9; font-size:18px; cursor:pointer;" onclick="renameDevice(\\''+id+'\\',\\''+d.name+'\\')">'+d.name+' ✎</b><br>';
                h += '<small style="color:gray">Wifi: '+d.wifi+'</small></div>';
                h += '<div><button class="btn-toggle '+d.state+'" onclick="toggle(\\''+id+'\\',\\''+(d.state==='ON'?'OFF':'ON')+'\\')">'+d.state+'</button>';
                h += '<span onclick="toggleInput(\\''+id+'\\')" style="cursor:pointer; margin-left:15px; font-size:20px;">⚙</span></div></div>';
                
                h += '<div style="margin-top:10px;"><b>Lịch trình:</b>';
                (d.schedules || []).forEach((s, i) => {
                    h += '<div class="sched-item"><div>🕒 '+s.on+' - '+s.off;
                    // Hiển thị các thứ lặp lại
                    if(s.days) {
                        for(let j=0; j<7; j++) {
                            if(s.days[j] === '1') h += '<span class="day-label">'+dayNames[j]+'</span>';
                        }
                    }
                    h += '</div><b onclick="del(\\''+id+'\\','+i+')" style="color:#e74c3c; cursor:pointer">✕</b></div>';
                });
                h += '</div>';

                if(openInputId === id) {
                    h += '<div class="input-area">';
                    h += '<b>Thêm giờ:</b><br><div style="margin-top:8px;">';
                    h += '<input type="time" id="t1-'+id+'"> | <input type="time" id="t2-'+id+'"> ';
                    h += '<button class="save-btn" onclick="add(\\''+id+'\\')">Lưu</button></div>';
                    
                    h += '<div class="days-picker">';
                    dayNames.forEach((name, index) => {
                        h += '<div class="day-box">'+name+'<input type="checkbox" class="day-check-'+id+'" value="'+index+'" checked></div>';
                    });
                    h += '<div class="day-box">All<input type="checkbox" id="all-'+id+'" onchange="toggleAll(\\''+id+'\\')" checked></div>';
                    h += '</div>';
                    h += '</div>';
                }
                h += '</div>';
            });
            container.innerHTML = h;
        }

        function toggleAll(id) {
            const isChecked = document.getElementById('all-'+id).checked;
            document.querySelectorAll('.day-check-'+id).forEach(el => el.checked = isChecked);
        }

        function toggleInput(id) { openInputId = (openInputId === id) ? null : id; render(); }
        
        async function toggle(id, st) { 
            devices[id].state = st; render();
            await fetch('/relay?id='+id+'&state='+st); 
        }

        async function renameDevice(id, oldName) {
            let n = prompt("Tên thiết bị mới:", oldName);
            if(n && n !== oldName) {
                await fetch('/rename?id='+id+'&name='+encodeURIComponent(n));
                load();
            }
        }

        async function add(id) {
            let t1 = document.getElementById('t1-'+id).value, t2 = document.getElementById('t2-'+id).value;
            let daysArr = ["0","0","0","0","0","0","0"];
            document.querySelectorAll('.day-check-'+id).forEach(el => {
                if(el.checked) daysArr[el.value] = "1";
            });
            let daysStr = daysArr.join("");

            if(t1 && t2) { 
                await fetch('/add-sched?id='+id+'&on='+t1+'&off='+t2+'&days='+daysStr); 
                openInputId = null; load(); 
            }
        }

        async function del(id, i) { if(confirm("Xóa lịch này?")) { await fetch('/del-sched?id='+id+'&idx='+i); load(); } }
        
        setInterval(load, 3000);
        load();
    </script>
</body>
</html>
    `);
});

app.listen(10000);
