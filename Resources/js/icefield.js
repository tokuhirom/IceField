(function (__global) {

var ICEField = __global.ICEField || {};

var Ti = __global.Titanium;

ICEField.db = Ti.Database.open('mydb');
ICEField.db.execute('CREATE TABLE IF NOT EXISTS post (id VARCHAR(255) PRIMARY KEY, data, read_fg default 0)');

ICEField.openURL = function (url) {
    Ti.Platform.openURL(url);
};

ICEField.showLoginWindow = function () {
    var win = Ti.UI.createWindow('app://login.html');
    win.open();
};

ICEField.showMainWindow = function () {
    var win = Ti.UI.createWindow('app://main.html');
    win.open();
};
ICEField.closeCurrentWindow = function () {
    Ti.UI.getCurrentWindow().close();
};

ICEField.getUserInfo = function () {
    var deferred = new $.Deferred();
    var login = localStorage.getItem('login');
    if (login) {
        var user = JSON.parse(login);
        ICEField.authenticate(user.email, user.password).done(function () {
            deferred.resolve(user);
        }).fail(function () {
            deferred.reject();
        });
    } else {
        deferred.reject();
    }
    return deferred;
};
ICEField.getUserInfoNoAuth = function () {
    var login = localStorage.getItem('login');
    if (!login) {
        return;
    }
    return JSON.parse(login);
};

ICEField.removeUserInfo = function () {
    localStorage.removeItem('login');
};
ICEField.setUserInfo = function (email, password) {
    localStorage.setItem('login', JSON.stringify({email:email, password:password}));
};
ICEField.authenticate = function (email, password) {
    var deferred = $.Deferred();
    $.ajax({
        url: 'http://www.tumblr.com/api/authenticate',
        method: 'GET',
        data: { email: email, password: password }
    }).success(function(res) {
        deferred.resolve(res);
    }).error(function (err) {
        console.log('error');
        console.log(err);
        deferred.reject(err);
    });
    return deferred;
};

ICEField.showUnreadCount = function () {
    var db = ICEField.db;
    var rows = db.execute('select count(*) from post where read_fg=0');
    $.jGrowl('Unread posts: ' + rows.field(0));
};

ICEField.transaction = function (code) {
    ICEField.db.execute('BEGIN TRANSACTION;');
    try {
        code();
        ICEField.db.execute('COMMIT TRANSACTION;');
    } catch (e) {
        console.log('error');
        console.log(e);
        ICEField.db.execute('ROLLBACK TRANSACTION;');
    };
};

ICEField.crawl = function () {
    console.log("Start crawling");

    var user = ICEField.getUserInfoNoAuth();
    var queue = [0, 50, 100, 150, 200];
    (function (start) {
        var code = arguments.callee;
        $.get(
            'http://tumblr.com/api/dashboard/json?num=50&email=' + escape(user.email) + '&password=' + escape(user.password) + '&start=' + escape(start)
        ).success(function (res) {
            console.log("success to fetch dashboard: " + start);
            var json = res.replace(/var tumblr_api_read = /, '').replace(/;\n$/, '');
            try {
                var data = JSON.parse(json);
                if (!data.posts) {
                    data.posts = {};
                }
                console.log('number of posts: ' + data.posts.length);
            } catch (e) {
                console.log('error');
                console.log(e);
            }

            ICEField.transaction(function () {
                var posts = data.posts,
                    db = ICEField.db,
                    inserted = 0;

                for (var i=0, max=posts.length; i<max; i++) {
                    var post = posts[i];
                    var rows = db.execute('SELECT * FROM post WHERE id=?', post.id);
                    if (rows.rowCount() > 0) {
                        continue;
                    } else {
                        inserted++;
                        db.execute('INSERT INTO post (id, data) VALUES (?, ?)', post.id, JSON.stringify(post));
                    }
                }
                if (inserted>0) {
                    $.jGrowl("got " + inserted + " posts");
                }
            });
        }).error(function (err) {
            console.log("Cannot fetch data: " + err.responseText);
            console.log(err);
        }).complete(function () {
            console.log('complete to fetch data');
            if (queue.length > 0) {
                console.log('try to fetch next page');
                setTimeout(function ( ) {
                    code(queue.shift()); // try to fetch next page
                }, 200);
            } else {
                console.log('re-crawl after one minute');
                setTimeout(ICEField.crawl, 1*60*1000); // sleep 1 minute.
            }
        });
    })(queue.shift());
};

// delete __global.Titanium;

__global.ICEField = ICEField;

})(this);
