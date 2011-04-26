console.log("Display login pane");

window.onload = function () {
    $('#LoginForm').submit(function (e) {
        e.stopPropagation();
        e.preventDefault();

        var form = $('#LoginForm'),
            email = $('input[name="email"]', form).val(),
            password = $('input[name="password"]', form).val();

        ICEField.authenticate(email, password).done(function (res) {
            ICEField.setUserInfo(email, password, res);

            ICEField.closeCurrentWindow();
            ICEField.showMainWindow();
        }).fail(function(err) {
            console.log("WHY");
            alert("Login failed: " + err.responseText);
        });

        return false;
    });
};

