(_ => {
    if(!_.dat) return;
    if(_.hasSetupDebugger) return;
    _.hasSetupDebugger = true;
    
    var gui = new dat.GUI();
    var editor = Editor.currentEditor;
    var config = editor.config;

    var appearance = gui.addFolder("外觀設定");
    appearance.add(config, "scaleY", 0.2, 5).listen();
    appearance.add(config, "autoScroll").listen();
    appearance.add(editor, "maxFPS", 1, 300).listen();
    appearance.add(editor, "noteSize", 50, 200).name("物件大小").listen();
    appearance.add(editor, "ratio", 0.5, 5).name("介面縮放").listen();
    appearance.add(editor, "toHiRes").name("高畫質模式");
    appearance.add(editor, "toLowRes").name("一般畫質模式");

    var audio = gui.addFolder("聲音設定");
    audio.add(editor, "globalOffset", -100, 100).name("聲音延遲").listen();
    audio.add(editor, "enableClickSound").name("啟用點擊音效").listen();

    var debug = gui.addFolder("除錯設定");
    debug.add(editor, "enableDebugLog").name("啟用紀錄").listen();
    debug.add(editor, "debugLogCount", 1, 30).name("顯示紀錄個數").listen();
})(window);
