// ... (Các phần khai báo đầu giữ nguyên)

// Thêm timestamp để theo dõi lần cuối người dùng bấm nút
app.get('/relay', (req, res) => { 
    if(devices[req.query.id]) {
        devices[req.query.id].state = req.query.state; 
        // Đánh dấu thời gian người dùng vừa can thiệp
        devices[req.query.id].lastUserUpdate = Date.now(); 
        saveData();
    }
    res.send("OK"); 
});

app.get('/ping', (req, res) => {
    const { id, wifi, name, state: espPhysState } = req.query;
    if (!id) return res.send("No ID");
    
    let isNew = false;
    if (!devices[id]) {
        devices[id] = { name: name || "Relay", state: "OFF", schedules: [], wifi: wifi || "Unknown" };
        isNew = true;
    }
    
    devices[id].wifi = wifi;
    devices[id].lastPing = Date.now();
    if (isNew) saveData();

    // --- LOGIC THÔNG MINH MỚI ---
    const webState = devices[id].state;
    const lastUserAction = devices[id].lastUserUpdate || 0;
    const timeSinceLastClick = Date.now() - lastUserAction;

    // Chỉ thực hiện so sánh nếu ESP gửi lên trạng thái thực tế
    if (espPhysState) {
        // TRƯỜNG HỢP 1: Người dùng vừa bấm nút trong vòng 15 giây qua
        // -> Ưu tiên lệnh từ Web (Server là chủ)
        if (timeSinceLastClick < 15000) {
             if (webState !== espPhysState) {
                 console.log(`[SYNC] User Clicked! Forcing ESP: ${webState}`);
                 return res.send(webState === "ON" ? "TURN_ON" : "TURN_OFF");
             }
        } 
        // TRƯỜNG HỢP 2: Người dùng KHÔNG bấm gì cả (Idle)
        // -> Ưu tiên trạng thái của ESP (Lịch trình là chủ)
        else {
             if (webState !== espPhysState) {
                 console.log(`[SYNC] Schedule/Manual detected. Updating Web to: ${espPhysState}`);
                 // Cập nhật Database theo thực tế ESP
                 devices[id].state = espPhysState; 
                 saveData();
                 // Không gửi lệnh gì cả, để ESP tự nhiên
             }
        }
    }

    res.send("OK");
});

// ... (Các phần còn lại giữ nguyên)
