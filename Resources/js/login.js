console.log("Display login pane");

window.onload = function () {
    $('#LoginForm').submit(function (e) {
        e.stopPropagation();
        e.preventDefault();

        var form = $('#LoginForm'),
            email = $('input[name="email"]', form).val(),
            password = $('input[name="password"]', form).val();

        ICEField.authenticate(email, password).done(function () {
            ICEField.setUserInfo(email, password);

            Titanium.UI.getCurrentWindow().close();
            var win = Titanium.UI.createWindow('app://main.html');
            win.open();
        }).fail(function(res) {
            alert("Login failed: " + err.responseText);
        });

        return false;
    });
};

