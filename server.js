// Biến lưu thời điểm người dùng nhấn nút lần cuối
// devices = { "ID": { state: "OFF", lastUserAction: 0, ... } }

app.get('/relay', (req, res) => {
    const { id, state } = req.query;
    if (devices[id]) {
        devices[id].state = state;
        devices[id].lastUserAction = Date.now(); // Ghi lại lúc người dùng bấm
        saveData();
    }
    res.send("OK");
});

app.get('/ping', (req, res) => {
    const { id, state: espPhysState } = req.query; // ON/OFF thực tế từ ESP
    if (!id || !devices[id]) return res.send("OK");

    const webState = devices[id].state;
    const lastAction = devices[id].lastUserAction || 0;
    const timeSinceClick = Date.now() - lastAction;

    // --- LOGIC ĐỒNG BỘ HAI CHIỀU ---
    if (espPhysState) {
        // 1. Nếu người dùng vừa bấm nút trên Web (< 10 giây) -> Ép ESP theo Web
        if (timeSinceClick < 10000) {
            if (webState !== espPhysState) {
                return res.send(webState === "ON" ? "TURN_ON" : "TURN_OFF");
            }
        } 
        // 2. Nếu đã lâu người dùng không bấm (Trạng thái do Hẹn giờ hoặc ESP tự chạy)
        // -> Server cập nhật Web theo ESP
        else {
            if (webState !== espPhysState) {
                console.log(`Syncing Web to ESP: ${espPhysState}`);
                devices[id].state = espPhysState; 
                saveData(); // Nút bấm trên Web sẽ tự nhảy sang màu tương ứng
            }
        }
    }
    res.send("OK");
});
