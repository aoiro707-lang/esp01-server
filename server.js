// Thêm vào đầu file hoặc trong object devices để theo dõi thời gian bấm nút
// let devices = {}; 

app.get('/relay', (req, res) => { 
    const { id, state } = req.query;
    if(devices[id]) {
        devices[id].state = state; 
        // QUAN TRỌNG: Lưu lại thời điểm người dùng nhấn nút
        devices[id].lastUserAction = Date.now(); 
        saveData();
        console.log(`[User] Device ${id} set to ${state}`);
    }
    res.send("OK"); 
});

app.get('/ping', (req, res) => {
    const { id, wifi, name, state: espPhysState } = req.query;
    if (!id) return res.send("No ID");
    
    if (!devices[id]) {
        devices[id] = { name: name || "Relay", state: "OFF", schedules: [], wifi: wifi || "Unknown", lastUserAction: 0 };
    }
    
    devices[id].wifi = wifi;
    devices[id].lastPing = Date.now();

    const webState = devices[id].state;
    const lastAction = devices[id].lastUserAction || 0;
    const timeSinceClick = Date.now() - lastAction;

    // LOGIC ĐỐI SOÁT MỚI:
    if (espPhysState) {
        // Nếu người dùng vừa bấm nút (trong 10 giây qua) -> Ép ESP theo Web
        if (timeSinceClick < 10000) { 
            if (webState !== espPhysState) {
                console.log(`[Sync] User Override -> Send ${webState} to ESP`);
                return res.send(webState === "ON" ? "TURN_ON" : "TURN_OFF");
            }
        } 
        // Nếu người dùng KHÔNG bấm gì -> Server phải đi theo ESP (Ưu tiên Lịch trình/Nút cứng)
        else {
            if (webState !== espPhysState) {
                console.log(`[Sync] ESP Changed (Schedule/Manual) -> Update Web to ${espPhysState}`);
                devices[id].state = espPhysState; 
                saveData();
                // Không gửi lệnh bắt ESP thay đổi nữa
            }
        }
    }

    res.send("OK");
});
