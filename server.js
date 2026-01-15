const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
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
app.get('/relay', (req, res) => { if(devices[req.query.id]) devices[req.query.id].state = req.query.state; res.send("OK"); });
app.get('/add-sched', (req, res) => { if(devices[req.query.id]) devices[req.query.id].schedules.push({on:req.query.on, off:req.query.off, days:req.query.days}); res.send("OK"); });
app.get('/del-sched', (req, res) => { if(devices[req.query.id]) devices[req.query.id].schedules.splice(req.query.idx, 1); res.send("OK"); });
app.get('/rename', (req, res) => { if(devices[req.query.id]) devices[req.query.id].name = req.query.name; res.send("OK"); });

// --- GIAO DIỆN ---
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <title>ESP Manager</title>
    <style>
        body { font-family: sans-serif; background: #f0f2f5; padding: 20px; }
        .card { background: white; padding: 15px; border-radius: 10px; margin-bottom: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        .flex { display: flex; justify-content: space-between; align-items: center; }
        .btn-more { cursor: pointer; color: blue; font-weight: bold; }
        .sched-item { font-size: 12px; background: #eee; padding: 5px; margin-top: 5px; border-radius: 4px; display: flex; justify-content: space-between; }
    </style>
</head>
<body>
    <h3>IoT ESP01s Control</h3>
    <div id="list">Đang tải thiết bị...</div>

    <script>
        let devices = {};
        let openId = null;

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
            if(ids.length === 0) { container.innerHTML = "Chưa có thiết bị nào online"; return; }
            
            let h = "";
            ids.forEach(id => {
                const d = devices[id];
                h += '<div class="card">';
                h += '<div class="flex"><div><b>' + d.name + '</b><br><small>' + d.wifi + '</small></div>';
                h += '<div><button onclick="toggle(\''+id+'\',\''+(d.state==='ON'?'OFF':'ON')+'\')">' + d.state + '</button>';
                h += '<span class="btn-more" onclick="show(\''+id+'\')"> ...</span></div></div>';
                
                if(openId === id) {
                    h += '<div style="margin-top:10px; border-top:1px solid #eee; padding-top:10px;">';
                    h += '<input type="time" id="t1-'+id+'"> <input type="time" id="t2-'+id+'"> <button onclick="add(\''+id+'\')">Lưu</button>';
                    (d.schedules || []).forEach((s, i) => {
                        h += '<div class="sched-item"><span>' + s.on + ' - ' + s.off + '</span><b onclick="del(\''+id+'\','+i+')" style="color:red">X</b></div>';
                    });
                    h += '</div>';
                }
                h += '</div>';
            });
            container.innerHTML = h;
        }

        function show(id) { openId = (openId === id) ? null : id; render(); }
        function toggle(id, st) { fetch('/relay?id='+id+'&state='+st).then(load); }
        function add(id) {
            let t1 = document.getElementById('t1-'+id).value;
            let t2 = document.getElementById('t2-'+id).value;
            if(t1 && t2) fetch('/add-sched?id='+id+'&on='+t1+'&off='+t2+'&days=1111111').then(load);
        }
        function del(id, i) { fetch('/del-sched?id='+id+'&idx='+i).then(load); }

        setInterval(load, 5000);
        load();
    </script>
</body>
</html>
    `);
});

app.listen(10000);
