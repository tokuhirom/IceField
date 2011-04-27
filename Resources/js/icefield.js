(function (__global) {

var ICEField = __global.ICEField || {};

var Ti = __global.Titanium;

if (!window.openDatabase) {
    alert("This browser does not support IndexedDB. abort.");
    return;
}

var DBVERSION = 1.0;
ICEField.db = window.openDatabase("icefield", DBVERSION, "IceField", 1048576);
if (!ICEField.db) {
    alert("Cannot open database");
    return;
}

ICEField.db.transaction(function(tx) {
    tx.executeSql('CREATE TABLE IF NOT EXISTS post (id VARCHAR(255) PRIMARY KEY, data, read_fg default 0)');
});

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
ICEField.setUserInfo = function (email, password, res) {
    var obj = {email:email, password:password};
    obj.urls = $(res).find('tumblelog').map(function (i,x) { return $(x).attr('url') }).splice(0);

    localStorage.setItem('login', JSON.stringify(obj));
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
    db.transaction(function (tx) {
        var rows = tx.executeSql('select count(*) AS count from post where read_fg=0', [], function (tx, rs) {
            console.log(rs.rows.item(0));
            var unread = rs.rows.item(0).count;
            $.jGrowl('Unread posts: ' + unread);
        }, function (err) {
            $.jGrowl("DBERR: " + err);
        });
    });
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

            var db = ICEField.db;
            db.transaction(function (tx) {
                (function (posts, inserted) {
                    var self = arguments.callee;

                    var post = posts.shift();
                    tx.executeSql('SELECT count(*) as count FROM post WHERE id=?', [post.id], function (tx, rs) {
                        if (rs.rows.item(0).count==0) {
                            inserted++;
                            tx.executeSql(
                                'INSERT INTO post (id, data) VALUES (?, ?)', [post.id, JSON.stringify(post)]
                            );
                        }
                        if (posts.length > 0) {
                            self(posts, inserted);
                        } else {
                            if (inserted>0) {
                                $.jGrowl("got " + inserted + " posts");
                            }
                        }
                    }, function (err) {
                        $.jGrowl("DBERR: " + err);
                    });
                })(data.posts.slice(0), 0);
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
