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
