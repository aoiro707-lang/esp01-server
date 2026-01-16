const express = require('express');
const app = express();

let devices = {}; // Lưu trữ: { "MACID": { name, state, wifi, lastPing, schedules: [] } }

app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <title>ESP Group Manager</title>
    <style>
        body { font-family: sans-serif; background: #f4f7f6; padding: 20px; }
        .wifi-group { background: white; border-radius: 10px; padding: 15px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        .wifi-header { color: #2ecc71; font-weight: bold; border-bottom: 2px solid #eee; padding-bottom: 5px; margin-bottom: 10px; }
        .device-row { display: flex; align-items: center; padding: 10px 0; border-bottom: 1px solid #f9f9f9; }
        .dev-name { flex-grow: 1; cursor: pointer; font-weight: bold; text-decoration: underline; color: #34495e; }
        .switch { position: relative; width: 50px; height: 24px; }
        .switch input { opacity: 0; }
        .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background: #ccc; border-radius: 24px; transition: .4s; }
        .slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 4px; bottom: 4px; background: white; border-radius: 50%; transition: .4s; }
        input:checked + .slider { background: #2ecc71; }
        input:checked + .slider:before { transform: translateX(26px); }
        .sched-box { border-left: 3px solid #3498db; padding-left: 10px; margin: 10px 0; display: none; font-size: 13px; }
    </style>
</head>
<body>
    <h2>IoT ESP01s Control System</h2>
    <div id="container"></div>

    <script>
        let data = ${JSON.stringify(devices)};

        function render() {
            const groups = {};
            // Group theo WiFi
            for (let id in data) {
                const wifi = data[id].wifi || "Unknown";
                if (!groups[wifi]) groups[wifi] = [];
                groups[wifi].push({id, ...data[id]});
            }

            let html = "";
            for (let wifi in groups) {
                html += \`<div class="wifi-group">
                    <div class="wifi-header">● Wifi: \${wifi} Connected</div>\`;
                groups[wifi].forEach(dev => {
                    html += \`<div class="device-row">
                        <span class="dev-name" onclick="rename('\${dev.id}', '\${dev.name}')">\${dev.name}</span>
                        <label class="switch">
                            <input type="checkbox" \${dev.state==='ON'?'checked':''} onchange="toggle('\${dev.id}', this.checked)">
                            <span class="slider"></span>
                        </label>
                        <span style="margin-left:15px; cursor:pointer;" onclick="showSched('\${dev.id}')">...</span>
                    </div>
                    <div id="box-\${dev.id}" class="sched-box">
                        <input type="time" id="on-\${dev.id}"> to <input type="time" id="off-\${dev.id}">
                        <button onclick="addSched('\${dev.id}')">Save 💾</button>
                        <div id="list-\${dev.id}">\${dev.schedules.map((s,i)=>\`<div>\${s.on}-\${s.off} <button onclick="delSched('\${dev.id}',\${i})">x</button></div>\`).join('')}</div>
                    </div>\`;
                });
                html += "</div>";
            }
            document.getElementById('container').innerHTML = html;
        }

        function rename(id, oldName) {
            let newName = prompt("Nhập tên mới cho thiết bị:", oldName);
            if (newName) fetch(\`/rename?id=\${id}&name=\${newName}\`).then(()=>location.reload());
        }

        function toggle(id, s) { fetch(\`/relay?id=\${id}&state=\${s?'ON':'OFF'}\`); }
        function showSched(id) { 
            let el = document.getElementById('box-'+id);
            el.style.display = el.style.display === 'block' ? 'none' : 'block';
        }
        function addSched(id) {
            let on = document.getElementById('on-'+id).value;
            let off = document.getElementById('off-'+id).value;
            fetch(\`/add-sched?id=\${id}&on=\${on}&off=\${off}&days=1111111\`).then(()=>location.reload());
        }
        function delSched(id, idx) {
            fetch(\`/del-sched?id=\${id}&idx=\${idx}\`).then(()=>location.reload());
        }

        render();
        setInterval(() => fetch('/all-data').then(r=>r.json()).then(d=>{data=d;render();}), 5000);
    </script>
</body>
</html>
    `);
});

// APIs
app.get('/ping', (req, res) => {
    const { id, wifi, name } = req.query;
    if (!devices[id]) devices[id] = { name: name || "Relay", schedules: [], state: "OFF" };
    devices[id].wifi = wifi;
    devices[id].lastPing = Date.now();
    res.send("OK");
});

app.get('/status', (req, res) => { res.json(devices[req.query.id] || {}); });
app.get('/rename', (req, res) => { devices[req.query.id].name = req.query.name; res.send("OK"); });
app.get('/all-data', (req, res) => { res.json(devices); });
app.get('/relay', (req, res) => { devices[req.query.id].state = req.query.state; res.send("OK"); });
app.get('/add-sched', (req, res) => { devices[req.query.id].schedules.push({on:req.query.on, off:req.query.off, days:req.query.days}); res.send("OK"); });
app.get('/del-sched', (req, res) => { devices[req.query.id].schedules.splice(req.query.idx, 1); res.send("OK"); });

app.listen(10000);
