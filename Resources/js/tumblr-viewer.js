// Simple JavaScript Templating
// John Resig - http://ejohn.org/ - MIT Licensed
(function(__global){
  var cache = {};
  
  __global.tmpl = function tmpl(str, data){
    // Figure out if we're getting a template, or if we need to
    // load the template - and be sure to cache the result.
    var fn = !/\W/.test(str) ?
      cache[str] = cache[str] ||
        tmpl(document.getElementById(str).innerHTML) : (function () {
      
      // Generate a reusable function that will serve as a template
      // generator (and which will be cached).
    var src = "var p=[],print=function(){p.push.apply(p,arguments);};" +
        
        // Introduce the data as local variables using with(){}
        "with(obj){p.push('" +
        
        // Convert the template into pure JavaScript
        str
          .replace(/[\r\t\n]/g, " ")
          .split("<%").join("\t")
          .replace(/((^|%>)[^\t]*)'/g, "$1\r")
          .replace(/\t=(.*?)%>/g, "',$1,'")
          .split("\t").join("');")
          .split("%>").join("p.push('")
          .split("\r").join("\\'")
      + "');}return p.join('');";
      return new Function("obj", src);
      })();
    
    // Provide some basic currying to the user
    return data ? fn( data ) : fn;
  };
})(this);

var LDRize = function () {
    this.i = 0;
};
LDRize.prototype = {
    goNext: function () {
        this.go(this.i+1);
    },
    goPrev: function () {
        if (this.i==0) { return; }
        this.go(this.i-1);
    },
    setPage: function (i) {
        this.i = i;
    },
    getElement: function (i) {
        return $('div.hentry:nth-child(' + i + ')');
    },
    go: function (i) {
        var elem = this.getElement(i);
        if (elem.size() == 0) {
            window.ap.loadNext();
            return;
        }
        location.hash="#" + i;
        this.i = i;

        var top = Math.max($(elem).offset().top - 20, 0);
        $("html:not(:animated),body:not(:animated)").animate(
            { scrollTop: top}, 1
        );
    },
    reblog: function () {
        var elem = this.getElement(this.i);
        elem.addClass('reblogging');
        this.goNext();
        var user = ICEField.getUserInfoNoAuth();

        $.ajax({
            type: 'POST',
            url: 'http://www.tumblr.com/api/reblog',
            data: {
                email: user.email,
                password: user.password,
                'reblog-key': elem.data('reblog-key'),
                'post-id': elem.data('post-id')
            }
        }).success(function () {
            console.log("reblog succeeded");
            $.jGrowl("Reblogged.");
            elem.removeClass('reblogging').addClass('reblogged');
        }).error(function (x) {
            console.log('reblog failed');
            $.jGrowl("Reblog failed...: " + x.status);
        });
    },
    open: function () {
        var elem = this.getElement(this.i);

        var url = elem.find('.permalink').attr('href');
        Titanium.Platform.openURL(url);
    }
};



// callback signature: callback(page, cb(is_finished));
function AutoPager(callback) {
    this.page = 1;

    this.didScroll = false;
    this.finished = false;
    this.callback = callback;

    var self = this;

    $(function () {
        self.loadPage(self.page++);
        $(window).scroll(function () {
            self.didScroll = true;
        });
        self.timer_event = function () {
            if (self.finished) { return; }

            var callee = arguments.callee;
            if (self.didScroll) {
                var remain = $(document).height() - $(document).scrollTop() - $(window).height()
                if (remain < 500) {
                    self.loadNext();
                } else {
                    self.timer = setTimeout(callee, 250);
                }
                self.didScroll = false;
            } else {
                self.timer = setTimeout(callee, 250);
            }
        };
        self.timer = setTimeout(self.timer_event, 250);
    });
}
AutoPager.prototype.loadPage = function (page) {
    var self = this;
    this.callback(page).done(function (has_next) {
        if (has_next) {
            self.timer = setTimeout(self.timer_event, 250);
        } else {
            this.finished = true;
        }
    });
};
AutoPager.prototype.loadNext = function () {
    var self = this;
    if (self.finished) { return; }

    clearTimeout(self.timer);
    self.loadPage(self.page++);
};

var ICEField = {};

$.ajaxSetup({
    cache: false
});

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

var MainPaneController = {
    onStart: function (user) {
        console.log("Display main pane");
        $('#MainPane').show();
        $('#LogoutForm').submit(function () {
            if (window.confirm('really logout?')) {
                $('#MainPane').hide();
                ICEField.removeUserInfo();
                LoginPaneController.onStart();
            } else {
                // nop.
            }
            return false;
        });

        var l = new LDRize();
        $(document).keydown(function (e) {
            switch (e.keyCode) {
            case 80: // p
                l.reblog();
                break;
            case 82: // r
                l.setPage(1);
                break;
            case 74: // j
                l.goNext();
                break;
            case 75: // k
                l.goPrev();
                break;
            case 86: // v
                l.open();
                break;
            }
        });

        window.ap = new AutoPager(function (current_page) {
            var d = new $.Deferred();
            console.log("ap");

            var t = tmpl("EntryTmpl");
            var container = $('.hfeed');

            var has_next=false;
            ICEField.transaction(function () {
                var entries_per_page = 50;
                var rows = ICEField.db.execute(
                    'SELECT id, data FROM post WHERE read_fg=0 ORDER BY id DESC LIMIT ?',
                    entries_per_page+1
                );

                if (!rows.rowCount()) { console.log(rows); $.jGrowl("no unread posts are available."); return; }

                var i=0,
                    has_next=false;
                while (rows.isValidRow()) {
                    i++;

                    if (i==entries_per_page+1) {
                        has_next=true;
                        break;
                    }

                    var html = t({post: JSON.parse(rows.field(1))});
                    container.append(html);

                    var id = rows.field(0);
                    console.log("UPDATING: " + id + ' ' + rows.fieldByName('id'));
                    ICEField.db.execute('UPDATE post SET read_fg=1 WHERE id=?', id);

                    rows.next();
                }
                rows.close();
            });

            d.resolve(has_next);

            (function () {
                var db = ICEField.db;
                var rows = db.execute('select count(*) from post where read_fg=0');
                $.jGrowl('Unread posts: ' + rows.field(0));
            })();

            return d;
        });

    }
};

var LoginPaneController = {
    onStart: function () {
        console.log("Display login pane");
        $('#LoginPane').show();
        $('#LoginForm').submit(function (e) {
            e.stopPropagation();
            e.preventDefault();

            var form = $('#LoginForm'),
                email = $('input[name="email"]', form).val(),
                password = $('input[name="password"]', form).val();

            ICEField.authenticate(email, password).done(function () {
                ICEField.setUserInfo(email, password);
                $('#LoginPane').hide();
                MainPaneController.onStart();
            }).fail(function(res) {
                alert("Login failed: " + err.responseText);
            });

            return false;
        });
    }
};

var htmlEscape = (function(){
    var map = {"<":"&lt;", ">":"&gt;", "&":"&amp;", "'":"&#39;", "\"":"&quot;", " ":"&nbsp;"};
    var replaceStr = function(s){ return map[s]; };
    return function(str) { return str.replace(/<|>|&|'|"|\s/g, replaceStr); };
})();

ICEField.db = Titanium.Database.open('mydb');
ICEField.db.execute('CREATE TABLE IF NOT EXISTS post (id VARCHAR(255) PRIMARY KEY, data, read_fg default 0)');

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


// initialize panes.
Titanium.UI.getCurrentWindow().setMinWidth(960);
window.Ti = Titanium;
window.onload = function () {
    console.log('onload');

    setTimeout(function () {
        // open external links on the web browser.
        $('a').live('click', function (e) {
            e.stopPropagation();
            e.preventDefault();

            var url = $(this).attr('href');
            window.Ti.Platform.openURL(url);

            return false;
        });

        $('.Pane').hide();
        ICEField.getUserInfo().done(function (user) {
            MainPaneController.onStart(user);
        }).fail(function (err) {
            console.log(err);
            LoginPaneController.onStart();
        });
    }, 0);
};

// initialize worker thread
setTimeout(function () {
    // TODO Titanium.Worker.Worker
    console.log('start crawler thread');
    ICEField.crawl();
}, 40);

