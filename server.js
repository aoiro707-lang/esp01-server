const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

let devices = {}; 

// --- API ---
app.get('/ping', (req, res) => {
    const { id, wifi, name } = req.query;
    if (!id) return res.send("No ID");
    if (!devices[id]) devices[id] = { name: name || "Relay", state: "OFF", schedules: [], wifi: wifi || "Unknown" };
    devices[id].wifi = wifi;
    devices[id].lastPing = Date.now();
    res.send("OK");
});

app.get('/all-data', (req, res) => res.json(devices));
app.get('/status', (req, res) => res.json(devices[req.query.id] || {}));
app.get('/relay', (req, res) => { 
    if(devices[req.query.id]) devices[req.query.id].state = req.query.state; 
    res.send("OK"); 
});
app.get('/add-sched', (req, res) => { 
    if(devices[req.query.id]) devices[req.query.id].schedules.push({on:req.query.on, off:req.query.off, days:req.query.days}); 
    res.send("OK"); 
});
app.get('/del-sched', (req, res) => { 
    if(devices[req.query.id]) devices[req.query.id].schedules.splice(req.query.idx, 1); 
    res.send("OK"); 
});
app.get('/rename', (req, res) => { 
    if(devices[req.query.id]) devices[req.query.id].name = req.query.name; 
    res.send("OK"); 
});

// --- GIAO DIỆN ---
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <title>ESP Control</title>
    <style>
        body { font-family: sans-serif; background: #f4f7f6; padding: 20px; }
        .card { background: white; padding: 15px; border-radius: 12px; margin-bottom: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .flex { display: flex; justify-content: space-between; align-items: center; }
        .btn-toggle { padding: 10px 20px; border-radius: 8px; border: none; cursor: pointer; font-weight: bold; min-width: 70px; }
        .ON { background: #2ecc71; color: white; }
        .OFF { background: #e74c3c; color: white; }
        .sched-box { margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee; }
        input[type="time"] { padding: 5px; border-radius: 4px; border: 1px solid #ddd; }
        .save-btn { background: #3498db; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; }
    </style>
</head>
<body>
    <h2 style="text-align:center; color:#2c3e50;">IoT ESP01s Control System</h2>
    <div id="list">Đang tải thiết bị...</div>

    <script>
        let devices = {};
        let openId = null;

        async function load() {
            // Nếu đang mở bảng hẹn giờ (openId !== null), tạm dừng cập nhật để không mất dữ liệu đang nhập
            if (openId !== null) return; 
            
            try {
                const r = await fetch('/all-data');
                devices = await r.json();
                render();
            } catch(e) { console.error("Lỗi kết nối server"); }
        }

        function render() {
            const container = document.getElementById('list');
            const ids = Object.keys(devices);
            if(ids.length === 0) { container.innerHTML = "Chưa có thiết bị online"; return; }
            
            let h = "";
            ids.forEach(id => {
                const d = devices[id];
                h += '<div class="card">';
                h += '<div class="flex"><div><b style="color:#3498db; cursor:pointer;" onclick="rename(\\''+id+'\\',\\''+d.name+'\\')">' + d.name + '</b><br><small>WiFi: ' + d.wifi + '</small></div>';
                h += '<div><button class="btn-toggle '+d.state+'" onclick="toggle(\\''+id+'\\',\\''+(d.state==='ON'?'OFF':'ON')+'\\')">' + d.state + '</button>';
                h += '<span onclick="show(\\''+id+'\\')" style="cursor:pointer; margin-left:15px; font-size:20px;">...</span></div></div>';
                
                if(openId === id) {
                    h += '<div class="sched-box">';
                    h += '<input type="time" id="t1-'+id+'"> - <input type="time" id="t2-'+id+'"> ';
                    h += '<button class="save-btn" onclick="add(\\''+id+'\\')">Lưu 💾</button>';
                    h += '<div style="margin-top:10px">';
                    (d.schedules || []).forEach((s, i) => {
                        h += '<div style="display:flex; justify-content:space-between; padding:8px; background:#f9f9f9; border-radius:5px; margin-bottom:5px; font-size:14px;">';
                        h += '<span>🕒 ' + s.on + ' - ' + s.off + '</span>';
                        h += '<b onclick="del(\\''+id+'\\','+i+')" style="color:#e74c3c; cursor:pointer">✕</b></div>';
                    });
                    h += '</div></div>';
                }
                h += '</div>';
            });
            container.innerHTML = h;
        }

        function show(id) { 
            openId = (openId === id) ? null : id; 
            render(); 
        }

        async function toggle(id, st) { 
            await fetch('/relay?id='+id+'&state='+st);
            // Sau khi điều khiển tay, cập nhật lại trạng thái ngay lập tức
            const r = await fetch('/all-data');
            devices = await r.json();
            render();
        }

        function rename(id, old) { 
            let n = prompt("Tên thiết bị mới:", old); 
            if(n) fetch('/rename?id='+id+'&name='+encodeURIComponent(n)).then(() => { openId = null; load(); }); 
        }

        async function add(id) {
            let t1 = document.getElementById('t1-'+id).value;
            let t2 = document.getElementById('t2-'+id).value;
            if(t1 && t2) {
                await fetch('/add-sched?id='+id+'&on='+t1+'&off='+t2+'&days=1111111');
                alert("Đã lưu lịch trình!");
                openId = null; // Đóng bảng sau khi lưu để cho phép auto-refresh trở lại
                const r = await fetch('/all-data');
                devices = await r.json();
                render();
            } else {
                alert("Vui lòng chọn đủ giờ Bật và Tắt!");
            }
        }

        async function del(id, i) { 
            await fetch('/del-sched?id='+id+'&idx='+i);
            const r = await fetch('/all-data');
            devices = await r.json();
            render();
        }

        setInterval(load, 5000); // Tự động cập nhật mỗi 5 giây
        load();
    </script>
</body>
</html>
    `);
});

app.listen(10000);
