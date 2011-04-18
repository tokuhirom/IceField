console.log("loading app.js");

ICEField.getUserInfo().done(function (user) {
    console.log('open main.html');
    var win = Titanium.UI.createWindow('app://main.html');
    win.open();
}).fail(function (err) {
    console.log(err);
    var win = Titanium.UI.createWindow('app://login.html');
    win.open();
});
// setTimeout(function () { Titanium.UI.getCurrentWindow().close() }, 1000);

// http://developer.appcelerator.com/question/31391/appjs-in-desktop-app
//   Just be careful to make sure you call Titanium.App.exit() to close the application when all visible windows are closed on Windows and Linux (you may or may not want to do this on OS X since many Mac apps are designed to stay open even with no visible windows).
