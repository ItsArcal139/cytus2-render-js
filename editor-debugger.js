(_ => {
    if(!_.dat) return;
    if(_.hasSetupDebugger) return;
    _.hasSetupDebugger = true;
    
    var gui = new dat.GUI();
    var config = Editor.currentEditor.config;

    var appearance = gui.addFolder("外觀設定");
    appearance.add(config, "scaleY", 0.2, 5).listen();
    appearance.add(config, "autoScroll").listen();
})(window);
