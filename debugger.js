(_ => {
    if(!_.dat) return;
    if(_.hasSetupDebugger) return;
    _.hasSetupDebugger = true;
    
    var gui = new dat.GUI();
    
    var control = gui.addFolder("操控設定");
    control.add(currentGame, "autoClear").name("Autoplay").listen();

    var basics = gui.addFolder("邦邦 (Bandori) 模式");
    basics.add(currentGame, "bandoriMode").name("啟用").listen();
    basics.add(currentGame, "bandoriSpeed", 1, 11).step(0.5).name("降落速度").listen();

    var appearance = gui.addFolder("外觀設定");
    appearance.add(currentGame, "maxFPS", 1, 300).listen();
    appearance.add(currentGame, "noteSize", 50, 200).name("物件大小").listen();
    appearance.add(currentGame, "noteFadeInTime", 0, 10000).name("物件淡入時長").listen();
    appearance.add(currentGame, "noteFadeOutTime", 0, 10000).name("物件淡出時長").listen();
    appearance.add(currentGame, "mirrored").name("左右翻轉").listen();
    appearance.add(currentGame, "yFlip").name("上下翻轉").listen();
    appearance.add(currentGame, "ratio", 0.5, 5).name("介面縮放").listen();
    appearance.add(currentGame, "toHiRes").name("高畫質模式");
    appearance.add(currentGame, "toLowRes").name("一般畫質模式");

    var audio = gui.addFolder("聲音設定");
    audio.add(currentGame, "globalOffset", -100, 100).name("聲音延遲").listen();
    audio.add(currentGame, "enableClickSound").name("啟用點擊音效").listen();

    var debug = gui.addFolder("除錯設定");
    debug.add(currentGame, "enableDebugLog").name("啟用紀錄").listen();
    debug.add(currentGame, "debugLogCount", 1, 30).name("顯示紀錄個數").listen();

    var exclusive = gui.addFolder("進階彩蛋");
    exclusive.add(currentGame.exclusive, "daycore");
    exclusive.add(currentGame.exclusive, "nightcore");
})(window);
