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

        var elem = this.getElement(this.i);
        var id = elem.data('post-id');
        /*
        setTimeout(function () {
            console.log('--- update read fg. ' + id);
            ICEField.db.execute('UPDATE post SET read_fg=1 WHERE id=?', id);
            console.log('--- update read fg... done.');
        }, 0);
        */
        console.log(id);

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
        ICEField.openURL(url);
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

$.ajaxSetup({
    cache: false
});

var MainPaneController = {
    onStart: function () {
        console.log("Display main pane");
        $('#MainPane').show();
        $('#LogoutForm').submit(function () {
            if (window.confirm('really logout?')) {
                ICEField.removeUserInfo();

                ICEField.closeCurrentWindow();
                ICEField.showLoginWindow();
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

            return false;
        });

        window.ap = new AutoPager(function (current_page) {
            var d = new $.Deferred();
            console.log("ap");

            var t = tmpl("EntryTmpl");
            var container = $('.hfeed');
            var user = ICEField.getUserInfoNoAuth();

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

                    (function () {
                        var entry = JSON.parse(rows.field(1));
                        if (entry && entry.tumblelog) {
                            for (var i=0, max=user.urls.length; i<max; i++) {
                                var url = user.urls[i];
                                if (url == entry.tumblelog.url) {
                                    return; // it's mine
                                }
                            }
                        }
                        // it's not mine
                        var html = t({post: entry});
                        container.append(html);
                    })();

                    // TODO delay to displaying element
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

function htmlspecialchars(s) { 
    var obj = document.createElement('pre');
    if (typeof obj.textContent != 'undefined') {
        obj.textContent = s;
    } else {
        obj.innerText = s;
    }
    return obj.innerHTML;
}

// sanitize html
function sanitize(src) {
    if (!src) { return undefined; }

    var div = document.createElement('div');
    div.innerHTML = src;
    return safeNode2String(div);
}

// http://d.hatena.ne.jp/os0x/20080228/1204210085
var safeNode2String = function(node){
  if (node.nodeType != Node.ELEMENT_NODE && node.nodeType != Node.TEXT_NODE) return;
  var func = arguments.callee;
  var nodes = node.childNodes;
  var contents =[];
  for (var i=0,l=nodes.length;i<l;i++){
    var content = func(nodes[i]);
    if(content) contents.push(content);
  }
  if (node.nodeType == Node.ELEMENT_NODE){
    var tag = node.tagName;
    var attr = (function(){
      var res=[''];
      switch(tag){
        case 'IMG':
          if (node.src.match(/^http:/) ) res.push('src="' + node.src + '"' );
          break;
        case 'A':
          if (node.href.match(/^http:/) ) res.push( 'href="' + node.href + '"' );
          break;
        default:
          break;
      }
      return res.join(' ');
    })();
    return '<' + tag + attr + '>' + contents.join('') + '</'+tag+'>';
  } else if (node.nodeType == Node.TEXT_NODE) {
    return node.nodeValue;
  }
};


var h = htmlspecialchars;

$.jGrowl.defaults.position='bottom-right';

// initialize panes.
window.onload = function () {
    console.log('onload');

    // open external links on the web browser.
    $('a').live('click', function (e) {
        e.stopPropagation();
        e.preventDefault();

        var url = $(this).attr('href');
        ICEField.openURL(url);

        return false;
    });

    MainPaneController.onStart();
};

// initialize worker thread
setTimeout(function () {
    // TODO Titanium.Worker.Worker
    console.log('start crawler thread');
    ICEField.crawl();
}, 40);

