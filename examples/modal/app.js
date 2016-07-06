require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
module.exports = dragDrop

var flatten = require('flatten')
var parallel = require('run-parallel')

function dragDrop (elem, listeners) {
  if (typeof elem === 'string') {
    elem = window.document.querySelector(elem)
  }

  if (typeof listeners === 'function') {
    listeners = { onDrop: listeners }
  }

  var timeout

  elem.addEventListener('dragenter', stopEvent, false)
  elem.addEventListener('dragover', onDragOver, false)
  elem.addEventListener('dragleave', onDragLeave, false)
  elem.addEventListener('drop', onDrop, false)

  // Function to remove drag-drop listeners
  return function remove () {
    removeDragClass()
    elem.removeEventListener('dragenter', stopEvent, false)
    elem.removeEventListener('dragover', onDragOver, false)
    elem.removeEventListener('dragleave', onDragLeave, false)
    elem.removeEventListener('drop', onDrop, false)
  }

  function onDragOver (e) {
    e.stopPropagation()
    e.preventDefault()
    if (e.dataTransfer.items) {
      // Only add "drag" class when `items` contains a file
      var items = toArray(e.dataTransfer.items).filter(function (item) {
        return item.kind === 'file'
      })
      if (items.length === 0) return
    }

    elem.classList.add('drag')
    clearTimeout(timeout)

    if (listeners.onDragOver) {
      listeners.onDragOver(e)
    }

    e.dataTransfer.dropEffect = 'copy'
    return false
  }

  function onDragLeave (e) {
    e.stopPropagation()
    e.preventDefault()

    if (listeners.onDragLeave) {
      listeners.onDragLeave(e)
    }

    clearTimeout(timeout)
    timeout = setTimeout(removeDragClass, 50)

    return false
  }

  function onDrop (e) {
    e.stopPropagation()
    e.preventDefault()

    if (listeners.onDragLeave) {
      listeners.onDragLeave(e)
    }

    clearTimeout(timeout)
    removeDragClass()

    var pos = {
      x: e.clientX,
      y: e.clientY
    }

    if (e.dataTransfer.items) {
      // Handle directories in Chrome using the proprietary FileSystem API
      var items = toArray(e.dataTransfer.items).filter(function (item) {
        return item.kind === 'file'
      })

      if (items.length === 0) return

      parallel(items.map(function (item) {
        return function (cb) {
          processEntry(item.webkitGetAsEntry(), cb)
        }
      }), function (err, results) {
        // This catches permission errors with file:// in Chrome. This should never
        // throw in production code, so the user does not need to use try-catch.
        if (err) throw err
        if (listeners.onDrop) {
          listeners.onDrop(flatten(results), pos)
        }
      })
    } else {
      var files = toArray(e.dataTransfer.files)

      if (files.length === 0) return

      files.forEach(function (file) {
        file.fullPath = '/' + file.name
      })

      if (listeners.onDrop) {
        listeners.onDrop(files, pos)
      }
    }

    return false
  }

  function removeDragClass () {
    elem.classList.remove('drag')
  }
}

function stopEvent (e) {
  e.stopPropagation()
  e.preventDefault()
  return false
}

function processEntry (entry, cb) {
  var entries = []

  if (entry.isFile) {
    entry.file(function (file) {
      file.fullPath = entry.fullPath  // preserve pathing for consumer
      cb(null, file)
    }, function (err) {
      cb(err)
    })
  } else if (entry.isDirectory) {
    var reader = entry.createReader()
    readEntries()
  }

  function readEntries () {
    reader.readEntries(function (entries_) {
      if (entries_.length > 0) {
        entries = entries.concat(toArray(entries_))
        readEntries() // continue reading entries until `readEntries` returns no more
      } else {
        doneEntries()
      }
    })
  }

  function doneEntries () {
    parallel(entries.map(function (entry) {
      return function (cb) {
        processEntry(entry, cb)
      }
    }), cb)
  }
}

function toArray (list) {
  return Array.prototype.slice.call(list || [], 0)
}

},{"flatten":2,"run-parallel":3}],2:[function(require,module,exports){
module.exports = function flatten(list, depth) {
  depth = (typeof depth == 'number') ? depth : Infinity;

  if (!depth) {
    if (Array.isArray(list)) {
      return list.map(function(i) { return i; });
    }
    return list;
  }

  return _flatten(list, 1);

  function _flatten(list, d) {
    return list.reduce(function (acc, item) {
      if (Array.isArray(item) && d < depth) {
        return acc.concat(_flatten(item, d + 1));
      }
      else {
        return acc.concat(item);
      }
    }, []);
  }
};

},{}],3:[function(require,module,exports){
(function (process){
module.exports = function (tasks, cb) {
  var results, pending, keys
  var isSync = true

  if (Array.isArray(tasks)) {
    results = []
    pending = tasks.length
  } else {
    keys = Object.keys(tasks)
    results = {}
    pending = keys.length
  }

  function done (err) {
    function end () {
      if (cb) cb(err, results)
      cb = null
    }
    if (isSync) process.nextTick(end)
    else end()
  }

  function each (i, err, result) {
    results[i] = result
    if (--pending === 0 || err) {
      done(err)
    }
  }

  if (!pending) {
    // empty
    done(null)
  } else if (keys) {
    // object
    keys.forEach(function (key) {
      tasks[key](function (err, result) { each(key, err, result) })
    })
  } else {
    // array
    tasks.forEach(function (task, i) {
      task(function (err, result) { each(i, err, result) })
    })
  }

  isSync = false
}

}).call(this,require('_process'))

},{"_process":36}],4:[function(require,module,exports){
(function (process,global){
/*!
 * @overview es6-promise - a tiny implementation of Promises/A+.
 * @copyright Copyright (c) 2014 Yehuda Katz, Tom Dale, Stefan Penner and contributors (Conversion to ES6 API by Jake Archibald)
 * @license   Licensed under MIT license
 *            See https://raw.githubusercontent.com/jakearchibald/es6-promise/master/LICENSE
 * @version   3.1.2
 */

(function() {
    "use strict";
    function lib$es6$promise$utils$$objectOrFunction(x) {
      return typeof x === 'function' || (typeof x === 'object' && x !== null);
    }

    function lib$es6$promise$utils$$isFunction(x) {
      return typeof x === 'function';
    }

    function lib$es6$promise$utils$$isMaybeThenable(x) {
      return typeof x === 'object' && x !== null;
    }

    var lib$es6$promise$utils$$_isArray;
    if (!Array.isArray) {
      lib$es6$promise$utils$$_isArray = function (x) {
        return Object.prototype.toString.call(x) === '[object Array]';
      };
    } else {
      lib$es6$promise$utils$$_isArray = Array.isArray;
    }

    var lib$es6$promise$utils$$isArray = lib$es6$promise$utils$$_isArray;
    var lib$es6$promise$asap$$len = 0;
    var lib$es6$promise$asap$$vertxNext;
    var lib$es6$promise$asap$$customSchedulerFn;

    var lib$es6$promise$asap$$asap = function asap(callback, arg) {
      lib$es6$promise$asap$$queue[lib$es6$promise$asap$$len] = callback;
      lib$es6$promise$asap$$queue[lib$es6$promise$asap$$len + 1] = arg;
      lib$es6$promise$asap$$len += 2;
      if (lib$es6$promise$asap$$len === 2) {
        // If len is 2, that means that we need to schedule an async flush.
        // If additional callbacks are queued before the queue is flushed, they
        // will be processed by this flush that we are scheduling.
        if (lib$es6$promise$asap$$customSchedulerFn) {
          lib$es6$promise$asap$$customSchedulerFn(lib$es6$promise$asap$$flush);
        } else {
          lib$es6$promise$asap$$scheduleFlush();
        }
      }
    }

    function lib$es6$promise$asap$$setScheduler(scheduleFn) {
      lib$es6$promise$asap$$customSchedulerFn = scheduleFn;
    }

    function lib$es6$promise$asap$$setAsap(asapFn) {
      lib$es6$promise$asap$$asap = asapFn;
    }

    var lib$es6$promise$asap$$browserWindow = (typeof window !== 'undefined') ? window : undefined;
    var lib$es6$promise$asap$$browserGlobal = lib$es6$promise$asap$$browserWindow || {};
    var lib$es6$promise$asap$$BrowserMutationObserver = lib$es6$promise$asap$$browserGlobal.MutationObserver || lib$es6$promise$asap$$browserGlobal.WebKitMutationObserver;
    var lib$es6$promise$asap$$isNode = typeof process !== 'undefined' && {}.toString.call(process) === '[object process]';

    // test for web worker but not in IE10
    var lib$es6$promise$asap$$isWorker = typeof Uint8ClampedArray !== 'undefined' &&
      typeof importScripts !== 'undefined' &&
      typeof MessageChannel !== 'undefined';

    // node
    function lib$es6$promise$asap$$useNextTick() {
      // node version 0.10.x displays a deprecation warning when nextTick is used recursively
      // see https://github.com/cujojs/when/issues/410 for details
      return function() {
        process.nextTick(lib$es6$promise$asap$$flush);
      };
    }

    // vertx
    function lib$es6$promise$asap$$useVertxTimer() {
      return function() {
        lib$es6$promise$asap$$vertxNext(lib$es6$promise$asap$$flush);
      };
    }

    function lib$es6$promise$asap$$useMutationObserver() {
      var iterations = 0;
      var observer = new lib$es6$promise$asap$$BrowserMutationObserver(lib$es6$promise$asap$$flush);
      var node = document.createTextNode('');
      observer.observe(node, { characterData: true });

      return function() {
        node.data = (iterations = ++iterations % 2);
      };
    }

    // web worker
    function lib$es6$promise$asap$$useMessageChannel() {
      var channel = new MessageChannel();
      channel.port1.onmessage = lib$es6$promise$asap$$flush;
      return function () {
        channel.port2.postMessage(0);
      };
    }

    function lib$es6$promise$asap$$useSetTimeout() {
      return function() {
        setTimeout(lib$es6$promise$asap$$flush, 1);
      };
    }

    var lib$es6$promise$asap$$queue = new Array(1000);
    function lib$es6$promise$asap$$flush() {
      for (var i = 0; i < lib$es6$promise$asap$$len; i+=2) {
        var callback = lib$es6$promise$asap$$queue[i];
        var arg = lib$es6$promise$asap$$queue[i+1];

        callback(arg);

        lib$es6$promise$asap$$queue[i] = undefined;
        lib$es6$promise$asap$$queue[i+1] = undefined;
      }

      lib$es6$promise$asap$$len = 0;
    }

    function lib$es6$promise$asap$$attemptVertx() {
      try {
        var r = require;
        var vertx = r('vertx');
        lib$es6$promise$asap$$vertxNext = vertx.runOnLoop || vertx.runOnContext;
        return lib$es6$promise$asap$$useVertxTimer();
      } catch(e) {
        return lib$es6$promise$asap$$useSetTimeout();
      }
    }

    var lib$es6$promise$asap$$scheduleFlush;
    // Decide what async method to use to triggering processing of queued callbacks:
    if (lib$es6$promise$asap$$isNode) {
      lib$es6$promise$asap$$scheduleFlush = lib$es6$promise$asap$$useNextTick();
    } else if (lib$es6$promise$asap$$BrowserMutationObserver) {
      lib$es6$promise$asap$$scheduleFlush = lib$es6$promise$asap$$useMutationObserver();
    } else if (lib$es6$promise$asap$$isWorker) {
      lib$es6$promise$asap$$scheduleFlush = lib$es6$promise$asap$$useMessageChannel();
    } else if (lib$es6$promise$asap$$browserWindow === undefined && typeof require === 'function') {
      lib$es6$promise$asap$$scheduleFlush = lib$es6$promise$asap$$attemptVertx();
    } else {
      lib$es6$promise$asap$$scheduleFlush = lib$es6$promise$asap$$useSetTimeout();
    }
    function lib$es6$promise$then$$then(onFulfillment, onRejection) {
      var parent = this;
      var state = parent._state;

      if (state === lib$es6$promise$$internal$$FULFILLED && !onFulfillment || state === lib$es6$promise$$internal$$REJECTED && !onRejection) {
        return this;
      }

      var child = new this.constructor(lib$es6$promise$$internal$$noop);
      var result = parent._result;

      if (state) {
        var callback = arguments[state - 1];
        lib$es6$promise$asap$$asap(function(){
          lib$es6$promise$$internal$$invokeCallback(state, child, callback, result);
        });
      } else {
        lib$es6$promise$$internal$$subscribe(parent, child, onFulfillment, onRejection);
      }

      return child;
    }
    var lib$es6$promise$then$$default = lib$es6$promise$then$$then;
    function lib$es6$promise$promise$resolve$$resolve(object) {
      /*jshint validthis:true */
      var Constructor = this;

      if (object && typeof object === 'object' && object.constructor === Constructor) {
        return object;
      }

      var promise = new Constructor(lib$es6$promise$$internal$$noop);
      lib$es6$promise$$internal$$resolve(promise, object);
      return promise;
    }
    var lib$es6$promise$promise$resolve$$default = lib$es6$promise$promise$resolve$$resolve;

    function lib$es6$promise$$internal$$noop() {}

    var lib$es6$promise$$internal$$PENDING   = void 0;
    var lib$es6$promise$$internal$$FULFILLED = 1;
    var lib$es6$promise$$internal$$REJECTED  = 2;

    var lib$es6$promise$$internal$$GET_THEN_ERROR = new lib$es6$promise$$internal$$ErrorObject();

    function lib$es6$promise$$internal$$selfFulfillment() {
      return new TypeError("You cannot resolve a promise with itself");
    }

    function lib$es6$promise$$internal$$cannotReturnOwn() {
      return new TypeError('A promises callback cannot return that same promise.');
    }

    function lib$es6$promise$$internal$$getThen(promise) {
      try {
        return promise.then;
      } catch(error) {
        lib$es6$promise$$internal$$GET_THEN_ERROR.error = error;
        return lib$es6$promise$$internal$$GET_THEN_ERROR;
      }
    }

    function lib$es6$promise$$internal$$tryThen(then, value, fulfillmentHandler, rejectionHandler) {
      try {
        then.call(value, fulfillmentHandler, rejectionHandler);
      } catch(e) {
        return e;
      }
    }

    function lib$es6$promise$$internal$$handleForeignThenable(promise, thenable, then) {
       lib$es6$promise$asap$$asap(function(promise) {
        var sealed = false;
        var error = lib$es6$promise$$internal$$tryThen(then, thenable, function(value) {
          if (sealed) { return; }
          sealed = true;
          if (thenable !== value) {
            lib$es6$promise$$internal$$resolve(promise, value);
          } else {
            lib$es6$promise$$internal$$fulfill(promise, value);
          }
        }, function(reason) {
          if (sealed) { return; }
          sealed = true;

          lib$es6$promise$$internal$$reject(promise, reason);
        }, 'Settle: ' + (promise._label || ' unknown promise'));

        if (!sealed && error) {
          sealed = true;
          lib$es6$promise$$internal$$reject(promise, error);
        }
      }, promise);
    }

    function lib$es6$promise$$internal$$handleOwnThenable(promise, thenable) {
      if (thenable._state === lib$es6$promise$$internal$$FULFILLED) {
        lib$es6$promise$$internal$$fulfill(promise, thenable._result);
      } else if (thenable._state === lib$es6$promise$$internal$$REJECTED) {
        lib$es6$promise$$internal$$reject(promise, thenable._result);
      } else {
        lib$es6$promise$$internal$$subscribe(thenable, undefined, function(value) {
          lib$es6$promise$$internal$$resolve(promise, value);
        }, function(reason) {
          lib$es6$promise$$internal$$reject(promise, reason);
        });
      }
    }

    function lib$es6$promise$$internal$$handleMaybeThenable(promise, maybeThenable, then) {
      if (maybeThenable.constructor === promise.constructor &&
          then === lib$es6$promise$then$$default &&
          constructor.resolve === lib$es6$promise$promise$resolve$$default) {
        lib$es6$promise$$internal$$handleOwnThenable(promise, maybeThenable);
      } else {
        if (then === lib$es6$promise$$internal$$GET_THEN_ERROR) {
          lib$es6$promise$$internal$$reject(promise, lib$es6$promise$$internal$$GET_THEN_ERROR.error);
        } else if (then === undefined) {
          lib$es6$promise$$internal$$fulfill(promise, maybeThenable);
        } else if (lib$es6$promise$utils$$isFunction(then)) {
          lib$es6$promise$$internal$$handleForeignThenable(promise, maybeThenable, then);
        } else {
          lib$es6$promise$$internal$$fulfill(promise, maybeThenable);
        }
      }
    }

    function lib$es6$promise$$internal$$resolve(promise, value) {
      if (promise === value) {
        lib$es6$promise$$internal$$reject(promise, lib$es6$promise$$internal$$selfFulfillment());
      } else if (lib$es6$promise$utils$$objectOrFunction(value)) {
        lib$es6$promise$$internal$$handleMaybeThenable(promise, value, lib$es6$promise$$internal$$getThen(value));
      } else {
        lib$es6$promise$$internal$$fulfill(promise, value);
      }
    }

    function lib$es6$promise$$internal$$publishRejection(promise) {
      if (promise._onerror) {
        promise._onerror(promise._result);
      }

      lib$es6$promise$$internal$$publish(promise);
    }

    function lib$es6$promise$$internal$$fulfill(promise, value) {
      if (promise._state !== lib$es6$promise$$internal$$PENDING) { return; }

      promise._result = value;
      promise._state = lib$es6$promise$$internal$$FULFILLED;

      if (promise._subscribers.length !== 0) {
        lib$es6$promise$asap$$asap(lib$es6$promise$$internal$$publish, promise);
      }
    }

    function lib$es6$promise$$internal$$reject(promise, reason) {
      if (promise._state !== lib$es6$promise$$internal$$PENDING) { return; }
      promise._state = lib$es6$promise$$internal$$REJECTED;
      promise._result = reason;

      lib$es6$promise$asap$$asap(lib$es6$promise$$internal$$publishRejection, promise);
    }

    function lib$es6$promise$$internal$$subscribe(parent, child, onFulfillment, onRejection) {
      var subscribers = parent._subscribers;
      var length = subscribers.length;

      parent._onerror = null;

      subscribers[length] = child;
      subscribers[length + lib$es6$promise$$internal$$FULFILLED] = onFulfillment;
      subscribers[length + lib$es6$promise$$internal$$REJECTED]  = onRejection;

      if (length === 0 && parent._state) {
        lib$es6$promise$asap$$asap(lib$es6$promise$$internal$$publish, parent);
      }
    }

    function lib$es6$promise$$internal$$publish(promise) {
      var subscribers = promise._subscribers;
      var settled = promise._state;

      if (subscribers.length === 0) { return; }

      var child, callback, detail = promise._result;

      for (var i = 0; i < subscribers.length; i += 3) {
        child = subscribers[i];
        callback = subscribers[i + settled];

        if (child) {
          lib$es6$promise$$internal$$invokeCallback(settled, child, callback, detail);
        } else {
          callback(detail);
        }
      }

      promise._subscribers.length = 0;
    }

    function lib$es6$promise$$internal$$ErrorObject() {
      this.error = null;
    }

    var lib$es6$promise$$internal$$TRY_CATCH_ERROR = new lib$es6$promise$$internal$$ErrorObject();

    function lib$es6$promise$$internal$$tryCatch(callback, detail) {
      try {
        return callback(detail);
      } catch(e) {
        lib$es6$promise$$internal$$TRY_CATCH_ERROR.error = e;
        return lib$es6$promise$$internal$$TRY_CATCH_ERROR;
      }
    }

    function lib$es6$promise$$internal$$invokeCallback(settled, promise, callback, detail) {
      var hasCallback = lib$es6$promise$utils$$isFunction(callback),
          value, error, succeeded, failed;

      if (hasCallback) {
        value = lib$es6$promise$$internal$$tryCatch(callback, detail);

        if (value === lib$es6$promise$$internal$$TRY_CATCH_ERROR) {
          failed = true;
          error = value.error;
          value = null;
        } else {
          succeeded = true;
        }

        if (promise === value) {
          lib$es6$promise$$internal$$reject(promise, lib$es6$promise$$internal$$cannotReturnOwn());
          return;
        }

      } else {
        value = detail;
        succeeded = true;
      }

      if (promise._state !== lib$es6$promise$$internal$$PENDING) {
        // noop
      } else if (hasCallback && succeeded) {
        lib$es6$promise$$internal$$resolve(promise, value);
      } else if (failed) {
        lib$es6$promise$$internal$$reject(promise, error);
      } else if (settled === lib$es6$promise$$internal$$FULFILLED) {
        lib$es6$promise$$internal$$fulfill(promise, value);
      } else if (settled === lib$es6$promise$$internal$$REJECTED) {
        lib$es6$promise$$internal$$reject(promise, value);
      }
    }

    function lib$es6$promise$$internal$$initializePromise(promise, resolver) {
      try {
        resolver(function resolvePromise(value){
          lib$es6$promise$$internal$$resolve(promise, value);
        }, function rejectPromise(reason) {
          lib$es6$promise$$internal$$reject(promise, reason);
        });
      } catch(e) {
        lib$es6$promise$$internal$$reject(promise, e);
      }
    }

    function lib$es6$promise$promise$all$$all(entries) {
      return new lib$es6$promise$enumerator$$default(this, entries).promise;
    }
    var lib$es6$promise$promise$all$$default = lib$es6$promise$promise$all$$all;
    function lib$es6$promise$promise$race$$race(entries) {
      /*jshint validthis:true */
      var Constructor = this;

      var promise = new Constructor(lib$es6$promise$$internal$$noop);

      if (!lib$es6$promise$utils$$isArray(entries)) {
        lib$es6$promise$$internal$$reject(promise, new TypeError('You must pass an array to race.'));
        return promise;
      }

      var length = entries.length;

      function onFulfillment(value) {
        lib$es6$promise$$internal$$resolve(promise, value);
      }

      function onRejection(reason) {
        lib$es6$promise$$internal$$reject(promise, reason);
      }

      for (var i = 0; promise._state === lib$es6$promise$$internal$$PENDING && i < length; i++) {
        lib$es6$promise$$internal$$subscribe(Constructor.resolve(entries[i]), undefined, onFulfillment, onRejection);
      }

      return promise;
    }
    var lib$es6$promise$promise$race$$default = lib$es6$promise$promise$race$$race;
    function lib$es6$promise$promise$reject$$reject(reason) {
      /*jshint validthis:true */
      var Constructor = this;
      var promise = new Constructor(lib$es6$promise$$internal$$noop);
      lib$es6$promise$$internal$$reject(promise, reason);
      return promise;
    }
    var lib$es6$promise$promise$reject$$default = lib$es6$promise$promise$reject$$reject;

    var lib$es6$promise$promise$$counter = 0;

    function lib$es6$promise$promise$$needsResolver() {
      throw new TypeError('You must pass a resolver function as the first argument to the promise constructor');
    }

    function lib$es6$promise$promise$$needsNew() {
      throw new TypeError("Failed to construct 'Promise': Please use the 'new' operator, this object constructor cannot be called as a function.");
    }

    var lib$es6$promise$promise$$default = lib$es6$promise$promise$$Promise;
    /**
      Promise objects represent the eventual result of an asynchronous operation. The
      primary way of interacting with a promise is through its `then` method, which
      registers callbacks to receive either a promise's eventual value or the reason
      why the promise cannot be fulfilled.

      Terminology
      -----------

      - `promise` is an object or function with a `then` method whose behavior conforms to this specification.
      - `thenable` is an object or function that defines a `then` method.
      - `value` is any legal JavaScript value (including undefined, a thenable, or a promise).
      - `exception` is a value that is thrown using the throw statement.
      - `reason` is a value that indicates why a promise was rejected.
      - `settled` the final resting state of a promise, fulfilled or rejected.

      A promise can be in one of three states: pending, fulfilled, or rejected.

      Promises that are fulfilled have a fulfillment value and are in the fulfilled
      state.  Promises that are rejected have a rejection reason and are in the
      rejected state.  A fulfillment value is never a thenable.

      Promises can also be said to *resolve* a value.  If this value is also a
      promise, then the original promise's settled state will match the value's
      settled state.  So a promise that *resolves* a promise that rejects will
      itself reject, and a promise that *resolves* a promise that fulfills will
      itself fulfill.


      Basic Usage:
      ------------

      ```js
      var promise = new Promise(function(resolve, reject) {
        // on success
        resolve(value);

        // on failure
        reject(reason);
      });

      promise.then(function(value) {
        // on fulfillment
      }, function(reason) {
        // on rejection
      });
      ```

      Advanced Usage:
      ---------------

      Promises shine when abstracting away asynchronous interactions such as
      `XMLHttpRequest`s.

      ```js
      function getJSON(url) {
        return new Promise(function(resolve, reject){
          var xhr = new XMLHttpRequest();

          xhr.open('GET', url);
          xhr.onreadystatechange = handler;
          xhr.responseType = 'json';
          xhr.setRequestHeader('Accept', 'application/json');
          xhr.send();

          function handler() {
            if (this.readyState === this.DONE) {
              if (this.status === 200) {
                resolve(this.response);
              } else {
                reject(new Error('getJSON: `' + url + '` failed with status: [' + this.status + ']'));
              }
            }
          };
        });
      }

      getJSON('/posts.json').then(function(json) {
        // on fulfillment
      }, function(reason) {
        // on rejection
      });
      ```

      Unlike callbacks, promises are great composable primitives.

      ```js
      Promise.all([
        getJSON('/posts'),
        getJSON('/comments')
      ]).then(function(values){
        values[0] // => postsJSON
        values[1] // => commentsJSON

        return values;
      });
      ```

      @class Promise
      @param {function} resolver
      Useful for tooling.
      @constructor
    */
    function lib$es6$promise$promise$$Promise(resolver) {
      this._id = lib$es6$promise$promise$$counter++;
      this._state = undefined;
      this._result = undefined;
      this._subscribers = [];

      if (lib$es6$promise$$internal$$noop !== resolver) {
        typeof resolver !== 'function' && lib$es6$promise$promise$$needsResolver();
        this instanceof lib$es6$promise$promise$$Promise ? lib$es6$promise$$internal$$initializePromise(this, resolver) : lib$es6$promise$promise$$needsNew();
      }
    }

    lib$es6$promise$promise$$Promise.all = lib$es6$promise$promise$all$$default;
    lib$es6$promise$promise$$Promise.race = lib$es6$promise$promise$race$$default;
    lib$es6$promise$promise$$Promise.resolve = lib$es6$promise$promise$resolve$$default;
    lib$es6$promise$promise$$Promise.reject = lib$es6$promise$promise$reject$$default;
    lib$es6$promise$promise$$Promise._setScheduler = lib$es6$promise$asap$$setScheduler;
    lib$es6$promise$promise$$Promise._setAsap = lib$es6$promise$asap$$setAsap;
    lib$es6$promise$promise$$Promise._asap = lib$es6$promise$asap$$asap;

    lib$es6$promise$promise$$Promise.prototype = {
      constructor: lib$es6$promise$promise$$Promise,

    /**
      The primary way of interacting with a promise is through its `then` method,
      which registers callbacks to receive either a promise's eventual value or the
      reason why the promise cannot be fulfilled.

      ```js
      findUser().then(function(user){
        // user is available
      }, function(reason){
        // user is unavailable, and you are given the reason why
      });
      ```

      Chaining
      --------

      The return value of `then` is itself a promise.  This second, 'downstream'
      promise is resolved with the return value of the first promise's fulfillment
      or rejection handler, or rejected if the handler throws an exception.

      ```js
      findUser().then(function (user) {
        return user.name;
      }, function (reason) {
        return 'default name';
      }).then(function (userName) {
        // If `findUser` fulfilled, `userName` will be the user's name, otherwise it
        // will be `'default name'`
      });

      findUser().then(function (user) {
        throw new Error('Found user, but still unhappy');
      }, function (reason) {
        throw new Error('`findUser` rejected and we're unhappy');
      }).then(function (value) {
        // never reached
      }, function (reason) {
        // if `findUser` fulfilled, `reason` will be 'Found user, but still unhappy'.
        // If `findUser` rejected, `reason` will be '`findUser` rejected and we're unhappy'.
      });
      ```
      If the downstream promise does not specify a rejection handler, rejection reasons will be propagated further downstream.

      ```js
      findUser().then(function (user) {
        throw new PedagogicalException('Upstream error');
      }).then(function (value) {
        // never reached
      }).then(function (value) {
        // never reached
      }, function (reason) {
        // The `PedgagocialException` is propagated all the way down to here
      });
      ```

      Assimilation
      ------------

      Sometimes the value you want to propagate to a downstream promise can only be
      retrieved asynchronously. This can be achieved by returning a promise in the
      fulfillment or rejection handler. The downstream promise will then be pending
      until the returned promise is settled. This is called *assimilation*.

      ```js
      findUser().then(function (user) {
        return findCommentsByAuthor(user);
      }).then(function (comments) {
        // The user's comments are now available
      });
      ```

      If the assimliated promise rejects, then the downstream promise will also reject.

      ```js
      findUser().then(function (user) {
        return findCommentsByAuthor(user);
      }).then(function (comments) {
        // If `findCommentsByAuthor` fulfills, we'll have the value here
      }, function (reason) {
        // If `findCommentsByAuthor` rejects, we'll have the reason here
      });
      ```

      Simple Example
      --------------

      Synchronous Example

      ```javascript
      var result;

      try {
        result = findResult();
        // success
      } catch(reason) {
        // failure
      }
      ```

      Errback Example

      ```js
      findResult(function(result, err){
        if (err) {
          // failure
        } else {
          // success
        }
      });
      ```

      Promise Example;

      ```javascript
      findResult().then(function(result){
        // success
      }, function(reason){
        // failure
      });
      ```

      Advanced Example
      --------------

      Synchronous Example

      ```javascript
      var author, books;

      try {
        author = findAuthor();
        books  = findBooksByAuthor(author);
        // success
      } catch(reason) {
        // failure
      }
      ```

      Errback Example

      ```js

      function foundBooks(books) {

      }

      function failure(reason) {

      }

      findAuthor(function(author, err){
        if (err) {
          failure(err);
          // failure
        } else {
          try {
            findBoooksByAuthor(author, function(books, err) {
              if (err) {
                failure(err);
              } else {
                try {
                  foundBooks(books);
                } catch(reason) {
                  failure(reason);
                }
              }
            });
          } catch(error) {
            failure(err);
          }
          // success
        }
      });
      ```

      Promise Example;

      ```javascript
      findAuthor().
        then(findBooksByAuthor).
        then(function(books){
          // found books
      }).catch(function(reason){
        // something went wrong
      });
      ```

      @method then
      @param {Function} onFulfilled
      @param {Function} onRejected
      Useful for tooling.
      @return {Promise}
    */
      then: lib$es6$promise$then$$default,

    /**
      `catch` is simply sugar for `then(undefined, onRejection)` which makes it the same
      as the catch block of a try/catch statement.

      ```js
      function findAuthor(){
        throw new Error('couldn't find that author');
      }

      // synchronous
      try {
        findAuthor();
      } catch(reason) {
        // something went wrong
      }

      // async with promises
      findAuthor().catch(function(reason){
        // something went wrong
      });
      ```

      @method catch
      @param {Function} onRejection
      Useful for tooling.
      @return {Promise}
    */
      'catch': function(onRejection) {
        return this.then(null, onRejection);
      }
    };
    var lib$es6$promise$enumerator$$default = lib$es6$promise$enumerator$$Enumerator;
    function lib$es6$promise$enumerator$$Enumerator(Constructor, input) {
      this._instanceConstructor = Constructor;
      this.promise = new Constructor(lib$es6$promise$$internal$$noop);

      if (Array.isArray(input)) {
        this._input     = input;
        this.length     = input.length;
        this._remaining = input.length;

        this._result = new Array(this.length);

        if (this.length === 0) {
          lib$es6$promise$$internal$$fulfill(this.promise, this._result);
        } else {
          this.length = this.length || 0;
          this._enumerate();
          if (this._remaining === 0) {
            lib$es6$promise$$internal$$fulfill(this.promise, this._result);
          }
        }
      } else {
        lib$es6$promise$$internal$$reject(this.promise, this._validationError());
      }
    }

    lib$es6$promise$enumerator$$Enumerator.prototype._validationError = function() {
      return new Error('Array Methods must be provided an Array');
    };

    lib$es6$promise$enumerator$$Enumerator.prototype._enumerate = function() {
      var length  = this.length;
      var input   = this._input;

      for (var i = 0; this._state === lib$es6$promise$$internal$$PENDING && i < length; i++) {
        this._eachEntry(input[i], i);
      }
    };

    lib$es6$promise$enumerator$$Enumerator.prototype._eachEntry = function(entry, i) {
      var c = this._instanceConstructor;
      var resolve = c.resolve;

      if (resolve === lib$es6$promise$promise$resolve$$default) {
        var then = lib$es6$promise$$internal$$getThen(entry);

        if (then === lib$es6$promise$then$$default &&
            entry._state !== lib$es6$promise$$internal$$PENDING) {
          this._settledAt(entry._state, i, entry._result);
        } else if (typeof then !== 'function') {
          this._remaining--;
          this._result[i] = entry;
        } else if (c === lib$es6$promise$promise$$default) {
          var promise = new c(lib$es6$promise$$internal$$noop);
          lib$es6$promise$$internal$$handleMaybeThenable(promise, entry, then);
          this._willSettleAt(promise, i);
        } else {
          this._willSettleAt(new c(function(resolve) { resolve(entry); }), i);
        }
      } else {
        this._willSettleAt(resolve(entry), i);
      }
    };

    lib$es6$promise$enumerator$$Enumerator.prototype._settledAt = function(state, i, value) {
      var promise = this.promise;

      if (promise._state === lib$es6$promise$$internal$$PENDING) {
        this._remaining--;

        if (state === lib$es6$promise$$internal$$REJECTED) {
          lib$es6$promise$$internal$$reject(promise, value);
        } else {
          this._result[i] = value;
        }
      }

      if (this._remaining === 0) {
        lib$es6$promise$$internal$$fulfill(promise, this._result);
      }
    };

    lib$es6$promise$enumerator$$Enumerator.prototype._willSettleAt = function(promise, i) {
      var enumerator = this;

      lib$es6$promise$$internal$$subscribe(promise, undefined, function(value) {
        enumerator._settledAt(lib$es6$promise$$internal$$FULFILLED, i, value);
      }, function(reason) {
        enumerator._settledAt(lib$es6$promise$$internal$$REJECTED, i, reason);
      });
    };
    function lib$es6$promise$polyfill$$polyfill() {
      var local;

      if (typeof global !== 'undefined') {
          local = global;
      } else if (typeof self !== 'undefined') {
          local = self;
      } else {
          try {
              local = Function('return this')();
          } catch (e) {
              throw new Error('polyfill failed because global object is unavailable in this environment');
          }
      }

      var P = local.Promise;

      if (P && Object.prototype.toString.call(P.resolve()) === '[object Promise]' && !P.cast) {
        return;
      }

      local.Promise = lib$es6$promise$promise$$default;
    }
    var lib$es6$promise$polyfill$$default = lib$es6$promise$polyfill$$polyfill;

    var lib$es6$promise$umd$$ES6Promise = {
      'Promise': lib$es6$promise$promise$$default,
      'polyfill': lib$es6$promise$polyfill$$default
    };

    /* global define:true module:true window: true */
    if (typeof define === 'function' && define['amd']) {
      define(function() { return lib$es6$promise$umd$$ES6Promise; });
    } else if (typeof module !== 'undefined' && module['exports']) {
      module['exports'] = lib$es6$promise$umd$$ES6Promise;
    } else if (typeof this !== 'undefined') {
      this['ES6Promise'] = lib$es6$promise$umd$$ES6Promise;
    }

    lib$es6$promise$polyfill$$default();
}).call(this);


}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"_process":36}],5:[function(require,module,exports){
(function (global){
(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.tus = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = fingerprint;
/**
 * Generate a fingerprint for a file which will be used the store the endpoint
 *
 * @param {File} file
 * @return {String}
 */
function fingerprint(file) {
  return ["tus", file.name, file.type, file.size, file.lastModified].join("-");
}

},{}],2:[function(_dereq_,module,exports){
"use strict";

var _upload = _dereq_("./upload");

var _upload2 = _interopRequireDefault(_upload);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var defaultOptions = _upload2.default.defaultOptions; /* global window */

var _window = window;
var XMLHttpRequest = _window.XMLHttpRequest;
var localStorage = _window.localStorage;
var Blob = _window.Blob;

var isSupported = XMLHttpRequest && localStorage && Blob && typeof Blob.prototype.slice === "function";

module.exports = {
  Upload: _upload2.default,
  isSupported: isSupported,
  defaultOptions: defaultOptions
};

},{"./upload":3}],3:[function(_dereq_,module,exports){
"use strict";

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })(); /* global window, XMLHttpRequest */

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _fingerprint = _dereq_("./fingerprint");

var _fingerprint2 = _interopRequireDefault(_fingerprint);

var _extend = _dereq_("extend");

var _extend2 = _interopRequireDefault(_extend);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _window = window;
var localStorage = _window.localStorage;
var btoa = _window.btoa;

var defaultOptions = {
  endpoint: "",
  fingerprint: _fingerprint2.default,
  resume: true,
  onProgress: null,
  onChunkComplete: null,
  onSuccess: null,
  onError: null,
  headers: {},
  chunkSize: Infinity,
  withCredentials: false
};

var Upload = (function () {
  function Upload(file, options) {
    _classCallCheck(this, Upload);

    this.options = (0, _extend2.default)(true, {}, defaultOptions, options);

    // The underlying File/Blob object
    this.file = file;

    // The URL against which the file will be uploaded
    this.url = null;

    // The underlying XHR object for the current PATCH request
    this._xhr = null;

    // The fingerpinrt for the current file (set after start())
    this._fingerprint = null;

    // The offset used in the current PATCH request
    this._offset = null;

    // True if the current PATCH request has been aborted
    this._aborted = false;
  }

  _createClass(Upload, [{
    key: "start",
    value: function start() {
      var file = this.file;

      if (!file) {
        this._emitError(new Error("tus: no file to upload provided"));
        return;
      }

      if (!this.options.endpoint) {
        this._emitError(new Error("tus: no endpoint provided"));
        return;
      }

      // A URL has manually been specified, so we try to resume
      if (this.url !== null) {
        this._resumeUpload();
        return;
      }

      // Try to find the endpoint for the file in the localStorage
      if (this.options.resume) {
        this._fingerprint = this.options.fingerprint(file);
        var resumedUrl = localStorage.getItem(this._fingerprint);

        if (resumedUrl != null) {
          this.url = resumedUrl;
          this._resumeUpload();
          return;
        }
      }

      // An upload has not started for the file yet, so we start a new one
      this._createUpload();
    }
  }, {
    key: "abort",
    value: function abort() {
      if (this._xhr !== null) {
        this._xhr.abort();
        this._aborted = true;
      }
    }
  }, {
    key: "_emitXhrError",
    value: function _emitXhrError(xhr, err) {
      err.originalRequest = xhr;
      this._emitError(err);
    }
  }, {
    key: "_emitError",
    value: function _emitError(err) {
      if (typeof this.options.onError === "function") {
        this.options.onError(err);
      } else {
        throw err;
      }
    }
  }, {
    key: "_emitSuccess",
    value: function _emitSuccess() {
      if (typeof this.options.onSuccess === "function") {
        this.options.onSuccess();
      }
    }

    /**
     * Publishes notification when data has been sent to the server. This
     * data may not have been accepted by the server yet.
     * @param  {number} bytesSent  Number of bytes sent to the server.
     * @param  {number} bytesTotal Total number of bytes to be sent to the server.
     */

  }, {
    key: "_emitProgress",
    value: function _emitProgress(bytesSent, bytesTotal) {
      if (typeof this.options.onProgress === "function") {
        this.options.onProgress(bytesSent, bytesTotal);
      }
    }

    /**
     * Publishes notification when a chunk of data has been sent to the server
     * and accepted by the server.
     * @param  {number} chunkSize  Size of the chunk that was accepted by the
     *                             server.
     * @param  {number} bytesAccepted Total number of bytes that have been
     *                                accepted by the server.
     * @param  {number} bytesTotal Total number of bytes to be sent to the server.
     */

  }, {
    key: "_emitChunkComplete",
    value: function _emitChunkComplete(chunkSize, bytesAccepted, bytesTotal) {
      if (typeof this.options.onChunkComplete === "function") {
        this.options.onChunkComplete(chunkSize, bytesAccepted, bytesTotal);
      }
    }

    /**
     * Set the headers used in the request and the withCredentials property
     * as defined in the options
     *
     * @param {XMLHttpRequest} xhr
     */

  }, {
    key: "_setupXHR",
    value: function _setupXHR(xhr) {
      xhr.setRequestHeader("Tus-Resumable", "1.0.0");
      var headers = this.options.headers;

      for (var name in headers) {
        xhr.setRequestHeader(name, headers[name]);
      }

      xhr.withCredentials = this.options.withCredentials;
    }

    /**
     * Create a new upload using the creation extension by sending a POST
     * request to the endpoint. After successful creation the file will be
     * uploaded
     *
     * @api private
     */

  }, {
    key: "_createUpload",
    value: function _createUpload() {
      var _this = this;

      var xhr = new XMLHttpRequest();
      xhr.open("POST", this.options.endpoint, true);

      xhr.onload = function () {
        if (!(xhr.status >= 200 && xhr.status < 300)) {
          _this._emitXhrError(xhr, new Error("tus: unexpected response while creating upload"));
          return;
        }

        _this.url = xhr.getResponseHeader("Location");

        if (_this.options.resume) {
          localStorage.setItem(_this._fingerprint, _this.url);
        }

        _this._offset = 0;
        _this._startUpload();
      };

      xhr.onerror = function () {
        _this._emitXhrError(xhr, new Error("tus: failed to create upload"));
      };

      this._setupXHR(xhr);
      xhr.setRequestHeader("Upload-Length", this.file.size);

      // Add metadata if values have been added
      var metadata = encodeMetadata(this.options.metadata);
      if (metadata !== "") {
        xhr.setRequestHeader("Upload-Metadata", metadata);
      }

      xhr.send(null);
    }

    /*
     * Try to resume an existing upload. First a HEAD request will be sent
     * to retrieve the offset. If the request fails a new upload will be
     * created. In the case of a successful response the file will be uploaded.
     *
     * @api private
     */

  }, {
    key: "_resumeUpload",
    value: function _resumeUpload() {
      var _this2 = this;

      var xhr = new XMLHttpRequest();
      xhr.open("HEAD", this.url, true);

      xhr.onload = function () {
        if (!(xhr.status >= 200 && xhr.status < 300)) {
          if (_this2.options.resume) {
            // Remove stored fingerprint and corresponding endpoint,
            // since the file can not be found
            localStorage.removeItem(_this2._fingerprint);
          }

          // Try to create a new upload
          _this2.url = null;
          _this2._createUpload();
          return;
        }

        var offset = parseInt(xhr.getResponseHeader("Upload-Offset"), 10);
        if (isNaN(offset)) {
          _this2._emitXhrError(xhr, new Error("tus: invalid or missing offset value"));
          return;
        }

        _this2._offset = offset;
        _this2._startUpload();
      };

      xhr.onerror = function () {
        _this2._emitXhrError(xhr, new Error("tus: failed to resume upload"));
      };

      this._setupXHR(xhr);
      xhr.send(null);
    }

    /**
     * Start uploading the file using PATCH requests. The file while be divided
     * into chunks as specified in the chunkSize option. During the upload
     * the onProgress event handler may be invoked multiple times.
     *
     * @api private
     */

  }, {
    key: "_startUpload",
    value: function _startUpload() {
      var _this3 = this;

      var xhr = this._xhr = new XMLHttpRequest();
      xhr.open("PATCH", this.url, true);

      xhr.onload = function () {
        if (!(xhr.status >= 200 && xhr.status < 300)) {
          _this3._emitXhrError(xhr, new Error("tus: unexpected response while creating upload"));
          return;
        }

        var offset = parseInt(xhr.getResponseHeader("Upload-Offset"), 10);
        if (isNaN(offset)) {
          _this3._emitXhrError(xhr, new Error("tus: invalid or missing offset value"));
          return;
        }

        _this3._emitChunkComplete(offset - _this3._offset, offset, _this3.file.size);

        _this3._offset = offset;

        if (offset == _this3.file.size) {
          // Yay, finally done :)
          // Emit a last progress event
          _this3._emitProgress(offset, offset);
          _this3._emitSuccess();
          return;
        }

        _this3._startUpload();
      };

      xhr.onerror = function () {
        // Don't emit an error if the upload was aborted manually
        if (_this3._aborted) {
          return;
        }

        _this3._emitXhrError(xhr, new Error("tus: failed to upload chunk at offset " + _this3._offset));
      };

      // Test support for progress events before attaching an event listener
      if ("upload" in xhr) {
        xhr.upload.onprogress = function (e) {
          if (!e.lengthComputable) {
            return;
          }

          _this3._emitProgress(start + e.loaded, _this3.file.size);
        };
      }

      this._setupXHR(xhr);

      xhr.setRequestHeader("Upload-Offset", this._offset);
      xhr.setRequestHeader("Content-Type", "application/offset+octet-stream");

      var start = this._offset;
      var end = this._offset + this.options.chunkSize;

      if (end === Infinity) {
        end = this.file.size;
      }

      xhr.send(this.file.slice(start, end));
    }
  }]);

  return Upload;
})();

function encodeMetadata(metadata) {
  if (!("btoa" in window)) {
    return "";
  }

  var encoded = [];

  for (var key in metadata) {
    encoded.push(key + " " + btoa(unescape(encodeURIComponent(metadata[key]))));
  }

  return encoded.join(",");
}

Upload.defaultOptions = defaultOptions;

exports.default = Upload;

},{"./fingerprint":1,"extend":4}],4:[function(_dereq_,module,exports){
'use strict';

var hasOwn = Object.prototype.hasOwnProperty;
var toStr = Object.prototype.toString;

var isArray = function isArray(arr) {
	if (typeof Array.isArray === 'function') {
		return Array.isArray(arr);
	}

	return toStr.call(arr) === '[object Array]';
};

var isPlainObject = function isPlainObject(obj) {
	if (!obj || toStr.call(obj) !== '[object Object]') {
		return false;
	}

	var hasOwnConstructor = hasOwn.call(obj, 'constructor');
	var hasIsPrototypeOf = obj.constructor && obj.constructor.prototype && hasOwn.call(obj.constructor.prototype, 'isPrototypeOf');
	// Not own constructor property must be Object
	if (obj.constructor && !hasOwnConstructor && !hasIsPrototypeOf) {
		return false;
	}

	// Own properties are enumerated firstly, so to speed up,
	// if last one is own, then all properties are own.
	var key;
	for (key in obj) {/**/}

	return typeof key === 'undefined' || hasOwn.call(obj, key);
};

module.exports = function extend() {
	var options, name, src, copy, copyIsArray, clone,
		target = arguments[0],
		i = 1,
		length = arguments.length,
		deep = false;

	// Handle a deep copy situation
	if (typeof target === 'boolean') {
		deep = target;
		target = arguments[1] || {};
		// skip the boolean and the target
		i = 2;
	} else if ((typeof target !== 'object' && typeof target !== 'function') || target == null) {
		target = {};
	}

	for (; i < length; ++i) {
		options = arguments[i];
		// Only deal with non-null/undefined values
		if (options != null) {
			// Extend the base object
			for (name in options) {
				src = target[name];
				copy = options[name];

				// Prevent never-ending loop
				if (target !== copy) {
					// Recurse if we're merging plain objects or arrays
					if (deep && copy && (isPlainObject(copy) || (copyIsArray = isArray(copy)))) {
						if (copyIsArray) {
							copyIsArray = false;
							clone = src && isArray(src) ? src : [];
						} else {
							clone = src && isPlainObject(src) ? src : {};
						}

						// Never move original objects, clone them
						target[name] = extend(deep, clone, copy);

					// Don't bring in undefined values
					} else if (typeof copy !== 'undefined') {
						target[name] = copy;
					}
				}
			}
		}
	}

	// Return the modified object
	return target;
};


},{}]},{},[2])(2)
});
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],6:[function(require,module,exports){
(function(self) {
  'use strict';

  if (self.fetch) {
    return
  }

  var support = {
    searchParams: 'URLSearchParams' in self,
    iterable: 'Symbol' in self && 'iterator' in Symbol,
    blob: 'FileReader' in self && 'Blob' in self && (function() {
      try {
        new Blob()
        return true
      } catch(e) {
        return false
      }
    })(),
    formData: 'FormData' in self,
    arrayBuffer: 'ArrayBuffer' in self
  }

  function normalizeName(name) {
    if (typeof name !== 'string') {
      name = String(name)
    }
    if (/[^a-z0-9\-#$%&'*+.\^_`|~]/i.test(name)) {
      throw new TypeError('Invalid character in header field name')
    }
    return name.toLowerCase()
  }

  function normalizeValue(value) {
    if (typeof value !== 'string') {
      value = String(value)
    }
    return value
  }

  // Build a destructive iterator for the value list
  function iteratorFor(items) {
    var iterator = {
      next: function() {
        var value = items.shift()
        return {done: value === undefined, value: value}
      }
    }

    if (support.iterable) {
      iterator[Symbol.iterator] = function() {
        return iterator
      }
    }

    return iterator
  }

  function Headers(headers) {
    this.map = {}

    if (headers instanceof Headers) {
      headers.forEach(function(value, name) {
        this.append(name, value)
      }, this)

    } else if (headers) {
      Object.getOwnPropertyNames(headers).forEach(function(name) {
        this.append(name, headers[name])
      }, this)
    }
  }

  Headers.prototype.append = function(name, value) {
    name = normalizeName(name)
    value = normalizeValue(value)
    var list = this.map[name]
    if (!list) {
      list = []
      this.map[name] = list
    }
    list.push(value)
  }

  Headers.prototype['delete'] = function(name) {
    delete this.map[normalizeName(name)]
  }

  Headers.prototype.get = function(name) {
    var values = this.map[normalizeName(name)]
    return values ? values[0] : null
  }

  Headers.prototype.getAll = function(name) {
    return this.map[normalizeName(name)] || []
  }

  Headers.prototype.has = function(name) {
    return this.map.hasOwnProperty(normalizeName(name))
  }

  Headers.prototype.set = function(name, value) {
    this.map[normalizeName(name)] = [normalizeValue(value)]
  }

  Headers.prototype.forEach = function(callback, thisArg) {
    Object.getOwnPropertyNames(this.map).forEach(function(name) {
      this.map[name].forEach(function(value) {
        callback.call(thisArg, value, name, this)
      }, this)
    }, this)
  }

  Headers.prototype.keys = function() {
    var items = []
    this.forEach(function(value, name) { items.push(name) })
    return iteratorFor(items)
  }

  Headers.prototype.values = function() {
    var items = []
    this.forEach(function(value) { items.push(value) })
    return iteratorFor(items)
  }

  Headers.prototype.entries = function() {
    var items = []
    this.forEach(function(value, name) { items.push([name, value]) })
    return iteratorFor(items)
  }

  if (support.iterable) {
    Headers.prototype[Symbol.iterator] = Headers.prototype.entries
  }

  function consumed(body) {
    if (body.bodyUsed) {
      return Promise.reject(new TypeError('Already read'))
    }
    body.bodyUsed = true
  }

  function fileReaderReady(reader) {
    return new Promise(function(resolve, reject) {
      reader.onload = function() {
        resolve(reader.result)
      }
      reader.onerror = function() {
        reject(reader.error)
      }
    })
  }

  function readBlobAsArrayBuffer(blob) {
    var reader = new FileReader()
    reader.readAsArrayBuffer(blob)
    return fileReaderReady(reader)
  }

  function readBlobAsText(blob) {
    var reader = new FileReader()
    reader.readAsText(blob)
    return fileReaderReady(reader)
  }

  function Body() {
    this.bodyUsed = false

    this._initBody = function(body) {
      this._bodyInit = body
      if (typeof body === 'string') {
        this._bodyText = body
      } else if (support.blob && Blob.prototype.isPrototypeOf(body)) {
        this._bodyBlob = body
      } else if (support.formData && FormData.prototype.isPrototypeOf(body)) {
        this._bodyFormData = body
      } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
        this._bodyText = body.toString()
      } else if (!body) {
        this._bodyText = ''
      } else if (support.arrayBuffer && ArrayBuffer.prototype.isPrototypeOf(body)) {
        // Only support ArrayBuffers for POST method.
        // Receiving ArrayBuffers happens via Blobs, instead.
      } else {
        throw new Error('unsupported BodyInit type')
      }

      if (!this.headers.get('content-type')) {
        if (typeof body === 'string') {
          this.headers.set('content-type', 'text/plain;charset=UTF-8')
        } else if (this._bodyBlob && this._bodyBlob.type) {
          this.headers.set('content-type', this._bodyBlob.type)
        } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
          this.headers.set('content-type', 'application/x-www-form-urlencoded;charset=UTF-8')
        }
      }
    }

    if (support.blob) {
      this.blob = function() {
        var rejected = consumed(this)
        if (rejected) {
          return rejected
        }

        if (this._bodyBlob) {
          return Promise.resolve(this._bodyBlob)
        } else if (this._bodyFormData) {
          throw new Error('could not read FormData body as blob')
        } else {
          return Promise.resolve(new Blob([this._bodyText]))
        }
      }

      this.arrayBuffer = function() {
        return this.blob().then(readBlobAsArrayBuffer)
      }

      this.text = function() {
        var rejected = consumed(this)
        if (rejected) {
          return rejected
        }

        if (this._bodyBlob) {
          return readBlobAsText(this._bodyBlob)
        } else if (this._bodyFormData) {
          throw new Error('could not read FormData body as text')
        } else {
          return Promise.resolve(this._bodyText)
        }
      }
    } else {
      this.text = function() {
        var rejected = consumed(this)
        return rejected ? rejected : Promise.resolve(this._bodyText)
      }
    }

    if (support.formData) {
      this.formData = function() {
        return this.text().then(decode)
      }
    }

    this.json = function() {
      return this.text().then(JSON.parse)
    }

    return this
  }

  // HTTP methods whose capitalization should be normalized
  var methods = ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'POST', 'PUT']

  function normalizeMethod(method) {
    var upcased = method.toUpperCase()
    return (methods.indexOf(upcased) > -1) ? upcased : method
  }

  function Request(input, options) {
    options = options || {}
    var body = options.body
    if (Request.prototype.isPrototypeOf(input)) {
      if (input.bodyUsed) {
        throw new TypeError('Already read')
      }
      this.url = input.url
      this.credentials = input.credentials
      if (!options.headers) {
        this.headers = new Headers(input.headers)
      }
      this.method = input.method
      this.mode = input.mode
      if (!body) {
        body = input._bodyInit
        input.bodyUsed = true
      }
    } else {
      this.url = input
    }

    this.credentials = options.credentials || this.credentials || 'omit'
    if (options.headers || !this.headers) {
      this.headers = new Headers(options.headers)
    }
    this.method = normalizeMethod(options.method || this.method || 'GET')
    this.mode = options.mode || this.mode || null
    this.referrer = null

    if ((this.method === 'GET' || this.method === 'HEAD') && body) {
      throw new TypeError('Body not allowed for GET or HEAD requests')
    }
    this._initBody(body)
  }

  Request.prototype.clone = function() {
    return new Request(this)
  }

  function decode(body) {
    var form = new FormData()
    body.trim().split('&').forEach(function(bytes) {
      if (bytes) {
        var split = bytes.split('=')
        var name = split.shift().replace(/\+/g, ' ')
        var value = split.join('=').replace(/\+/g, ' ')
        form.append(decodeURIComponent(name), decodeURIComponent(value))
      }
    })
    return form
  }

  function headers(xhr) {
    var head = new Headers()
    var pairs = (xhr.getAllResponseHeaders() || '').trim().split('\n')
    pairs.forEach(function(header) {
      var split = header.trim().split(':')
      var key = split.shift().trim()
      var value = split.join(':').trim()
      head.append(key, value)
    })
    return head
  }

  Body.call(Request.prototype)

  function Response(bodyInit, options) {
    if (!options) {
      options = {}
    }

    this.type = 'default'
    this.status = options.status
    this.ok = this.status >= 200 && this.status < 300
    this.statusText = options.statusText
    this.headers = options.headers instanceof Headers ? options.headers : new Headers(options.headers)
    this.url = options.url || ''
    this._initBody(bodyInit)
  }

  Body.call(Response.prototype)

  Response.prototype.clone = function() {
    return new Response(this._bodyInit, {
      status: this.status,
      statusText: this.statusText,
      headers: new Headers(this.headers),
      url: this.url
    })
  }

  Response.error = function() {
    var response = new Response(null, {status: 0, statusText: ''})
    response.type = 'error'
    return response
  }

  var redirectStatuses = [301, 302, 303, 307, 308]

  Response.redirect = function(url, status) {
    if (redirectStatuses.indexOf(status) === -1) {
      throw new RangeError('Invalid status code')
    }

    return new Response(null, {status: status, headers: {location: url}})
  }

  self.Headers = Headers
  self.Request = Request
  self.Response = Response

  self.fetch = function(input, init) {
    return new Promise(function(resolve, reject) {
      var request
      if (Request.prototype.isPrototypeOf(input) && !init) {
        request = input
      } else {
        request = new Request(input, init)
      }

      var xhr = new XMLHttpRequest()

      function responseURL() {
        if ('responseURL' in xhr) {
          return xhr.responseURL
        }

        // Avoid security warnings on getResponseHeader when not allowed by CORS
        if (/^X-Request-URL:/m.test(xhr.getAllResponseHeaders())) {
          return xhr.getResponseHeader('X-Request-URL')
        }

        return
      }

      xhr.onload = function() {
        var options = {
          status: xhr.status,
          statusText: xhr.statusText,
          headers: headers(xhr),
          url: responseURL()
        }
        var body = 'response' in xhr ? xhr.response : xhr.responseText
        resolve(new Response(body, options))
      }

      xhr.onerror = function() {
        reject(new TypeError('Network request failed'))
      }

      xhr.ontimeout = function() {
        reject(new TypeError('Network request failed'))
      }

      xhr.open(request.method, request.url, true)

      if (request.credentials === 'include') {
        xhr.withCredentials = true
      }

      if ('responseType' in xhr && support.blob) {
        xhr.responseType = 'blob'
      }

      request.headers.forEach(function(value, name) {
        xhr.setRequestHeader(name, value)
      })

      xhr.send(typeof request._bodyInit === 'undefined' ? null : request._bodyInit)
    })
  }
  self.fetch.polyfill = true
})(typeof self !== 'undefined' ? self : this);

},{}],7:[function(require,module,exports){
var bel = require('bel') // turns template tag into DOM elements
var morphdom = require('morphdom') // efficiently diffs + morphs two DOM elements
var defaultEvents = require('./update-events.js') // default events to be copied when dom elements update

module.exports = bel

// TODO move this + defaultEvents to a new module once we receive more feedback
module.exports.update = function (fromNode, toNode, opts) {
  if (!opts) opts = {}
  if (opts.events !== false) {
    if (!opts.onBeforeMorphEl) opts.onBeforeMorphEl = copier
  }

  return morphdom(fromNode, toNode, opts)

  // morphdom only copies attributes. we decided we also wanted to copy events
  // that can be set via attributes
  function copier (f, t) {
    // copy events:
    var events = opts.events || defaultEvents
    for (var i = 0; i < events.length; i++) {
      var ev = events[i]
      if (t[ev]) { // if new element has a whitelisted attribute
        f[ev] = t[ev] // update existing element
      } else if (f[ev]) { // if existing element has it and new one doesnt
        f[ev] = undefined // remove it from existing element
      }
    }
    // copy values for form elements
    if (f.nodeName === 'INPUT' || f.nodeName === 'TEXTAREA' || f.nodeNAME === 'SELECT') {
      if (t.getAttribute('value') === null) t.value = f.value
    }
  }
}

},{"./update-events.js":13,"bel":8,"morphdom":12}],8:[function(require,module,exports){
var document = require('global/document')
var hyperx = require('hyperx')

var SVGNS = 'http://www.w3.org/2000/svg'
var BOOL_PROPS = {
  autofocus: 1,
  checked: 1,
  defaultchecked: 1,
  disabled: 1,
  formnovalidate: 1,
  indeterminate: 1,
  readonly: 1,
  required: 1,
  willvalidate: 1
}
var SVG_TAGS = [
  'svg',
  'altGlyph', 'altGlyphDef', 'altGlyphItem', 'animate', 'animateColor',
  'animateMotion', 'animateTransform', 'circle', 'clipPath', 'color-profile',
  'cursor', 'defs', 'desc', 'ellipse', 'feBlend', 'feColorMatrix',
  'feComponentTransfer', 'feComposite', 'feConvolveMatrix', 'feDiffuseLighting',
  'feDisplacementMap', 'feDistantLight', 'feFlood', 'feFuncA', 'feFuncB',
  'feFuncG', 'feFuncR', 'feGaussianBlur', 'feImage', 'feMerge', 'feMergeNode',
  'feMorphology', 'feOffset', 'fePointLight', 'feSpecularLighting',
  'feSpotLight', 'feTile', 'feTurbulence', 'filter', 'font', 'font-face',
  'font-face-format', 'font-face-name', 'font-face-src', 'font-face-uri',
  'foreignObject', 'g', 'glyph', 'glyphRef', 'hkern', 'image', 'line',
  'linearGradient', 'marker', 'mask', 'metadata', 'missing-glyph', 'mpath',
  'path', 'pattern', 'polygon', 'polyline', 'radialGradient', 'rect',
  'set', 'stop', 'switch', 'symbol', 'text', 'textPath', 'title', 'tref',
  'tspan', 'use', 'view', 'vkern'
]

function belCreateElement (tag, props, children) {
  var el

  // If an svg tag, it needs a namespace
  if (SVG_TAGS.indexOf(tag) !== -1) {
    props.namespace = SVGNS
  }

  // If we are using a namespace
  var ns = false
  if (props.namespace) {
    ns = props.namespace
    delete props.namespace
  }

  // Create the element
  if (ns) {
    el = document.createElementNS(ns, tag)
  } else {
    el = document.createElement(tag)
  }

  // Create the properties
  for (var p in props) {
    if (props.hasOwnProperty(p)) {
      var key = p.toLowerCase()
      var val = props[p]
      // Normalize className
      if (key === 'classname') {
        key = 'class'
        p = 'class'
      }
      // If a property is boolean, set itself to the key
      if (BOOL_PROPS[key]) {
        if (val === 'true') val = key
        else if (val === 'false') continue
      }
      // If a property prefers being set directly vs setAttribute
      if (key.slice(0, 2) === 'on') {
        el[p] = val
      } else {
        if (ns) {
          el.setAttributeNS(null, p, val)
        } else {
          el.setAttribute(p, val)
        }
      }
    }
  }

  function appendChild (childs) {
    if (!Array.isArray(childs)) return
    for (var i = 0; i < childs.length; i++) {
      var node = childs[i]
      if (Array.isArray(node)) {
        appendChild(node)
        continue
      }

      if (typeof node === 'number' ||
        typeof node === 'boolean' ||
        node instanceof Date ||
        node instanceof RegExp) {
        node = node.toString()
      }

      if (typeof node === 'string') {
        if (el.lastChild && el.lastChild.nodeName === '#text') {
          el.lastChild.nodeValue += node
          continue
        }
        node = document.createTextNode(node)
      }

      if (node && node.nodeType) {
        el.appendChild(node)
      }
    }
  }
  appendChild(children)

  return el
}

module.exports = hyperx(belCreateElement)
module.exports.createElement = belCreateElement

},{"global/document":9,"hyperx":10}],9:[function(require,module,exports){
(function (global){
var topLevel = typeof global !== 'undefined' ? global :
    typeof window !== 'undefined' ? window : {}
var minDoc = require('min-document');

if (typeof document !== 'undefined') {
    module.exports = document;
} else {
    var doccy = topLevel['__GLOBAL_DOCUMENT_CACHE@4'];

    if (!doccy) {
        doccy = topLevel['__GLOBAL_DOCUMENT_CACHE@4'] = minDoc;
    }

    module.exports = doccy;
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"min-document":34}],10:[function(require,module,exports){
var attrToProp = require('hyperscript-attribute-to-property')

var VAR = 0, TEXT = 1, OPEN = 2, CLOSE = 3, ATTR = 4
var ATTR_KEY = 5, ATTR_KEY_W = 6
var ATTR_VALUE_W = 7, ATTR_VALUE = 8
var ATTR_VALUE_SQ = 9, ATTR_VALUE_DQ = 10
var ATTR_EQ = 11, ATTR_BREAK = 12

module.exports = function (h, opts) {
  h = attrToProp(h)
  if (!opts) opts = {}
  var concat = opts.concat || function (a, b) {
    return String(a) + String(b)
  }

  return function (strings) {
    var state = TEXT, reg = ''
    var arglen = arguments.length
    var parts = []

    for (var i = 0; i < strings.length; i++) {
      if (i < arglen - 1) {
        var arg = arguments[i+1]
        var p = parse(strings[i])
        var xstate = state
        if (xstate === ATTR_VALUE_DQ) xstate = ATTR_VALUE
        if (xstate === ATTR_VALUE_SQ) xstate = ATTR_VALUE
        if (xstate === ATTR_VALUE_W) xstate = ATTR_VALUE
        if (xstate === ATTR) xstate = ATTR_KEY
        p.push([ VAR, xstate, arg ])
        parts.push.apply(parts, p)
      } else parts.push.apply(parts, parse(strings[i]))
    }

    var tree = [null,{},[]]
    var stack = [[tree,-1]]
    for (var i = 0; i < parts.length; i++) {
      var cur = stack[stack.length-1][0]
      var p = parts[i], s = p[0]
      if (s === OPEN && /^\//.test(p[1])) {
        var ix = stack[stack.length-1][1]
        if (stack.length > 1) {
          stack.pop()
          stack[stack.length-1][0][2][ix] = h(
            cur[0], cur[1], cur[2].length ? cur[2] : undefined
          )
        }
      } else if (s === OPEN) {
        var c = [p[1],{},[]]
        cur[2].push(c)
        stack.push([c,cur[2].length-1])
      } else if (s === ATTR_KEY || (s === VAR && p[1] === ATTR_KEY)) {
        var key = ''
        var copyKey
        for (; i < parts.length; i++) {
          if (parts[i][0] === ATTR_KEY) {
            key = concat(key, parts[i][1])
          } else if (parts[i][0] === VAR && parts[i][1] === ATTR_KEY) {
            if (typeof parts[i][2] === 'object' && !key) {
              for (copyKey in parts[i][2]) {
                if (parts[i][2].hasOwnProperty(copyKey) && !cur[1][copyKey]) {
                  cur[1][copyKey] = parts[i][2][copyKey]
                }
              }
            } else {
              key = concat(key, parts[i][2])
            }
          } else break
        }
        if (parts[i][0] === ATTR_EQ) i++
        var j = i
        for (; i < parts.length; i++) {
          if (parts[i][0] === ATTR_VALUE || parts[i][0] === ATTR_KEY) {
            if (!cur[1][key]) cur[1][key] = strfn(parts[i][1])
            else cur[1][key] = concat(cur[1][key], parts[i][1])
          } else if (parts[i][0] === VAR
          && (parts[i][1] === ATTR_VALUE || parts[i][1] === ATTR_KEY)) {
            if (!cur[1][key]) cur[1][key] = strfn(parts[i][2])
            else cur[1][key] = concat(cur[1][key], parts[i][2])
          } else {
            if (key.length && !cur[1][key] && i === j
            && (parts[i][0] === CLOSE || parts[i][0] === ATTR_BREAK)) {
              // https://html.spec.whatwg.org/multipage/infrastructure.html#boolean-attributes
              // empty string is falsy, not well behaved value in browser
              cur[1][key] = key.toLowerCase()
            }
            break
          }
        }
      } else if (s === ATTR_KEY) {
        cur[1][p[1]] = true
      } else if (s === VAR && p[1] === ATTR_KEY) {
        cur[1][p[2]] = true
      } else if (s === CLOSE) {
        if (selfClosing(cur[0]) && stack.length) {
          var ix = stack[stack.length-1][1]
          stack.pop()
          stack[stack.length-1][0][2][ix] = h(
            cur[0], cur[1], cur[2].length ? cur[2] : undefined
          )
        }
      } else if (s === VAR && p[1] === TEXT) {
        if (p[2] === undefined || p[2] === null) p[2] = ''
        else if (!p[2]) p[2] = concat('', p[2])
        if (Array.isArray(p[2][0])) {
          cur[2].push.apply(cur[2], p[2])
        } else {
          cur[2].push(p[2])
        }
      } else if (s === TEXT) {
        cur[2].push(p[1])
      } else if (s === ATTR_EQ || s === ATTR_BREAK) {
        // no-op
      } else {
        throw new Error('unhandled: ' + s)
      }
    }

    if (tree[2].length > 1 && /^\s*$/.test(tree[2][0])) {
      tree[2].shift()
    }

    if (tree[2].length > 2
    || (tree[2].length === 2 && /\S/.test(tree[2][1]))) {
      throw new Error(
        'multiple root elements must be wrapped in an enclosing tag'
      )
    }
    if (Array.isArray(tree[2][0]) && typeof tree[2][0][0] === 'string'
    && Array.isArray(tree[2][0][2])) {
      tree[2][0] = h(tree[2][0][0], tree[2][0][1], tree[2][0][2])
    }
    return tree[2][0]

    function parse (str) {
      var res = []
      if (state === ATTR_VALUE_W) state = ATTR
      for (var i = 0; i < str.length; i++) {
        var c = str.charAt(i)
        if (state === TEXT && c === '<') {
          if (reg.length) res.push([TEXT, reg])
          reg = ''
          state = OPEN
        } else if (c === '>' && !quot(state)) {
          if (state === OPEN) {
            res.push([OPEN,reg])
          } else if (state === ATTR_KEY) {
            res.push([ATTR_KEY,reg])
          } else if (state === ATTR_VALUE && reg.length) {
            res.push([ATTR_VALUE,reg])
          }
          res.push([CLOSE])
          reg = ''
          state = TEXT
        } else if (state === TEXT) {
          reg += c
        } else if (state === OPEN && /\s/.test(c)) {
          res.push([OPEN, reg])
          reg = ''
          state = ATTR
        } else if (state === OPEN) {
          reg += c
        } else if (state === ATTR && /[\w-]/.test(c)) {
          state = ATTR_KEY
          reg = c
        } else if (state === ATTR && /\s/.test(c)) {
          if (reg.length) res.push([ATTR_KEY,reg])
          res.push([ATTR_BREAK])
        } else if (state === ATTR_KEY && /\s/.test(c)) {
          res.push([ATTR_KEY,reg])
          reg = ''
          state = ATTR_KEY_W
        } else if (state === ATTR_KEY && c === '=') {
          res.push([ATTR_KEY,reg],[ATTR_EQ])
          reg = ''
          state = ATTR_VALUE_W
        } else if (state === ATTR_KEY) {
          reg += c
        } else if ((state === ATTR_KEY_W || state === ATTR) && c === '=') {
          res.push([ATTR_EQ])
          state = ATTR_VALUE_W
        } else if ((state === ATTR_KEY_W || state === ATTR) && !/\s/.test(c)) {
          res.push([ATTR_BREAK])
          if (/[\w-]/.test(c)) {
            reg += c
            state = ATTR_KEY
          } else state = ATTR
        } else if (state === ATTR_VALUE_W && c === '"') {
          state = ATTR_VALUE_DQ
        } else if (state === ATTR_VALUE_W && c === "'") {
          state = ATTR_VALUE_SQ
        } else if (state === ATTR_VALUE_DQ && c === '"') {
          res.push([ATTR_VALUE,reg],[ATTR_BREAK])
          reg = ''
          state = ATTR
        } else if (state === ATTR_VALUE_SQ && c === "'") {
          res.push([ATTR_VALUE,reg],[ATTR_BREAK])
          reg = ''
          state = ATTR
        } else if (state === ATTR_VALUE_W && !/\s/.test(c)) {
          state = ATTR_VALUE
          i--
        } else if (state === ATTR_VALUE && /\s/.test(c)) {
          res.push([ATTR_BREAK],[ATTR_VALUE,reg])
          reg = ''
          state = ATTR
        } else if (state === ATTR_VALUE || state === ATTR_VALUE_SQ
        || state === ATTR_VALUE_DQ) {
          reg += c
        }
      }
      if (state === TEXT && reg.length) {
        res.push([TEXT,reg])
        reg = ''
      } else if (state === ATTR_VALUE && reg.length) {
        res.push([ATTR_VALUE,reg])
        reg = ''
      } else if (state === ATTR_VALUE_DQ && reg.length) {
        res.push([ATTR_VALUE,reg])
        reg = ''
      } else if (state === ATTR_VALUE_SQ && reg.length) {
        res.push([ATTR_VALUE,reg])
        reg = ''
      } else if (state === ATTR_KEY) {
        res.push([ATTR_KEY,reg])
        reg = ''
      }
      return res
    }
  }

  function strfn (x) {
    if (typeof x === 'function') return x
    else if (typeof x === 'string') return x
    else if (x && typeof x === 'object') return x
    else return concat('', x)
  }
}

function quot (state) {
  return state === ATTR_VALUE_SQ || state === ATTR_VALUE_DQ
}

var hasOwn = Object.prototype.hasOwnProperty
function has (obj, key) { return hasOwn.call(obj, key) }

var closeRE = RegExp('^(' + [
  'area', 'base', 'basefont', 'bgsound', 'br', 'col', 'command', 'embed',
  'frame', 'hr', 'img', 'input', 'isindex', 'keygen', 'link', 'meta', 'param',
  'source', 'track', 'wbr',
  // SVG TAGS
  'animate', 'animateTransform', 'circle', 'cursor', 'desc', 'ellipse',
  'feBlend', 'feColorMatrix', 'feComponentTransfer', 'feComposite',
  'feConvolveMatrix', 'feDiffuseLighting', 'feDisplacementMap',
  'feDistantLight', 'feFlood', 'feFuncA', 'feFuncB', 'feFuncG', 'feFuncR',
  'feGaussianBlur', 'feImage', 'feMergeNode', 'feMorphology',
  'feOffset', 'fePointLight', 'feSpecularLighting', 'feSpotLight', 'feTile',
  'feTurbulence', 'font-face-format', 'font-face-name', 'font-face-uri',
  'glyph', 'glyphRef', 'hkern', 'image', 'line', 'missing-glyph', 'mpath',
  'path', 'polygon', 'polyline', 'rect', 'set', 'stop', 'tref', 'use', 'view',
  'vkern'
].join('|') + ')(?:[\.#][a-zA-Z0-9\u007F-\uFFFF_:-]+)*$')
function selfClosing (tag) { return closeRE.test(tag) }

},{"hyperscript-attribute-to-property":11}],11:[function(require,module,exports){
module.exports = attributeToProperty

var transform = {
  'class': 'className',
  'for': 'htmlFor',
  'http-equiv': 'httpEquiv'
}

function attributeToProperty (h) {
  return function (tagName, attrs, children) {
    for (var attr in attrs) {
      if (attr in transform) {
        attrs[transform[attr]] = attrs[attr]
        delete attrs[attr]
      }
    }
    return h(tagName, attrs, children)
  }
}

},{}],12:[function(require,module,exports){
// Create a range object for efficently rendering strings to elements.
var range;

var testEl = (typeof document !== 'undefined') ?
    document.body || document.createElement('div') :
    {};

var XHTML = 'http://www.w3.org/1999/xhtml';
var ELEMENT_NODE = 1;
var TEXT_NODE = 3;

// Fixes <https://github.com/patrick-steele-idem/morphdom/issues/32>
// (IE7+ support) <=IE7 does not support el.hasAttribute(name)
var hasAttributeNS;

if (testEl.hasAttributeNS) {
    hasAttributeNS = function(el, namespaceURI, name) {
        return el.hasAttributeNS(namespaceURI, name);
    };
} else if (testEl.hasAttribute) {
    hasAttributeNS = function(el, namespaceURI, name) {
        return el.hasAttribute(name);
    };
} else {
    hasAttributeNS = function(el, namespaceURI, name) {
        return !!el.getAttributeNode(name);
    };
}

function empty(o) {
    for (var k in o) {
        if (o.hasOwnProperty(k)) {
            return false;
        }
    }
    return true;
}

function toElement(str) {
    if (!range && document.createRange) {
        range = document.createRange();
        range.selectNode(document.body);
    }

    var fragment;
    if (range && range.createContextualFragment) {
        fragment = range.createContextualFragment(str);
    } else {
        fragment = document.createElement('body');
        fragment.innerHTML = str;
    }
    return fragment.childNodes[0];
}

var specialElHandlers = {
    /**
     * Needed for IE. Apparently IE doesn't think that "selected" is an
     * attribute when reading over the attributes using selectEl.attributes
     */
    OPTION: function(fromEl, toEl) {
        fromEl.selected = toEl.selected;
        if (fromEl.selected) {
            fromEl.setAttribute('selected', '');
        } else {
            fromEl.removeAttribute('selected', '');
        }
    },
    /**
     * The "value" attribute is special for the <input> element since it sets
     * the initial value. Changing the "value" attribute without changing the
     * "value" property will have no effect since it is only used to the set the
     * initial value.  Similar for the "checked" attribute, and "disabled".
     */
    INPUT: function(fromEl, toEl) {
        fromEl.checked = toEl.checked;
        if (fromEl.checked) {
            fromEl.setAttribute('checked', '');
        } else {
            fromEl.removeAttribute('checked');
        }

        if (fromEl.value !== toEl.value) {
            fromEl.value = toEl.value;
        }

        if (!hasAttributeNS(toEl, null, 'value')) {
            fromEl.removeAttribute('value');
        }

        fromEl.disabled = toEl.disabled;
        if (fromEl.disabled) {
            fromEl.setAttribute('disabled', '');
        } else {
            fromEl.removeAttribute('disabled');
        }
    },

    TEXTAREA: function(fromEl, toEl) {
        var newValue = toEl.value;
        if (fromEl.value !== newValue) {
            fromEl.value = newValue;
        }

        if (fromEl.firstChild) {
            fromEl.firstChild.nodeValue = newValue;
        }
    }
};

function noop() {}

/**
 * Returns true if two node's names and namespace URIs are the same.
 *
 * @param {Element} a
 * @param {Element} b
 * @return {boolean}
 */
var compareNodeNames = function(a, b) {
    return a.nodeName === b.nodeName &&
           a.namespaceURI === b.namespaceURI;
};

/**
 * Create an element, optionally with a known namespace URI.
 *
 * @param {string} name the element name, e.g. 'div' or 'svg'
 * @param {string} [namespaceURI] the element's namespace URI, i.e. the value of
 * its `xmlns` attribute or its inferred namespace.
 *
 * @return {Element}
 */
function createElementNS(name, namespaceURI) {
    return !namespaceURI || namespaceURI === XHTML ?
        document.createElement(name) :
        document.createElementNS(namespaceURI, name);
}

/**
 * Loop over all of the attributes on the target node and make sure the original
 * DOM node has the same attributes. If an attribute found on the original node
 * is not on the new node then remove it from the original node.
 *
 * @param  {Element} fromNode
 * @param  {Element} toNode
 */
function morphAttrs(fromNode, toNode) {
    var attrs = toNode.attributes;
    var i;
    var attr;
    var attrName;
    var attrNamespaceURI;
    var attrValue;
    var fromValue;

    for (i = attrs.length - 1; i >= 0; i--) {
        attr = attrs[i];
        attrName = attr.name;
        attrValue = attr.value;
        attrNamespaceURI = attr.namespaceURI;

        if (attrNamespaceURI) {
            attrName = attr.localName || attrName;
            fromValue = fromNode.getAttributeNS(attrNamespaceURI, attrName);
        } else {
            fromValue = fromNode.getAttribute(attrName);
        }

        if (fromValue !== attrValue) {
            if (attrNamespaceURI) {
                fromNode.setAttributeNS(attrNamespaceURI, attrName, attrValue);
            } else {
                fromNode.setAttribute(attrName, attrValue);
            }
        }
    }

    // Remove any extra attributes found on the original DOM element that
    // weren't found on the target element.
    attrs = fromNode.attributes;

    for (i = attrs.length - 1; i >= 0; i--) {
        attr = attrs[i];
        if (attr.specified !== false) {
            attrName = attr.name;
            attrNamespaceURI = attr.namespaceURI;

            if (!hasAttributeNS(toNode, attrNamespaceURI, attrNamespaceURI ? attrName = attr.localName || attrName : attrName)) {
                fromNode.removeAttributeNode(attr);
            }
        }
    }
}

/**
 * Copies the children of one DOM element to another DOM element
 */
function moveChildren(fromEl, toEl) {
    var curChild = fromEl.firstChild;
    while (curChild) {
        var nextChild = curChild.nextSibling;
        toEl.appendChild(curChild);
        curChild = nextChild;
    }
    return toEl;
}

function defaultGetNodeKey(node) {
    return node.id;
}

function morphdom(fromNode, toNode, options) {
    if (!options) {
        options = {};
    }

    if (typeof toNode === 'string') {
        if (fromNode.nodeName === '#document' || fromNode.nodeName === 'HTML') {
            var toNodeHtml = toNode;
            toNode = document.createElement('html');
            toNode.innerHTML = toNodeHtml;
        } else {
            toNode = toElement(toNode);
        }
    }

    // XXX optimization: if the nodes are equal, don't morph them
    /*
    if (fromNode.isEqualNode(toNode)) {
      return fromNode;
    }
    */

    var savedEls = {}; // Used to save off DOM elements with IDs
    var unmatchedEls = {};
    var getNodeKey = options.getNodeKey || defaultGetNodeKey;
    var onBeforeNodeAdded = options.onBeforeNodeAdded || noop;
    var onNodeAdded = options.onNodeAdded || noop;
    var onBeforeElUpdated = options.onBeforeElUpdated || options.onBeforeMorphEl || noop;
    var onElUpdated = options.onElUpdated || noop;
    var onBeforeNodeDiscarded = options.onBeforeNodeDiscarded || noop;
    var onNodeDiscarded = options.onNodeDiscarded || noop;
    var onBeforeElChildrenUpdated = options.onBeforeElChildrenUpdated || options.onBeforeMorphElChildren || noop;
    var childrenOnly = options.childrenOnly === true;
    var movedEls = [];

    function removeNodeHelper(node, nestedInSavedEl) {
        var id = getNodeKey(node);
        // If the node has an ID then save it off since we will want
        // to reuse it in case the target DOM tree has a DOM element
        // with the same ID
        if (id) {
            savedEls[id] = node;
        } else if (!nestedInSavedEl) {
            // If we are not nested in a saved element then we know that this node has been
            // completely discarded and will not exist in the final DOM.
            onNodeDiscarded(node);
        }

        if (node.nodeType === ELEMENT_NODE) {
            var curChild = node.firstChild;
            while (curChild) {
                removeNodeHelper(curChild, nestedInSavedEl || id);
                curChild = curChild.nextSibling;
            }
        }
    }

    function walkDiscardedChildNodes(node) {
        if (node.nodeType === ELEMENT_NODE) {
            var curChild = node.firstChild;
            while (curChild) {


                if (!getNodeKey(curChild)) {
                    // We only want to handle nodes that don't have an ID to avoid double
                    // walking the same saved element.

                    onNodeDiscarded(curChild);

                    // Walk recursively
                    walkDiscardedChildNodes(curChild);
                }

                curChild = curChild.nextSibling;
            }
        }
    }

    function removeNode(node, parentNode, alreadyVisited) {
        if (onBeforeNodeDiscarded(node) === false) {
            return;
        }

        parentNode.removeChild(node);
        if (alreadyVisited) {
            if (!getNodeKey(node)) {
                onNodeDiscarded(node);
                walkDiscardedChildNodes(node);
            }
        } else {
            removeNodeHelper(node);
        }
    }

    function morphEl(fromEl, toEl, alreadyVisited, childrenOnly) {
        var toElKey = getNodeKey(toEl);
        if (toElKey) {
            // If an element with an ID is being morphed then it is will be in the final
            // DOM so clear it out of the saved elements collection
            delete savedEls[toElKey];
        }

        if (!childrenOnly) {
            if (onBeforeElUpdated(fromEl, toEl) === false) {
                return;
            }

            morphAttrs(fromEl, toEl);
            onElUpdated(fromEl);

            if (onBeforeElChildrenUpdated(fromEl, toEl) === false) {
                return;
            }
        }

        if (fromEl.nodeName !== 'TEXTAREA') {
            var curToNodeChild = toEl.firstChild;
            var curFromNodeChild = fromEl.firstChild;
            var curToNodeId;

            var fromNextSibling;
            var toNextSibling;
            var savedEl;
            var unmatchedEl;

            outer: while (curToNodeChild) {
                toNextSibling = curToNodeChild.nextSibling;
                curToNodeId = getNodeKey(curToNodeChild);

                while (curFromNodeChild) {
                    var curFromNodeId = getNodeKey(curFromNodeChild);
                    fromNextSibling = curFromNodeChild.nextSibling;

                    if (!alreadyVisited) {
                        if (curFromNodeId && (unmatchedEl = unmatchedEls[curFromNodeId])) {
                            unmatchedEl.parentNode.replaceChild(curFromNodeChild, unmatchedEl);
                            morphEl(curFromNodeChild, unmatchedEl, alreadyVisited);
                            curFromNodeChild = fromNextSibling;
                            continue;
                        }
                    }

                    var curFromNodeType = curFromNodeChild.nodeType;

                    if (curFromNodeType === curToNodeChild.nodeType) {
                        var isCompatible = false;

                        // Both nodes being compared are Element nodes
                        if (curFromNodeType === ELEMENT_NODE) {
                            if (compareNodeNames(curFromNodeChild, curToNodeChild)) {
                                // We have compatible DOM elements
                                if (curFromNodeId || curToNodeId) {
                                    // If either DOM element has an ID then we
                                    // handle those differently since we want to
                                    // match up by ID
                                    if (curToNodeId === curFromNodeId) {
                                        isCompatible = true;
                                    }
                                } else {
                                    isCompatible = true;
                                }
                            }

                            if (isCompatible) {
                                // We found compatible DOM elements so transform
                                // the current "from" node to match the current
                                // target DOM node.
                                morphEl(curFromNodeChild, curToNodeChild, alreadyVisited);
                            }
                        // Both nodes being compared are Text nodes
                    } else if (curFromNodeType === TEXT_NODE) {
                            isCompatible = true;
                            // Simply update nodeValue on the original node to
                            // change the text value
                            curFromNodeChild.nodeValue = curToNodeChild.nodeValue;
                        }

                        if (isCompatible) {
                            curToNodeChild = toNextSibling;
                            curFromNodeChild = fromNextSibling;
                            continue outer;
                        }
                    }

                    // No compatible match so remove the old node from the DOM
                    // and continue trying to find a match in the original DOM
                    removeNode(curFromNodeChild, fromEl, alreadyVisited);
                    curFromNodeChild = fromNextSibling;
                }

                if (curToNodeId) {
                    if ((savedEl = savedEls[curToNodeId])) {
                        morphEl(savedEl, curToNodeChild, true);
                        // We want to append the saved element instead
                        curToNodeChild = savedEl;
                    } else {
                        // The current DOM element in the target tree has an ID
                        // but we did not find a match in any of the
                        // corresponding siblings. We just put the target
                        // element in the old DOM tree but if we later find an
                        // element in the old DOM tree that has a matching ID
                        // then we will replace the target element with the
                        // corresponding old element and morph the old element
                        unmatchedEls[curToNodeId] = curToNodeChild;
                    }
                }

                // If we got this far then we did not find a candidate match for
                // our "to node" and we exhausted all of the children "from"
                // nodes. Therefore, we will just append the current "to node"
                // to the end
                if (onBeforeNodeAdded(curToNodeChild) !== false) {
                    fromEl.appendChild(curToNodeChild);
                    onNodeAdded(curToNodeChild);
                }

                if (curToNodeChild.nodeType === ELEMENT_NODE &&
                    (curToNodeId || curToNodeChild.firstChild)) {
                    // The element that was just added to the original DOM may
                    // have some nested elements with a key/ID that needs to be
                    // matched up with other elements. We'll add the element to
                    // a list so that we can later process the nested elements
                    // if there are any unmatched keyed elements that were
                    // discarded
                    movedEls.push(curToNodeChild);
                }

                curToNodeChild = toNextSibling;
                curFromNodeChild = fromNextSibling;
            }

            // We have processed all of the "to nodes". If curFromNodeChild is
            // non-null then we still have some from nodes left over that need
            // to be removed
            while (curFromNodeChild) {
                fromNextSibling = curFromNodeChild.nextSibling;
                removeNode(curFromNodeChild, fromEl, alreadyVisited);
                curFromNodeChild = fromNextSibling;
            }
        }

        var specialElHandler = specialElHandlers[fromEl.nodeName];
        if (specialElHandler) {
            specialElHandler(fromEl, toEl);
        }
    } // END: morphEl(...)

    var morphedNode = fromNode;
    var morphedNodeType = morphedNode.nodeType;
    var toNodeType = toNode.nodeType;

    if (!childrenOnly) {
        // Handle the case where we are given two DOM nodes that are not
        // compatible (e.g. <div> --> <span> or <div> --> TEXT)
        if (morphedNodeType === ELEMENT_NODE) {
            if (toNodeType === ELEMENT_NODE) {
                if (!compareNodeNames(fromNode, toNode)) {
                    onNodeDiscarded(fromNode);
                    morphedNode = moveChildren(fromNode, createElementNS(toNode.nodeName, toNode.namespaceURI));
                }
            } else {
                // Going from an element node to a text node
                morphedNode = toNode;
            }
        } else if (morphedNodeType === TEXT_NODE) { // Text node
            if (toNodeType === TEXT_NODE) {
                morphedNode.nodeValue = toNode.nodeValue;
                return morphedNode;
            } else {
                // Text node to something else
                morphedNode = toNode;
            }
        }
    }

    if (morphedNode === toNode) {
        // The "to node" was not compatible with the "from node" so we had to
        // toss out the "from node" and use the "to node"
        onNodeDiscarded(fromNode);
    } else {
        morphEl(morphedNode, toNode, false, childrenOnly);

        /**
         * What we will do here is walk the tree for the DOM element that was
         * moved from the target DOM tree to the original DOM tree and we will
         * look for keyed elements that could be matched to keyed elements that
         * were earlier discarded.  If we find a match then we will move the
         * saved element into the final DOM tree.
         */
        var handleMovedEl = function(el) {
            var curChild = el.firstChild;
            while (curChild) {
                var nextSibling = curChild.nextSibling;

                var key = getNodeKey(curChild);
                if (key) {
                    var savedEl = savedEls[key];
                    if (savedEl && compareNodeNames(curChild, savedEl)) {
                        curChild.parentNode.replaceChild(savedEl, curChild);
                        // true: already visited the saved el tree
                        morphEl(savedEl, curChild, true);
                        curChild = nextSibling;
                        if (empty(savedEls)) {
                            return false;
                        }
                        continue;
                    }
                }

                if (curChild.nodeType === ELEMENT_NODE) {
                    handleMovedEl(curChild);
                }

                curChild = nextSibling;
            }
        };

        // The loop below is used to possibly match up any discarded
        // elements in the original DOM tree with elemenets from the
        // target tree that were moved over without visiting their
        // children
        if (!empty(savedEls)) {
            handleMovedElsLoop:
            while (movedEls.length) {
                var movedElsTemp = movedEls;
                movedEls = [];
                for (var i=0; i<movedElsTemp.length; i++) {
                    if (handleMovedEl(movedElsTemp[i]) === false) {
                        // There are no more unmatched elements so completely end
                        // the loop
                        break handleMovedElsLoop;
                    }
                }
            }
        }

        // Fire the "onNodeDiscarded" event for any saved elements
        // that never found a new home in the morphed DOM
        for (var savedElId in savedEls) {
            if (savedEls.hasOwnProperty(savedElId)) {
                var savedEl = savedEls[savedElId];
                onNodeDiscarded(savedEl);
                walkDiscardedChildNodes(savedEl);
            }
        }
    }

    if (!childrenOnly && morphedNode !== fromNode && fromNode.parentNode) {
        // If we had to swap out the from node with a new node because the old
        // node was not compatible with the target node then we need to
        // replace the old DOM node in the original DOM tree. This is only
        // possible if the original DOM node was part of a DOM tree which
        // we know is the case if it has a parent node.
        fromNode.parentNode.replaceChild(morphedNode, fromNode);
    }

    return morphedNode;
}

module.exports = morphdom;

},{}],13:[function(require,module,exports){
module.exports = [
  // attribute events (can be set with attributes)
  'onclick',
  'ondblclick',
  'onmousedown',
  'onmouseup',
  'onmouseover',
  'onmousemove',
  'onmouseout',
  'ondragstart',
  'ondrag',
  'ondragenter',
  'ondragleave',
  'ondragover',
  'ondrop',
  'ondragend',
  'onkeydown',
  'onkeypress',
  'onkeyup',
  'onunload',
  'onabort',
  'onerror',
  'onresize',
  'onscroll',
  'onselect',
  'onchange',
  'onsubmit',
  'onreset',
  'onfocus',
  'onblur',
  'oninput',
  // other common events
  'oncontextmenu',
  'onfocusin',
  'onfocusout'
]

},{}],14:[function(require,module,exports){
(function (global){
'use strict';

exports.__esModule = true;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _templateObject = _taggedTemplateLiteralLoose(['<img alt="', '" src="', '">'], ['<img alt="', '" src="', '">']);

var _Utils = require('../core/Utils');

var _Utils2 = _interopRequireDefault(_Utils);

var _Translator = require('../core/Translator');

var _Translator2 = _interopRequireDefault(_Translator);

var _yoYo = require('yo-yo');

var _yoYo2 = _interopRequireDefault(_yoYo);

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

var _UppySocket = require('./UppySocket');

var _UppySocket2 = _interopRequireDefault(_UppySocket);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _taggedTemplateLiteralLoose(strings, raw) { strings.raw = raw; return strings; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Main Uppy core
 *
 * @param {object} opts general options, like locales, to show modal or not to show
 */

var Core = function () {
  function Core(opts) {
    _classCallCheck(this, Core);

    // set default options
    var defaultOptions = {
      // load English as the default locales
      locales: require('../locales/en_US.js'),
      autoProceed: true,
      debug: false
    };

    // Merge default options with the ones set by user
    this.opts = _extends({}, defaultOptions, opts);

    // Dictates in what order different plugin types are ran:
    this.types = ['presetter', 'orchestrator', 'progressindicator', 'acquirer', 'uploader', 'presenter'];

    this.type = 'core';

    // Container for different types of plugins
    this.plugins = {};

    this.translator = new _Translator2.default({ locales: this.opts.locales });
    this.i18n = this.translator.translate.bind(this.translator);
    this.initSocket = this.initSocket.bind(this);

    this.emitter = new _events2.default.EventEmitter();

    this.state = {
      files: {}
    };

    if (this.opts.debug) {
      // for debugging and testing
      global.UppyState = this.state;
      global.uppyLog = '';
      global.UppyAddFile = this.addFile.bind(this);
    }
  }

  /**
   * Iterate on all plugins and run `update` on them. Called each time when state changes
   *
   */


  Core.prototype.updateAll = function updateAll() {
    var _this = this;

    Object.keys(this.plugins).forEach(function (pluginType) {
      _this.plugins[pluginType].forEach(function (plugin) {
        plugin.update();
      });
    });
  };

  /**
   * Updates state
   *
   * @param {newState} object
   */


  Core.prototype.setState = function setState(newState) {
    this.log('Setting state to: ');
    this.log(newState);
    this.state = _extends({}, this.state, newState);
    this.updateAll();
  };

  /**
   * Gets current state, making sure to make a copy of the state object and pass that,
   * instead of an actual reference to `this.state`
   *
   */


  Core.prototype.getState = function getState() {
    return this.state;
  };

  Core.prototype.addImgPreviewToFile = function addImgPreviewToFile(file) {
    var _this2 = this;

    var reader = new FileReader();
    reader.addEventListener('load', function (ev) {
      var imgSrc = ev.target.result;
      var updatedFiles = _extends({}, _this2.state.files);
      updatedFiles[file.id].preview = imgSrc;
      updatedFiles[file.id].previewEl = (0, _yoYo2.default)(_templateObject, file.name, imgSrc);
      _this2.setState({ files: updatedFiles });
    });
    reader.addEventListener('error', function (err) {
      _this2.core.log('FileReader error' + err);
    });
    reader.readAsDataURL(file.data);
  };

  Core.prototype.addMeta = function addMeta(meta, fileID) {
    if (typeof fileID === 'undefined') {
      var updatedFiles = _extends({}, this.state.files);
      for (var file in updatedFiles) {
        updatedFiles[file].meta = meta;
      }
      this.setState({ files: updatedFiles });
    }
  };

  Core.prototype.addFile = function addFile(file) {
    var updatedFiles = _extends({}, this.state.files);

    var fileType = file.type.split('/');
    var fileTypeGeneral = fileType[0];
    var fileTypeSpecific = fileType[1];
    var fileID = _Utils2.default.generateFileID(file.name);

    updatedFiles[fileID] = {
      source: file.source || '',
      id: fileID,
      name: file.name,
      type: {
        general: fileTypeGeneral,
        specific: fileTypeSpecific
      },
      data: file.data,
      progress: 0,
      isRemote: file.isRemote || false,
      remote: file.remote
    };

    this.setState({ files: updatedFiles });

    if (fileTypeGeneral === 'image') {
      this.addImgPreviewToFile(updatedFiles[fileID]);
    }

    if (this.opts.autoProceed) {
      this.emitter.emit('next');
    }
  };

  /**
   * Registers listeners for all global actions, like:
   * `file-add`, `file-remove`, `upload-progress`, `reset`
   *
   */


  Core.prototype.actions = function actions() {
    var _this3 = this;

    this.emitter.on('file-add', function (data) {
      _this3.addFile(data);
    });

    // `remove-file` removes a file from `state.files`, for example when
    // a user decides not to upload particular file and clicks a button to remove it
    this.emitter.on('file-remove', function (fileID) {
      var updatedFiles = _extends({}, _this3.state.files);
      delete updatedFiles[fileID];
      _this3.setState({ files: updatedFiles });
    });

    this.emitter.on('upload-progress', function (progressData) {
      var updatedFiles = _extends({}, _this3.state.files);
      updatedFiles[progressData.id].progress = progressData.percentage;

      var inProgress = Object.keys(updatedFiles).map(function (file) {
        return file.progress !== 0;
      });

      // calculate total progress, using the number of files currently uploading,
      // multiplied by 100 and the summ of individual progress of each file
      var progressMax = Object.keys(inProgress).length * 100;
      var progressAll = 0;
      Object.keys(updatedFiles).forEach(function (file) {
        progressAll = progressAll + updatedFiles[file].progress;
      });

      var totalProgress = progressAll * 100 / progressMax;

      _this3.setState({
        totalProgress: totalProgress,
        files: updatedFiles
      });
    });

    // `upload-success` adds successfully uploaded file to `state.uploadedFiles`
    // and fires `remove-file` to remove it from `state.files`
    this.emitter.on('upload-success', function (file) {
      var updatedFiles = _extends({}, _this3.state.files);
      updatedFiles[file.id] = file;
      _this3.setState({ files: updatedFiles });
      // this.log(this.state.uploadedFiles)
      // this.emitter.emit('file-remove', file.id)
    });
  };

  /**
   * Registers a plugin with Core
   *
   * @param {Class} Plugin object
   * @param {Object} options object that will be passed to Plugin later
   * @return {Object} self for chaining
   */


  Core.prototype.use = function use(Plugin, opts) {
    // Instantiate
    var plugin = new Plugin(this, opts);
    var pluginName = plugin.id;
    this.plugins[plugin.type] = this.plugins[plugin.type] || [];

    if (!pluginName) {
      throw new Error('Your plugin must have a name');
    }

    if (!plugin.type) {
      throw new Error('Your plugin must have a type');
    }

    var existsPluginAlready = this.getPlugin(pluginName);
    if (existsPluginAlready) {
      var msg = 'Already found a plugin named \'' + existsPluginAlready.name + '\'.\n        Tried to use: \'' + pluginName + '\'.\n        Uppy is currently limited to running one of every plugin.\n        Share your use case with us over at\n        https://github.com/transloadit/uppy/issues/\n        if you want us to reconsider.';
      throw new Error(msg);
    }

    this.plugins[plugin.type].push(plugin);

    return this;
  };

  /**
   * Find one Plugin by name
   *
   * @param string name description
   */


  Core.prototype.getPlugin = function getPlugin(name) {
    var foundPlugin = false;
    this.iteratePlugins(function (plugin) {
      var pluginName = plugin.id;
      if (pluginName === name) {
        foundPlugin = plugin;
        return false;
      }
    });
    return foundPlugin;
  };

  /**
   * Iterate through all `use`d plugins
   *
   * @param function method description
   */


  Core.prototype.iteratePlugins = function iteratePlugins(method) {
    var _this4 = this;

    Object.keys(this.plugins).forEach(function (pluginType) {
      _this4.plugins[pluginType].forEach(method);
    });
  };

  /**
   * Logs stuff to console, only if `debug` is set to true. Silent in production.
   *
   * @return {String|Object} to log
   */


  Core.prototype.log = function log(msg) {
    if (!this.opts.debug) {
      return;
    }
    if (msg === '' + msg) {
      console.log('LOG: ' + msg);
    } else {
      console.log('LOG↓');
      console.dir(msg);
    }
    global.uppyLog = global.uppyLog + '\n' + 'DEBUG LOG: ' + msg;
  };

  /**
   * Runs all plugins of the same type in parallel
   *
   * @param {string} type that wants to set progress
   * @param {array} files
   * @return {Promise} of all methods
   */


  Core.prototype.runType = function runType(type, method, files) {
    var methods = this.plugins[type].map(function (plugin) {
      return plugin[method](_Utils2.default.flatten(files));
    });

    return Promise.all(methods).catch(function (error) {
      return console.error(error);
    });
  };

  /**
   * Runs a waterfall of runType plugin packs, like so:
   * All preseters(data) --> All acquirers(data) --> All uploaders(data) --> done
   */


  Core.prototype.run = function run() {
    var _this5 = this;

    this.log('Core is run, initializing actions, installing plugins...');

    this.actions();

    // Forse set `autoProceed` option to false if there are multiple selector Plugins active
    if (this.plugins.acquirer && this.plugins.acquirer.length > 1) {
      this.opts.autoProceed = false;
    }

    // Install all plugins
    Object.keys(this.plugins).forEach(function (pluginType) {
      _this5.plugins[pluginType].forEach(function (plugin) {
        plugin.install();
      });
    });

    return;

    // Each Plugin can have `run` and/or `install` methods.
    // `install` adds event listeners and does some non-blocking work, useful for `progressindicator`,
    // `run` waits for the previous step to finish (user selects files) before proceeding
    // ['install', 'run'].forEach((method) => {
    //   // First we select only plugins of current type,
    //   // then create an array of runType methods of this plugins
    //   const typeMethods = this.types.filter((type) => this.plugins[type])
    //     .map((type) => this.runType.bind(this, type, method))
    //   // Run waterfall of typeMethods
    //   return Utils.promiseWaterfall(typeMethods)
    //     .then((result) => {
    //       // If results are empty, don't log upload results. Hasn't run yet.
    //       if (result[0] !== undefined) {
    //         this.log(result)
    //         this.log('Upload result -> success!')
    //         return result
    //       }
    //     })
    //     .catch((error) => this.log('Upload result -> failed:', error))
    // })
  };

  Core.prototype.initSocket = function initSocket(opts) {
    if (!this.socket) {
      this.socket = new _UppySocket2.default(opts);
    }

    return this.socket;
  };

  return Core;
}();

exports.default = Core;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../core/Translator":15,"../core/Utils":17,"../locales/en_US.js":18,"./UppySocket":16,"events":35,"yo-yo":7}],15:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Translates strings with interpolation & pluralization support.Extensible with custom dictionaries
 * and pluralization functions.
 *
 * Borrows heavily from and inspired by Polyglot https://github.com/airbnb/polyglot.js,
 * basically a stripped-down version of it. Differences: pluralization functions are not hardcoded
 * and can be easily added among with dictionaries, nested objects are used for pluralization
 * as opposed to `||||` delimeter
 *
 * Usage example: `translator.translate('files_chosen', {smart_count: 3})`
 *
 * @param {object} opts
 */

var Translator = function () {
  function Translator(opts) {
    _classCallCheck(this, Translator);

    var defaultOptions = {};
    this.opts = _extends({}, defaultOptions, opts);
  }

  /**
   * Takes a string with placeholder variables like `%{smart_count} file selected`
   * and replaces it with values from options `{smart_count: 5}`
   *
   * @license https://github.com/airbnb/polyglot.js/blob/master/LICENSE
   * taken from https://github.com/airbnb/polyglot.js/blob/master/lib/polyglot.js#L299
   *
   * @param {string} phrase that needs interpolation, with placeholders
   * @param {object} options with values that will be used to replace placeholders
   * @return {string} interpolated
   */


  Translator.prototype.interpolate = function interpolate(phrase, options) {
    var replace = String.prototype.replace;
    var dollarRegex = /\$/g;
    var dollarBillsYall = '$$$$';

    for (var arg in options) {
      if (arg !== '_' && options.hasOwnProperty(arg)) {
        // Ensure replacement value is escaped to prevent special $-prefixed
        // regex replace tokens. the "$$$$" is needed because each "$" needs to
        // be escaped with "$" itself, and we need two in the resulting output.
        var replacement = options[arg];
        if (typeof replacement === 'string') {
          replacement = replace.call(options[arg], dollarRegex, dollarBillsYall);
        }
        // We create a new `RegExp` each time instead of using a more-efficient
        // string replace so that the same argument can be replaced multiple times
        // in the same phrase.
        phrase = replace.call(phrase, new RegExp('%\\{' + arg + '\\}', 'g'), replacement);
      }
    }
    return phrase;
  };

  /**
   * Public translate method
   *
   * @param {string} key
   * @param {object} options with values that will be used later to replace placeholders in string
   * @return {string} translated (and interpolated)
   */


  Translator.prototype.translate = function translate(key, options) {
    if (options && options.smart_count) {
      var plural = this.opts.locales.pluralize(options.smart_count);
      return this.interpolate(this.opts.locales.strings[key][plural], options);
    }

    return this.interpolate(this.opts.locales.strings[key], options);
  };

  return Translator;
}();

exports.default = Translator;

},{}],16:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var UppySocket = function () {
  function UppySocket(opts) {
    var _this = this;

    _classCallCheck(this, UppySocket);

    this.queued = [];
    this.isOpen = false;
    this.socket = new WebSocket(opts.target);
    this.emitter = new _events2.default.EventEmitter();

    this.socket.onopen = function (e) {
      _this.isOpen = true;

      while (_this.queued.length > 0 && _this.isOpen) {
        var first = _this.queued[0];
        _this.send(first.action, first.payload);
        _this.queued = _this.queued.slice(1);
      }
    };

    this.socket.onclose = function (e) {
      _this.isOpen = false;
    };

    this._handleMessage = this._handleMessage.bind(this);

    this.socket.onmessage = this._handleMessage;

    this.emit = this.emit.bind(this);
    this.on = this.on.bind(this);
    this.once = this.once.bind(this);
    this.send = this.send.bind(this);
  }

  UppySocket.prototype.send = function send(action, payload) {
    // attach uuid

    if (!this.isOpen) {
      this.queued.push({ action: action, payload: payload });
      return;
    }

    this.socket.send(JSON.stringify({
      action: action,
      payload: payload
    }));
  };

  UppySocket.prototype.on = function on(action, handler) {
    this.emitter.on(action, handler);
  };

  UppySocket.prototype.emit = function emit(action, payload) {
    this.emitter.emit(action, payload);
  };

  UppySocket.prototype.once = function once(action, handler) {
    this.emitter.once(action, handler);
  };

  UppySocket.prototype._handleMessage = function _handleMessage(e) {
    try {
      var message = JSON.parse(e.data);
      this.emit(message.action, message.payload);
    } catch (err) {
      console.log(err);
    }
  };

  return UppySocket;
}();

exports.default = UppySocket;

},{"events":35}],17:[function(require,module,exports){
'use strict';

exports.__esModule = true;
/**
 * A collection of small utility functions that help with dom manipulation, adding listeners,
 * promises and other good things.
 *
 * @module Utils
 */

/**
 * Runs a waterfall of promises: calls each task, passing the result
 * from the previous one as an argument. The first task is run with an empty array.
 *
 * @memberof Utils
 * @param {array} methods of Promises to run waterfall on
 * @return {Promise} of the final task
 */
function promiseWaterfall(methods) {
  var resolvedPromise = methods[0];
  var tasks = methods.slice(1);

  var finalTaskPromise = tasks.reduce(function (prevTaskPromise, task) {
    return prevTaskPromise.then(task);
  }, resolvedPromise([])); // initial value

  return finalTaskPromise;
}

/**
 * Shallow flatten nested arrays.
 */
function flatten(arr) {
  return [].concat.apply([], arr);
}

/**
 * `querySelectorAll` that returns a normal array instead of fileList
 */
function qsa(selector, context) {
  return Array.prototype.slice.call((context || document).querySelectorAll(selector) || []);
}

/**
 * Partition array by a grouping function.
 * @param  {[type]} array      Input array
 * @param  {[type]} groupingFn Grouping function
 * @return {[type]}            Array of arrays
 */
function groupBy(array, groupingFn) {
  return array.reduce(function (result, item) {
    var key = groupingFn(item);
    var xs = result.get(key) || [];
    xs.push(item);
    result.set(key, xs);
    return result;
  }, new Map());
}

/**
 * Tests if every array element passes predicate
 * @param  {Array}  array       Input array
 * @param  {Object} predicateFn Predicate
 * @return {bool}               Every element pass
 */
function every(array, predicateFn) {
  return array.reduce(function (result, item) {
    if (!result) {
      return false;
    }

    return predicateFn(item);
  }, true);
}

/**
 * Converts list into array
*/
function toArray(list) {
  return Array.prototype.slice.call(list || [], 0);
}

/**
 * Takes a fileName and turns it into fileID, by converting to lowercase,
 * removing extra characters and adding unix timestamp
 *
 * @param {String} fileName
 *
 */
function generateFileID(fileName) {
  var fileID = fileName.toLowerCase();
  fileID = fileID.replace(/[^A-Z0-9]/ig, '');
  fileID = fileID + Date.now();
  return fileID;
}

function extend() {
  for (var _len = arguments.length, objs = Array(_len), _key = 0; _key < _len; _key++) {
    objs[_key] = arguments[_key];
  }

  return Object.assign.apply(this, [{}].concat(objs));
}

/**
 * Takes function or class, returns its name.
 * Because IE doesn’t support `constructor.name`.
 * https://gist.github.com/dfkaye/6384439, http://stackoverflow.com/a/15714445
 *
 * @param {Object} fn — function
 *
 */
function getFnName(fn) {
  var f = typeof fn === 'function';
  var s = f && (fn.name && ['', fn.name] || fn.toString().match(/function ([^\(]+)/));
  return !f && 'not a function' || s && s[1] || 'anonymous';
}

exports.default = {
  promiseWaterfall: promiseWaterfall,
  generateFileID: generateFileID,
  getFnName: getFnName,
  toArray: toArray,
  every: every,
  flatten: flatten,
  groupBy: groupBy,
  qsa: qsa,
  extend: extend
};

},{}],18:[function(require,module,exports){
'use strict';

var en_US = {};

en_US.strings = {
  chooseFile: 'Choose a file',
  youHaveChosen: 'You have chosen: %{fileName}',
  orDragDrop: 'or drag it here',
  filesChosen: {
    0: '%{smart_count} file selected',
    1: '%{smart_count} files selected'
  },
  filesUploaded: {
    0: '%{smart_count} file uploaded',
    1: '%{smart_count} files uploaded'
  },
  files: {
    0: '%{smart_count} file',
    1: '%{smart_count} files'
  },
  uploadFiles: {
    0: 'Upload %{smart_count} file',
    1: 'Upload %{smart_count} files'
  },
  selectToUpload: 'Select files to upload',
  closeModal: 'Close Modal',
  upload: 'Upload'
};

en_US.pluralize = function (n) {
  if (n === 1) {
    return 0;
  }
  return 1;
};

if (typeof window !== 'undefined' && typeof window.Uppy !== 'undefined') {
  window.Uppy.locales.en_US = en_US;
}

module.exports = en_US;

},{}],19:[function(require,module,exports){
'use strict';

var ru_RU = {};

ru_RU.strings = {
  chooseFile: 'Выберите файл',
  orDragDrop: 'или перенесите его сюда',
  youHaveChosen: 'Вы выбрали: %{file_name}',
  filesChosen: {
    0: 'Выбран %{smart_count} файл',
    1: 'Выбрано %{smart_count} файла',
    2: 'Выбрано %{smart_count} файлов'
  },
  upload: 'Загрузить'
};

ru_RU.pluralize = function (n) {
  if (n % 10 === 1 && n % 100 !== 11) {
    return 0;
  }

  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) {
    return 1;
  }

  return 2;
};

if (typeof window !== 'undefined' && typeof window.Uppy !== 'undefined') {
  window.Uppy.locales.ru_RU = ru_RU;
}

module.exports = ru_RU;

},{}],20:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _templateObject = _taggedTemplateLiteralLoose(['\n      <svg class="UppyModalTab-icon" width="28" height="28" viewBox="0 0 16 16">\n        <path d="M15.982 2.97c0-.02 0-.02-.018-.037 0-.017-.017-.035-.035-.053 0 0 0-.018-.02-.018-.017-.018-.034-.053-.052-.07L13.19.123c-.017-.017-.034-.035-.07-.053h-.018c-.018-.017-.035-.017-.053-.034h-.02c-.017 0-.034-.018-.052-.018h-6.31a.415.415 0 0 0-.446.426V11.11c0 .25.196.446.445.446h8.89A.44.44 0 0 0 16 11.11V3.023c-.018-.018-.018-.035-.018-.053zm-2.65-1.46l1.157 1.157h-1.157V1.51zm1.78 9.157h-8V.89h5.332v2.22c0 .25.196.446.445.446h2.22v7.11z"/>\n        <path d="M9.778 12.89H4V2.666a.44.44 0 0 0-.444-.445.44.44 0 0 0-.445.445v10.666c0 .25.197.445.446.445h6.222a.44.44 0 0 0 .444-.445.44.44 0 0 0-.444-.444z"/>\n        <path d="M.444 16h6.223a.44.44 0 0 0 .444-.444.44.44 0 0 0-.443-.445H.89V4.89a.44.44 0 0 0-.446-.446A.44.44 0 0 0 0 4.89v10.666c0 .248.196.444.444.444z"/>\n      </svg>\n    '], ['\n      <svg class="UppyModalTab-icon" width="28" height="28" viewBox="0 0 16 16">\n        <path d="M15.982 2.97c0-.02 0-.02-.018-.037 0-.017-.017-.035-.035-.053 0 0 0-.018-.02-.018-.017-.018-.034-.053-.052-.07L13.19.123c-.017-.017-.034-.035-.07-.053h-.018c-.018-.017-.035-.017-.053-.034h-.02c-.017 0-.034-.018-.052-.018h-6.31a.415.415 0 0 0-.446.426V11.11c0 .25.196.446.445.446h8.89A.44.44 0 0 0 16 11.11V3.023c-.018-.018-.018-.035-.018-.053zm-2.65-1.46l1.157 1.157h-1.157V1.51zm1.78 9.157h-8V.89h5.332v2.22c0 .25.196.446.445.446h2.22v7.11z"/>\n        <path d="M9.778 12.89H4V2.666a.44.44 0 0 0-.444-.445.44.44 0 0 0-.445.445v10.666c0 .25.197.445.446.445h6.222a.44.44 0 0 0 .444-.445.44.44 0 0 0-.444-.444z"/>\n        <path d="M.444 16h6.223a.44.44 0 0 0 .444-.444.44.44 0 0 0-.443-.445H.89V4.89a.44.44 0 0 0-.446-.446A.44.44 0 0 0 0 4.89v10.666c0 .248.196.444.444.444z"/>\n      </svg>\n    ']),
    _templateObject2 = _taggedTemplateLiteralLoose(['\n      <div class="UppyDragDrop-container ', '">\n        <form class="UppyDragDrop-inner"\n              onsubmit=', '>\n          <input class="UppyDragDrop-input UppyDragDrop-focus"\n                 type="file"\n                 name="files[]"\n                 multiple="true"\n                 value=""\n                 onchange=', ' />\n          <label class="UppyDragDrop-label" onclick=', '>\n            <strong>', '</strong>\n            <span class="UppyDragDrop-dragText">', '</span>\n          </label>\n          ', '\n        </form>\n      </div>\n    '], ['\n      <div class="UppyDragDrop-container ', '">\n        <form class="UppyDragDrop-inner"\n              onsubmit=', '>\n          <input class="UppyDragDrop-input UppyDragDrop-focus"\n                 type="file"\n                 name="files[]"\n                 multiple="true"\n                 value=""\n                 onchange=', ' />\n          <label class="UppyDragDrop-label" onclick=', '>\n            <strong>', '</strong>\n            <span class="UppyDragDrop-dragText">', '</span>\n          </label>\n          ', '\n        </form>\n      </div>\n    ']),
    _templateObject3 = _taggedTemplateLiteralLoose(['<button class="UppyDragDrop-uploadBtn UppyNextBtn"\n                         type="submit"\n                         onclick=', '>\n                    ', '\n              </button>'], ['<button class="UppyDragDrop-uploadBtn UppyNextBtn"\n                         type="submit"\n                         onclick=', '>\n                    ', '\n              </button>']);

var _Plugin2 = require('./Plugin');

var _Plugin3 = _interopRequireDefault(_Plugin2);

var _Utils = require('../core/Utils');

var _Utils2 = _interopRequireDefault(_Utils);

var _dragDrop = require('drag-drop');

var _dragDrop2 = _interopRequireDefault(_dragDrop);

var _yoYo = require('yo-yo');

var _yoYo2 = _interopRequireDefault(_yoYo);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _taggedTemplateLiteralLoose(strings, raw) { strings.raw = raw; return strings; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * Drag & Drop plugin
 *
 */

var DragDrop = function (_Plugin) {
  _inherits(DragDrop, _Plugin);

  function DragDrop(core, opts) {
    _classCallCheck(this, DragDrop);

    var _this = _possibleConstructorReturn(this, _Plugin.call(this, core, opts));

    _this.type = 'acquirer';
    _this.id = 'DragDrop';
    _this.title = 'Drag & Drop';
    _this.icon = (0, _yoYo2.default)(_templateObject);

    // Default options
    var defaultOptions = {
      target: '.UppyDragDrop'
    };

    // Merge default options with the ones set by user
    _this.opts = _extends({}, defaultOptions, opts);

    // Check for browser dragDrop support
    _this.isDragDropSupported = _this.checkDragDropSupport();

    // Bind `this` to class methods
    _this.handleDrop = _this.handleDrop.bind(_this);
    _this.checkDragDropSupport = _this.checkDragDropSupport.bind(_this);
    _this.handleInputChange = _this.handleInputChange.bind(_this);
    _this.render = _this.render.bind(_this);
    return _this;
  }

  /**
   * Checks if the browser supports Drag & Drop (not supported on mobile devices, for example).
   * @return {Boolean} true if supported, false otherwise
   */


  DragDrop.prototype.checkDragDropSupport = function checkDragDropSupport() {
    var div = document.createElement('div');

    if (!('draggable' in div) || !('ondragstart' in div && 'ondrop' in div)) {
      return false;
    }

    if (!('FormData' in window)) {
      return false;
    }

    if (!('FileReader' in window)) {
      return false;
    }

    return true;
  };

  DragDrop.prototype.handleDrop = function handleDrop(files) {
    var _this2 = this;

    this.core.log('All right, someone dropped something...');

    // this.core.emitter.emit('file-add', {
    //   plugin: this,
    //   acquiredFiles: files
    // })

    files.forEach(function (file) {
      _this2.core.emitter.emit('file-add', {
        source: _this2.id,
        name: file.name,
        type: file.type,
        data: file
      });
    });

    this.core.addMeta({ bla: 'bla' });
  };

  DragDrop.prototype.handleInputChange = function handleInputChange(ev) {
    var _this3 = this;

    this.core.log('All right, something selected through input...');

    var files = _Utils2.default.toArray(ev.target.files);

    files.forEach(function (file) {
      console.log(file);
      _this3.core.emitter.emit('file-add', {
        source: _this3.id,
        name: file.name,
        type: file.type,
        data: file
      });
    });
  };

  DragDrop.prototype.focus = function focus() {
    var firstInput = document.querySelector(this.target + ' .UppyDragDrop-focus');

    // only works for the first time if wrapped in setTimeout for some reason
    // firstInput.focus()
    setTimeout(function () {
      firstInput.focus();
    }, 10);
  };

  DragDrop.prototype.render = function render(state) {
    var _this4 = this;

    // Another way not to render next/upload button — if Modal is used as a target
    var target = this.opts.target.name;

    var onSelect = function onSelect(ev) {
      var input = document.querySelector(_this4.target + ' .UppyDragDrop-input');
      input.click();
    };

    var next = function next(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      _this4.core.emitter.emit('next');
    };

    var onSubmit = function onSubmit(ev) {
      ev.preventDefault();
    };

    return (0, _yoYo2.default)(_templateObject2, this.isDragDropSupported ? 'is-dragdrop-supported' : '', onSubmit, this.handleInputChange.bind(this), onSelect, this.core.i18n('chooseFile'), this.core.i18n('orDragDrop'), !this.core.opts.autoProceed && target !== 'Modal' ? (0, _yoYo2.default)(_templateObject3, next, this.core.i18n('upload')) : '');
  };

  DragDrop.prototype.install = function install() {
    var _this5 = this;

    var target = this.opts.target;
    var plugin = this;
    this.target = this.mount(target, plugin);

    (0, _dragDrop2.default)(this.target + ' .UppyDragDrop-container', function (files) {
      _this5.handleDrop(files);
      _this5.core.log(files);
    });
  };

  return DragDrop;
}(_Plugin3.default);

exports.default = DragDrop;

},{"../core/Utils":17,"./Plugin":27,"drag-drop":1,"yo-yo":7}],21:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _Plugin2 = require('./Plugin');

var _Plugin3 = _interopRequireDefault(_Plugin2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Dropbox = function (_Plugin) {
  _inherits(Dropbox, _Plugin);

  function Dropbox(core, opts) {
    _classCallCheck(this, Dropbox);

    var _this = _possibleConstructorReturn(this, _Plugin.call(this, core, opts));

    _this.type = 'acquirer';
    _this.id = 'Dropbox';
    _this.title = 'Dropbox';

    _this.authenticate = _this.authenticate.bind(_this);
    _this.connect = _this.connect.bind(_this);
    _this.render = _this.render.bind(_this);
    _this.files = [];
    _this.currentDirectory = '/';
    return _this;
  }

  Dropbox.prototype.connect = function connect(target) {
    this.getDirectory();
  };

  Dropbox.prototype.authenticate = function authenticate() {
    // request.get('/')
  };

  Dropbox.prototype.addFile = function addFile() {};

  Dropbox.prototype.getDirectory = function getDirectory() {
    // request.get('//localhost:3020/dropbox/readdir')
    //   .query(opts)
    //   .set('Content-Type', 'application/json')
    //   .end((err, res) => {
    //     if (err) return new Error(err)
    //     console.log(res)
    //   })
  };

  Dropbox.prototype.run = function run(results) {};

  Dropbox.prototype.render = function render(files) {
    var _this2 = this;

    // for each file in the directory, create a list item element
    var elems = files.map(function (file, i) {
      var icon = file.isFolder ? 'folder' : 'file';
      return '<li data-type="' + icon + '" data-name="' + file.name + '">\n        <span>' + icon + ': </span>\n        <span> ' + file.name + '</span>\n      </li>';
    });

    // appends the list items to the target
    this._target.innerHTML = elems.sort().join('');

    if (this.currentDir.length > 1) {
      var parent = document.createElement('LI');
      parent.setAttribute('data-type', 'parent');
      parent.innerHTML = '<span>...</span>';
      this._target.appendChild(parent);
    }

    // add an onClick to each list item
    var fileElems = this._target.querySelectorAll('li');

    Array.prototype.forEach.call(fileElems, function (element) {
      var type = element.getAttribute('data-type');

      if (type === 'file') {
        element.addEventListener('click', function () {
          _this2.files.push(element.getAttribute('data-name'));
          console.log('files: ' + _this2.files);
        });
      } else {
        element.addEventListener('dblclick', function () {
          var length = _this2.currentDir.split('/').length;

          if (type === 'folder') {
            _this2.currentDir = '' + _this2.currentDir + element.getAttribute('data-name') + '/';
          } else if (type === 'parent') {
            _this2.currentDir = _this2.currentDir.split('/').slice(0, length - 2).join('/') + '/';
          }
          console.log(_this2.currentDir);
          _this2.getDirectory();
        });
      }
    });
  };

  return Dropbox;
}(_Plugin3.default);

exports.default = Dropbox;

},{"./Plugin":27}],22:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _templateObject = _taggedTemplateLiteralLoose(['<h1>this is strange 1</h1>'], ['<h1>this is strange 1</h1>']),
    _templateObject2 = _taggedTemplateLiteralLoose(['<h2>this is strange 2</h2>'], ['<h2>this is strange 2</h2>']),
    _templateObject3 = _taggedTemplateLiteralLoose(['\n      <div class="wow-this-works">\n        <input class="UppyDummy-firstInput" type="text" value="hello">\n        ', '\n        ', '\n      </div>\n    '], ['\n      <div class="wow-this-works">\n        <input class="UppyDummy-firstInput" type="text" value="hello">\n        ', '\n        ', '\n      </div>\n    ']);

var _Plugin2 = require('./Plugin');

var _Plugin3 = _interopRequireDefault(_Plugin2);

var _yoYo = require('yo-yo');

var _yoYo2 = _interopRequireDefault(_yoYo);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _taggedTemplateLiteralLoose(strings, raw) { strings.raw = raw; return strings; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * Dummy
 *
 */

var Dummy = function (_Plugin) {
  _inherits(Dummy, _Plugin);

  function Dummy(core, opts) {
    _classCallCheck(this, Dummy);

    var _this = _possibleConstructorReturn(this, _Plugin.call(this, core, opts));

    _this.type = 'acquirer';
    _this.id = 'Dummy';
    _this.title = 'Dummy';

    // set default options
    var defaultOptions = {};

    // merge default options with the ones set by user
    _this.opts = _extends({}, defaultOptions, opts);

    _this.strange = (0, _yoYo2.default)(_templateObject);
    _this.render = _this.render.bind(_this);
    _this.install = _this.install.bind(_this);
    return _this;
  }

  Dummy.prototype.render = function render() {
    var bla = (0, _yoYo2.default)(_templateObject2);
    return (0, _yoYo2.default)(_templateObject3, this.strange, bla);
  };

  Dummy.prototype.focus = function focus() {
    var firstInput = document.querySelector(this.target + ' .UppyDummy-firstInput');

    // only works for the first time if wrapped in setTimeout for some reason
    // firstInput.focus()
    setTimeout(function () {
      firstInput.focus();
    }, 10);
  };

  Dummy.prototype.install = function install() {
    var target = this.opts.target;
    var plugin = this;
    this.target = this.mount(target, plugin);
  };

  return Dummy;
}(_Plugin3.default);

exports.default = Dummy;

},{"./Plugin":27,"yo-yo":7}],23:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _templateObject = _taggedTemplateLiteralLoose(['<form class="UppyFormContainer">\n      <input class="UppyForm-input"\n             type="file"\n             name="files[]"\n             onchange=', '\n             multiple="', '"\n             value="">\n      ', '\n    </form>'], ['<form class="UppyFormContainer">\n      <input class="UppyForm-input"\n             type="file"\n             name="files[]"\n             onchange=', '\n             multiple="', '"\n             value="">\n      ', '\n    </form>']),
    _templateObject2 = _taggedTemplateLiteralLoose(['<button class="UppyForm-uploadBtn UppyNextBtn"\n                     type="submit"\n                     onclick=', '>\n              ', '\n            </button>'], ['<button class="UppyForm-uploadBtn UppyNextBtn"\n                     type="submit"\n                     onclick=', '>\n              ', '\n            </button>']);

var _Plugin2 = require('./Plugin');

var _Plugin3 = _interopRequireDefault(_Plugin2);

var _Utils = require('../core/Utils');

var _Utils2 = _interopRequireDefault(_Utils);

var _yoYo = require('yo-yo');

var _yoYo2 = _interopRequireDefault(_yoYo);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _taggedTemplateLiteralLoose(strings, raw) { strings.raw = raw; return strings; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Formtag = function (_Plugin) {
  _inherits(Formtag, _Plugin);

  function Formtag(core, opts) {
    _classCallCheck(this, Formtag);

    var _this = _possibleConstructorReturn(this, _Plugin.call(this, core, opts));

    _this.id = 'Formtag';
    _this.title = 'Formtag';
    _this.type = 'acquirer';

    // Default options
    var defaultOptions = {
      target: '.UppyForm',
      replaceTargetContent: true,
      multipleFiles: true
    };

    // Merge default options with the ones set by user
    _this.opts = _extends({}, defaultOptions, opts);

    _this.render = _this.render.bind(_this);
    return _this;
  }

  Formtag.prototype.handleInputChange = function handleInputChange(ev) {
    var _this2 = this;

    this.core.log('All right, something selected through input...');

    // this added rubbish keys like “length” to the resulting array
    // const files = Object.keys(ev.target.files).map((key) => {
    //   return ev.target.files[key]
    // })

    var files = _Utils2.default.toArray(ev.target.files);

    files.forEach(function (file) {
      _this2.core.emitter.emit('file-add', {
        source: _this2.id,
        name: file.name,
        type: file.type,
        data: file
      });
    });
  };

  Formtag.prototype.render = function render(state) {
    var _this3 = this;

    var next = function next(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      _this3.core.emitter.emit('next');
    };

    return (0, _yoYo2.default)(_templateObject, this.handleInputChange.bind(this), this.opts.multipleFiles ? 'true' : 'false', !this.core.opts.autoProceed && this.opts.target.name !== 'Modal' ? (0, _yoYo2.default)(_templateObject2, next, this.core.i18n('upload')) : '');
  };

  Formtag.prototype.install = function install() {
    var target = this.opts.target;
    var plugin = this;
    this.target = this.mount(target, plugin);
  };

  // run (results) {
  //   console.log({
  //     class: 'Formtag',
  //     method: 'run',
  //     results: results
  //   })
  //
  //   const button = document.querySelector(this.opts.doneButtonSelector)
  //   var self = this
  //
  //   return new Promise((resolve, reject) => {
  //     button.addEventListener('click', (e) => {
  //       var fields = document.querySelectorAll(self.opts.selector)
  //       var selected = [];
  //
  //       [].forEach.call(fields, (field, i) => {
  //         selected.push({
  //           from: 'Formtag',
  //           files: field.files
  //         })
  //       })
  //       resolve(selected)
  //     })
  //   })
  // }


  return Formtag;
}(_Plugin3.default);

exports.default = Formtag;

},{"../core/Utils":17,"./Plugin":27,"yo-yo":7}],24:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _templateObject = _taggedTemplateLiteralLoose(['\n      <svg class="UppyModalTab-icon" width="28" height="28" viewBox="0 0 16 16">\n        <path d="M2.955 14.93l2.667-4.62H16l-2.667 4.62H2.955zm2.378-4.62l-2.666 4.62L0 10.31l5.19-8.99 2.666 4.62-2.523 4.37zm10.523-.25h-5.333l-5.19-8.99h5.334l5.19 8.99z"/>\n      </svg>\n    '], ['\n      <svg class="UppyModalTab-icon" width="28" height="28" viewBox="0 0 16 16">\n        <path d="M2.955 14.93l2.667-4.62H16l-2.667 4.62H2.955zm2.378-4.62l-2.666 4.62L0 10.31l5.19-8.99 2.666 4.62-2.523 4.37zm10.523-.25h-5.333l-5.19-8.99h5.334l5.19 8.99z"/>\n      </svg>\n    ']),
    _templateObject2 = _taggedTemplateLiteralLoose(['\n      <div class="UppyGoogleDrive-authenticate">\n        <h1>You need to authenticate with Google before selecting files.</h1>\n        <a onclick=', '>Authenticate</a>\n      </div>\n    '], ['\n      <div class="UppyGoogleDrive-authenticate">\n        <h1>You need to authenticate with Google before selecting files.</h1>\n        <a onclick=', '>Authenticate</a>\n      </div>\n    ']),
    _templateObject3 = _taggedTemplateLiteralLoose(['<li><button onclick=', '>', '</button></li> '], ['<li><button onclick=', '>', '</button></li> ']),
    _templateObject4 = _taggedTemplateLiteralLoose(['\n        <div>\n          <h1><span class="UppyGoogleDrive-fileIcon"><img src=', '/></span>', '</h1>\n          <ul>\n            <li>Type: ', '</li>\n            <li>Modified By Me: ', '</li>\n          </ul>\n          ', '\n        </div>\n      '], ['\n        <div>\n          <h1><span class="UppyGoogleDrive-fileIcon"><img src=', '/></span>', '</h1>\n          <ul>\n            <li>Type: ', '</li>\n            <li>Modified By Me: ', '</li>\n          </ul>\n          ', '\n        </div>\n      ']),
    _templateObject5 = _taggedTemplateLiteralLoose(['<img src=', ' class="UppyGoogleDrive-fileThumbnail" />'], ['<img src=', ' class="UppyGoogleDrive-fileThumbnail" />']),
    _templateObject6 = _taggedTemplateLiteralLoose([''], ['']),
    _templateObject7 = _taggedTemplateLiteralLoose(['\n      <div>\n        <div class="UppyGoogleDrive-header">\n          <ul class="UppyGoogleDrive-breadcrumbs">\n            ', '\n          </ul>\n        </div>\n        <div class="container-fluid">\n          <div class="row">\n            <div class="hidden-md-down col-lg-3 col-xl-3">\n              <ul class="UppyGoogleDrive-sidebar">\n                <li class="UppyGoogleDrive-filter"><input class="UppyGoogleDrive-focusInput" type=\'text\' onkeyup=', ' placeholder="Search.." value=', '/></li>\n                <li><button onclick=', '><img src="https://ssl.gstatic.com/docs/doclist/images/icon_11_collection_list_3.png"/> My Drive</button></li>\n                <li><button><img src="https://ssl.gstatic.com/docs/doclist/images/icon_11_shared_collection_list_1.png"/> Shared with me</button></li>\n                <li><button onclick=', '>Logout</button></li>\n              </ul>\n            </div>\n            <div class="col-md-12 col-lg-9 col-xl-6">\n              <div class="UppyGoogleDrive-browserContainer">\n                <table class="UppyGoogleDrive-browser">\n                  <thead>\n                    <tr>\n                      <td class="UppyGoogleDrive-sortableHeader" onclick=', '>Name</td>\n                      <td>Owner</td>\n                      <td class="UppyGoogleDrive-sortableHeader" onclick=', '>Last Modified</td>\n                      <td>Filesize</td>\n                    </tr>\n                  </thead>\n                  <tbody>\n                    ', '\n                    ', '\n                  </tbody>\n                </table>\n              </div>\n            </div>\n            <div class="hidden-lg-down col-xl-2">\n              <div class="UppyGoogleDrive-fileInfo">\n                ', '\n              </div>\n            </div>\n          </div>\n        </div>\n      </div>\n    '], ['\n      <div>\n        <div class="UppyGoogleDrive-header">\n          <ul class="UppyGoogleDrive-breadcrumbs">\n            ', '\n          </ul>\n        </div>\n        <div class="container-fluid">\n          <div class="row">\n            <div class="hidden-md-down col-lg-3 col-xl-3">\n              <ul class="UppyGoogleDrive-sidebar">\n                <li class="UppyGoogleDrive-filter"><input class="UppyGoogleDrive-focusInput" type=\'text\' onkeyup=', ' placeholder="Search.." value=', '/></li>\n                <li><button onclick=', '><img src="https://ssl.gstatic.com/docs/doclist/images/icon_11_collection_list_3.png"/> My Drive</button></li>\n                <li><button><img src="https://ssl.gstatic.com/docs/doclist/images/icon_11_shared_collection_list_1.png"/> Shared with me</button></li>\n                <li><button onclick=', '>Logout</button></li>\n              </ul>\n            </div>\n            <div class="col-md-12 col-lg-9 col-xl-6">\n              <div class="UppyGoogleDrive-browserContainer">\n                <table class="UppyGoogleDrive-browser">\n                  <thead>\n                    <tr>\n                      <td class="UppyGoogleDrive-sortableHeader" onclick=', '>Name</td>\n                      <td>Owner</td>\n                      <td class="UppyGoogleDrive-sortableHeader" onclick=', '>Last Modified</td>\n                      <td>Filesize</td>\n                    </tr>\n                  </thead>\n                  <tbody>\n                    ', '\n                    ', '\n                  </tbody>\n                </table>\n              </div>\n            </div>\n            <div class="hidden-lg-down col-xl-2">\n              <div class="UppyGoogleDrive-fileInfo">\n                ', '\n              </div>\n            </div>\n          </div>\n        </div>\n      </div>\n    ']),
    _templateObject8 = _taggedTemplateLiteralLoose(['\n      <tr class=', '\n        onclick=', '\n        ondblclick=', '>\n        <td><span class="UppyGoogleDrive-folderIcon"><img src=', '/></span> ', '</td>\n        <td>Me</td>\n        <td>', '</td>\n        <td>-</td>\n      </tr>\n    '], ['\n      <tr class=', '\n        onclick=', '\n        ondblclick=', '>\n        <td><span class="UppyGoogleDrive-folderIcon"><img src=', '/></span> ', '</td>\n        <td>Me</td>\n        <td>', '</td>\n        <td>-</td>\n      </tr>\n    ']),
    _templateObject9 = _taggedTemplateLiteralLoose(['\n      <div>\n        <span>\n          Something went wrong.  Probably our fault. ', '\n        </span>\n      </div>\n    '], ['\n      <div>\n        <span>\n          Something went wrong.  Probably our fault. ', '\n        </span>\n      </div>\n    ']);

var _Utils = require('../core/Utils');

var _Utils2 = _interopRequireDefault(_Utils);

var _Plugin2 = require('./Plugin');

var _Plugin3 = _interopRequireDefault(_Plugin2);

require('whatwg-fetch');

var _yoYo = require('yo-yo');

var _yoYo2 = _interopRequireDefault(_yoYo);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _taggedTemplateLiteralLoose(strings, raw) { strings.raw = raw; return strings; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Google = function (_Plugin) {
  _inherits(Google, _Plugin);

  function Google(core, opts) {
    _classCallCheck(this, Google);

    var _this = _possibleConstructorReturn(this, _Plugin.call(this, core, opts));

    _this.type = 'acquirer';
    _this.id = 'GoogleDrive';
    _this.title = 'Google Drive';
    _this.icon = (0, _yoYo2.default)(_templateObject);

    _this.files = [];

    // Logic
    _this.addFile = _this.addFile.bind(_this);
    _this.getFolder = _this.getFolder.bind(_this);
    _this.handleClick = _this.handleClick.bind(_this);
    _this.logout = _this.logout.bind(_this);

    // Visual
    _this.renderBrowserItem = _this.renderBrowserItem.bind(_this);
    _this.filterItems = _this.filterItems.bind(_this);
    _this.filterQuery = _this.filterQuery.bind(_this);
    _this.renderAuth = _this.renderAuth.bind(_this);
    _this.renderBrowser = _this.renderBrowser.bind(_this);
    _this.sortByTitle = _this.sortByTitle.bind(_this);
    _this.sortByDate = _this.sortByDate.bind(_this);
    _this.render = _this.render.bind(_this);

    // set default options
    var defaultOptions = {};

    // merge default options with the ones set by user
    _this.opts = _extends({}, defaultOptions, opts);

    var host = _this.opts.host.replace(/^https?:\/\//, '');

    _this.socket = _this.core.initSocket({
      target: 'ws://' + host + '/'
    });

    _this.socket.on('google.auth.pass', function () {
      console.log('google.auth.pass');
      _this.getFolder(_this.core.getState().googleDrive.directory.id);
    });

    _this.socket.on('uppy.debug', function (payload) {
      console.log('GOOGLE DEBUG:');
      console.log(payload);
    });

    _this.socket.on('google.list.ok', function (data) {
      console.log('google.list.ok');
      var folders = [];
      var files = [];
      data.items.forEach(function (item) {
        if (item.mimeType === 'application/vnd.google-apps.folder') {
          folders.push(item);
        } else {
          files.push(item);
        }
      });

      _this.updateState({
        folders: folders,
        files: files,
        authenticated: true
      });
    });

    _this.socket.on('google.list.fail', function (data) {
      console.log('google.list.fail');
      console.log(data);
    });

    _this.socket.on('google.auth.fail', function () {
      console.log('google.auth.fail');
      _this.updateState({
        authenticated: false
      });
    });
    return _this;
  }

  Google.prototype.install = function install() {
    // Set default state for Google Drive
    this.core.setState({
      googleDrive: {
        authenticated: false,
        files: [],
        folders: [],
        directory: [{
          title: 'My Drive',
          id: 'root'
        }],
        active: {},
        filterInput: ''
      }
    });

    var target = this.opts.target;
    var plugin = this;
    this.target = this.mount(target, plugin);

    this.checkAuthentication();

    return;
  };

  Google.prototype.focus = function focus() {
    var firstInput = document.querySelector(this.target + ' .UppyGoogleDrive-focusInput');

    // only works for the first time if wrapped in setTimeout for some reason
    // firstInput.focus()
    setTimeout(function () {
      firstInput.focus();
    }, 10);
  };

  /**
   * Little shorthand to update the state with my new state
   */


  Google.prototype.updateState = function updateState(newState) {
    var state = this.core.state;

    var googleDrive = _extends({}, state.googleDrive, newState);

    this.core.setState({ googleDrive: googleDrive });
  };

  /**
   * Check to see if the user is authenticated.
   * @return {Promise} authentication status
   */


  Google.prototype.checkAuthentication = function checkAuthentication() {
    this.socket.send('google.auth');
  };

  /**
   * Based on folder ID, fetch a new folder
   * @param  {String} id Folder id
   * @return {Promise}   Folders/files in folder
   */


  Google.prototype.getFolder = function getFolder() {
    var dir = arguments.length <= 0 || arguments[0] === undefined ? 'root' : arguments[0];

    this.socket.send('google.list', {
      dir: dir
    });
  };

  /**
   * Fetches new folder and adds to breadcrumb nav
   * @param  {String} id    Folder id
   * @param  {String} title Folder title
   */


  Google.prototype.getNextFolder = function getNextFolder(id, title) {
    var _this2 = this;

    this.getFolder(id).then(function (data) {
      var state = _this2.core.getState().googleDrive;

      var index = state.directory.findIndex(function (dir) {
        return id === dir.id;
      });
      var directory = void 0;

      if (index !== -1) {
        directory = state.directory.slice(0, index + 1);
      } else {
        directory = state.directory.concat([{
          id: id,
          title: title
        }]);
      }

      _this2.updateState(_Utils2.default.extend(data, { directory: directory }));
    });
  };

  Google.prototype.addFile = function addFile(file) {
    var tagFile = {
      source: this,
      data: file,
      name: file.title,
      type: this.getFileType(file),
      remote: {
        action: 'google.get',
        payload: {
          id: file.id
        }
      }
    };

    this.core.emitter.emit('file-add', tagFile);
  };

  Google.prototype.handleError = function handleError(response) {}
  // this.checkAuthentication()
  //   .then((authenticated) => {
  //     this.updateState({authenticated})
  //   })


  /**
   * Removes session token on client side.
   */
  ;

  Google.prototype.logout = function logout() {
    var _this3 = this;

    fetch(this.opts.host + '/google/logout?redirect=' + location.href, {
      method: 'get',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    }).then(function (res) {
      return res.json();
    }).then(function (res) {
      if (res.ok) {
        console.log('ok');
        var newState = {
          authenticated: false,
          files: [],
          folders: [],
          directory: [{
            title: 'My Drive',
            id: 'root'
          }]
        };

        _this3.updateState(newState);
      }
    });
  };

  Google.prototype.getFileType = function getFileType(file) {
    var fileTypes = {
      'application/vnd.google-apps.folder': 'Folder',
      'application/vnd.google-apps.document': 'Google Docs',
      'application/vnd.google-apps.spreadsheet': 'Google Sheets',
      'application/vnd.google-apps.presentation': 'Google Slides',
      'image/jpeg': 'JPEG Image',
      'image/png': 'PNG Image'
    };

    return fileTypes[file.mimeType] ? fileTypes[file.mimeType] : file.fileExtension.toUpperCase();
  };

  /**
   * Used to set active file/folder.
   * @param  {Object} file   Active file/folder
   */


  Google.prototype.handleClick = function handleClick(file) {
    var state = this.core.getState().googleDrive;
    var newState = _extends({}, state, {
      active: file
    });

    this.updateState(newState);
  };

  Google.prototype.filterQuery = function filterQuery(e) {
    var state = this.core.getState().googleDrive;
    this.updateState(_extends({}, state, {
      filterInput: e.target.value
    }));
  };

  Google.prototype.filterItems = function filterItems(items) {
    var state = this.core.getState().googleDrive;
    return items.filter(function (folder) {
      return folder.title.toLowerCase().indexOf(state.filterInput.toLowerCase()) !== -1;
    });
  };

  Google.prototype.sortByTitle = function sortByTitle() {
    var state = this.core.getState().googleDrive;
    var files = state.files;
    var folders = state.folders;
    var sorting = state.sorting;


    var sortedFiles = files.sort(function (fileA, fileB) {
      if (sorting === 'titleDescending') {
        return fileB.title.localeCompare(fileA.title);
      }
      return fileA.title.localeCompare(fileB.title);
    });

    var sortedFolders = folders.sort(function (folderA, folderB) {
      if (sorting === 'titleDescending') {
        return folderB.title.localeCompare(folderA.title);
      }
      return folderA.title.localeCompare(folderB.title);
    });

    this.updateState(_extends({}, state, {
      files: sortedFiles,
      folders: sortedFolders,
      sorting: sorting === 'titleDescending' ? 'titleAscending' : 'titleDescending'
    }));
  };

  Google.prototype.sortByDate = function sortByDate() {
    var state = this.core.getState().googleDrive;
    var files = state.files;
    var folders = state.folders;
    var sorting = state.sorting;


    var sortedFiles = files.sort(function (fileA, fileB) {
      var a = new Date(fileA.modifiedByMeDate);
      var b = new Date(fileB.modifiedByMeDate);

      if (sorting === 'dateDescending') {
        return a > b ? -1 : a < b ? 1 : 0;
      }
      return a > b ? 1 : a < b ? -1 : 0;
    });

    var sortedFolders = folders.sort(function (folderA, folderB) {
      var a = new Date(folderA.modifiedByMeDate);
      var b = new Date(folderB.modifiedByMeDate);

      if (sorting === 'dateDescending') {
        return a > b ? -1 : a < b ? 1 : 0;
      }

      return a > b ? 1 : a < b ? -1 : 0;
    });

    this.updateState(_extends({}, state, {
      files: sortedFiles,
      folders: sortedFolders,
      sorting: sorting === 'dateDescending' ? 'dateAscending' : 'dateDescending'
    }));
  };

  /**
   *  Render user authentication view
   */


  Google.prototype.renderAuth = function renderAuth() {
    var _this4 = this;

    var link = this.opts.host + '/connect/google';

    var handleAuth = function handleAuth(e) {
      e.preventDefault();
      var authWindow = window.open(link);
      _this4.socket.once('google.auth.complete', function () {
        console.log('google.auth.complete');
        authWindow.close();
      });
    };

    return (0, _yoYo2.default)(_templateObject2, handleAuth);
  };

  /**
   * Render file browser
   * @param  {Object} state Google Drive state
   */


  Google.prototype.renderBrowser = function renderBrowser(state) {
    var _this5 = this;

    var folders = state.folders;
    var files = state.files;
    var previewElem = '';
    var isFileSelected = Object.keys(state.active).length !== 0 && JSON.stringify(state.active) !== JSON.stringify({});

    if (state.filterInput !== '') {
      folders = this.filterItems(state.folders);
      files = this.filterItems(state.files);
    }

    folders = folders.map(function (folder) {
      return _this5.renderBrowserItem(folder);
    });
    files = files.map(function (file) {
      return _this5.renderBrowserItem(file);
    });

    var breadcrumbs = state.directory.map(function (dir) {
      return (0, _yoYo2.default)(_templateObject3, _this5.getNextFolder.bind(_this5, dir.id, dir.title), dir.title);
    });
    if (isFileSelected) {
      previewElem = (0, _yoYo2.default)(_templateObject4, state.active.iconLink, state.active.title, this.getFileType(state.active), state.active.modifiedByMeDate, state.active.thumbnailLink ? (0, _yoYo2.default)(_templateObject5, state.active.thumbnailLink) : (0, _yoYo2.default)(_templateObject6));
    }

    return (0, _yoYo2.default)(_templateObject7, breadcrumbs, this.filterQuery, state.filterInput, this.getNextFolder.bind(this, 'root', 'My Drive'), this.logout, this.sortByTitle, this.sortByDate, folders, files, previewElem);
  };

  Google.prototype.renderBrowserItem = function renderBrowserItem(item) {
    var state = this.core.getState().googleDrive;
    var isAFileSelected = Object.keys(state.active).length !== 0 && JSON.stringify(state.active) !== JSON.stringify({});
    var isFolder = item.mimeType === 'application/vnd.google-apps.folder';
    return (0, _yoYo2.default)(_templateObject8, isAFileSelected && state.active.id === item.id ? 'is-active' : '', this.handleClick.bind(this, item), isFolder ? this.getNextFolder.bind(this, item.id, item.title) : this.addFile.bind(this, item), item.iconLink, item.title, item.modifiedByMeDate);
  };

  Google.prototype.renderError = function renderError(err) {
    return (0, _yoYo2.default)(_templateObject9, err);
  };

  Google.prototype.render = function render(state) {
    if (state.googleDrive.error) {
      return this.renderError();
    }

    if (!state.googleDrive.authenticated) {
      return this.renderAuth();
    }

    return this.renderBrowser(state.googleDrive);
  };

  return Google;
}(_Plugin3.default);

exports.default = Google;

},{"../core/Utils":17,"./Plugin":27,"whatwg-fetch":6,"yo-yo":7}],25:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _templateObject = _taggedTemplateLiteralLoose(['\n        <svg class="UppyModalTab-icon" width="28" height="28" viewBox="0 0 101 58">\n          <path d="M17.582.3L.915 41.713l32.94 13.295L17.582.3zm83.333 41.414L67.975 55.01 84.25.3l16.665 41.414zm-48.998 5.403L63.443 35.59H38.386l11.527 11.526v5.905l-3.063 3.32 1.474 1.36 2.59-2.806 2.59 2.807 1.475-1.357-3.064-3.32v-5.906zm16.06-26.702c-3.973 0-7.194-3.22-7.194-7.193 0-3.973 3.222-7.193 7.193-7.193 3.974 0 7.193 3.22 7.193 7.19 0 3.974-3.22 7.194-7.195 7.194zM70.48 8.682c-.737 0-1.336.6-1.336 1.337 0 .736.6 1.335 1.337 1.335.738 0 1.338-.598 1.338-1.336 0-.74-.6-1.338-1.338-1.338zM33.855 20.415c-3.973 0-7.193-3.22-7.193-7.193 0-3.973 3.22-7.193 7.195-7.193 3.973 0 7.192 3.22 7.192 7.19 0 3.974-3.22 7.194-7.192 7.194zM36.36 8.682c-.737 0-1.336.6-1.336 1.337 0 .736.6 1.335 1.337 1.335.738 0 1.338-.598 1.338-1.336 0-.74-.598-1.338-1.337-1.338z"/>\n        </svg>\n      '], ['\n        <svg class="UppyModalTab-icon" width="28" height="28" viewBox="0 0 101 58">\n          <path d="M17.582.3L.915 41.713l32.94 13.295L17.582.3zm83.333 41.414L67.975 55.01 84.25.3l16.665 41.414zm-48.998 5.403L63.443 35.59H38.386l11.527 11.526v5.905l-3.063 3.32 1.474 1.36 2.59-2.806 2.59 2.807 1.475-1.357-3.064-3.32v-5.906zm16.06-26.702c-3.973 0-7.194-3.22-7.194-7.193 0-3.973 3.222-7.193 7.193-7.193 3.974 0 7.193 3.22 7.193 7.19 0 3.974-3.22 7.194-7.195 7.194zM70.48 8.682c-.737 0-1.336.6-1.336 1.337 0 .736.6 1.335 1.337 1.335.738 0 1.338-.598 1.338-1.336 0-.74-.6-1.338-1.338-1.338zM33.855 20.415c-3.973 0-7.193-3.22-7.193-7.193 0-3.973 3.22-7.193 7.195-7.193 3.973 0 7.192 3.22 7.192 7.19 0 3.974-3.22 7.194-7.192 7.194zM36.36 8.682c-.737 0-1.336.6-1.336 1.337 0 .736.6 1.335 1.337 1.335.738 0 1.338-.598 1.338-1.336 0-.74-.598-1.338-1.337-1.338z"/>\n        </svg>\n      ']),
    _templateObject2 = _taggedTemplateLiteralLoose(['<div class="', '"\n                   aria-hidden="', '"\n                   aria-label="Uppy Dialog Window (Press escape to close)"\n                   role="dialog">\n      <div class="UppyModal-overlay"\n                  onclick=', '></div>\n        <div class="UppyModal-inner" tabindex="0">\n        <ul class="UppyModalTabs" role="tablist">\n          ', '\n        </ul>\n\n        <div class="UppyModalContent">\n          <div class="UppyModal-presenter"></div>\n          ', '\n        </div>\n        <div class="UppyModal-progressindicators">\n          ', '\n        </div>\n        <button class="UppyModal-close"\n                title="Close Uppy modal"\n                onclick=', '>×</button>\n      </div>\n    </div>'], ['<div class="', '"\n                   aria-hidden="', '"\n                   aria-label="Uppy Dialog Window (Press escape to close)"\n                   role="dialog">\n      <div class="UppyModal-overlay"\n                  onclick=', '></div>\n        <div class="UppyModal-inner" tabindex="0">\n        <ul class="UppyModalTabs" role="tablist">\n          ', '\n        </ul>\n\n        <div class="UppyModalContent">\n          <div class="UppyModal-presenter"></div>\n          ', '\n        </div>\n        <div class="UppyModal-progressindicators">\n          ', '\n        </div>\n        <button class="UppyModal-close"\n                title="Close Uppy modal"\n                onclick=', '>×</button>\n      </div>\n    </div>']),
    _templateObject3 = _taggedTemplateLiteralLoose(['<li class="UppyModalTab">\n              <button class="UppyModalTab-btn"\n                      role="tab"\n                      tabindex="0"\n                      aria-controls="', '--', '"\n                      aria-selected="', '"\n                      onclick=', '>\n                ', '\n                <span class="UppyModalTab-name">', '</span>\n              </button>\n            </li>'], ['<li class="UppyModalTab">\n              <button class="UppyModalTab-btn"\n                      role="tab"\n                      tabindex="0"\n                      aria-controls="', '--', '"\n                      aria-selected="', '"\n                      onclick=', '>\n                ', '\n                <span class="UppyModalTab-name">', '</span>\n              </button>\n            </li>']),
    _templateObject4 = _taggedTemplateLiteralLoose(['<div class="UppyModalContent-panel"\n                           id="', '--', '"\n                           role="tabpanel"\n                           aria-hidden="', '">\n              ', '\n            </div>'], ['<div class="UppyModalContent-panel"\n                           id="', '--', '"\n                           role="tabpanel"\n                           aria-hidden="', '">\n              ', '\n            </div>']);

var _Plugin2 = require('./Plugin');

var _Plugin3 = _interopRequireDefault(_Plugin2);

var _yoYo = require('yo-yo');

var _yoYo2 = _interopRequireDefault(_yoYo);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _taggedTemplateLiteralLoose(strings, raw) { strings.raw = raw; return strings; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * Modal
 *
 */

var Modal = function (_Plugin) {
  _inherits(Modal, _Plugin);

  function Modal(core, opts) {
    _classCallCheck(this, Modal);

    var _this = _possibleConstructorReturn(this, _Plugin.call(this, core, opts));

    _this.id = 'Modal';
    _this.title = 'Modal';
    _this.type = 'orchestrator';

    // set default options
    var defaultOptions = {
      target: '.UppyModal',
      defaultTabIcon: (0, _yoYo2.default)(_templateObject),
      panelSelectorPrefix: 'UppyModalContent-panel'
    };

    // merge default options with the ones set by user
    _this.opts = _extends({}, defaultOptions, opts);

    _this.hideModal = _this.hideModal.bind(_this);
    _this.showModal = _this.showModal.bind(_this);

    _this.addTarget = _this.addTarget.bind(_this);
    _this.showTabPanel = _this.showTabPanel.bind(_this);
    _this.events = _this.events.bind(_this);
    _this.render = _this.render.bind(_this);
    _this.install = _this.install.bind(_this);
    return _this;
  }

  Modal.prototype.addTarget = function addTarget(plugin) {
    var callerPluginId = plugin.constructor.name;
    var callerPluginName = plugin.title || callerPluginId;
    var callerPluginIcon = plugin.icon || this.opts.defaultTabIcon;
    var callerPluginType = plugin.type;

    if (callerPluginType !== 'acquirer' && callerPluginType !== 'progressindicator' && callerPluginType !== 'presenter') {
      var msg = 'Error: Modal can only be used by plugins of types: acquirer, progressindicator, presenter';
      this.core.log(msg);
      return;
    }

    var target = {
      id: callerPluginId,
      name: callerPluginName,
      icon: callerPluginIcon,
      type: callerPluginType,
      focus: plugin.focus,
      render: plugin.render,
      isHidden: true
    };

    var modal = this.core.getState().modal;

    this.core.setState({
      modal: _extends({}, modal, {
        targets: modal.targets.concat([target])
      })
    });

    return this.opts.target;
  };

  Modal.prototype.showTabPanel = function showTabPanel(id) {
    var modal = this.core.getState().modal;

    // hide all panels, except the one that matches current id
    var newTargets = modal.targets.map(function (target) {
      if (target.type === 'acquirer') {
        if (target.id === id) {
          target.focus();
          return _extends({}, target, {
            isHidden: false
          });
        }
        return _extends({}, target, {
          isHidden: true
        });
      }
      return target;
    });

    this.core.setState({ modal: _extends({}, modal, {
        targets: newTargets
      }) });
  };

  Modal.prototype.hideModal = function hideModal() {
    // Straightforward simple way
    // this.core.state.modal.isHidden = true
    // this.core.updateAll()

    // The “right way”
    var modal = this.core.getState().modal;

    var newTargets = modal.targets.map(function (target) {
      target.isHidden = true;
      return target;
    });

    this.core.setState({
      modal: _extends({}, modal, {
        isHidden: true,
        targets: newTargets
      })
    });

    document.body.classList.remove('is-UppyModal-open');
  };

  Modal.prototype.showModal = function showModal() {
    var modal = this.core.getState().modal;

    // Show first acquirer plugin when modal is open
    var found = false;
    var newTargets = modal.targets.map(function (target) {
      if (target.type === 'acquirer' && !found) {
        found = true;
        target.focus();

        return _extends({}, target, {
          isHidden: false
        });
      }
      return target;
    });

    this.core.setState({
      modal: _extends({}, modal, {
        isHidden: false,
        targets: newTargets
      })
    });

    // add class to body that sets position fixed
    document.body.classList.add('is-UppyModal-open');
    // focus on modal inner block
    document.querySelector('*[tabindex="0"]').focus();
  };

  Modal.prototype.events = function events() {
    var _this2 = this;

    // Modal open button
    var showModalTrigger = document.querySelector(this.opts.trigger);
    showModalTrigger.addEventListener('click', this.showModal);

    // Close the Modal on esc key press
    document.body.addEventListener('keyup', function (event) {
      if (event.keyCode === 27) {
        _this2.hideModal();
      }
    });

    // Close on click outside modal or close buttons
    document.addEventListener('click', function (e) {
      if (e.target.classList.contains('js-UppyModal-close')) {
        _this2.hideModal();
      }
    });
  };

  Modal.prototype.render = function render(state) {
    var _this3 = this;

    // http://dev.edenspiekermann.com/2016/02/11/introducing-accessible-modal-dialog

    var modalTargets = state.modal.targets;

    var acquirers = modalTargets.filter(function (target) {
      return target.type === 'acquirer';
    });

    var progressindicators = modalTargets.filter(function (target) {
      return target.type === 'progressindicator';
    });

    var targetClassName = this.opts.target.substring(1);

    return (0, _yoYo2.default)(_templateObject2, targetClassName, state.modal.isHidden, this.hideModal, acquirers.map(function (target) {
      return (0, _yoYo2.default)(_templateObject3, _this3.opts.panelSelectorPrefix, target.id, target.isHidden ? 'false' : 'true', _this3.showTabPanel.bind(_this3, target.id), target.icon, target.name);
    }), acquirers.map(function (target) {
      return (0, _yoYo2.default)(_templateObject4, _this3.opts.panelSelectorPrefix, target.id, target.isHidden, target.render(state));
    }), progressindicators.map(function (target) {
      return target.render(state);
    }), this.hideModal);
  };

  Modal.prototype.install = function install() {
    // Set default state for Modal
    this.core.setState({ modal: {
        isHidden: true,
        targets: []
      } });

    this.el = this.render(this.core.state);
    document.body.appendChild(this.el);

    this.events();
  };

  return Modal;
}(_Plugin3.default);

exports.default = Modal;

},{"./Plugin":27,"yo-yo":7}],26:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _Plugin2 = require('./Plugin');

var _Plugin3 = _interopRequireDefault(_Plugin2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _Promise = typeof Promise === 'undefined' ? require('es6-promise').Promise : Promise;

var Multipart = function (_Plugin) {
  _inherits(Multipart, _Plugin);

  function Multipart(core, opts) {
    _classCallCheck(this, Multipart);

    var _this = _possibleConstructorReturn(this, _Plugin.call(this, core, opts));

    _this.type = 'uploader';
    _this.id = 'Multipart';
    _this.title = 'Multipart';

    // Default options
    var defaultOptions = {
      fieldName: 'files[]',
      responseUrlFieldName: 'url',
      bundle: true
    };

    // Merge default options with the ones set by user
    _this.opts = _extends({}, defaultOptions, opts);
    return _this;
  }

  Multipart.prototype.upload = function upload(file, current, total) {
    var _this2 = this;

    this.core.log('uploading ' + current + ' of ' + total);
    return new _Promise(function (resolve, reject) {
      // turn file into an array so we can use bundle
      // if (!this.opts.bundle) {
      //   files = [files[current]]
      // }

      // for (let i in files) {
      //   formPost.append(this.opts.fieldName, files[i])
      // }

      var formPost = new FormData();
      formPost.append(_this2.opts.fieldName, file.data);

      var xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', function (ev) {
        if (ev.lengthComputable) {
          var percentage = (ev.loaded / ev.total * 100).toFixed(2);
          percentage = Math.round(percentage);
          _this2.core.log(percentage);

          // Dispatch progress event
          _this2.core.emitter.emit('upload-progress', {
            uploader: _this2,
            id: file.id,
            percentage: percentage
          });
        }
      });

      xhr.addEventListener('load', function (ev) {
        if (ev.target.status === 200) {
          var resp = JSON.parse(xhr.response);
          file.uploadURL = resp[_this2.opts.responseUrlFieldName];

          _this2.core.log('Download ' + file.name + ' from ' + file.uploadURL);
          return resolve(file);
        }

        // var upload = {}
        //
        // if (this.opts.bundle) {
        //   upload = {files: files}
        // } else {
        //   upload = {file: files[current]}
        // }

        // return resolve(upload)
      });

      xhr.addEventListener('error', function (ev) {
        return reject('fucking error!');
      });

      xhr.open('POST', _this2.opts.endpoint, true);
      xhr.send(formPost);
    });
  };

  Multipart.prototype.run = function run() {
    var _this3 = this;

    var files = this.core.state.files;

    var filesForUpload = [];
    Object.keys(files).forEach(function (file) {
      if (files[file].progress === 0) {
        filesForUpload.push(files[file]);
      }
    });

    var uploaders = [];
    filesForUpload.forEach(function (file, i) {
      var current = parseInt(i, 10) + 1;
      var total = filesForUpload.length;
      uploaders.push(_this3.upload(file, current, total));
    });

    Promise.all(uploaders).then(function (result) {
      _this3.core.log('Multipart has finished uploading!');
    });

    //   console.log({
    //     class: 'Multipart',
    //     method: 'run',
    //     results: results
    //   })
    //
    //   const files = results
    //
    //   var uploaders = []
    //
    //   if (this.opts.bundle) {
    //     uploaders.push(this.upload(files, 0, files.length))
    //   } else {
    //     for (let i in files) {
    //       uploaders.push(this.upload(files, i, files.length))
    //     }
    //   }
    //
    //   return Promise.all(uploaders)
  };

  Multipart.prototype.install = function install() {
    var _this4 = this;

    this.core.emitter.on('next', function () {
      _this4.core.log('Multipart is uploading...');
      _this4.run();
    });
  };

  return Multipart;
}(_Plugin3.default);

exports.default = Multipart;

},{"./Plugin":27,"es6-promise":4}],27:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _yoYo = require('yo-yo');

var _yoYo2 = _interopRequireDefault(_yoYo);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Boilerplate that all Plugins share - and should not be used
 * directly. It also shows which methods final plugins should implement/override,
 * this deciding on structure.
 *
 * @param {object} main Uppy core object
 * @param {object} object with plugin options
 * @return {array | string} files or success/fail message
 */

var Plugin = function () {
  function Plugin(core, opts) {
    _classCallCheck(this, Plugin);

    this.core = core;
    this.opts = opts;
    this.type = 'none';

    this.update = this.update.bind(this);
    this.mount = this.mount.bind(this);
    this.focus = this.focus.bind(this);
    this.install = this.install.bind(this);
  }

  Plugin.prototype.update = function update() {
    if (typeof this.el === 'undefined') {
      return;
    }

    var newEl = this.render(this.core.state);
    _yoYo2.default.update(this.el, newEl);
  };

  /**
   * Check if supplied `target` is a `string` or an `object`.
   * If it’s an object — target is a plugin, and we search `plugins`
   * for a plugin with same name and return its target.
   *
   * @param {String|Object} target
   *
   */


  Plugin.prototype.mount = function mount(target, plugin) {
    var callerPluginName = plugin.id;

    if (typeof target === 'string') {
      this.core.log('Installing ' + callerPluginName + ' to ' + target);

      // clear everything inside the target selector
      // if (replaceTargetContent) {
      //   document.querySelector(target).innerHTML = ''
      // }
      this.el = plugin.render(this.core.state);
      document.querySelector(target).appendChild(this.el);

      return target;
    } else {
      // TODO: is instantiating the plugin really the way to roll
      // just to get the plugin name?
      var Target = target;
      var targetPluginName = new Target().id;

      this.core.log('Installing ' + callerPluginName + ' to ' + targetPluginName);

      var targetPlugin = this.core.getPlugin(targetPluginName);
      var selectorTarget = targetPlugin.addTarget(plugin);

      return selectorTarget;
    }
  };

  Plugin.prototype.focus = function focus() {
    return;
  };

  Plugin.prototype.install = function install() {
    return;
  };

  Plugin.prototype.run = function run() {
    return;
  };

  return Plugin;
}();

exports.default = Plugin;

},{"yo-yo":7}],28:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _Plugin2 = require('./Plugin');

var _Plugin3 = _interopRequireDefault(_Plugin2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * Present
 *
 */

var Present = function (_Plugin) {
  _inherits(Present, _Plugin);

  function Present(core, opts) {
    _classCallCheck(this, Present);

    var _this = _possibleConstructorReturn(this, _Plugin.call(this, core, opts));

    _this.id = 'Present';
    _this.title = 'Present';
    _this.type = 'presenter';

    // set default options
    var defaultOptions = {
      target: '.UppyPresenter-container'
    };

    // merge default options with the ones set by user
    _this.opts = _extends({}, defaultOptions, opts);
    return _this;
  }

  Present.prototype.render = function render() {
    return '\n      <div class="UppyPresenter"></div>\n    ';
  };

  Present.prototype.hidePresenter = function hidePresenter() {
    this.presenter.classList.remove('is-visible');
  };

  Present.prototype.showPresenter = function showPresenter(target, uploadedCount) {
    this.presenter.classList.add('is-visible');
    this.presenter.innerHTML = '\n      <p>You have successfully uploaded\n        <strong>' + this.core.i18n('files', { 'smart_count': uploadedCount }) + '</strong>\n      </p>\n      ' + (target === 'Modal' ? '<button class="UppyPresenter-modalClose js-UppyModal-close" type="button">' + this.core.i18n('closeModal') + '</button>' : '') + '\n    ';
  };

  Present.prototype.initEvents = function initEvents() {
    var _this2 = this;

    this.core.emitter.on('reset', function (data) {
      _this2.hidePresenter();
    });
  };

  Present.prototype.run = function run(results) {
    // Emit allDone event so that, for example, Modal can hide all tabs
    this.core.emitter.emit('allDone');

    var uploadedCount = results[0].uploadedCount;
    var target = this.opts.target.name;
    this.showPresenter(target, uploadedCount);
  };

  Present.prototype.install = function install() {
    var caller = this;
    this.target = this.getTarget(this.opts.target, caller);
    this.targetEl = document.querySelector(this.target);
    this.targetEl.innerHTML = this.render();
    this.initEvents();
    this.presenter = document.querySelector('.UppyPresenter');

    return;
  };

  return Present;
}(_Plugin3.default);

exports.default = Present;

},{"./Plugin":27}],29:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _templateObject = _taggedTemplateLiteralLoose(['<div class="UppyProgressBar">\n      <div class="UppyProgressBar-inner" style="width: ', '%"></div>\n      <div class="UppyProgressBar-percentage">', '</div>\n    </div>'], ['<div class="UppyProgressBar">\n      <div class="UppyProgressBar-inner" style="width: ', '%"></div>\n      <div class="UppyProgressBar-percentage">', '</div>\n    </div>']);

var _Plugin2 = require('./Plugin');

var _Plugin3 = _interopRequireDefault(_Plugin2);

var _yoYo = require('yo-yo');

var _yoYo2 = _interopRequireDefault(_yoYo);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _taggedTemplateLiteralLoose(strings, raw) { strings.raw = raw; return strings; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * Progress bar
 *
 */

var ProgressBar = function (_Plugin) {
  _inherits(ProgressBar, _Plugin);

  function ProgressBar(core, opts) {
    _classCallCheck(this, ProgressBar);

    var _this = _possibleConstructorReturn(this, _Plugin.call(this, core, opts));

    _this.id = 'ProgressBar';
    _this.title = 'Progress Bar';
    _this.type = 'progressindicator';

    // set default options
    var defaultOptions = {
      replaceTargetContent: false
    };

    // merge default options with the ones set by user
    _this.opts = _extends({}, defaultOptions, opts);

    _this.render = _this.render.bind(_this);
    return _this;
  }

  ProgressBar.prototype.render = function render(state) {
    var progress = state.totalProgress || 0;

    return (0, _yoYo2.default)(_templateObject, progress, progress);
  };

  ProgressBar.prototype.install = function install() {
    var target = this.opts.target;
    var plugin = this;
    this.target = this.mount(target, plugin);
  };

  return ProgressBar;
}(_Plugin3.default);

exports.default = ProgressBar;

},{"./Plugin":27,"yo-yo":7}],30:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _templateObject = _taggedTemplateLiteralLoose(['<svg class="UppyProgressDrawer-itemCheck" width="16" height="16" viewBox="0 0 32 32" enable-background="new 0 0 32 32">\n        <polygon points="2.836,14.708 5.665,11.878 13.415,19.628 26.334,6.712 29.164,9.54 13.415,25.288 "></polygon>\n      </svg>'], ['<svg class="UppyProgressDrawer-itemCheck" width="16" height="16" viewBox="0 0 32 32" enable-background="new 0 0 32 32">\n        <polygon points="2.836,14.708 5.665,11.878 13.415,19.628 26.334,6.712 29.164,9.54 13.415,25.288 "></polygon>\n      </svg>']),
    _templateObject2 = _taggedTemplateLiteralLoose(['\n      <svg width="34" height="44" viewBox="0 0 21 29">\n        <path d="M2.473.31C1.44.31.59 1.21.59 2.307V26.31c0 1.097.85 2 1.883 2H18.71c1.03 0 1.88-.903 1.88-2V7.746a.525.525 0 0 0-.014-.108v-.015a.51.51 0 0 0-.014-.03v-.017a.51.51 0 0 0-.015-.03.482.482 0 0 0-.014-.016v-.015a.482.482 0 0 0-.015-.015.51.51 0 0 0-.014-.03.482.482 0 0 0-.014-.017.51.51 0 0 0-.015-.03.483.483 0 0 0-.03-.03L13.636.45a.47.47 0 0 0-.118-.093.448.448 0 0 0-.044-.015.448.448 0 0 0-.044-.016.448.448 0 0 0-.045-.015.44.44 0 0 0-.073 0H2.474zm0 .99h10.372v4.943c0 1.097.85 2 1.88 2h4.932V26.31c0 .56-.42 1.007-.948 1.007H2.472c-.527 0-.95-.446-.95-1.007V2.308c0-.56.423-1.008.95-1.008zm11.305.667l4.843 4.927.352.357h-4.246c-.527 0-.948-.446-.948-1.007V1.967z"\n              fill="#F6A623"\n              fill-rule="evenodd" />\n        <text font-family="ArialMT, Arial"\n              font-size="5"\n              font-weight="bold"\n              fill="#F6A623"\n              text-anchor="middle"\n              x="11"\n              y="22">\n          ', '\n        </text>\n      </svg>\n    '], ['\n      <svg width="34" height="44" viewBox="0 0 21 29">\n        <path d="M2.473.31C1.44.31.59 1.21.59 2.307V26.31c0 1.097.85 2 1.883 2H18.71c1.03 0 1.88-.903 1.88-2V7.746a.525.525 0 0 0-.014-.108v-.015a.51.51 0 0 0-.014-.03v-.017a.51.51 0 0 0-.015-.03.482.482 0 0 0-.014-.016v-.015a.482.482 0 0 0-.015-.015.51.51 0 0 0-.014-.03.482.482 0 0 0-.014-.017.51.51 0 0 0-.015-.03.483.483 0 0 0-.03-.03L13.636.45a.47.47 0 0 0-.118-.093.448.448 0 0 0-.044-.015.448.448 0 0 0-.044-.016.448.448 0 0 0-.045-.015.44.44 0 0 0-.073 0H2.474zm0 .99h10.372v4.943c0 1.097.85 2 1.88 2h4.932V26.31c0 .56-.42 1.007-.948 1.007H2.472c-.527 0-.95-.446-.95-1.007V2.308c0-.56.423-1.008.95-1.008zm11.305.667l4.843 4.927.352.357h-4.246c-.527 0-.948-.446-.948-1.007V1.967z"\n              fill="#F6A623"\n              fill-rule="evenodd" />\n        <text font-family="ArialMT, Arial"\n              font-size="5"\n              font-weight="bold"\n              fill="#F6A623"\n              text-anchor="middle"\n              x="11"\n              y="22">\n          ', '\n        </text>\n      </svg>\n    ']),
    _templateObject3 = _taggedTemplateLiteralLoose(['<li id="', '" class="UppyProgressDrawer-item"\n                  title="', '">\n      <div class="UppyProgressDrawer-itemInfo">\n          ', '\n      </div>\n      <div class="UppyProgressDrawer-itemInner">\n        <h4 class="UppyProgressDrawer-itemName">\n          ', '\n          <br>\n        </h4>\n        <h5 class="UppyProgressDrawer-itemStatus">\n          ', '\n          ', '\n        </h5>\n          ', '\n          ', '\n          <div class="UppyProgressDrawer-itemProgress"\n               style="width: ', '%"></div>\n      </div>\n    </li>'], ['<li id="', '" class="UppyProgressDrawer-item"\n                  title="', '">\n      <div class="UppyProgressDrawer-itemInfo">\n          ', '\n      </div>\n      <div class="UppyProgressDrawer-itemInner">\n        <h4 class="UppyProgressDrawer-itemName">\n          ', '\n          <br>\n        </h4>\n        <h5 class="UppyProgressDrawer-itemStatus">\n          ', '\n          ', '\n        </h5>\n          ', '\n          ', '\n          <div class="UppyProgressDrawer-itemProgress"\n               style="width: ', '%"></div>\n      </div>\n    </li>']),
    _templateObject4 = _taggedTemplateLiteralLoose(['<a href="', '" target="_blank">', '</a>'], ['<a href="', '" target="_blank">', '</a>']),
    _templateObject5 = _taggedTemplateLiteralLoose(['<span>', '</span>'], ['<span>', '</span>']),
    _templateObject6 = _taggedTemplateLiteralLoose(['<button class="UppyProgressDrawer-itemRemove" onclick=', '>×</button>'], ['<button class="UppyProgressDrawer-itemRemove" onclick=', '>×</button>']),
    _templateObject7 = _taggedTemplateLiteralLoose(['<div class="UppyProgressDrawer ', '">\n      <ul class="UppyProgressDrawer-list">\n        ', '\n      </ul>\n      ', '\n    </div>'], ['<div class="UppyProgressDrawer ', '">\n      <ul class="UppyProgressDrawer-list">\n        ', '\n      </ul>\n      ', '\n    </div>']),
    _templateObject8 = _taggedTemplateLiteralLoose(['<button class="UppyProgressDrawer-upload ', '"\n                     type="button"\n                     onclick=', '>\n          ', '\n        </button>'], ['<button class="UppyProgressDrawer-upload ', '"\n                     type="button"\n                     onclick=', '>\n          ', '\n        </button>']);

var _Plugin2 = require('./Plugin');

var _Plugin3 = _interopRequireDefault(_Plugin2);

var _yoYo = require('yo-yo');

var _yoYo2 = _interopRequireDefault(_yoYo);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _taggedTemplateLiteralLoose(strings, raw) { strings.raw = raw; return strings; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * Progress drawer
 *
 */

var ProgressDrawer = function (_Plugin) {
  _inherits(ProgressDrawer, _Plugin);

  function ProgressDrawer(core, opts) {
    _classCallCheck(this, ProgressDrawer);

    var _this = _possibleConstructorReturn(this, _Plugin.call(this, core, opts));

    _this.id = 'ProgressDrawer';
    _this.title = 'Progress Drawer';
    _this.type = 'progressindicator';

    // set default options
    var defaultOptions = {};

    // merge default options with the ones set by user
    _this.opts = _extends({}, defaultOptions, opts);

    _this.render = _this.render.bind(_this);
    return _this;
  }

  ProgressDrawer.prototype.drawerItem = function drawerItem(file) {
    var _this2 = this;

    var isUploaded = file.progress === 100;

    var remove = function remove(ev) {
      _this2.core.emitter.emit('file-remove', file.id);
    };

    var checkIcon = (0, _yoYo2.default)(_templateObject);

    var fileIcon = (0, _yoYo2.default)(_templateObject2, file.type.specific ? file.type.specific.toUpperCase() : '?');

    return (0, _yoYo2.default)(_templateObject3, file.id, file.name, file.type.general === 'image' ? file.previewEl : fileIcon, file.uploadURL ? (0, _yoYo2.default)(_templateObject4, file.uploadURL, file.name) : (0, _yoYo2.default)(_templateObject5, file.name), file.progress > 0 && file.progress < 100 ? 'Uploading… ' + file.progress + '%' : '', file.progress === 100 ? 'Completed' : '', isUploaded ? checkIcon : '', isUploaded ? '' : (0, _yoYo2.default)(_templateObject6, remove), file.progress);
  };

  ProgressDrawer.prototype.render = function render(state) {
    var _this3 = this;

    var files = state.files;

    var selectedFiles = Object.keys(files).filter(function (file) {
      return files[file].progress !== 100;
    });

    var uploadedFiles = Object.keys(files).filter(function (file) {
      return files[file].progress === 100;
    });

    var selectedFileCount = Object.keys(selectedFiles).length;
    var uploadedFileCount = Object.keys(uploadedFiles).length;

    var isSomethingSelected = selectedFileCount > 0;
    var isSomethingUploaded = uploadedFileCount > 0;
    var isSomethingSelectedOrUploaded = isSomethingSelected || isSomethingUploaded;

    var autoProceed = this.core.opts.autoProceed;

    var next = function next(ev) {
      _this3.core.emitter.emit('next');
    };

    return (0, _yoYo2.default)(_templateObject7, isSomethingSelectedOrUploaded ? 'is-visible' : '', Object.keys(files).map(function (fileID) {
      return _this3.drawerItem(files[fileID]);
    }), autoProceed ? '' : (0, _yoYo2.default)(_templateObject8, isSomethingSelected ? 'is-active' : '', next, isSomethingSelected ? this.core.i18n('uploadFiles', { 'smart_count': selectedFileCount }) : this.core.i18n('selectToUpload')));

    // TODO: add this info to the upload button?
    //    <div class="UppyProgressDrawer-status">
    //      ${isSomethingSelected ? this.core.i18n('filesChosen', {'smart_count': selectedFileCount}) : ''}
    //      ${isSomethingSelected && isSomethingUploaded ? ', ' : ''}
    //      ${isSomethingUploaded ? this.core.i18n('filesUploaded', {'smart_count': uploadedFileCount}) : ''}
    //    </div>
  };

  ProgressDrawer.prototype.install = function install() {
    var target = this.opts.target;
    var plugin = this;
    this.target = this.mount(target, plugin);
  };

  return ProgressDrawer;
}(_Plugin3.default);

exports.default = ProgressDrawer;

},{"./Plugin":27,"yo-yo":7}],31:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _Plugin2 = require('./Plugin');

var _Plugin3 = _interopRequireDefault(_Plugin2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * Spinner
 *
 */

var Spinner = function (_Plugin) {
  _inherits(Spinner, _Plugin);

  function Spinner(core, opts) {
    _classCallCheck(this, Spinner);

    var _this = _possibleConstructorReturn(this, _Plugin.call(this, core, opts));

    _this.type = 'progressindicator';
    _this.id = 'Spinner';
    _this.title = 'Spinner';

    // set default options
    var defaultOptions = {};

    // merge default options with the ones set by user
    _this.opts = _extends({}, defaultOptions, opts);
    return _this;
  }

  Spinner.prototype.setProgress = function setProgress(percentage) {
    if (percentage !== 100) {
      this.spinnerEl.classList.add('is-spinning');
    } else {
      this.spinnerEl.classList.remove('is-spinning');
    }
  };

  Spinner.prototype.initSpinner = function initSpinner() {
    var spinnerContainer = document.querySelector(this.target);
    spinnerContainer.innerHTML = '<div class="UppySpinner"></div>';
    this.spinnerEl = document.querySelector(this.target + ' .UppySpinner');
  };

  Spinner.prototype.initEvents = function initEvents() {
    var _this2 = this;

    this.core.emitter.on('upload-progress', function (data) {
      var percentage = data.percentage;
      var plugin = data.plugin;
      _this2.core.log('progress is: ' + percentage + ', set by ' + plugin.constructor.name);
      _this2.setProgress(percentage);
    });
  };

  Spinner.prototype.install = function install() {
    var caller = this;
    this.target = this.getTarget(this.opts.target, caller);

    this.initSpinner();
    this.initEvents();
    return;
  };

  return Spinner;
}(_Plugin3.default);

exports.default = Spinner;

},{"./Plugin":27}],32:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _Plugin2 = require('./Plugin');

var _Plugin3 = _interopRequireDefault(_Plugin2);

var _DragDrop = require('./DragDrop');

var _DragDrop2 = _interopRequireDefault(_DragDrop);

var _Tus = require('./Tus10');

var _Tus2 = _interopRequireDefault(_Tus);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var TransloaditBasic = function (_Plugin) {
  _inherits(TransloaditBasic, _Plugin);

  function TransloaditBasic(core, opts) {
    _classCallCheck(this, TransloaditBasic);

    var _this = _possibleConstructorReturn(this, _Plugin.call(this, core, opts));

    _this.type = 'presetter';
    _this.id = 'TransloaditBasic';
    _this.title = 'Transloadit Basic';
    _this.core.use(_DragDrop2.default, { modal: true, wait: true }).use(_Tus2.default, { endpoint: 'http://master.tus.io:8080' });
    return _this;
  }

  return TransloaditBasic;
}(_Plugin3.default);

exports.default = TransloaditBasic;

},{"./DragDrop":20,"./Plugin":27,"./Tus10":33}],33:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _Plugin2 = require('./Plugin');

var _Plugin3 = _interopRequireDefault(_Plugin2);

var _tusJsClient = require('tus-js-client');

var _tusJsClient2 = _interopRequireDefault(_tusJsClient);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _Promise = typeof Promise === 'undefined' ? require('es6-promise').Promise : Promise;

/**
 * Tus resumable file uploader
 *
 */

var Tus10 = function (_Plugin) {
  _inherits(Tus10, _Plugin);

  function Tus10(core, opts) {
    _classCallCheck(this, Tus10);

    var _this = _possibleConstructorReturn(this, _Plugin.call(this, core, opts));

    _this.type = 'uploader';
    _this.id = 'Tus';
    _this.title = 'Tus';

    // set default options
    var defaultOptions = {};

    // merge default options with the ones set by user
    _this.opts = _extends({}, defaultOptions, opts);
    return _this;
  }

  /**
   * Create a new Tus upload
   *
   * @param {object} file for use with upload
   * @param {integer} current file in a queue
   * @param {integer} total number of files in a queue
   * @returns {Promise}
   */


  Tus10.prototype.upload = function upload(file, current, total) {
    var _this2 = this;

    this.core.log('uploading ' + current + ' of ' + total);

    // Create a new tus upload
    return new _Promise(function (resolve, reject) {
      var upload = new _tusJsClient2.default.Upload(file.data, {

        // TODO merge this.opts or this.opts.tus here
        resume: false,
        endpoint: _this2.opts.endpoint,
        onError: function onError(error) {
          reject('Failed because: ' + error);
        },
        onProgress: function onProgress(bytesUploaded, bytesTotal) {
          var percentage = (bytesUploaded / bytesTotal * 100).toFixed(2);
          percentage = Math.round(percentage);

          // Dispatch progress event
          _this2.core.emitter.emit('upload-progress', {
            uploader: _this2,
            id: file.id,
            percentage: percentage
          });
        },
        onSuccess: function onSuccess() {
          file.uploadURL = upload.url;
          _this2.core.emitter.emit('upload-success', file);

          _this2.core.log('Download ' + upload.file.name + ' from ' + upload.url);
          resolve(upload);
        }
      });
      upload.start();
    });
  };

  Tus10.prototype.install = function install() {
    var _this3 = this;

    this.core.emitter.on('next', function () {
      _this3.core.log('Tus is uploading..');
      var files = _this3.core.state.files;

      var filesForUpload = {};
      Object.keys(files).forEach(function (file) {
        if (files[file].progress === 0 || files[file].remote) {
          filesForUpload[file] = files[file];
        }
      });

      _this3.uploadFiles(filesForUpload);
    });
  };

  Tus10.prototype.uploadFiles = function uploadFiles(files) {
    var uploaders = [];
    for (var i in files) {
      var file = files[i];
      var current = parseInt(i, 10) + 1;
      var total = files.length;

      if (files[i].remote) {
        uploaders.push(this.uploadRemote(file, current, total));
      } else {
        uploaders.push(this.upload(file, current, total));
      }
    }

    return Promise.all(uploaders).then(function () {
      return {
        uploadedCount: files.length
      };
    });
  };

  Tus10.prototype.uploadRemote = function uploadRemote(file, current, total) {
    var _this4 = this;

    return new _Promise(function (resolve, reject) {
      var payload = _extends({}, file.remote.payload, {
        target: _this4.opts.endpoint,
        protocol: 'tus'
      });
      _this4.core.socket.send(file.remote.action, payload);
      _this4.core.socket.once('upload-success', function () {
        console.log('success');
        _this4.core.emitter.emit('upload-success', file);

        _this4.core.emitter.emit('upload-progress', {
          id: file.id,
          percentage: 100
        });

        resolve();
      });
    });
  };

  /**
   * Add files to an array of `upload()` calles, passing the current and total file count numbers
   *
   * @param {Array | Object} results
   * @returns {Promise} of parallel uploads `Promise.all(uploaders)`
   */


  Tus10.prototype.run = function run(results) {
    this.core.log({
      class: this.constructor.name,
      method: 'run',
      results: results
    });

    return this.uploadFiles(results);
  };

  return Tus10;
}(_Plugin3.default);

exports.default = Tus10;

},{"./Plugin":27,"es6-promise":4,"tus-js-client":5}],34:[function(require,module,exports){

},{}],35:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    args = Array.prototype.slice.call(arguments, 1);
    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else if (listeners) {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.prototype.listenerCount = function(type) {
  if (this._events) {
    var evlistener = this._events[type];

    if (isFunction(evlistener))
      return 1;
    else if (evlistener)
      return evlistener.length;
  }
  return 0;
};

EventEmitter.listenerCount = function(emitter, type) {
  return emitter.listenerCount(type);
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],36:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        setTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],37:[function(require,module,exports){
'use strict';

exports.__esModule = true;
var uppyServerEndpoint = 'http://localhost:3020';

if (location.hostname === 'uppy.io') {
  uppyServerEndpoint = 'http://server.uppy.io:3020';
}

// uppyServerEndpoint = 'http://server.uppy.io:3020'
var UPPY_SERVER = exports.UPPY_SERVER = uppyServerEndpoint;

},{}],38:[function(require,module,exports){
'use strict';

var _Core = require('../../../../src/core/Core.js');

var _Core2 = _interopRequireDefault(_Core);

var _Dummy = require('../../../../src/plugins/Dummy.js');

var _Dummy2 = _interopRequireDefault(_Dummy);

var _Tus = require('../../../../src/plugins/Tus10.js');

var _Tus2 = _interopRequireDefault(_Tus);

var _Modal = require('../../../../src/plugins/Modal.js');

var _Modal2 = _interopRequireDefault(_Modal);

var _DragDrop = require('../../../../src/plugins/DragDrop.js');

var _DragDrop2 = _interopRequireDefault(_DragDrop);

var _GoogleDrive = require('../../../../src/plugins/GoogleDrive.js');

var _GoogleDrive2 = _interopRequireDefault(_GoogleDrive);

var _ProgressBar = require('../../../../src/plugins/ProgressBar.js');

var _ProgressBar2 = _interopRequireDefault(_ProgressBar);

var _ProgressDrawer = require('../../../../src/plugins/ProgressDrawer.js');

var _ProgressDrawer2 = _interopRequireDefault(_ProgressDrawer);

var _env = require('../env');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var uppy = new _Core2.default({ debug: true, autoProceed: false });
uppy.use(_Modal2.default, { trigger: '#uppyModalOpener' }).use(_ProgressBar2.default, { target: 'body' }).use(_DragDrop2.default, { target: _Modal2.default }).use(_GoogleDrive2.default, { target: _Modal2.default, host: _env.UPPY_SERVER }).use(_Dummy2.default, { target: _Modal2.default }).use(_Tus2.default, { endpoint: 'http://master.tus.io:8080/files/' }).use(_ProgressDrawer2.default, { target: _Modal2.default }).run();

},{"../../../../src/core/Core.js":14,"../../../../src/plugins/DragDrop.js":20,"../../../../src/plugins/Dummy.js":22,"../../../../src/plugins/GoogleDrive.js":24,"../../../../src/plugins/Modal.js":25,"../../../../src/plugins/ProgressBar.js":29,"../../../../src/plugins/ProgressDrawer.js":30,"../../../../src/plugins/Tus10.js":33,"../env":37}],"uppy/core":[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _Core = require('./Core');

var _Core2 = _interopRequireDefault(_Core);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = _Core2.default;

},{"./Core":14}],"uppy/locales":[function(require,module,exports){
'use strict';

var _en_US = require('./en_US');

var _en_US2 = _interopRequireDefault(_en_US);

var _ru_RU = require('./ru_RU');

var _ru_RU2 = _interopRequireDefault(_ru_RU);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// Parent


module.exports = {
  en_US: _en_US2.default,
  ru_RU: _ru_RU2.default
};

},{"./en_US":18,"./ru_RU":19}],"uppy/plugins":[function(require,module,exports){
'use strict';

var _Plugin = require('./Plugin');

var _Plugin2 = _interopRequireDefault(_Plugin);

var _Modal = require('./Modal');

var _Modal2 = _interopRequireDefault(_Modal);

var _Dummy = require('./Dummy');

var _Dummy2 = _interopRequireDefault(_Dummy);

var _DragDrop = require('./DragDrop');

var _DragDrop2 = _interopRequireDefault(_DragDrop);

var _Dropbox = require('./Dropbox');

var _Dropbox2 = _interopRequireDefault(_Dropbox);

var _Formtag = require('./Formtag');

var _Formtag2 = _interopRequireDefault(_Formtag);

var _GoogleDrive = require('./GoogleDrive');

var _GoogleDrive2 = _interopRequireDefault(_GoogleDrive);

var _ProgressBar = require('./ProgressBar');

var _ProgressBar2 = _interopRequireDefault(_ProgressBar);

var _Spinner = require('./Spinner');

var _Spinner2 = _interopRequireDefault(_Spinner);

var _Tus = require('./Tus10');

var _Tus2 = _interopRequireDefault(_Tus);

var _Multipart = require('./Multipart');

var _Multipart2 = _interopRequireDefault(_Multipart);

var _Present = require('./Present');

var _Present2 = _interopRequireDefault(_Present);

var _TransloaditBasic = require('./TransloaditBasic');

var _TransloaditBasic2 = _interopRequireDefault(_TransloaditBasic);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// Presenters


// Uploaders


// Progressindicators


// Orchestrators


module.exports = {
  Plugin: _Plugin2.default,
  Dummy: _Dummy2.default,
  ProgressBar: _ProgressBar2.default,
  Spinner: _Spinner2.default,
  Present: _Present2.default,
  DragDrop: _DragDrop2.default,
  Dropbox: _Dropbox2.default,
  GoogleDrive: _GoogleDrive2.default,
  Formtag: _Formtag2.default,
  Tus10: _Tus2.default,
  Multipart: _Multipart2.default,
  TransloaditBasic: _TransloaditBasic2.default,
  Modal: _Modal2.default
};

// Presetters


// Acquirers
// Parent

},{"./DragDrop":20,"./Dropbox":21,"./Dummy":22,"./Formtag":23,"./GoogleDrive":24,"./Modal":25,"./Multipart":26,"./Plugin":27,"./Present":28,"./ProgressBar":29,"./Spinner":31,"./TransloaditBasic":32,"./Tus10":33}],"uppy":[function(require,module,exports){
'use strict';

exports.__esModule = true;
exports.locales = exports.plugins = exports.Core = undefined;

var _index = require('./core/index');

var _index2 = _interopRequireDefault(_index);

var _index3 = require('./plugins/index');

var _index4 = _interopRequireDefault(_index3);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var locales = {};

exports.Core = _index2.default;
exports.plugins = _index4.default;
exports.locales = locales;

},{"./core/index":"uppy/core","./plugins/index":"uppy/plugins"}]},{},[38])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIuLi9ub2RlX21vZHVsZXMvZHJhZy1kcm9wL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL2RyYWctZHJvcC9ub2RlX21vZHVsZXMvZmxhdHRlbi9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9kcmFnLWRyb3Avbm9kZV9tb2R1bGVzL3J1bi1wYXJhbGxlbC9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9lczYtcHJvbWlzZS9kaXN0L2VzNi1wcm9taXNlLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3R1cy1qcy1jbGllbnQvZGlzdC90dXMuanMiLCIuLi9ub2RlX21vZHVsZXMvd2hhdHdnLWZldGNoL2ZldGNoLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3lvLXlvL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3lvLXlvL25vZGVfbW9kdWxlcy9iZWwvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMveW8teW8vbm9kZV9tb2R1bGVzL2JlbC9ub2RlX21vZHVsZXMvZ2xvYmFsL2RvY3VtZW50LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3lvLXlvL25vZGVfbW9kdWxlcy9iZWwvbm9kZV9tb2R1bGVzL2h5cGVyeC9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy95by15by9ub2RlX21vZHVsZXMvYmVsL25vZGVfbW9kdWxlcy9oeXBlcngvbm9kZV9tb2R1bGVzL2h5cGVyc2NyaXB0LWF0dHJpYnV0ZS10by1wcm9wZXJ0eS9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy95by15by9ub2RlX21vZHVsZXMvbW9ycGhkb20vbGliL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3lvLXlvL3VwZGF0ZS1ldmVudHMuanMiLCIuLi9zcmMvY29yZS9Db3JlLmpzIiwiLi4vc3JjL2NvcmUvVHJhbnNsYXRvci5qcyIsIi4uL3NyYy9jb3JlL1VwcHlTb2NrZXQuanMiLCIuLi9zcmMvY29yZS9VdGlscy5qcyIsIi4uL3NyYy9sb2NhbGVzL2VuX1VTLmpzIiwiLi4vc3JjL2xvY2FsZXMvcnVfUlUuanMiLCIuLi9zcmMvcGx1Z2lucy9EcmFnRHJvcC5qcyIsIi4uL3NyYy9wbHVnaW5zL0Ryb3Bib3guanMiLCIuLi9zcmMvcGx1Z2lucy9EdW1teS5qcyIsIi4uL3NyYy9wbHVnaW5zL0Zvcm10YWcuanMiLCIuLi9zcmMvcGx1Z2lucy9Hb29nbGVEcml2ZS5qcyIsIi4uL3NyYy9wbHVnaW5zL01vZGFsLmpzIiwiLi4vc3JjL3BsdWdpbnMvTXVsdGlwYXJ0LmpzIiwiLi4vc3JjL3BsdWdpbnMvUGx1Z2luLmpzIiwiLi4vc3JjL3BsdWdpbnMvUHJlc2VudC5qcyIsIi4uL3NyYy9wbHVnaW5zL1Byb2dyZXNzQmFyLmpzIiwiLi4vc3JjL3BsdWdpbnMvUHJvZ3Jlc3NEcmF3ZXIuanMiLCIuLi9zcmMvcGx1Z2lucy9TcGlubmVyLmpzIiwiLi4vc3JjL3BsdWdpbnMvVHJhbnNsb2FkaXRCYXNpYy5qcyIsIi4uL3NyYy9wbHVnaW5zL1R1czEwLmpzIiwibm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcmVzb2x2ZS9lbXB0eS5qcyIsIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9ldmVudHMvZXZlbnRzLmpzIiwibm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyIsInNyYy9leGFtcGxlcy9lbnYuanMiLCJzcmMvZXhhbXBsZXMvbW9kYWwvYXBwLmVzNiIsIi4uL3NyYy9jb3JlL2luZGV4LmpzIiwiLi4vc3JjL2xvY2FsZXMvaW5kZXguanMiLCIuLi9zcmMvcGx1Z2lucy9pbmRleC5qcyIsIi4uL3NyYy9pbmRleC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3ZCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQzlDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUMxN0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzdmQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2piQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3ZIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ2ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2UUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FB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QUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxU0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUMzRkEsSUFBSSxxQkFBcUIsdUJBQXpCOztBQUVBLElBQUksU0FBUyxRQUFULEtBQXNCLFNBQTFCLEVBQXFDO0FBQ25DLHVCQUFxQiw0QkFBckI7QUFDRDs7O0FBR00sSUFBTSxvQ0FBYyxrQkFBcEI7Ozs7O0FDUFA7Ozs7QUFDQTs7OztBQUNBOzs7O0FBQ0E7Ozs7QUFDQTs7OztBQUNBOzs7O0FBQ0E7Ozs7QUFDQTs7OztBQUVBOzs7O0FBRUEsSUFBTSxPQUFPLG1CQUFTLEVBQUMsT0FBTyxJQUFSLEVBQWMsYUFBYSxLQUEzQixFQUFULENBQWI7QUFDQSxLQUNHLEdBREgsa0JBQ2MsRUFBQyxTQUFTLGtCQUFWLEVBRGQsRUFFRyxHQUZILHdCQUVvQixFQUFDLFFBQVEsTUFBVCxFQUZwQixFQUdHLEdBSEgscUJBR2lCLEVBQUMsdUJBQUQsRUFIakIsRUFJRyxHQUpILHdCQUlvQixFQUFDLHVCQUFELEVBQWdCLHNCQUFoQixFQUpwQixFQUtHLEdBTEgsa0JBS2MsRUFBQyx1QkFBRCxFQUxkLEVBTUcsR0FOSCxnQkFNYyxFQUFDLFVBQVUsa0NBQVgsRUFOZCxFQU9HLEdBUEgsMkJBT3VCLEVBQUMsdUJBQUQsRUFQdkIsRUFRRyxHQVJIOzs7Ozs7O0FDWkE7Ozs7Ozs7Ozs7O0FDQ0E7Ozs7QUFDQTs7Ozs7Ozs7O0FBRUEsT0FBTyxPQUFQLEdBQWlCO0FBQ2Ysd0JBRGU7QUFFZjtBQUZlLENBQWpCOzs7OztBQ0hBOzs7O0FBR0E7Ozs7QUFHQTs7OztBQUNBOzs7O0FBQ0E7Ozs7QUFDQTs7OztBQUNBOzs7O0FBR0E7Ozs7QUFDQTs7OztBQUdBOzs7O0FBQ0E7Ozs7QUFHQTs7OztBQUdBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFQSxPQUFPLE9BQVAsR0FBaUI7QUFDZiwwQkFEZTtBQUVmLHdCQUZlO0FBR2Ysb0NBSGU7QUFJZiw0QkFKZTtBQUtmLDRCQUxlO0FBTWYsOEJBTmU7QUFPZiw0QkFQZTtBQVFmLG9DQVJlO0FBU2YsNEJBVGU7QUFVZixzQkFWZTtBQVdmLGdDQVhlO0FBWWYsOENBWmU7QUFhZjtBQWJlLENBQWpCOzs7Ozs7Ozs7Ozs7OztBQzNCQTs7OztBQUNBOzs7Ozs7QUFFQSxJQUFNLFVBQVUsRUFBaEI7O1FBR0UsSTtRQUNBLE87UUFDQSxPLEdBQUEsTyIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJtb2R1bGUuZXhwb3J0cyA9IGRyYWdEcm9wXG5cbnZhciBmbGF0dGVuID0gcmVxdWlyZSgnZmxhdHRlbicpXG52YXIgcGFyYWxsZWwgPSByZXF1aXJlKCdydW4tcGFyYWxsZWwnKVxuXG5mdW5jdGlvbiBkcmFnRHJvcCAoZWxlbSwgbGlzdGVuZXJzKSB7XG4gIGlmICh0eXBlb2YgZWxlbSA9PT0gJ3N0cmluZycpIHtcbiAgICBlbGVtID0gd2luZG93LmRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoZWxlbSlcbiAgfVxuXG4gIGlmICh0eXBlb2YgbGlzdGVuZXJzID09PSAnZnVuY3Rpb24nKSB7XG4gICAgbGlzdGVuZXJzID0geyBvbkRyb3A6IGxpc3RlbmVycyB9XG4gIH1cblxuICB2YXIgdGltZW91dFxuXG4gIGVsZW0uYWRkRXZlbnRMaXN0ZW5lcignZHJhZ2VudGVyJywgc3RvcEV2ZW50LCBmYWxzZSlcbiAgZWxlbS5hZGRFdmVudExpc3RlbmVyKCdkcmFnb3ZlcicsIG9uRHJhZ092ZXIsIGZhbHNlKVxuICBlbGVtLmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdsZWF2ZScsIG9uRHJhZ0xlYXZlLCBmYWxzZSlcbiAgZWxlbS5hZGRFdmVudExpc3RlbmVyKCdkcm9wJywgb25Ecm9wLCBmYWxzZSlcblxuICAvLyBGdW5jdGlvbiB0byByZW1vdmUgZHJhZy1kcm9wIGxpc3RlbmVyc1xuICByZXR1cm4gZnVuY3Rpb24gcmVtb3ZlICgpIHtcbiAgICByZW1vdmVEcmFnQ2xhc3MoKVxuICAgIGVsZW0ucmVtb3ZlRXZlbnRMaXN0ZW5lcignZHJhZ2VudGVyJywgc3RvcEV2ZW50LCBmYWxzZSlcbiAgICBlbGVtLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2RyYWdvdmVyJywgb25EcmFnT3ZlciwgZmFsc2UpXG4gICAgZWxlbS5yZW1vdmVFdmVudExpc3RlbmVyKCdkcmFnbGVhdmUnLCBvbkRyYWdMZWF2ZSwgZmFsc2UpXG4gICAgZWxlbS5yZW1vdmVFdmVudExpc3RlbmVyKCdkcm9wJywgb25Ecm9wLCBmYWxzZSlcbiAgfVxuXG4gIGZ1bmN0aW9uIG9uRHJhZ092ZXIgKGUpIHtcbiAgICBlLnN0b3BQcm9wYWdhdGlvbigpXG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgaWYgKGUuZGF0YVRyYW5zZmVyLml0ZW1zKSB7XG4gICAgICAvLyBPbmx5IGFkZCBcImRyYWdcIiBjbGFzcyB3aGVuIGBpdGVtc2AgY29udGFpbnMgYSBmaWxlXG4gICAgICB2YXIgaXRlbXMgPSB0b0FycmF5KGUuZGF0YVRyYW5zZmVyLml0ZW1zKS5maWx0ZXIoZnVuY3Rpb24gKGl0ZW0pIHtcbiAgICAgICAgcmV0dXJuIGl0ZW0ua2luZCA9PT0gJ2ZpbGUnXG4gICAgICB9KVxuICAgICAgaWYgKGl0ZW1zLmxlbmd0aCA9PT0gMCkgcmV0dXJuXG4gICAgfVxuXG4gICAgZWxlbS5jbGFzc0xpc3QuYWRkKCdkcmFnJylcbiAgICBjbGVhclRpbWVvdXQodGltZW91dClcblxuICAgIGlmIChsaXN0ZW5lcnMub25EcmFnT3Zlcikge1xuICAgICAgbGlzdGVuZXJzLm9uRHJhZ092ZXIoZSlcbiAgICB9XG5cbiAgICBlLmRhdGFUcmFuc2Zlci5kcm9wRWZmZWN0ID0gJ2NvcHknXG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cblxuICBmdW5jdGlvbiBvbkRyYWdMZWF2ZSAoZSkge1xuICAgIGUuc3RvcFByb3BhZ2F0aW9uKClcbiAgICBlLnByZXZlbnREZWZhdWx0KClcblxuICAgIGlmIChsaXN0ZW5lcnMub25EcmFnTGVhdmUpIHtcbiAgICAgIGxpc3RlbmVycy5vbkRyYWdMZWF2ZShlKVxuICAgIH1cblxuICAgIGNsZWFyVGltZW91dCh0aW1lb3V0KVxuICAgIHRpbWVvdXQgPSBzZXRUaW1lb3V0KHJlbW92ZURyYWdDbGFzcywgNTApXG5cbiAgICByZXR1cm4gZmFsc2VcbiAgfVxuXG4gIGZ1bmN0aW9uIG9uRHJvcCAoZSkge1xuICAgIGUuc3RvcFByb3BhZ2F0aW9uKClcbiAgICBlLnByZXZlbnREZWZhdWx0KClcblxuICAgIGlmIChsaXN0ZW5lcnMub25EcmFnTGVhdmUpIHtcbiAgICAgIGxpc3RlbmVycy5vbkRyYWdMZWF2ZShlKVxuICAgIH1cblxuICAgIGNsZWFyVGltZW91dCh0aW1lb3V0KVxuICAgIHJlbW92ZURyYWdDbGFzcygpXG5cbiAgICB2YXIgcG9zID0ge1xuICAgICAgeDogZS5jbGllbnRYLFxuICAgICAgeTogZS5jbGllbnRZXG4gICAgfVxuXG4gICAgaWYgKGUuZGF0YVRyYW5zZmVyLml0ZW1zKSB7XG4gICAgICAvLyBIYW5kbGUgZGlyZWN0b3JpZXMgaW4gQ2hyb21lIHVzaW5nIHRoZSBwcm9wcmlldGFyeSBGaWxlU3lzdGVtIEFQSVxuICAgICAgdmFyIGl0ZW1zID0gdG9BcnJheShlLmRhdGFUcmFuc2Zlci5pdGVtcykuZmlsdGVyKGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICAgIHJldHVybiBpdGVtLmtpbmQgPT09ICdmaWxlJ1xuICAgICAgfSlcblxuICAgICAgaWYgKGl0ZW1zLmxlbmd0aCA9PT0gMCkgcmV0dXJuXG5cbiAgICAgIHBhcmFsbGVsKGl0ZW1zLm1hcChmdW5jdGlvbiAoaXRlbSkge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKGNiKSB7XG4gICAgICAgICAgcHJvY2Vzc0VudHJ5KGl0ZW0ud2Via2l0R2V0QXNFbnRyeSgpLCBjYilcbiAgICAgICAgfVxuICAgICAgfSksIGZ1bmN0aW9uIChlcnIsIHJlc3VsdHMpIHtcbiAgICAgICAgLy8gVGhpcyBjYXRjaGVzIHBlcm1pc3Npb24gZXJyb3JzIHdpdGggZmlsZTovLyBpbiBDaHJvbWUuIFRoaXMgc2hvdWxkIG5ldmVyXG4gICAgICAgIC8vIHRocm93IGluIHByb2R1Y3Rpb24gY29kZSwgc28gdGhlIHVzZXIgZG9lcyBub3QgbmVlZCB0byB1c2UgdHJ5LWNhdGNoLlxuICAgICAgICBpZiAoZXJyKSB0aHJvdyBlcnJcbiAgICAgICAgaWYgKGxpc3RlbmVycy5vbkRyb3ApIHtcbiAgICAgICAgICBsaXN0ZW5lcnMub25Ecm9wKGZsYXR0ZW4ocmVzdWx0cyksIHBvcylcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIGZpbGVzID0gdG9BcnJheShlLmRhdGFUcmFuc2Zlci5maWxlcylcblxuICAgICAgaWYgKGZpbGVzLmxlbmd0aCA9PT0gMCkgcmV0dXJuXG5cbiAgICAgIGZpbGVzLmZvckVhY2goZnVuY3Rpb24gKGZpbGUpIHtcbiAgICAgICAgZmlsZS5mdWxsUGF0aCA9ICcvJyArIGZpbGUubmFtZVxuICAgICAgfSlcblxuICAgICAgaWYgKGxpc3RlbmVycy5vbkRyb3ApIHtcbiAgICAgICAgbGlzdGVuZXJzLm9uRHJvcChmaWxlcywgcG9zKVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBmYWxzZVxuICB9XG5cbiAgZnVuY3Rpb24gcmVtb3ZlRHJhZ0NsYXNzICgpIHtcbiAgICBlbGVtLmNsYXNzTGlzdC5yZW1vdmUoJ2RyYWcnKVxuICB9XG59XG5cbmZ1bmN0aW9uIHN0b3BFdmVudCAoZSkge1xuICBlLnN0b3BQcm9wYWdhdGlvbigpXG4gIGUucHJldmVudERlZmF1bHQoKVxuICByZXR1cm4gZmFsc2Vcbn1cblxuZnVuY3Rpb24gcHJvY2Vzc0VudHJ5IChlbnRyeSwgY2IpIHtcbiAgdmFyIGVudHJpZXMgPSBbXVxuXG4gIGlmIChlbnRyeS5pc0ZpbGUpIHtcbiAgICBlbnRyeS5maWxlKGZ1bmN0aW9uIChmaWxlKSB7XG4gICAgICBmaWxlLmZ1bGxQYXRoID0gZW50cnkuZnVsbFBhdGggIC8vIHByZXNlcnZlIHBhdGhpbmcgZm9yIGNvbnN1bWVyXG4gICAgICBjYihudWxsLCBmaWxlKVxuICAgIH0sIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgIGNiKGVycilcbiAgICB9KVxuICB9IGVsc2UgaWYgKGVudHJ5LmlzRGlyZWN0b3J5KSB7XG4gICAgdmFyIHJlYWRlciA9IGVudHJ5LmNyZWF0ZVJlYWRlcigpXG4gICAgcmVhZEVudHJpZXMoKVxuICB9XG5cbiAgZnVuY3Rpb24gcmVhZEVudHJpZXMgKCkge1xuICAgIHJlYWRlci5yZWFkRW50cmllcyhmdW5jdGlvbiAoZW50cmllc18pIHtcbiAgICAgIGlmIChlbnRyaWVzXy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGVudHJpZXMgPSBlbnRyaWVzLmNvbmNhdCh0b0FycmF5KGVudHJpZXNfKSlcbiAgICAgICAgcmVhZEVudHJpZXMoKSAvLyBjb250aW51ZSByZWFkaW5nIGVudHJpZXMgdW50aWwgYHJlYWRFbnRyaWVzYCByZXR1cm5zIG5vIG1vcmVcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGRvbmVFbnRyaWVzKClcbiAgICAgIH1cbiAgICB9KVxuICB9XG5cbiAgZnVuY3Rpb24gZG9uZUVudHJpZXMgKCkge1xuICAgIHBhcmFsbGVsKGVudHJpZXMubWFwKGZ1bmN0aW9uIChlbnRyeSkge1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uIChjYikge1xuICAgICAgICBwcm9jZXNzRW50cnkoZW50cnksIGNiKVxuICAgICAgfVxuICAgIH0pLCBjYilcbiAgfVxufVxuXG5mdW5jdGlvbiB0b0FycmF5IChsaXN0KSB7XG4gIHJldHVybiBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChsaXN0IHx8IFtdLCAwKVxufVxuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBmbGF0dGVuKGxpc3QsIGRlcHRoKSB7XG4gIGRlcHRoID0gKHR5cGVvZiBkZXB0aCA9PSAnbnVtYmVyJykgPyBkZXB0aCA6IEluZmluaXR5O1xuXG4gIGlmICghZGVwdGgpIHtcbiAgICBpZiAoQXJyYXkuaXNBcnJheShsaXN0KSkge1xuICAgICAgcmV0dXJuIGxpc3QubWFwKGZ1bmN0aW9uKGkpIHsgcmV0dXJuIGk7IH0pO1xuICAgIH1cbiAgICByZXR1cm4gbGlzdDtcbiAgfVxuXG4gIHJldHVybiBfZmxhdHRlbihsaXN0LCAxKTtcblxuICBmdW5jdGlvbiBfZmxhdHRlbihsaXN0LCBkKSB7XG4gICAgcmV0dXJuIGxpc3QucmVkdWNlKGZ1bmN0aW9uIChhY2MsIGl0ZW0pIHtcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KGl0ZW0pICYmIGQgPCBkZXB0aCkge1xuICAgICAgICByZXR1cm4gYWNjLmNvbmNhdChfZmxhdHRlbihpdGVtLCBkICsgMSkpO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIHJldHVybiBhY2MuY29uY2F0KGl0ZW0pO1xuICAgICAgfVxuICAgIH0sIFtdKTtcbiAgfVxufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKHRhc2tzLCBjYikge1xuICB2YXIgcmVzdWx0cywgcGVuZGluZywga2V5c1xuICB2YXIgaXNTeW5jID0gdHJ1ZVxuXG4gIGlmIChBcnJheS5pc0FycmF5KHRhc2tzKSkge1xuICAgIHJlc3VsdHMgPSBbXVxuICAgIHBlbmRpbmcgPSB0YXNrcy5sZW5ndGhcbiAgfSBlbHNlIHtcbiAgICBrZXlzID0gT2JqZWN0LmtleXModGFza3MpXG4gICAgcmVzdWx0cyA9IHt9XG4gICAgcGVuZGluZyA9IGtleXMubGVuZ3RoXG4gIH1cblxuICBmdW5jdGlvbiBkb25lIChlcnIpIHtcbiAgICBmdW5jdGlvbiBlbmQgKCkge1xuICAgICAgaWYgKGNiKSBjYihlcnIsIHJlc3VsdHMpXG4gICAgICBjYiA9IG51bGxcbiAgICB9XG4gICAgaWYgKGlzU3luYykgcHJvY2Vzcy5uZXh0VGljayhlbmQpXG4gICAgZWxzZSBlbmQoKVxuICB9XG5cbiAgZnVuY3Rpb24gZWFjaCAoaSwgZXJyLCByZXN1bHQpIHtcbiAgICByZXN1bHRzW2ldID0gcmVzdWx0XG4gICAgaWYgKC0tcGVuZGluZyA9PT0gMCB8fCBlcnIpIHtcbiAgICAgIGRvbmUoZXJyKVxuICAgIH1cbiAgfVxuXG4gIGlmICghcGVuZGluZykge1xuICAgIC8vIGVtcHR5XG4gICAgZG9uZShudWxsKVxuICB9IGVsc2UgaWYgKGtleXMpIHtcbiAgICAvLyBvYmplY3RcbiAgICBrZXlzLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuICAgICAgdGFza3Nba2V5XShmdW5jdGlvbiAoZXJyLCByZXN1bHQpIHsgZWFjaChrZXksIGVyciwgcmVzdWx0KSB9KVxuICAgIH0pXG4gIH0gZWxzZSB7XG4gICAgLy8gYXJyYXlcbiAgICB0YXNrcy5mb3JFYWNoKGZ1bmN0aW9uICh0YXNrLCBpKSB7XG4gICAgICB0YXNrKGZ1bmN0aW9uIChlcnIsIHJlc3VsdCkgeyBlYWNoKGksIGVyciwgcmVzdWx0KSB9KVxuICAgIH0pXG4gIH1cblxuICBpc1N5bmMgPSBmYWxzZVxufVxuIiwiLyohXG4gKiBAb3ZlcnZpZXcgZXM2LXByb21pc2UgLSBhIHRpbnkgaW1wbGVtZW50YXRpb24gb2YgUHJvbWlzZXMvQSsuXG4gKiBAY29weXJpZ2h0IENvcHlyaWdodCAoYykgMjAxNCBZZWh1ZGEgS2F0eiwgVG9tIERhbGUsIFN0ZWZhbiBQZW5uZXIgYW5kIGNvbnRyaWJ1dG9ycyAoQ29udmVyc2lvbiB0byBFUzYgQVBJIGJ5IEpha2UgQXJjaGliYWxkKVxuICogQGxpY2Vuc2UgICBMaWNlbnNlZCB1bmRlciBNSVQgbGljZW5zZVxuICogICAgICAgICAgICBTZWUgaHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL2pha2VhcmNoaWJhbGQvZXM2LXByb21pc2UvbWFzdGVyL0xJQ0VOU0VcbiAqIEB2ZXJzaW9uICAgMy4xLjJcbiAqL1xuXG4oZnVuY3Rpb24oKSB7XG4gICAgXCJ1c2Ugc3RyaWN0XCI7XG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJHV0aWxzJCRvYmplY3RPckZ1bmN0aW9uKHgpIHtcbiAgICAgIHJldHVybiB0eXBlb2YgeCA9PT0gJ2Z1bmN0aW9uJyB8fCAodHlwZW9mIHggPT09ICdvYmplY3QnICYmIHggIT09IG51bGwpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSR1dGlscyQkaXNGdW5jdGlvbih4KSB7XG4gICAgICByZXR1cm4gdHlwZW9mIHggPT09ICdmdW5jdGlvbic7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJHV0aWxzJCRpc01heWJlVGhlbmFibGUoeCkge1xuICAgICAgcmV0dXJuIHR5cGVvZiB4ID09PSAnb2JqZWN0JyAmJiB4ICE9PSBudWxsO1xuICAgIH1cblxuICAgIHZhciBsaWIkZXM2JHByb21pc2UkdXRpbHMkJF9pc0FycmF5O1xuICAgIGlmICghQXJyYXkuaXNBcnJheSkge1xuICAgICAgbGliJGVzNiRwcm9taXNlJHV0aWxzJCRfaXNBcnJheSA9IGZ1bmN0aW9uICh4KSB7XG4gICAgICAgIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoeCkgPT09ICdbb2JqZWN0IEFycmF5XSc7XG4gICAgICB9O1xuICAgIH0gZWxzZSB7XG4gICAgICBsaWIkZXM2JHByb21pc2UkdXRpbHMkJF9pc0FycmF5ID0gQXJyYXkuaXNBcnJheTtcbiAgICB9XG5cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJHV0aWxzJCRpc0FycmF5ID0gbGliJGVzNiRwcm9taXNlJHV0aWxzJCRfaXNBcnJheTtcbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJGFzYXAkJGxlbiA9IDA7XG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRhc2FwJCR2ZXJ0eE5leHQ7XG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRjdXN0b21TY2hlZHVsZXJGbjtcblxuICAgIHZhciBsaWIkZXM2JHByb21pc2UkYXNhcCQkYXNhcCA9IGZ1bmN0aW9uIGFzYXAoY2FsbGJhY2ssIGFyZykge1xuICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJHF1ZXVlW2xpYiRlczYkcHJvbWlzZSRhc2FwJCRsZW5dID0gY2FsbGJhY2s7XG4gICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkcXVldWVbbGliJGVzNiRwcm9taXNlJGFzYXAkJGxlbiArIDFdID0gYXJnO1xuICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJGxlbiArPSAyO1xuICAgICAgaWYgKGxpYiRlczYkcHJvbWlzZSRhc2FwJCRsZW4gPT09IDIpIHtcbiAgICAgICAgLy8gSWYgbGVuIGlzIDIsIHRoYXQgbWVhbnMgdGhhdCB3ZSBuZWVkIHRvIHNjaGVkdWxlIGFuIGFzeW5jIGZsdXNoLlxuICAgICAgICAvLyBJZiBhZGRpdGlvbmFsIGNhbGxiYWNrcyBhcmUgcXVldWVkIGJlZm9yZSB0aGUgcXVldWUgaXMgZmx1c2hlZCwgdGhleVxuICAgICAgICAvLyB3aWxsIGJlIHByb2Nlc3NlZCBieSB0aGlzIGZsdXNoIHRoYXQgd2UgYXJlIHNjaGVkdWxpbmcuXG4gICAgICAgIGlmIChsaWIkZXM2JHByb21pc2UkYXNhcCQkY3VzdG9tU2NoZWR1bGVyRm4pIHtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkY3VzdG9tU2NoZWR1bGVyRm4obGliJGVzNiRwcm9taXNlJGFzYXAkJGZsdXNoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkc2NoZWR1bGVGbHVzaCgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJGFzYXAkJHNldFNjaGVkdWxlcihzY2hlZHVsZUZuKSB7XG4gICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkY3VzdG9tU2NoZWR1bGVyRm4gPSBzY2hlZHVsZUZuO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRzZXRBc2FwKGFzYXBGbikge1xuICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJGFzYXAgPSBhc2FwRm47XG4gICAgfVxuXG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRicm93c2VyV2luZG93ID0gKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnKSA/IHdpbmRvdyA6IHVuZGVmaW5lZDtcbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJGFzYXAkJGJyb3dzZXJHbG9iYWwgPSBsaWIkZXM2JHByb21pc2UkYXNhcCQkYnJvd3NlcldpbmRvdyB8fCB7fTtcbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJGFzYXAkJEJyb3dzZXJNdXRhdGlvbk9ic2VydmVyID0gbGliJGVzNiRwcm9taXNlJGFzYXAkJGJyb3dzZXJHbG9iYWwuTXV0YXRpb25PYnNlcnZlciB8fCBsaWIkZXM2JHByb21pc2UkYXNhcCQkYnJvd3Nlckdsb2JhbC5XZWJLaXRNdXRhdGlvbk9ic2VydmVyO1xuICAgIHZhciBsaWIkZXM2JHByb21pc2UkYXNhcCQkaXNOb2RlID0gdHlwZW9mIHByb2Nlc3MgIT09ICd1bmRlZmluZWQnICYmIHt9LnRvU3RyaW5nLmNhbGwocHJvY2VzcykgPT09ICdbb2JqZWN0IHByb2Nlc3NdJztcblxuICAgIC8vIHRlc3QgZm9yIHdlYiB3b3JrZXIgYnV0IG5vdCBpbiBJRTEwXG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRpc1dvcmtlciA9IHR5cGVvZiBVaW50OENsYW1wZWRBcnJheSAhPT0gJ3VuZGVmaW5lZCcgJiZcbiAgICAgIHR5cGVvZiBpbXBvcnRTY3JpcHRzICE9PSAndW5kZWZpbmVkJyAmJlxuICAgICAgdHlwZW9mIE1lc3NhZ2VDaGFubmVsICE9PSAndW5kZWZpbmVkJztcblxuICAgIC8vIG5vZGVcbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkYXNhcCQkdXNlTmV4dFRpY2soKSB7XG4gICAgICAvLyBub2RlIHZlcnNpb24gMC4xMC54IGRpc3BsYXlzIGEgZGVwcmVjYXRpb24gd2FybmluZyB3aGVuIG5leHRUaWNrIGlzIHVzZWQgcmVjdXJzaXZlbHlcbiAgICAgIC8vIHNlZSBodHRwczovL2dpdGh1Yi5jb20vY3Vqb2pzL3doZW4vaXNzdWVzLzQxMCBmb3IgZGV0YWlsc1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICBwcm9jZXNzLm5leHRUaWNrKGxpYiRlczYkcHJvbWlzZSRhc2FwJCRmbHVzaCk7XG4gICAgICB9O1xuICAgIH1cblxuICAgIC8vIHZlcnR4XG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJGFzYXAkJHVzZVZlcnR4VGltZXIoKSB7XG4gICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCR2ZXJ0eE5leHQobGliJGVzNiRwcm9taXNlJGFzYXAkJGZsdXNoKTtcbiAgICAgIH07XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJGFzYXAkJHVzZU11dGF0aW9uT2JzZXJ2ZXIoKSB7XG4gICAgICB2YXIgaXRlcmF0aW9ucyA9IDA7XG4gICAgICB2YXIgb2JzZXJ2ZXIgPSBuZXcgbGliJGVzNiRwcm9taXNlJGFzYXAkJEJyb3dzZXJNdXRhdGlvbk9ic2VydmVyKGxpYiRlczYkcHJvbWlzZSRhc2FwJCRmbHVzaCk7XG4gICAgICB2YXIgbm9kZSA9IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKCcnKTtcbiAgICAgIG9ic2VydmVyLm9ic2VydmUobm9kZSwgeyBjaGFyYWN0ZXJEYXRhOiB0cnVlIH0pO1xuXG4gICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgIG5vZGUuZGF0YSA9IChpdGVyYXRpb25zID0gKytpdGVyYXRpb25zICUgMik7XG4gICAgICB9O1xuICAgIH1cblxuICAgIC8vIHdlYiB3b3JrZXJcbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkYXNhcCQkdXNlTWVzc2FnZUNoYW5uZWwoKSB7XG4gICAgICB2YXIgY2hhbm5lbCA9IG5ldyBNZXNzYWdlQ2hhbm5lbCgpO1xuICAgICAgY2hhbm5lbC5wb3J0MS5vbm1lc3NhZ2UgPSBsaWIkZXM2JHByb21pc2UkYXNhcCQkZmx1c2g7XG4gICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICBjaGFubmVsLnBvcnQyLnBvc3RNZXNzYWdlKDApO1xuICAgICAgfTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkYXNhcCQkdXNlU2V0VGltZW91dCgpIHtcbiAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgc2V0VGltZW91dChsaWIkZXM2JHByb21pc2UkYXNhcCQkZmx1c2gsIDEpO1xuICAgICAgfTtcbiAgICB9XG5cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJGFzYXAkJHF1ZXVlID0gbmV3IEFycmF5KDEwMDApO1xuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRmbHVzaCgpIHtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGliJGVzNiRwcm9taXNlJGFzYXAkJGxlbjsgaSs9Mikge1xuICAgICAgICB2YXIgY2FsbGJhY2sgPSBsaWIkZXM2JHByb21pc2UkYXNhcCQkcXVldWVbaV07XG4gICAgICAgIHZhciBhcmcgPSBsaWIkZXM2JHByb21pc2UkYXNhcCQkcXVldWVbaSsxXTtcblxuICAgICAgICBjYWxsYmFjayhhcmcpO1xuXG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRxdWV1ZVtpXSA9IHVuZGVmaW5lZDtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJHF1ZXVlW2krMV0gPSB1bmRlZmluZWQ7XG4gICAgICB9XG5cbiAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRsZW4gPSAwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRhdHRlbXB0VmVydHgoKSB7XG4gICAgICB0cnkge1xuICAgICAgICB2YXIgciA9IHJlcXVpcmU7XG4gICAgICAgIHZhciB2ZXJ0eCA9IHIoJ3ZlcnR4Jyk7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCR2ZXJ0eE5leHQgPSB2ZXJ0eC5ydW5Pbkxvb3AgfHwgdmVydHgucnVuT25Db250ZXh0O1xuICAgICAgICByZXR1cm4gbGliJGVzNiRwcm9taXNlJGFzYXAkJHVzZVZlcnR4VGltZXIoKTtcbiAgICAgIH0gY2F0Y2goZSkge1xuICAgICAgICByZXR1cm4gbGliJGVzNiRwcm9taXNlJGFzYXAkJHVzZVNldFRpbWVvdXQoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJGFzYXAkJHNjaGVkdWxlRmx1c2g7XG4gICAgLy8gRGVjaWRlIHdoYXQgYXN5bmMgbWV0aG9kIHRvIHVzZSB0byB0cmlnZ2VyaW5nIHByb2Nlc3Npbmcgb2YgcXVldWVkIGNhbGxiYWNrczpcbiAgICBpZiAobGliJGVzNiRwcm9taXNlJGFzYXAkJGlzTm9kZSkge1xuICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJHNjaGVkdWxlRmx1c2ggPSBsaWIkZXM2JHByb21pc2UkYXNhcCQkdXNlTmV4dFRpY2soKTtcbiAgICB9IGVsc2UgaWYgKGxpYiRlczYkcHJvbWlzZSRhc2FwJCRCcm93c2VyTXV0YXRpb25PYnNlcnZlcikge1xuICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJHNjaGVkdWxlRmx1c2ggPSBsaWIkZXM2JHByb21pc2UkYXNhcCQkdXNlTXV0YXRpb25PYnNlcnZlcigpO1xuICAgIH0gZWxzZSBpZiAobGliJGVzNiRwcm9taXNlJGFzYXAkJGlzV29ya2VyKSB7XG4gICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkc2NoZWR1bGVGbHVzaCA9IGxpYiRlczYkcHJvbWlzZSRhc2FwJCR1c2VNZXNzYWdlQ2hhbm5lbCgpO1xuICAgIH0gZWxzZSBpZiAobGliJGVzNiRwcm9taXNlJGFzYXAkJGJyb3dzZXJXaW5kb3cgPT09IHVuZGVmaW5lZCAmJiB0eXBlb2YgcmVxdWlyZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJHNjaGVkdWxlRmx1c2ggPSBsaWIkZXM2JHByb21pc2UkYXNhcCQkYXR0ZW1wdFZlcnR4KCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRzY2hlZHVsZUZsdXNoID0gbGliJGVzNiRwcm9taXNlJGFzYXAkJHVzZVNldFRpbWVvdXQoKTtcbiAgICB9XG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJHRoZW4kJHRoZW4ob25GdWxmaWxsbWVudCwgb25SZWplY3Rpb24pIHtcbiAgICAgIHZhciBwYXJlbnQgPSB0aGlzO1xuICAgICAgdmFyIHN0YXRlID0gcGFyZW50Ll9zdGF0ZTtcblxuICAgICAgaWYgKHN0YXRlID09PSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRGVUxGSUxMRUQgJiYgIW9uRnVsZmlsbG1lbnQgfHwgc3RhdGUgPT09IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFJFSkVDVEVEICYmICFvblJlamVjdGlvbikge1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgIH1cblxuICAgICAgdmFyIGNoaWxkID0gbmV3IHRoaXMuY29uc3RydWN0b3IobGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkbm9vcCk7XG4gICAgICB2YXIgcmVzdWx0ID0gcGFyZW50Ll9yZXN1bHQ7XG5cbiAgICAgIGlmIChzdGF0ZSkge1xuICAgICAgICB2YXIgY2FsbGJhY2sgPSBhcmd1bWVudHNbc3RhdGUgLSAxXTtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJGFzYXAoZnVuY3Rpb24oKXtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRpbnZva2VDYWxsYmFjayhzdGF0ZSwgY2hpbGQsIGNhbGxiYWNrLCByZXN1bHQpO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHN1YnNjcmliZShwYXJlbnQsIGNoaWxkLCBvbkZ1bGZpbGxtZW50LCBvblJlamVjdGlvbik7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBjaGlsZDtcbiAgICB9XG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSR0aGVuJCRkZWZhdWx0ID0gbGliJGVzNiRwcm9taXNlJHRoZW4kJHRoZW47XG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJHByb21pc2UkcmVzb2x2ZSQkcmVzb2x2ZShvYmplY3QpIHtcbiAgICAgIC8qanNoaW50IHZhbGlkdGhpczp0cnVlICovXG4gICAgICB2YXIgQ29uc3RydWN0b3IgPSB0aGlzO1xuXG4gICAgICBpZiAob2JqZWN0ICYmIHR5cGVvZiBvYmplY3QgPT09ICdvYmplY3QnICYmIG9iamVjdC5jb25zdHJ1Y3RvciA9PT0gQ29uc3RydWN0b3IpIHtcbiAgICAgICAgcmV0dXJuIG9iamVjdDtcbiAgICAgIH1cblxuICAgICAgdmFyIHByb21pc2UgPSBuZXcgQ29uc3RydWN0b3IobGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkbm9vcCk7XG4gICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZXNvbHZlKHByb21pc2UsIG9iamVjdCk7XG4gICAgICByZXR1cm4gcHJvbWlzZTtcbiAgICB9XG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJHJlc29sdmUkJGRlZmF1bHQgPSBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSRyZXNvbHZlJCRyZXNvbHZlO1xuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkbm9vcCgpIHt9XG5cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkUEVORElORyAgID0gdm9pZCAwO1xuICAgIHZhciBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRGVUxGSUxMRUQgPSAxO1xuICAgIHZhciBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRSRUpFQ1RFRCAgPSAyO1xuXG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJEdFVF9USEVOX0VSUk9SID0gbmV3IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJEVycm9yT2JqZWN0KCk7XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRzZWxmRnVsZmlsbG1lbnQoKSB7XG4gICAgICByZXR1cm4gbmV3IFR5cGVFcnJvcihcIllvdSBjYW5ub3QgcmVzb2x2ZSBhIHByb21pc2Ugd2l0aCBpdHNlbGZcIik7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkY2Fubm90UmV0dXJuT3duKCkge1xuICAgICAgcmV0dXJuIG5ldyBUeXBlRXJyb3IoJ0EgcHJvbWlzZXMgY2FsbGJhY2sgY2Fubm90IHJldHVybiB0aGF0IHNhbWUgcHJvbWlzZS4nKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRnZXRUaGVuKHByb21pc2UpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHJldHVybiBwcm9taXNlLnRoZW47XG4gICAgICB9IGNhdGNoKGVycm9yKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJEdFVF9USEVOX0VSUk9SLmVycm9yID0gZXJyb3I7XG4gICAgICAgIHJldHVybiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRHRVRfVEhFTl9FUlJPUjtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCR0cnlUaGVuKHRoZW4sIHZhbHVlLCBmdWxmaWxsbWVudEhhbmRsZXIsIHJlamVjdGlvbkhhbmRsZXIpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHRoZW4uY2FsbCh2YWx1ZSwgZnVsZmlsbG1lbnRIYW5kbGVyLCByZWplY3Rpb25IYW5kbGVyKTtcbiAgICAgIH0gY2F0Y2goZSkge1xuICAgICAgICByZXR1cm4gZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRoYW5kbGVGb3JlaWduVGhlbmFibGUocHJvbWlzZSwgdGhlbmFibGUsIHRoZW4pIHtcbiAgICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkYXNhcChmdW5jdGlvbihwcm9taXNlKSB7XG4gICAgICAgIHZhciBzZWFsZWQgPSBmYWxzZTtcbiAgICAgICAgdmFyIGVycm9yID0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkdHJ5VGhlbih0aGVuLCB0aGVuYWJsZSwgZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgICBpZiAoc2VhbGVkKSB7IHJldHVybjsgfVxuICAgICAgICAgIHNlYWxlZCA9IHRydWU7XG4gICAgICAgICAgaWYgKHRoZW5hYmxlICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVzb2x2ZShwcm9taXNlLCB2YWx1ZSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGZ1bGZpbGwocHJvbWlzZSwgdmFsdWUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSwgZnVuY3Rpb24ocmVhc29uKSB7XG4gICAgICAgICAgaWYgKHNlYWxlZCkgeyByZXR1cm47IH1cbiAgICAgICAgICBzZWFsZWQgPSB0cnVlO1xuXG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVqZWN0KHByb21pc2UsIHJlYXNvbik7XG4gICAgICAgIH0sICdTZXR0bGU6ICcgKyAocHJvbWlzZS5fbGFiZWwgfHwgJyB1bmtub3duIHByb21pc2UnKSk7XG5cbiAgICAgICAgaWYgKCFzZWFsZWQgJiYgZXJyb3IpIHtcbiAgICAgICAgICBzZWFsZWQgPSB0cnVlO1xuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlamVjdChwcm9taXNlLCBlcnJvcik7XG4gICAgICAgIH1cbiAgICAgIH0sIHByb21pc2UpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGhhbmRsZU93blRoZW5hYmxlKHByb21pc2UsIHRoZW5hYmxlKSB7XG4gICAgICBpZiAodGhlbmFibGUuX3N0YXRlID09PSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRGVUxGSUxMRUQpIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkZnVsZmlsbChwcm9taXNlLCB0aGVuYWJsZS5fcmVzdWx0KTtcbiAgICAgIH0gZWxzZSBpZiAodGhlbmFibGUuX3N0YXRlID09PSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRSRUpFQ1RFRCkge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZWplY3QocHJvbWlzZSwgdGhlbmFibGUuX3Jlc3VsdCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRzdWJzY3JpYmUodGhlbmFibGUsIHVuZGVmaW5lZCwgZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZXNvbHZlKHByb21pc2UsIHZhbHVlKTtcbiAgICAgICAgfSwgZnVuY3Rpb24ocmVhc29uKSB7XG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVqZWN0KHByb21pc2UsIHJlYXNvbik7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGhhbmRsZU1heWJlVGhlbmFibGUocHJvbWlzZSwgbWF5YmVUaGVuYWJsZSwgdGhlbikge1xuICAgICAgaWYgKG1heWJlVGhlbmFibGUuY29uc3RydWN0b3IgPT09IHByb21pc2UuY29uc3RydWN0b3IgJiZcbiAgICAgICAgICB0aGVuID09PSBsaWIkZXM2JHByb21pc2UkdGhlbiQkZGVmYXVsdCAmJlxuICAgICAgICAgIGNvbnN0cnVjdG9yLnJlc29sdmUgPT09IGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJHJlc29sdmUkJGRlZmF1bHQpIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkaGFuZGxlT3duVGhlbmFibGUocHJvbWlzZSwgbWF5YmVUaGVuYWJsZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAodGhlbiA9PT0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkR0VUX1RIRU5fRVJST1IpIHtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZWplY3QocHJvbWlzZSwgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkR0VUX1RIRU5fRVJST1IuZXJyb3IpO1xuICAgICAgICB9IGVsc2UgaWYgKHRoZW4gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGZ1bGZpbGwocHJvbWlzZSwgbWF5YmVUaGVuYWJsZSk7XG4gICAgICAgIH0gZWxzZSBpZiAobGliJGVzNiRwcm9taXNlJHV0aWxzJCRpc0Z1bmN0aW9uKHRoZW4pKSB7XG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkaGFuZGxlRm9yZWlnblRoZW5hYmxlKHByb21pc2UsIG1heWJlVGhlbmFibGUsIHRoZW4pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGZ1bGZpbGwocHJvbWlzZSwgbWF5YmVUaGVuYWJsZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZXNvbHZlKHByb21pc2UsIHZhbHVlKSB7XG4gICAgICBpZiAocHJvbWlzZSA9PT0gdmFsdWUpIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVqZWN0KHByb21pc2UsIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHNlbGZGdWxmaWxsbWVudCgpKTtcbiAgICAgIH0gZWxzZSBpZiAobGliJGVzNiRwcm9taXNlJHV0aWxzJCRvYmplY3RPckZ1bmN0aW9uKHZhbHVlKSkge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRoYW5kbGVNYXliZVRoZW5hYmxlKHByb21pc2UsIHZhbHVlLCBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRnZXRUaGVuKHZhbHVlKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRmdWxmaWxsKHByb21pc2UsIHZhbHVlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRwdWJsaXNoUmVqZWN0aW9uKHByb21pc2UpIHtcbiAgICAgIGlmIChwcm9taXNlLl9vbmVycm9yKSB7XG4gICAgICAgIHByb21pc2UuX29uZXJyb3IocHJvbWlzZS5fcmVzdWx0KTtcbiAgICAgIH1cblxuICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcHVibGlzaChwcm9taXNlKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRmdWxmaWxsKHByb21pc2UsIHZhbHVlKSB7XG4gICAgICBpZiAocHJvbWlzZS5fc3RhdGUgIT09IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFBFTkRJTkcpIHsgcmV0dXJuOyB9XG5cbiAgICAgIHByb21pc2UuX3Jlc3VsdCA9IHZhbHVlO1xuICAgICAgcHJvbWlzZS5fc3RhdGUgPSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRGVUxGSUxMRUQ7XG5cbiAgICAgIGlmIChwcm9taXNlLl9zdWJzY3JpYmVycy5sZW5ndGggIT09IDApIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJGFzYXAobGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcHVibGlzaCwgcHJvbWlzZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVqZWN0KHByb21pc2UsIHJlYXNvbikge1xuICAgICAgaWYgKHByb21pc2UuX3N0YXRlICE9PSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRQRU5ESU5HKSB7IHJldHVybjsgfVxuICAgICAgcHJvbWlzZS5fc3RhdGUgPSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRSRUpFQ1RFRDtcbiAgICAgIHByb21pc2UuX3Jlc3VsdCA9IHJlYXNvbjtcblxuICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJGFzYXAobGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcHVibGlzaFJlamVjdGlvbiwgcHJvbWlzZSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkc3Vic2NyaWJlKHBhcmVudCwgY2hpbGQsIG9uRnVsZmlsbG1lbnQsIG9uUmVqZWN0aW9uKSB7XG4gICAgICB2YXIgc3Vic2NyaWJlcnMgPSBwYXJlbnQuX3N1YnNjcmliZXJzO1xuICAgICAgdmFyIGxlbmd0aCA9IHN1YnNjcmliZXJzLmxlbmd0aDtcblxuICAgICAgcGFyZW50Ll9vbmVycm9yID0gbnVsbDtcblxuICAgICAgc3Vic2NyaWJlcnNbbGVuZ3RoXSA9IGNoaWxkO1xuICAgICAgc3Vic2NyaWJlcnNbbGVuZ3RoICsgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkRlVMRklMTEVEXSA9IG9uRnVsZmlsbG1lbnQ7XG4gICAgICBzdWJzY3JpYmVyc1tsZW5ndGggKyBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRSRUpFQ1RFRF0gID0gb25SZWplY3Rpb247XG5cbiAgICAgIGlmIChsZW5ndGggPT09IDAgJiYgcGFyZW50Ll9zdGF0ZSkge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkYXNhcChsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRwdWJsaXNoLCBwYXJlbnQpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHB1Ymxpc2gocHJvbWlzZSkge1xuICAgICAgdmFyIHN1YnNjcmliZXJzID0gcHJvbWlzZS5fc3Vic2NyaWJlcnM7XG4gICAgICB2YXIgc2V0dGxlZCA9IHByb21pc2UuX3N0YXRlO1xuXG4gICAgICBpZiAoc3Vic2NyaWJlcnMubGVuZ3RoID09PSAwKSB7IHJldHVybjsgfVxuXG4gICAgICB2YXIgY2hpbGQsIGNhbGxiYWNrLCBkZXRhaWwgPSBwcm9taXNlLl9yZXN1bHQ7XG5cbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc3Vic2NyaWJlcnMubGVuZ3RoOyBpICs9IDMpIHtcbiAgICAgICAgY2hpbGQgPSBzdWJzY3JpYmVyc1tpXTtcbiAgICAgICAgY2FsbGJhY2sgPSBzdWJzY3JpYmVyc1tpICsgc2V0dGxlZF07XG5cbiAgICAgICAgaWYgKGNoaWxkKSB7XG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkaW52b2tlQ2FsbGJhY2soc2V0dGxlZCwgY2hpbGQsIGNhbGxiYWNrLCBkZXRhaWwpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNhbGxiYWNrKGRldGFpbCk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcHJvbWlzZS5fc3Vic2NyaWJlcnMubGVuZ3RoID0gMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRFcnJvck9iamVjdCgpIHtcbiAgICAgIHRoaXMuZXJyb3IgPSBudWxsO1xuICAgIH1cblxuICAgIHZhciBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRUUllfQ0FUQ0hfRVJST1IgPSBuZXcgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkRXJyb3JPYmplY3QoKTtcblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHRyeUNhdGNoKGNhbGxiYWNrLCBkZXRhaWwpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHJldHVybiBjYWxsYmFjayhkZXRhaWwpO1xuICAgICAgfSBjYXRjaChlKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFRSWV9DQVRDSF9FUlJPUi5lcnJvciA9IGU7XG4gICAgICAgIHJldHVybiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRUUllfQ0FUQ0hfRVJST1I7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkaW52b2tlQ2FsbGJhY2soc2V0dGxlZCwgcHJvbWlzZSwgY2FsbGJhY2ssIGRldGFpbCkge1xuICAgICAgdmFyIGhhc0NhbGxiYWNrID0gbGliJGVzNiRwcm9taXNlJHV0aWxzJCRpc0Z1bmN0aW9uKGNhbGxiYWNrKSxcbiAgICAgICAgICB2YWx1ZSwgZXJyb3IsIHN1Y2NlZWRlZCwgZmFpbGVkO1xuXG4gICAgICBpZiAoaGFzQ2FsbGJhY2spIHtcbiAgICAgICAgdmFsdWUgPSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCR0cnlDYXRjaChjYWxsYmFjaywgZGV0YWlsKTtcblxuICAgICAgICBpZiAodmFsdWUgPT09IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFRSWV9DQVRDSF9FUlJPUikge1xuICAgICAgICAgIGZhaWxlZCA9IHRydWU7XG4gICAgICAgICAgZXJyb3IgPSB2YWx1ZS5lcnJvcjtcbiAgICAgICAgICB2YWx1ZSA9IG51bGw7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc3VjY2VlZGVkID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChwcm9taXNlID09PSB2YWx1ZSkge1xuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlamVjdChwcm9taXNlLCBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRjYW5ub3RSZXR1cm5Pd24oKSk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhbHVlID0gZGV0YWlsO1xuICAgICAgICBzdWNjZWVkZWQgPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAocHJvbWlzZS5fc3RhdGUgIT09IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFBFTkRJTkcpIHtcbiAgICAgICAgLy8gbm9vcFxuICAgICAgfSBlbHNlIGlmIChoYXNDYWxsYmFjayAmJiBzdWNjZWVkZWQpIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVzb2x2ZShwcm9taXNlLCB2YWx1ZSk7XG4gICAgICB9IGVsc2UgaWYgKGZhaWxlZCkge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZWplY3QocHJvbWlzZSwgZXJyb3IpO1xuICAgICAgfSBlbHNlIGlmIChzZXR0bGVkID09PSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRGVUxGSUxMRUQpIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkZnVsZmlsbChwcm9taXNlLCB2YWx1ZSk7XG4gICAgICB9IGVsc2UgaWYgKHNldHRsZWQgPT09IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFJFSkVDVEVEKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlamVjdChwcm9taXNlLCB2YWx1ZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkaW5pdGlhbGl6ZVByb21pc2UocHJvbWlzZSwgcmVzb2x2ZXIpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHJlc29sdmVyKGZ1bmN0aW9uIHJlc29sdmVQcm9taXNlKHZhbHVlKXtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZXNvbHZlKHByb21pc2UsIHZhbHVlKTtcbiAgICAgICAgfSwgZnVuY3Rpb24gcmVqZWN0UHJvbWlzZShyZWFzb24pIHtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZWplY3QocHJvbWlzZSwgcmVhc29uKTtcbiAgICAgICAgfSk7XG4gICAgICB9IGNhdGNoKGUpIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVqZWN0KHByb21pc2UsIGUpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJGFsbCQkYWxsKGVudHJpZXMpIHtcbiAgICAgIHJldHVybiBuZXcgbGliJGVzNiRwcm9taXNlJGVudW1lcmF0b3IkJGRlZmF1bHQodGhpcywgZW50cmllcykucHJvbWlzZTtcbiAgICB9XG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJGFsbCQkZGVmYXVsdCA9IGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJGFsbCQkYWxsO1xuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJHJhY2UkJHJhY2UoZW50cmllcykge1xuICAgICAgLypqc2hpbnQgdmFsaWR0aGlzOnRydWUgKi9cbiAgICAgIHZhciBDb25zdHJ1Y3RvciA9IHRoaXM7XG5cbiAgICAgIHZhciBwcm9taXNlID0gbmV3IENvbnN0cnVjdG9yKGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJG5vb3ApO1xuXG4gICAgICBpZiAoIWxpYiRlczYkcHJvbWlzZSR1dGlscyQkaXNBcnJheShlbnRyaWVzKSkge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZWplY3QocHJvbWlzZSwgbmV3IFR5cGVFcnJvcignWW91IG11c3QgcGFzcyBhbiBhcnJheSB0byByYWNlLicpKTtcbiAgICAgICAgcmV0dXJuIHByb21pc2U7XG4gICAgICB9XG5cbiAgICAgIHZhciBsZW5ndGggPSBlbnRyaWVzLmxlbmd0aDtcblxuICAgICAgZnVuY3Rpb24gb25GdWxmaWxsbWVudCh2YWx1ZSkge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZXNvbHZlKHByb21pc2UsIHZhbHVlKTtcbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gb25SZWplY3Rpb24ocmVhc29uKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlamVjdChwcm9taXNlLCByZWFzb24pO1xuICAgICAgfVxuXG4gICAgICBmb3IgKHZhciBpID0gMDsgcHJvbWlzZS5fc3RhdGUgPT09IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFBFTkRJTkcgJiYgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHN1YnNjcmliZShDb25zdHJ1Y3Rvci5yZXNvbHZlKGVudHJpZXNbaV0pLCB1bmRlZmluZWQsIG9uRnVsZmlsbG1lbnQsIG9uUmVqZWN0aW9uKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHByb21pc2U7XG4gICAgfVxuICAgIHZhciBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSRyYWNlJCRkZWZhdWx0ID0gbGliJGVzNiRwcm9taXNlJHByb21pc2UkcmFjZSQkcmFjZTtcbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSRyZWplY3QkJHJlamVjdChyZWFzb24pIHtcbiAgICAgIC8qanNoaW50IHZhbGlkdGhpczp0cnVlICovXG4gICAgICB2YXIgQ29uc3RydWN0b3IgPSB0aGlzO1xuICAgICAgdmFyIHByb21pc2UgPSBuZXcgQ29uc3RydWN0b3IobGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkbm9vcCk7XG4gICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZWplY3QocHJvbWlzZSwgcmVhc29uKTtcbiAgICAgIHJldHVybiBwcm9taXNlO1xuICAgIH1cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJHByb21pc2UkcmVqZWN0JCRkZWZhdWx0ID0gbGliJGVzNiRwcm9taXNlJHByb21pc2UkcmVqZWN0JCRyZWplY3Q7XG5cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJHByb21pc2UkJGNvdW50ZXIgPSAwO1xuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJHByb21pc2UkJG5lZWRzUmVzb2x2ZXIoKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdZb3UgbXVzdCBwYXNzIGEgcmVzb2x2ZXIgZnVuY3Rpb24gYXMgdGhlIGZpcnN0IGFyZ3VtZW50IHRvIHRoZSBwcm9taXNlIGNvbnN0cnVjdG9yJyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJHByb21pc2UkJG5lZWRzTmV3KCkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkZhaWxlZCB0byBjb25zdHJ1Y3QgJ1Byb21pc2UnOiBQbGVhc2UgdXNlIHRoZSAnbmV3JyBvcGVyYXRvciwgdGhpcyBvYmplY3QgY29uc3RydWN0b3IgY2Fubm90IGJlIGNhbGxlZCBhcyBhIGZ1bmN0aW9uLlwiKTtcbiAgICB9XG5cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJHByb21pc2UkJGRlZmF1bHQgPSBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkUHJvbWlzZTtcbiAgICAvKipcbiAgICAgIFByb21pc2Ugb2JqZWN0cyByZXByZXNlbnQgdGhlIGV2ZW50dWFsIHJlc3VsdCBvZiBhbiBhc3luY2hyb25vdXMgb3BlcmF0aW9uLiBUaGVcbiAgICAgIHByaW1hcnkgd2F5IG9mIGludGVyYWN0aW5nIHdpdGggYSBwcm9taXNlIGlzIHRocm91Z2ggaXRzIGB0aGVuYCBtZXRob2QsIHdoaWNoXG4gICAgICByZWdpc3RlcnMgY2FsbGJhY2tzIHRvIHJlY2VpdmUgZWl0aGVyIGEgcHJvbWlzZSdzIGV2ZW50dWFsIHZhbHVlIG9yIHRoZSByZWFzb25cbiAgICAgIHdoeSB0aGUgcHJvbWlzZSBjYW5ub3QgYmUgZnVsZmlsbGVkLlxuXG4gICAgICBUZXJtaW5vbG9neVxuICAgICAgLS0tLS0tLS0tLS1cblxuICAgICAgLSBgcHJvbWlzZWAgaXMgYW4gb2JqZWN0IG9yIGZ1bmN0aW9uIHdpdGggYSBgdGhlbmAgbWV0aG9kIHdob3NlIGJlaGF2aW9yIGNvbmZvcm1zIHRvIHRoaXMgc3BlY2lmaWNhdGlvbi5cbiAgICAgIC0gYHRoZW5hYmxlYCBpcyBhbiBvYmplY3Qgb3IgZnVuY3Rpb24gdGhhdCBkZWZpbmVzIGEgYHRoZW5gIG1ldGhvZC5cbiAgICAgIC0gYHZhbHVlYCBpcyBhbnkgbGVnYWwgSmF2YVNjcmlwdCB2YWx1ZSAoaW5jbHVkaW5nIHVuZGVmaW5lZCwgYSB0aGVuYWJsZSwgb3IgYSBwcm9taXNlKS5cbiAgICAgIC0gYGV4Y2VwdGlvbmAgaXMgYSB2YWx1ZSB0aGF0IGlzIHRocm93biB1c2luZyB0aGUgdGhyb3cgc3RhdGVtZW50LlxuICAgICAgLSBgcmVhc29uYCBpcyBhIHZhbHVlIHRoYXQgaW5kaWNhdGVzIHdoeSBhIHByb21pc2Ugd2FzIHJlamVjdGVkLlxuICAgICAgLSBgc2V0dGxlZGAgdGhlIGZpbmFsIHJlc3Rpbmcgc3RhdGUgb2YgYSBwcm9taXNlLCBmdWxmaWxsZWQgb3IgcmVqZWN0ZWQuXG5cbiAgICAgIEEgcHJvbWlzZSBjYW4gYmUgaW4gb25lIG9mIHRocmVlIHN0YXRlczogcGVuZGluZywgZnVsZmlsbGVkLCBvciByZWplY3RlZC5cblxuICAgICAgUHJvbWlzZXMgdGhhdCBhcmUgZnVsZmlsbGVkIGhhdmUgYSBmdWxmaWxsbWVudCB2YWx1ZSBhbmQgYXJlIGluIHRoZSBmdWxmaWxsZWRcbiAgICAgIHN0YXRlLiAgUHJvbWlzZXMgdGhhdCBhcmUgcmVqZWN0ZWQgaGF2ZSBhIHJlamVjdGlvbiByZWFzb24gYW5kIGFyZSBpbiB0aGVcbiAgICAgIHJlamVjdGVkIHN0YXRlLiAgQSBmdWxmaWxsbWVudCB2YWx1ZSBpcyBuZXZlciBhIHRoZW5hYmxlLlxuXG4gICAgICBQcm9taXNlcyBjYW4gYWxzbyBiZSBzYWlkIHRvICpyZXNvbHZlKiBhIHZhbHVlLiAgSWYgdGhpcyB2YWx1ZSBpcyBhbHNvIGFcbiAgICAgIHByb21pc2UsIHRoZW4gdGhlIG9yaWdpbmFsIHByb21pc2UncyBzZXR0bGVkIHN0YXRlIHdpbGwgbWF0Y2ggdGhlIHZhbHVlJ3NcbiAgICAgIHNldHRsZWQgc3RhdGUuICBTbyBhIHByb21pc2UgdGhhdCAqcmVzb2x2ZXMqIGEgcHJvbWlzZSB0aGF0IHJlamVjdHMgd2lsbFxuICAgICAgaXRzZWxmIHJlamVjdCwgYW5kIGEgcHJvbWlzZSB0aGF0ICpyZXNvbHZlcyogYSBwcm9taXNlIHRoYXQgZnVsZmlsbHMgd2lsbFxuICAgICAgaXRzZWxmIGZ1bGZpbGwuXG5cblxuICAgICAgQmFzaWMgVXNhZ2U6XG4gICAgICAtLS0tLS0tLS0tLS1cblxuICAgICAgYGBganNcbiAgICAgIHZhciBwcm9taXNlID0gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgIC8vIG9uIHN1Y2Nlc3NcbiAgICAgICAgcmVzb2x2ZSh2YWx1ZSk7XG5cbiAgICAgICAgLy8gb24gZmFpbHVyZVxuICAgICAgICByZWplY3QocmVhc29uKTtcbiAgICAgIH0pO1xuXG4gICAgICBwcm9taXNlLnRoZW4oZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgLy8gb24gZnVsZmlsbG1lbnRcbiAgICAgIH0sIGZ1bmN0aW9uKHJlYXNvbikge1xuICAgICAgICAvLyBvbiByZWplY3Rpb25cbiAgICAgIH0pO1xuICAgICAgYGBgXG5cbiAgICAgIEFkdmFuY2VkIFVzYWdlOlxuICAgICAgLS0tLS0tLS0tLS0tLS0tXG5cbiAgICAgIFByb21pc2VzIHNoaW5lIHdoZW4gYWJzdHJhY3RpbmcgYXdheSBhc3luY2hyb25vdXMgaW50ZXJhY3Rpb25zIHN1Y2ggYXNcbiAgICAgIGBYTUxIdHRwUmVxdWVzdGBzLlxuXG4gICAgICBgYGBqc1xuICAgICAgZnVuY3Rpb24gZ2V0SlNPTih1cmwpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG4gICAgICAgICAgdmFyIHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuXG4gICAgICAgICAgeGhyLm9wZW4oJ0dFVCcsIHVybCk7XG4gICAgICAgICAgeGhyLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGhhbmRsZXI7XG4gICAgICAgICAgeGhyLnJlc3BvbnNlVHlwZSA9ICdqc29uJztcbiAgICAgICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcignQWNjZXB0JywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcbiAgICAgICAgICB4aHIuc2VuZCgpO1xuXG4gICAgICAgICAgZnVuY3Rpb24gaGFuZGxlcigpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLnJlYWR5U3RhdGUgPT09IHRoaXMuRE9ORSkge1xuICAgICAgICAgICAgICBpZiAodGhpcy5zdGF0dXMgPT09IDIwMCkge1xuICAgICAgICAgICAgICAgIHJlc29sdmUodGhpcy5yZXNwb25zZSk7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcignZ2V0SlNPTjogYCcgKyB1cmwgKyAnYCBmYWlsZWQgd2l0aCBzdGF0dXM6IFsnICsgdGhpcy5zdGF0dXMgKyAnXScpKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH07XG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICBnZXRKU09OKCcvcG9zdHMuanNvbicpLnRoZW4oZnVuY3Rpb24oanNvbikge1xuICAgICAgICAvLyBvbiBmdWxmaWxsbWVudFxuICAgICAgfSwgZnVuY3Rpb24ocmVhc29uKSB7XG4gICAgICAgIC8vIG9uIHJlamVjdGlvblxuICAgICAgfSk7XG4gICAgICBgYGBcblxuICAgICAgVW5saWtlIGNhbGxiYWNrcywgcHJvbWlzZXMgYXJlIGdyZWF0IGNvbXBvc2FibGUgcHJpbWl0aXZlcy5cblxuICAgICAgYGBganNcbiAgICAgIFByb21pc2UuYWxsKFtcbiAgICAgICAgZ2V0SlNPTignL3Bvc3RzJyksXG4gICAgICAgIGdldEpTT04oJy9jb21tZW50cycpXG4gICAgICBdKS50aGVuKGZ1bmN0aW9uKHZhbHVlcyl7XG4gICAgICAgIHZhbHVlc1swXSAvLyA9PiBwb3N0c0pTT05cbiAgICAgICAgdmFsdWVzWzFdIC8vID0+IGNvbW1lbnRzSlNPTlxuXG4gICAgICAgIHJldHVybiB2YWx1ZXM7XG4gICAgICB9KTtcbiAgICAgIGBgYFxuXG4gICAgICBAY2xhc3MgUHJvbWlzZVxuICAgICAgQHBhcmFtIHtmdW5jdGlvbn0gcmVzb2x2ZXJcbiAgICAgIFVzZWZ1bCBmb3IgdG9vbGluZy5cbiAgICAgIEBjb25zdHJ1Y3RvclxuICAgICovXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJHByb21pc2UkJFByb21pc2UocmVzb2x2ZXIpIHtcbiAgICAgIHRoaXMuX2lkID0gbGliJGVzNiRwcm9taXNlJHByb21pc2UkJGNvdW50ZXIrKztcbiAgICAgIHRoaXMuX3N0YXRlID0gdW5kZWZpbmVkO1xuICAgICAgdGhpcy5fcmVzdWx0ID0gdW5kZWZpbmVkO1xuICAgICAgdGhpcy5fc3Vic2NyaWJlcnMgPSBbXTtcblxuICAgICAgaWYgKGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJG5vb3AgIT09IHJlc29sdmVyKSB7XG4gICAgICAgIHR5cGVvZiByZXNvbHZlciAhPT0gJ2Z1bmN0aW9uJyAmJiBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkbmVlZHNSZXNvbHZlcigpO1xuICAgICAgICB0aGlzIGluc3RhbmNlb2YgbGliJGVzNiRwcm9taXNlJHByb21pc2UkJFByb21pc2UgPyBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRpbml0aWFsaXplUHJvbWlzZSh0aGlzLCByZXNvbHZlcikgOiBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkbmVlZHNOZXcoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkUHJvbWlzZS5hbGwgPSBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSRhbGwkJGRlZmF1bHQ7XG4gICAgbGliJGVzNiRwcm9taXNlJHByb21pc2UkJFByb21pc2UucmFjZSA9IGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJHJhY2UkJGRlZmF1bHQ7XG4gICAgbGliJGVzNiRwcm9taXNlJHByb21pc2UkJFByb21pc2UucmVzb2x2ZSA9IGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJHJlc29sdmUkJGRlZmF1bHQ7XG4gICAgbGliJGVzNiRwcm9taXNlJHByb21pc2UkJFByb21pc2UucmVqZWN0ID0gbGliJGVzNiRwcm9taXNlJHByb21pc2UkcmVqZWN0JCRkZWZhdWx0O1xuICAgIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRQcm9taXNlLl9zZXRTY2hlZHVsZXIgPSBsaWIkZXM2JHByb21pc2UkYXNhcCQkc2V0U2NoZWR1bGVyO1xuICAgIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRQcm9taXNlLl9zZXRBc2FwID0gbGliJGVzNiRwcm9taXNlJGFzYXAkJHNldEFzYXA7XG4gICAgbGliJGVzNiRwcm9taXNlJHByb21pc2UkJFByb21pc2UuX2FzYXAgPSBsaWIkZXM2JHByb21pc2UkYXNhcCQkYXNhcDtcblxuICAgIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRQcm9taXNlLnByb3RvdHlwZSA9IHtcbiAgICAgIGNvbnN0cnVjdG9yOiBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkUHJvbWlzZSxcblxuICAgIC8qKlxuICAgICAgVGhlIHByaW1hcnkgd2F5IG9mIGludGVyYWN0aW5nIHdpdGggYSBwcm9taXNlIGlzIHRocm91Z2ggaXRzIGB0aGVuYCBtZXRob2QsXG4gICAgICB3aGljaCByZWdpc3RlcnMgY2FsbGJhY2tzIHRvIHJlY2VpdmUgZWl0aGVyIGEgcHJvbWlzZSdzIGV2ZW50dWFsIHZhbHVlIG9yIHRoZVxuICAgICAgcmVhc29uIHdoeSB0aGUgcHJvbWlzZSBjYW5ub3QgYmUgZnVsZmlsbGVkLlxuXG4gICAgICBgYGBqc1xuICAgICAgZmluZFVzZXIoKS50aGVuKGZ1bmN0aW9uKHVzZXIpe1xuICAgICAgICAvLyB1c2VyIGlzIGF2YWlsYWJsZVxuICAgICAgfSwgZnVuY3Rpb24ocmVhc29uKXtcbiAgICAgICAgLy8gdXNlciBpcyB1bmF2YWlsYWJsZSwgYW5kIHlvdSBhcmUgZ2l2ZW4gdGhlIHJlYXNvbiB3aHlcbiAgICAgIH0pO1xuICAgICAgYGBgXG5cbiAgICAgIENoYWluaW5nXG4gICAgICAtLS0tLS0tLVxuXG4gICAgICBUaGUgcmV0dXJuIHZhbHVlIG9mIGB0aGVuYCBpcyBpdHNlbGYgYSBwcm9taXNlLiAgVGhpcyBzZWNvbmQsICdkb3duc3RyZWFtJ1xuICAgICAgcHJvbWlzZSBpcyByZXNvbHZlZCB3aXRoIHRoZSByZXR1cm4gdmFsdWUgb2YgdGhlIGZpcnN0IHByb21pc2UncyBmdWxmaWxsbWVudFxuICAgICAgb3IgcmVqZWN0aW9uIGhhbmRsZXIsIG9yIHJlamVjdGVkIGlmIHRoZSBoYW5kbGVyIHRocm93cyBhbiBleGNlcHRpb24uXG5cbiAgICAgIGBgYGpzXG4gICAgICBmaW5kVXNlcigpLnRoZW4oZnVuY3Rpb24gKHVzZXIpIHtcbiAgICAgICAgcmV0dXJuIHVzZXIubmFtZTtcbiAgICAgIH0sIGZ1bmN0aW9uIChyZWFzb24pIHtcbiAgICAgICAgcmV0dXJuICdkZWZhdWx0IG5hbWUnO1xuICAgICAgfSkudGhlbihmdW5jdGlvbiAodXNlck5hbWUpIHtcbiAgICAgICAgLy8gSWYgYGZpbmRVc2VyYCBmdWxmaWxsZWQsIGB1c2VyTmFtZWAgd2lsbCBiZSB0aGUgdXNlcidzIG5hbWUsIG90aGVyd2lzZSBpdFxuICAgICAgICAvLyB3aWxsIGJlIGAnZGVmYXVsdCBuYW1lJ2BcbiAgICAgIH0pO1xuXG4gICAgICBmaW5kVXNlcigpLnRoZW4oZnVuY3Rpb24gKHVzZXIpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdGb3VuZCB1c2VyLCBidXQgc3RpbGwgdW5oYXBweScpO1xuICAgICAgfSwgZnVuY3Rpb24gKHJlYXNvbikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2BmaW5kVXNlcmAgcmVqZWN0ZWQgYW5kIHdlJ3JlIHVuaGFwcHknKTtcbiAgICAgIH0pLnRoZW4oZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIC8vIG5ldmVyIHJlYWNoZWRcbiAgICAgIH0sIGZ1bmN0aW9uIChyZWFzb24pIHtcbiAgICAgICAgLy8gaWYgYGZpbmRVc2VyYCBmdWxmaWxsZWQsIGByZWFzb25gIHdpbGwgYmUgJ0ZvdW5kIHVzZXIsIGJ1dCBzdGlsbCB1bmhhcHB5Jy5cbiAgICAgICAgLy8gSWYgYGZpbmRVc2VyYCByZWplY3RlZCwgYHJlYXNvbmAgd2lsbCBiZSAnYGZpbmRVc2VyYCByZWplY3RlZCBhbmQgd2UncmUgdW5oYXBweScuXG4gICAgICB9KTtcbiAgICAgIGBgYFxuICAgICAgSWYgdGhlIGRvd25zdHJlYW0gcHJvbWlzZSBkb2VzIG5vdCBzcGVjaWZ5IGEgcmVqZWN0aW9uIGhhbmRsZXIsIHJlamVjdGlvbiByZWFzb25zIHdpbGwgYmUgcHJvcGFnYXRlZCBmdXJ0aGVyIGRvd25zdHJlYW0uXG5cbiAgICAgIGBgYGpzXG4gICAgICBmaW5kVXNlcigpLnRoZW4oZnVuY3Rpb24gKHVzZXIpIHtcbiAgICAgICAgdGhyb3cgbmV3IFBlZGFnb2dpY2FsRXhjZXB0aW9uKCdVcHN0cmVhbSBlcnJvcicpO1xuICAgICAgfSkudGhlbihmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgLy8gbmV2ZXIgcmVhY2hlZFxuICAgICAgfSkudGhlbihmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgLy8gbmV2ZXIgcmVhY2hlZFxuICAgICAgfSwgZnVuY3Rpb24gKHJlYXNvbikge1xuICAgICAgICAvLyBUaGUgYFBlZGdhZ29jaWFsRXhjZXB0aW9uYCBpcyBwcm9wYWdhdGVkIGFsbCB0aGUgd2F5IGRvd24gdG8gaGVyZVxuICAgICAgfSk7XG4gICAgICBgYGBcblxuICAgICAgQXNzaW1pbGF0aW9uXG4gICAgICAtLS0tLS0tLS0tLS1cblxuICAgICAgU29tZXRpbWVzIHRoZSB2YWx1ZSB5b3Ugd2FudCB0byBwcm9wYWdhdGUgdG8gYSBkb3duc3RyZWFtIHByb21pc2UgY2FuIG9ubHkgYmVcbiAgICAgIHJldHJpZXZlZCBhc3luY2hyb25vdXNseS4gVGhpcyBjYW4gYmUgYWNoaWV2ZWQgYnkgcmV0dXJuaW5nIGEgcHJvbWlzZSBpbiB0aGVcbiAgICAgIGZ1bGZpbGxtZW50IG9yIHJlamVjdGlvbiBoYW5kbGVyLiBUaGUgZG93bnN0cmVhbSBwcm9taXNlIHdpbGwgdGhlbiBiZSBwZW5kaW5nXG4gICAgICB1bnRpbCB0aGUgcmV0dXJuZWQgcHJvbWlzZSBpcyBzZXR0bGVkLiBUaGlzIGlzIGNhbGxlZCAqYXNzaW1pbGF0aW9uKi5cblxuICAgICAgYGBganNcbiAgICAgIGZpbmRVc2VyKCkudGhlbihmdW5jdGlvbiAodXNlcikge1xuICAgICAgICByZXR1cm4gZmluZENvbW1lbnRzQnlBdXRob3IodXNlcik7XG4gICAgICB9KS50aGVuKGZ1bmN0aW9uIChjb21tZW50cykge1xuICAgICAgICAvLyBUaGUgdXNlcidzIGNvbW1lbnRzIGFyZSBub3cgYXZhaWxhYmxlXG4gICAgICB9KTtcbiAgICAgIGBgYFxuXG4gICAgICBJZiB0aGUgYXNzaW1saWF0ZWQgcHJvbWlzZSByZWplY3RzLCB0aGVuIHRoZSBkb3duc3RyZWFtIHByb21pc2Ugd2lsbCBhbHNvIHJlamVjdC5cblxuICAgICAgYGBganNcbiAgICAgIGZpbmRVc2VyKCkudGhlbihmdW5jdGlvbiAodXNlcikge1xuICAgICAgICByZXR1cm4gZmluZENvbW1lbnRzQnlBdXRob3IodXNlcik7XG4gICAgICB9KS50aGVuKGZ1bmN0aW9uIChjb21tZW50cykge1xuICAgICAgICAvLyBJZiBgZmluZENvbW1lbnRzQnlBdXRob3JgIGZ1bGZpbGxzLCB3ZSdsbCBoYXZlIHRoZSB2YWx1ZSBoZXJlXG4gICAgICB9LCBmdW5jdGlvbiAocmVhc29uKSB7XG4gICAgICAgIC8vIElmIGBmaW5kQ29tbWVudHNCeUF1dGhvcmAgcmVqZWN0cywgd2UnbGwgaGF2ZSB0aGUgcmVhc29uIGhlcmVcbiAgICAgIH0pO1xuICAgICAgYGBgXG5cbiAgICAgIFNpbXBsZSBFeGFtcGxlXG4gICAgICAtLS0tLS0tLS0tLS0tLVxuXG4gICAgICBTeW5jaHJvbm91cyBFeGFtcGxlXG5cbiAgICAgIGBgYGphdmFzY3JpcHRcbiAgICAgIHZhciByZXN1bHQ7XG5cbiAgICAgIHRyeSB7XG4gICAgICAgIHJlc3VsdCA9IGZpbmRSZXN1bHQoKTtcbiAgICAgICAgLy8gc3VjY2Vzc1xuICAgICAgfSBjYXRjaChyZWFzb24pIHtcbiAgICAgICAgLy8gZmFpbHVyZVxuICAgICAgfVxuICAgICAgYGBgXG5cbiAgICAgIEVycmJhY2sgRXhhbXBsZVxuXG4gICAgICBgYGBqc1xuICAgICAgZmluZFJlc3VsdChmdW5jdGlvbihyZXN1bHQsIGVycil7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAvLyBmYWlsdXJlXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gc3VjY2Vzc1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIGBgYFxuXG4gICAgICBQcm9taXNlIEV4YW1wbGU7XG5cbiAgICAgIGBgYGphdmFzY3JpcHRcbiAgICAgIGZpbmRSZXN1bHQoKS50aGVuKGZ1bmN0aW9uKHJlc3VsdCl7XG4gICAgICAgIC8vIHN1Y2Nlc3NcbiAgICAgIH0sIGZ1bmN0aW9uKHJlYXNvbil7XG4gICAgICAgIC8vIGZhaWx1cmVcbiAgICAgIH0pO1xuICAgICAgYGBgXG5cbiAgICAgIEFkdmFuY2VkIEV4YW1wbGVcbiAgICAgIC0tLS0tLS0tLS0tLS0tXG5cbiAgICAgIFN5bmNocm9ub3VzIEV4YW1wbGVcblxuICAgICAgYGBgamF2YXNjcmlwdFxuICAgICAgdmFyIGF1dGhvciwgYm9va3M7XG5cbiAgICAgIHRyeSB7XG4gICAgICAgIGF1dGhvciA9IGZpbmRBdXRob3IoKTtcbiAgICAgICAgYm9va3MgID0gZmluZEJvb2tzQnlBdXRob3IoYXV0aG9yKTtcbiAgICAgICAgLy8gc3VjY2Vzc1xuICAgICAgfSBjYXRjaChyZWFzb24pIHtcbiAgICAgICAgLy8gZmFpbHVyZVxuICAgICAgfVxuICAgICAgYGBgXG5cbiAgICAgIEVycmJhY2sgRXhhbXBsZVxuXG4gICAgICBgYGBqc1xuXG4gICAgICBmdW5jdGlvbiBmb3VuZEJvb2tzKGJvb2tzKSB7XG5cbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gZmFpbHVyZShyZWFzb24pIHtcblxuICAgICAgfVxuXG4gICAgICBmaW5kQXV0aG9yKGZ1bmN0aW9uKGF1dGhvciwgZXJyKXtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgIGZhaWx1cmUoZXJyKTtcbiAgICAgICAgICAvLyBmYWlsdXJlXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGZpbmRCb29va3NCeUF1dGhvcihhdXRob3IsIGZ1bmN0aW9uKGJvb2tzLCBlcnIpIHtcbiAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGZhaWx1cmUoZXJyKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgZm91bmRCb29rcyhib29rcyk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaChyZWFzb24pIHtcbiAgICAgICAgICAgICAgICAgIGZhaWx1cmUocmVhc29uKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0gY2F0Y2goZXJyb3IpIHtcbiAgICAgICAgICAgIGZhaWx1cmUoZXJyKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gc3VjY2Vzc1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIGBgYFxuXG4gICAgICBQcm9taXNlIEV4YW1wbGU7XG5cbiAgICAgIGBgYGphdmFzY3JpcHRcbiAgICAgIGZpbmRBdXRob3IoKS5cbiAgICAgICAgdGhlbihmaW5kQm9va3NCeUF1dGhvcikuXG4gICAgICAgIHRoZW4oZnVuY3Rpb24oYm9va3Mpe1xuICAgICAgICAgIC8vIGZvdW5kIGJvb2tzXG4gICAgICB9KS5jYXRjaChmdW5jdGlvbihyZWFzb24pe1xuICAgICAgICAvLyBzb21ldGhpbmcgd2VudCB3cm9uZ1xuICAgICAgfSk7XG4gICAgICBgYGBcblxuICAgICAgQG1ldGhvZCB0aGVuXG4gICAgICBAcGFyYW0ge0Z1bmN0aW9ufSBvbkZ1bGZpbGxlZFxuICAgICAgQHBhcmFtIHtGdW5jdGlvbn0gb25SZWplY3RlZFxuICAgICAgVXNlZnVsIGZvciB0b29saW5nLlxuICAgICAgQHJldHVybiB7UHJvbWlzZX1cbiAgICAqL1xuICAgICAgdGhlbjogbGliJGVzNiRwcm9taXNlJHRoZW4kJGRlZmF1bHQsXG5cbiAgICAvKipcbiAgICAgIGBjYXRjaGAgaXMgc2ltcGx5IHN1Z2FyIGZvciBgdGhlbih1bmRlZmluZWQsIG9uUmVqZWN0aW9uKWAgd2hpY2ggbWFrZXMgaXQgdGhlIHNhbWVcbiAgICAgIGFzIHRoZSBjYXRjaCBibG9jayBvZiBhIHRyeS9jYXRjaCBzdGF0ZW1lbnQuXG5cbiAgICAgIGBgYGpzXG4gICAgICBmdW5jdGlvbiBmaW5kQXV0aG9yKCl7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignY291bGRuJ3QgZmluZCB0aGF0IGF1dGhvcicpO1xuICAgICAgfVxuXG4gICAgICAvLyBzeW5jaHJvbm91c1xuICAgICAgdHJ5IHtcbiAgICAgICAgZmluZEF1dGhvcigpO1xuICAgICAgfSBjYXRjaChyZWFzb24pIHtcbiAgICAgICAgLy8gc29tZXRoaW5nIHdlbnQgd3JvbmdcbiAgICAgIH1cblxuICAgICAgLy8gYXN5bmMgd2l0aCBwcm9taXNlc1xuICAgICAgZmluZEF1dGhvcigpLmNhdGNoKGZ1bmN0aW9uKHJlYXNvbil7XG4gICAgICAgIC8vIHNvbWV0aGluZyB3ZW50IHdyb25nXG4gICAgICB9KTtcbiAgICAgIGBgYFxuXG4gICAgICBAbWV0aG9kIGNhdGNoXG4gICAgICBAcGFyYW0ge0Z1bmN0aW9ufSBvblJlamVjdGlvblxuICAgICAgVXNlZnVsIGZvciB0b29saW5nLlxuICAgICAgQHJldHVybiB7UHJvbWlzZX1cbiAgICAqL1xuICAgICAgJ2NhdGNoJzogZnVuY3Rpb24ob25SZWplY3Rpb24pIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudGhlbihudWxsLCBvblJlamVjdGlvbik7XG4gICAgICB9XG4gICAgfTtcbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJGVudW1lcmF0b3IkJGRlZmF1bHQgPSBsaWIkZXM2JHByb21pc2UkZW51bWVyYXRvciQkRW51bWVyYXRvcjtcbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkZW51bWVyYXRvciQkRW51bWVyYXRvcihDb25zdHJ1Y3RvciwgaW5wdXQpIHtcbiAgICAgIHRoaXMuX2luc3RhbmNlQ29uc3RydWN0b3IgPSBDb25zdHJ1Y3RvcjtcbiAgICAgIHRoaXMucHJvbWlzZSA9IG5ldyBDb25zdHJ1Y3RvcihsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRub29wKTtcblxuICAgICAgaWYgKEFycmF5LmlzQXJyYXkoaW5wdXQpKSB7XG4gICAgICAgIHRoaXMuX2lucHV0ICAgICA9IGlucHV0O1xuICAgICAgICB0aGlzLmxlbmd0aCAgICAgPSBpbnB1dC5sZW5ndGg7XG4gICAgICAgIHRoaXMuX3JlbWFpbmluZyA9IGlucHV0Lmxlbmd0aDtcblxuICAgICAgICB0aGlzLl9yZXN1bHQgPSBuZXcgQXJyYXkodGhpcy5sZW5ndGgpO1xuXG4gICAgICAgIGlmICh0aGlzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGZ1bGZpbGwodGhpcy5wcm9taXNlLCB0aGlzLl9yZXN1bHQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMubGVuZ3RoID0gdGhpcy5sZW5ndGggfHwgMDtcbiAgICAgICAgICB0aGlzLl9lbnVtZXJhdGUoKTtcbiAgICAgICAgICBpZiAodGhpcy5fcmVtYWluaW5nID09PSAwKSB7XG4gICAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRmdWxmaWxsKHRoaXMucHJvbWlzZSwgdGhpcy5fcmVzdWx0KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlamVjdCh0aGlzLnByb21pc2UsIHRoaXMuX3ZhbGlkYXRpb25FcnJvcigpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBsaWIkZXM2JHByb21pc2UkZW51bWVyYXRvciQkRW51bWVyYXRvci5wcm90b3R5cGUuX3ZhbGlkYXRpb25FcnJvciA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIG5ldyBFcnJvcignQXJyYXkgTWV0aG9kcyBtdXN0IGJlIHByb3ZpZGVkIGFuIEFycmF5Jyk7XG4gICAgfTtcblxuICAgIGxpYiRlczYkcHJvbWlzZSRlbnVtZXJhdG9yJCRFbnVtZXJhdG9yLnByb3RvdHlwZS5fZW51bWVyYXRlID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgbGVuZ3RoICA9IHRoaXMubGVuZ3RoO1xuICAgICAgdmFyIGlucHV0ICAgPSB0aGlzLl9pbnB1dDtcblxuICAgICAgZm9yICh2YXIgaSA9IDA7IHRoaXMuX3N0YXRlID09PSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRQRU5ESU5HICYmIGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICB0aGlzLl9lYWNoRW50cnkoaW5wdXRbaV0sIGkpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBsaWIkZXM2JHByb21pc2UkZW51bWVyYXRvciQkRW51bWVyYXRvci5wcm90b3R5cGUuX2VhY2hFbnRyeSA9IGZ1bmN0aW9uKGVudHJ5LCBpKSB7XG4gICAgICB2YXIgYyA9IHRoaXMuX2luc3RhbmNlQ29uc3RydWN0b3I7XG4gICAgICB2YXIgcmVzb2x2ZSA9IGMucmVzb2x2ZTtcblxuICAgICAgaWYgKHJlc29sdmUgPT09IGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJHJlc29sdmUkJGRlZmF1bHQpIHtcbiAgICAgICAgdmFyIHRoZW4gPSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRnZXRUaGVuKGVudHJ5KTtcblxuICAgICAgICBpZiAodGhlbiA9PT0gbGliJGVzNiRwcm9taXNlJHRoZW4kJGRlZmF1bHQgJiZcbiAgICAgICAgICAgIGVudHJ5Ll9zdGF0ZSAhPT0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkUEVORElORykge1xuICAgICAgICAgIHRoaXMuX3NldHRsZWRBdChlbnRyeS5fc3RhdGUsIGksIGVudHJ5Ll9yZXN1bHQpO1xuICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiB0aGVuICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgdGhpcy5fcmVtYWluaW5nLS07XG4gICAgICAgICAgdGhpcy5fcmVzdWx0W2ldID0gZW50cnk7XG4gICAgICAgIH0gZWxzZSBpZiAoYyA9PT0gbGliJGVzNiRwcm9taXNlJHByb21pc2UkJGRlZmF1bHQpIHtcbiAgICAgICAgICB2YXIgcHJvbWlzZSA9IG5ldyBjKGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJG5vb3ApO1xuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGhhbmRsZU1heWJlVGhlbmFibGUocHJvbWlzZSwgZW50cnksIHRoZW4pO1xuICAgICAgICAgIHRoaXMuX3dpbGxTZXR0bGVBdChwcm9taXNlLCBpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLl93aWxsU2V0dGxlQXQobmV3IGMoZnVuY3Rpb24ocmVzb2x2ZSkgeyByZXNvbHZlKGVudHJ5KTsgfSksIGkpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl93aWxsU2V0dGxlQXQocmVzb2x2ZShlbnRyeSksIGkpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBsaWIkZXM2JHByb21pc2UkZW51bWVyYXRvciQkRW51bWVyYXRvci5wcm90b3R5cGUuX3NldHRsZWRBdCA9IGZ1bmN0aW9uKHN0YXRlLCBpLCB2YWx1ZSkge1xuICAgICAgdmFyIHByb21pc2UgPSB0aGlzLnByb21pc2U7XG5cbiAgICAgIGlmIChwcm9taXNlLl9zdGF0ZSA9PT0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkUEVORElORykge1xuICAgICAgICB0aGlzLl9yZW1haW5pbmctLTtcblxuICAgICAgICBpZiAoc3RhdGUgPT09IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFJFSkVDVEVEKSB7XG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVqZWN0KHByb21pc2UsIHZhbHVlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLl9yZXN1bHRbaV0gPSB2YWx1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy5fcmVtYWluaW5nID09PSAwKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGZ1bGZpbGwocHJvbWlzZSwgdGhpcy5fcmVzdWx0KTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgbGliJGVzNiRwcm9taXNlJGVudW1lcmF0b3IkJEVudW1lcmF0b3IucHJvdG90eXBlLl93aWxsU2V0dGxlQXQgPSBmdW5jdGlvbihwcm9taXNlLCBpKSB7XG4gICAgICB2YXIgZW51bWVyYXRvciA9IHRoaXM7XG5cbiAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHN1YnNjcmliZShwcm9taXNlLCB1bmRlZmluZWQsIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIGVudW1lcmF0b3IuX3NldHRsZWRBdChsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRGVUxGSUxMRUQsIGksIHZhbHVlKTtcbiAgICAgIH0sIGZ1bmN0aW9uKHJlYXNvbikge1xuICAgICAgICBlbnVtZXJhdG9yLl9zZXR0bGVkQXQobGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkUkVKRUNURUQsIGksIHJlYXNvbik7XG4gICAgICB9KTtcbiAgICB9O1xuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSRwb2x5ZmlsbCQkcG9seWZpbGwoKSB7XG4gICAgICB2YXIgbG9jYWw7XG5cbiAgICAgIGlmICh0eXBlb2YgZ2xvYmFsICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgIGxvY2FsID0gZ2xvYmFsO1xuICAgICAgfSBlbHNlIGlmICh0eXBlb2Ygc2VsZiAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICBsb2NhbCA9IHNlbGY7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGxvY2FsID0gRnVuY3Rpb24oJ3JldHVybiB0aGlzJykoKTtcbiAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcigncG9seWZpbGwgZmFpbGVkIGJlY2F1c2UgZ2xvYmFsIG9iamVjdCBpcyB1bmF2YWlsYWJsZSBpbiB0aGlzIGVudmlyb25tZW50Jyk7XG4gICAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICB2YXIgUCA9IGxvY2FsLlByb21pc2U7XG5cbiAgICAgIGlmIChQICYmIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChQLnJlc29sdmUoKSkgPT09ICdbb2JqZWN0IFByb21pc2VdJyAmJiAhUC5jYXN0KSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgbG9jYWwuUHJvbWlzZSA9IGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRkZWZhdWx0O1xuICAgIH1cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJHBvbHlmaWxsJCRkZWZhdWx0ID0gbGliJGVzNiRwcm9taXNlJHBvbHlmaWxsJCRwb2x5ZmlsbDtcblxuICAgIHZhciBsaWIkZXM2JHByb21pc2UkdW1kJCRFUzZQcm9taXNlID0ge1xuICAgICAgJ1Byb21pc2UnOiBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkZGVmYXVsdCxcbiAgICAgICdwb2x5ZmlsbCc6IGxpYiRlczYkcHJvbWlzZSRwb2x5ZmlsbCQkZGVmYXVsdFxuICAgIH07XG5cbiAgICAvKiBnbG9iYWwgZGVmaW5lOnRydWUgbW9kdWxlOnRydWUgd2luZG93OiB0cnVlICovXG4gICAgaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lWydhbWQnXSkge1xuICAgICAgZGVmaW5lKGZ1bmN0aW9uKCkgeyByZXR1cm4gbGliJGVzNiRwcm9taXNlJHVtZCQkRVM2UHJvbWlzZTsgfSk7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiBtb2R1bGVbJ2V4cG9ydHMnXSkge1xuICAgICAgbW9kdWxlWydleHBvcnRzJ10gPSBsaWIkZXM2JHByb21pc2UkdW1kJCRFUzZQcm9taXNlO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIHRoaXMgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICB0aGlzWydFUzZQcm9taXNlJ10gPSBsaWIkZXM2JHByb21pc2UkdW1kJCRFUzZQcm9taXNlO1xuICAgIH1cblxuICAgIGxpYiRlczYkcHJvbWlzZSRwb2x5ZmlsbCQkZGVmYXVsdCgpO1xufSkuY2FsbCh0aGlzKTtcblxuIiwiKGZ1bmN0aW9uKGYpe2lmKHR5cGVvZiBleHBvcnRzPT09XCJvYmplY3RcIiYmdHlwZW9mIG1vZHVsZSE9PVwidW5kZWZpbmVkXCIpe21vZHVsZS5leHBvcnRzPWYoKX1lbHNlIGlmKHR5cGVvZiBkZWZpbmU9PT1cImZ1bmN0aW9uXCImJmRlZmluZS5hbWQpe2RlZmluZShbXSxmKX1lbHNle3ZhciBnO2lmKHR5cGVvZiB3aW5kb3chPT1cInVuZGVmaW5lZFwiKXtnPXdpbmRvd31lbHNlIGlmKHR5cGVvZiBnbG9iYWwhPT1cInVuZGVmaW5lZFwiKXtnPWdsb2JhbH1lbHNlIGlmKHR5cGVvZiBzZWxmIT09XCJ1bmRlZmluZWRcIil7Zz1zZWxmfWVsc2V7Zz10aGlzfWcudHVzID0gZigpfX0pKGZ1bmN0aW9uKCl7dmFyIGRlZmluZSxtb2R1bGUsZXhwb3J0cztyZXR1cm4gKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkoezE6W2Z1bmN0aW9uKF9kZXJlcV8sbW9kdWxlLGV4cG9ydHMpe1xuXCJ1c2Ugc3RyaWN0XCI7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwge1xuICB2YWx1ZTogdHJ1ZVxufSk7XG5leHBvcnRzLmRlZmF1bHQgPSBmaW5nZXJwcmludDtcbi8qKlxuICogR2VuZXJhdGUgYSBmaW5nZXJwcmludCBmb3IgYSBmaWxlIHdoaWNoIHdpbGwgYmUgdXNlZCB0aGUgc3RvcmUgdGhlIGVuZHBvaW50XG4gKlxuICogQHBhcmFtIHtGaWxlfSBmaWxlXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKi9cbmZ1bmN0aW9uIGZpbmdlcnByaW50KGZpbGUpIHtcbiAgcmV0dXJuIFtcInR1c1wiLCBmaWxlLm5hbWUsIGZpbGUudHlwZSwgZmlsZS5zaXplLCBmaWxlLmxhc3RNb2RpZmllZF0uam9pbihcIi1cIik7XG59XG5cbn0se31dLDI6W2Z1bmN0aW9uKF9kZXJlcV8sbW9kdWxlLGV4cG9ydHMpe1xuXCJ1c2Ugc3RyaWN0XCI7XG5cbnZhciBfdXBsb2FkID0gX2RlcmVxXyhcIi4vdXBsb2FkXCIpO1xuXG52YXIgX3VwbG9hZDIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF91cGxvYWQpO1xuXG5mdW5jdGlvbiBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KG9iaikgeyByZXR1cm4gb2JqICYmIG9iai5fX2VzTW9kdWxlID8gb2JqIDogeyBkZWZhdWx0OiBvYmogfTsgfVxuXG52YXIgZGVmYXVsdE9wdGlvbnMgPSBfdXBsb2FkMi5kZWZhdWx0LmRlZmF1bHRPcHRpb25zOyAvKiBnbG9iYWwgd2luZG93ICovXG5cbnZhciBfd2luZG93ID0gd2luZG93O1xudmFyIFhNTEh0dHBSZXF1ZXN0ID0gX3dpbmRvdy5YTUxIdHRwUmVxdWVzdDtcbnZhciBsb2NhbFN0b3JhZ2UgPSBfd2luZG93LmxvY2FsU3RvcmFnZTtcbnZhciBCbG9iID0gX3dpbmRvdy5CbG9iO1xuXG52YXIgaXNTdXBwb3J0ZWQgPSBYTUxIdHRwUmVxdWVzdCAmJiBsb2NhbFN0b3JhZ2UgJiYgQmxvYiAmJiB0eXBlb2YgQmxvYi5wcm90b3R5cGUuc2xpY2UgPT09IFwiZnVuY3Rpb25cIjtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIFVwbG9hZDogX3VwbG9hZDIuZGVmYXVsdCxcbiAgaXNTdXBwb3J0ZWQ6IGlzU3VwcG9ydGVkLFxuICBkZWZhdWx0T3B0aW9uczogZGVmYXVsdE9wdGlvbnNcbn07XG5cbn0se1wiLi91cGxvYWRcIjozfV0sMzpbZnVuY3Rpb24oX2RlcmVxXyxtb2R1bGUsZXhwb3J0cyl7XG5cInVzZSBzdHJpY3RcIjtcblxudmFyIF9jcmVhdGVDbGFzcyA9IChmdW5jdGlvbiAoKSB7IGZ1bmN0aW9uIGRlZmluZVByb3BlcnRpZXModGFyZ2V0LCBwcm9wcykgeyBmb3IgKHZhciBpID0gMDsgaSA8IHByb3BzLmxlbmd0aDsgaSsrKSB7IHZhciBkZXNjcmlwdG9yID0gcHJvcHNbaV07IGRlc2NyaXB0b3IuZW51bWVyYWJsZSA9IGRlc2NyaXB0b3IuZW51bWVyYWJsZSB8fCBmYWxzZTsgZGVzY3JpcHRvci5jb25maWd1cmFibGUgPSB0cnVlOyBpZiAoXCJ2YWx1ZVwiIGluIGRlc2NyaXB0b3IpIGRlc2NyaXB0b3Iud3JpdGFibGUgPSB0cnVlOyBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBkZXNjcmlwdG9yLmtleSwgZGVzY3JpcHRvcik7IH0gfSByZXR1cm4gZnVuY3Rpb24gKENvbnN0cnVjdG9yLCBwcm90b1Byb3BzLCBzdGF0aWNQcm9wcykgeyBpZiAocHJvdG9Qcm9wcykgZGVmaW5lUHJvcGVydGllcyhDb25zdHJ1Y3Rvci5wcm90b3R5cGUsIHByb3RvUHJvcHMpOyBpZiAoc3RhdGljUHJvcHMpIGRlZmluZVByb3BlcnRpZXMoQ29uc3RydWN0b3IsIHN0YXRpY1Byb3BzKTsgcmV0dXJuIENvbnN0cnVjdG9yOyB9OyB9KSgpOyAvKiBnbG9iYWwgd2luZG93LCBYTUxIdHRwUmVxdWVzdCAqL1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHtcbiAgdmFsdWU6IHRydWVcbn0pO1xuXG52YXIgX2ZpbmdlcnByaW50ID0gX2RlcmVxXyhcIi4vZmluZ2VycHJpbnRcIik7XG5cbnZhciBfZmluZ2VycHJpbnQyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfZmluZ2VycHJpbnQpO1xuXG52YXIgX2V4dGVuZCA9IF9kZXJlcV8oXCJleHRlbmRcIik7XG5cbnZhciBfZXh0ZW5kMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX2V4dGVuZCk7XG5cbmZ1bmN0aW9uIF9pbnRlcm9wUmVxdWlyZURlZmF1bHQob2JqKSB7IHJldHVybiBvYmogJiYgb2JqLl9fZXNNb2R1bGUgPyBvYmogOiB7IGRlZmF1bHQ6IG9iaiB9OyB9XG5cbmZ1bmN0aW9uIF9jbGFzc0NhbGxDaGVjayhpbnN0YW5jZSwgQ29uc3RydWN0b3IpIHsgaWYgKCEoaW5zdGFuY2UgaW5zdGFuY2VvZiBDb25zdHJ1Y3RvcikpIHsgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCBjYWxsIGEgY2xhc3MgYXMgYSBmdW5jdGlvblwiKTsgfSB9XG5cbnZhciBfd2luZG93ID0gd2luZG93O1xudmFyIGxvY2FsU3RvcmFnZSA9IF93aW5kb3cubG9jYWxTdG9yYWdlO1xudmFyIGJ0b2EgPSBfd2luZG93LmJ0b2E7XG5cbnZhciBkZWZhdWx0T3B0aW9ucyA9IHtcbiAgZW5kcG9pbnQ6IFwiXCIsXG4gIGZpbmdlcnByaW50OiBfZmluZ2VycHJpbnQyLmRlZmF1bHQsXG4gIHJlc3VtZTogdHJ1ZSxcbiAgb25Qcm9ncmVzczogbnVsbCxcbiAgb25DaHVua0NvbXBsZXRlOiBudWxsLFxuICBvblN1Y2Nlc3M6IG51bGwsXG4gIG9uRXJyb3I6IG51bGwsXG4gIGhlYWRlcnM6IHt9LFxuICBjaHVua1NpemU6IEluZmluaXR5LFxuICB3aXRoQ3JlZGVudGlhbHM6IGZhbHNlXG59O1xuXG52YXIgVXBsb2FkID0gKGZ1bmN0aW9uICgpIHtcbiAgZnVuY3Rpb24gVXBsb2FkKGZpbGUsIG9wdGlvbnMpIHtcbiAgICBfY2xhc3NDYWxsQ2hlY2sodGhpcywgVXBsb2FkKTtcblxuICAgIHRoaXMub3B0aW9ucyA9ICgwLCBfZXh0ZW5kMi5kZWZhdWx0KSh0cnVlLCB7fSwgZGVmYXVsdE9wdGlvbnMsIG9wdGlvbnMpO1xuXG4gICAgLy8gVGhlIHVuZGVybHlpbmcgRmlsZS9CbG9iIG9iamVjdFxuICAgIHRoaXMuZmlsZSA9IGZpbGU7XG5cbiAgICAvLyBUaGUgVVJMIGFnYWluc3Qgd2hpY2ggdGhlIGZpbGUgd2lsbCBiZSB1cGxvYWRlZFxuICAgIHRoaXMudXJsID0gbnVsbDtcblxuICAgIC8vIFRoZSB1bmRlcmx5aW5nIFhIUiBvYmplY3QgZm9yIHRoZSBjdXJyZW50IFBBVENIIHJlcXVlc3RcbiAgICB0aGlzLl94aHIgPSBudWxsO1xuXG4gICAgLy8gVGhlIGZpbmdlcnBpbnJ0IGZvciB0aGUgY3VycmVudCBmaWxlIChzZXQgYWZ0ZXIgc3RhcnQoKSlcbiAgICB0aGlzLl9maW5nZXJwcmludCA9IG51bGw7XG5cbiAgICAvLyBUaGUgb2Zmc2V0IHVzZWQgaW4gdGhlIGN1cnJlbnQgUEFUQ0ggcmVxdWVzdFxuICAgIHRoaXMuX29mZnNldCA9IG51bGw7XG5cbiAgICAvLyBUcnVlIGlmIHRoZSBjdXJyZW50IFBBVENIIHJlcXVlc3QgaGFzIGJlZW4gYWJvcnRlZFxuICAgIHRoaXMuX2Fib3J0ZWQgPSBmYWxzZTtcbiAgfVxuXG4gIF9jcmVhdGVDbGFzcyhVcGxvYWQsIFt7XG4gICAga2V5OiBcInN0YXJ0XCIsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIHN0YXJ0KCkge1xuICAgICAgdmFyIGZpbGUgPSB0aGlzLmZpbGU7XG5cbiAgICAgIGlmICghZmlsZSkge1xuICAgICAgICB0aGlzLl9lbWl0RXJyb3IobmV3IEVycm9yKFwidHVzOiBubyBmaWxlIHRvIHVwbG9hZCBwcm92aWRlZFwiKSk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgaWYgKCF0aGlzLm9wdGlvbnMuZW5kcG9pbnQpIHtcbiAgICAgICAgdGhpcy5fZW1pdEVycm9yKG5ldyBFcnJvcihcInR1czogbm8gZW5kcG9pbnQgcHJvdmlkZWRcIikpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIC8vIEEgVVJMIGhhcyBtYW51YWxseSBiZWVuIHNwZWNpZmllZCwgc28gd2UgdHJ5IHRvIHJlc3VtZVxuICAgICAgaWYgKHRoaXMudXJsICE9PSBudWxsKSB7XG4gICAgICAgIHRoaXMuX3Jlc3VtZVVwbG9hZCgpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIC8vIFRyeSB0byBmaW5kIHRoZSBlbmRwb2ludCBmb3IgdGhlIGZpbGUgaW4gdGhlIGxvY2FsU3RvcmFnZVxuICAgICAgaWYgKHRoaXMub3B0aW9ucy5yZXN1bWUpIHtcbiAgICAgICAgdGhpcy5fZmluZ2VycHJpbnQgPSB0aGlzLm9wdGlvbnMuZmluZ2VycHJpbnQoZmlsZSk7XG4gICAgICAgIHZhciByZXN1bWVkVXJsID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0odGhpcy5fZmluZ2VycHJpbnQpO1xuXG4gICAgICAgIGlmIChyZXN1bWVkVXJsICE9IG51bGwpIHtcbiAgICAgICAgICB0aGlzLnVybCA9IHJlc3VtZWRVcmw7XG4gICAgICAgICAgdGhpcy5fcmVzdW1lVXBsb2FkKCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIEFuIHVwbG9hZCBoYXMgbm90IHN0YXJ0ZWQgZm9yIHRoZSBmaWxlIHlldCwgc28gd2Ugc3RhcnQgYSBuZXcgb25lXG4gICAgICB0aGlzLl9jcmVhdGVVcGxvYWQoKTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6IFwiYWJvcnRcIixcbiAgICB2YWx1ZTogZnVuY3Rpb24gYWJvcnQoKSB7XG4gICAgICBpZiAodGhpcy5feGhyICE9PSBudWxsKSB7XG4gICAgICAgIHRoaXMuX3hoci5hYm9ydCgpO1xuICAgICAgICB0aGlzLl9hYm9ydGVkID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6IFwiX2VtaXRYaHJFcnJvclwiLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBfZW1pdFhockVycm9yKHhociwgZXJyKSB7XG4gICAgICBlcnIub3JpZ2luYWxSZXF1ZXN0ID0geGhyO1xuICAgICAgdGhpcy5fZW1pdEVycm9yKGVycik7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiBcIl9lbWl0RXJyb3JcIixcbiAgICB2YWx1ZTogZnVuY3Rpb24gX2VtaXRFcnJvcihlcnIpIHtcbiAgICAgIGlmICh0eXBlb2YgdGhpcy5vcHRpb25zLm9uRXJyb3IgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICB0aGlzLm9wdGlvbnMub25FcnJvcihlcnIpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgfVxuICAgIH1cbiAgfSwge1xuICAgIGtleTogXCJfZW1pdFN1Y2Nlc3NcIixcbiAgICB2YWx1ZTogZnVuY3Rpb24gX2VtaXRTdWNjZXNzKCkge1xuICAgICAgaWYgKHR5cGVvZiB0aGlzLm9wdGlvbnMub25TdWNjZXNzID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgdGhpcy5vcHRpb25zLm9uU3VjY2VzcygpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFB1Ymxpc2hlcyBub3RpZmljYXRpb24gd2hlbiBkYXRhIGhhcyBiZWVuIHNlbnQgdG8gdGhlIHNlcnZlci4gVGhpc1xuICAgICAqIGRhdGEgbWF5IG5vdCBoYXZlIGJlZW4gYWNjZXB0ZWQgYnkgdGhlIHNlcnZlciB5ZXQuXG4gICAgICogQHBhcmFtICB7bnVtYmVyfSBieXRlc1NlbnQgIE51bWJlciBvZiBieXRlcyBzZW50IHRvIHRoZSBzZXJ2ZXIuXG4gICAgICogQHBhcmFtICB7bnVtYmVyfSBieXRlc1RvdGFsIFRvdGFsIG51bWJlciBvZiBieXRlcyB0byBiZSBzZW50IHRvIHRoZSBzZXJ2ZXIuXG4gICAgICovXG5cbiAgfSwge1xuICAgIGtleTogXCJfZW1pdFByb2dyZXNzXCIsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIF9lbWl0UHJvZ3Jlc3MoYnl0ZXNTZW50LCBieXRlc1RvdGFsKSB7XG4gICAgICBpZiAodHlwZW9mIHRoaXMub3B0aW9ucy5vblByb2dyZXNzID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgdGhpcy5vcHRpb25zLm9uUHJvZ3Jlc3MoYnl0ZXNTZW50LCBieXRlc1RvdGFsKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBQdWJsaXNoZXMgbm90aWZpY2F0aW9uIHdoZW4gYSBjaHVuayBvZiBkYXRhIGhhcyBiZWVuIHNlbnQgdG8gdGhlIHNlcnZlclxuICAgICAqIGFuZCBhY2NlcHRlZCBieSB0aGUgc2VydmVyLlxuICAgICAqIEBwYXJhbSAge251bWJlcn0gY2h1bmtTaXplICBTaXplIG9mIHRoZSBjaHVuayB0aGF0IHdhcyBhY2NlcHRlZCBieSB0aGVcbiAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VydmVyLlxuICAgICAqIEBwYXJhbSAge251bWJlcn0gYnl0ZXNBY2NlcHRlZCBUb3RhbCBudW1iZXIgb2YgYnl0ZXMgdGhhdCBoYXZlIGJlZW5cbiAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYWNjZXB0ZWQgYnkgdGhlIHNlcnZlci5cbiAgICAgKiBAcGFyYW0gIHtudW1iZXJ9IGJ5dGVzVG90YWwgVG90YWwgbnVtYmVyIG9mIGJ5dGVzIHRvIGJlIHNlbnQgdG8gdGhlIHNlcnZlci5cbiAgICAgKi9cblxuICB9LCB7XG4gICAga2V5OiBcIl9lbWl0Q2h1bmtDb21wbGV0ZVwiLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBfZW1pdENodW5rQ29tcGxldGUoY2h1bmtTaXplLCBieXRlc0FjY2VwdGVkLCBieXRlc1RvdGFsKSB7XG4gICAgICBpZiAodHlwZW9mIHRoaXMub3B0aW9ucy5vbkNodW5rQ29tcGxldGUgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICB0aGlzLm9wdGlvbnMub25DaHVua0NvbXBsZXRlKGNodW5rU2l6ZSwgYnl0ZXNBY2NlcHRlZCwgYnl0ZXNUb3RhbCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0IHRoZSBoZWFkZXJzIHVzZWQgaW4gdGhlIHJlcXVlc3QgYW5kIHRoZSB3aXRoQ3JlZGVudGlhbHMgcHJvcGVydHlcbiAgICAgKiBhcyBkZWZpbmVkIGluIHRoZSBvcHRpb25zXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1hNTEh0dHBSZXF1ZXN0fSB4aHJcbiAgICAgKi9cblxuICB9LCB7XG4gICAga2V5OiBcIl9zZXR1cFhIUlwiLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBfc2V0dXBYSFIoeGhyKSB7XG4gICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcihcIlR1cy1SZXN1bWFibGVcIiwgXCIxLjAuMFwiKTtcbiAgICAgIHZhciBoZWFkZXJzID0gdGhpcy5vcHRpb25zLmhlYWRlcnM7XG5cbiAgICAgIGZvciAodmFyIG5hbWUgaW4gaGVhZGVycykge1xuICAgICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcihuYW1lLCBoZWFkZXJzW25hbWVdKTtcbiAgICAgIH1cblxuICAgICAgeGhyLndpdGhDcmVkZW50aWFscyA9IHRoaXMub3B0aW9ucy53aXRoQ3JlZGVudGlhbHM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IHVwbG9hZCB1c2luZyB0aGUgY3JlYXRpb24gZXh0ZW5zaW9uIGJ5IHNlbmRpbmcgYSBQT1NUXG4gICAgICogcmVxdWVzdCB0byB0aGUgZW5kcG9pbnQuIEFmdGVyIHN1Y2Nlc3NmdWwgY3JlYXRpb24gdGhlIGZpbGUgd2lsbCBiZVxuICAgICAqIHVwbG9hZGVkXG4gICAgICpcbiAgICAgKiBAYXBpIHByaXZhdGVcbiAgICAgKi9cblxuICB9LCB7XG4gICAga2V5OiBcIl9jcmVhdGVVcGxvYWRcIixcbiAgICB2YWx1ZTogZnVuY3Rpb24gX2NyZWF0ZVVwbG9hZCgpIHtcbiAgICAgIHZhciBfdGhpcyA9IHRoaXM7XG5cbiAgICAgIHZhciB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICAgIHhoci5vcGVuKFwiUE9TVFwiLCB0aGlzLm9wdGlvbnMuZW5kcG9pbnQsIHRydWUpO1xuXG4gICAgICB4aHIub25sb2FkID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoISh4aHIuc3RhdHVzID49IDIwMCAmJiB4aHIuc3RhdHVzIDwgMzAwKSkge1xuICAgICAgICAgIF90aGlzLl9lbWl0WGhyRXJyb3IoeGhyLCBuZXcgRXJyb3IoXCJ0dXM6IHVuZXhwZWN0ZWQgcmVzcG9uc2Ugd2hpbGUgY3JlYXRpbmcgdXBsb2FkXCIpKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBfdGhpcy51cmwgPSB4aHIuZ2V0UmVzcG9uc2VIZWFkZXIoXCJMb2NhdGlvblwiKTtcblxuICAgICAgICBpZiAoX3RoaXMub3B0aW9ucy5yZXN1bWUpIHtcbiAgICAgICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbShfdGhpcy5fZmluZ2VycHJpbnQsIF90aGlzLnVybCk7XG4gICAgICAgIH1cblxuICAgICAgICBfdGhpcy5fb2Zmc2V0ID0gMDtcbiAgICAgICAgX3RoaXMuX3N0YXJ0VXBsb2FkKCk7XG4gICAgICB9O1xuXG4gICAgICB4aHIub25lcnJvciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgX3RoaXMuX2VtaXRYaHJFcnJvcih4aHIsIG5ldyBFcnJvcihcInR1czogZmFpbGVkIHRvIGNyZWF0ZSB1cGxvYWRcIikpO1xuICAgICAgfTtcblxuICAgICAgdGhpcy5fc2V0dXBYSFIoeGhyKTtcbiAgICAgIHhoci5zZXRSZXF1ZXN0SGVhZGVyKFwiVXBsb2FkLUxlbmd0aFwiLCB0aGlzLmZpbGUuc2l6ZSk7XG5cbiAgICAgIC8vIEFkZCBtZXRhZGF0YSBpZiB2YWx1ZXMgaGF2ZSBiZWVuIGFkZGVkXG4gICAgICB2YXIgbWV0YWRhdGEgPSBlbmNvZGVNZXRhZGF0YSh0aGlzLm9wdGlvbnMubWV0YWRhdGEpO1xuICAgICAgaWYgKG1ldGFkYXRhICE9PSBcIlwiKSB7XG4gICAgICAgIHhoci5zZXRSZXF1ZXN0SGVhZGVyKFwiVXBsb2FkLU1ldGFkYXRhXCIsIG1ldGFkYXRhKTtcbiAgICAgIH1cblxuICAgICAgeGhyLnNlbmQobnVsbCk7XG4gICAgfVxuXG4gICAgLypcbiAgICAgKiBUcnkgdG8gcmVzdW1lIGFuIGV4aXN0aW5nIHVwbG9hZC4gRmlyc3QgYSBIRUFEIHJlcXVlc3Qgd2lsbCBiZSBzZW50XG4gICAgICogdG8gcmV0cmlldmUgdGhlIG9mZnNldC4gSWYgdGhlIHJlcXVlc3QgZmFpbHMgYSBuZXcgdXBsb2FkIHdpbGwgYmVcbiAgICAgKiBjcmVhdGVkLiBJbiB0aGUgY2FzZSBvZiBhIHN1Y2Nlc3NmdWwgcmVzcG9uc2UgdGhlIGZpbGUgd2lsbCBiZSB1cGxvYWRlZC5cbiAgICAgKlxuICAgICAqIEBhcGkgcHJpdmF0ZVxuICAgICAqL1xuXG4gIH0sIHtcbiAgICBrZXk6IFwiX3Jlc3VtZVVwbG9hZFwiLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBfcmVzdW1lVXBsb2FkKCkge1xuICAgICAgdmFyIF90aGlzMiA9IHRoaXM7XG5cbiAgICAgIHZhciB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICAgIHhoci5vcGVuKFwiSEVBRFwiLCB0aGlzLnVybCwgdHJ1ZSk7XG5cbiAgICAgIHhoci5vbmxvYWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICghKHhoci5zdGF0dXMgPj0gMjAwICYmIHhoci5zdGF0dXMgPCAzMDApKSB7XG4gICAgICAgICAgaWYgKF90aGlzMi5vcHRpb25zLnJlc3VtZSkge1xuICAgICAgICAgICAgLy8gUmVtb3ZlIHN0b3JlZCBmaW5nZXJwcmludCBhbmQgY29ycmVzcG9uZGluZyBlbmRwb2ludCxcbiAgICAgICAgICAgIC8vIHNpbmNlIHRoZSBmaWxlIGNhbiBub3QgYmUgZm91bmRcbiAgICAgICAgICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKF90aGlzMi5fZmluZ2VycHJpbnQpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIFRyeSB0byBjcmVhdGUgYSBuZXcgdXBsb2FkXG4gICAgICAgICAgX3RoaXMyLnVybCA9IG51bGw7XG4gICAgICAgICAgX3RoaXMyLl9jcmVhdGVVcGxvYWQoKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgb2Zmc2V0ID0gcGFyc2VJbnQoeGhyLmdldFJlc3BvbnNlSGVhZGVyKFwiVXBsb2FkLU9mZnNldFwiKSwgMTApO1xuICAgICAgICBpZiAoaXNOYU4ob2Zmc2V0KSkge1xuICAgICAgICAgIF90aGlzMi5fZW1pdFhockVycm9yKHhociwgbmV3IEVycm9yKFwidHVzOiBpbnZhbGlkIG9yIG1pc3Npbmcgb2Zmc2V0IHZhbHVlXCIpKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBfdGhpczIuX29mZnNldCA9IG9mZnNldDtcbiAgICAgICAgX3RoaXMyLl9zdGFydFVwbG9hZCgpO1xuICAgICAgfTtcblxuICAgICAgeGhyLm9uZXJyb3IgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIF90aGlzMi5fZW1pdFhockVycm9yKHhociwgbmV3IEVycm9yKFwidHVzOiBmYWlsZWQgdG8gcmVzdW1lIHVwbG9hZFwiKSk7XG4gICAgICB9O1xuXG4gICAgICB0aGlzLl9zZXR1cFhIUih4aHIpO1xuICAgICAgeGhyLnNlbmQobnVsbCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3RhcnQgdXBsb2FkaW5nIHRoZSBmaWxlIHVzaW5nIFBBVENIIHJlcXVlc3RzLiBUaGUgZmlsZSB3aGlsZSBiZSBkaXZpZGVkXG4gICAgICogaW50byBjaHVua3MgYXMgc3BlY2lmaWVkIGluIHRoZSBjaHVua1NpemUgb3B0aW9uLiBEdXJpbmcgdGhlIHVwbG9hZFxuICAgICAqIHRoZSBvblByb2dyZXNzIGV2ZW50IGhhbmRsZXIgbWF5IGJlIGludm9rZWQgbXVsdGlwbGUgdGltZXMuXG4gICAgICpcbiAgICAgKiBAYXBpIHByaXZhdGVcbiAgICAgKi9cblxuICB9LCB7XG4gICAga2V5OiBcIl9zdGFydFVwbG9hZFwiLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBfc3RhcnRVcGxvYWQoKSB7XG4gICAgICB2YXIgX3RoaXMzID0gdGhpcztcblxuICAgICAgdmFyIHhociA9IHRoaXMuX3hociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgICAgeGhyLm9wZW4oXCJQQVRDSFwiLCB0aGlzLnVybCwgdHJ1ZSk7XG5cbiAgICAgIHhoci5vbmxvYWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICghKHhoci5zdGF0dXMgPj0gMjAwICYmIHhoci5zdGF0dXMgPCAzMDApKSB7XG4gICAgICAgICAgX3RoaXMzLl9lbWl0WGhyRXJyb3IoeGhyLCBuZXcgRXJyb3IoXCJ0dXM6IHVuZXhwZWN0ZWQgcmVzcG9uc2Ugd2hpbGUgY3JlYXRpbmcgdXBsb2FkXCIpKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgb2Zmc2V0ID0gcGFyc2VJbnQoeGhyLmdldFJlc3BvbnNlSGVhZGVyKFwiVXBsb2FkLU9mZnNldFwiKSwgMTApO1xuICAgICAgICBpZiAoaXNOYU4ob2Zmc2V0KSkge1xuICAgICAgICAgIF90aGlzMy5fZW1pdFhockVycm9yKHhociwgbmV3IEVycm9yKFwidHVzOiBpbnZhbGlkIG9yIG1pc3Npbmcgb2Zmc2V0IHZhbHVlXCIpKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBfdGhpczMuX2VtaXRDaHVua0NvbXBsZXRlKG9mZnNldCAtIF90aGlzMy5fb2Zmc2V0LCBvZmZzZXQsIF90aGlzMy5maWxlLnNpemUpO1xuXG4gICAgICAgIF90aGlzMy5fb2Zmc2V0ID0gb2Zmc2V0O1xuXG4gICAgICAgIGlmIChvZmZzZXQgPT0gX3RoaXMzLmZpbGUuc2l6ZSkge1xuICAgICAgICAgIC8vIFlheSwgZmluYWxseSBkb25lIDopXG4gICAgICAgICAgLy8gRW1pdCBhIGxhc3QgcHJvZ3Jlc3MgZXZlbnRcbiAgICAgICAgICBfdGhpczMuX2VtaXRQcm9ncmVzcyhvZmZzZXQsIG9mZnNldCk7XG4gICAgICAgICAgX3RoaXMzLl9lbWl0U3VjY2VzcygpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIF90aGlzMy5fc3RhcnRVcGxvYWQoKTtcbiAgICAgIH07XG5cbiAgICAgIHhoci5vbmVycm9yID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAvLyBEb24ndCBlbWl0IGFuIGVycm9yIGlmIHRoZSB1cGxvYWQgd2FzIGFib3J0ZWQgbWFudWFsbHlcbiAgICAgICAgaWYgKF90aGlzMy5fYWJvcnRlZCkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIF90aGlzMy5fZW1pdFhockVycm9yKHhociwgbmV3IEVycm9yKFwidHVzOiBmYWlsZWQgdG8gdXBsb2FkIGNodW5rIGF0IG9mZnNldCBcIiArIF90aGlzMy5fb2Zmc2V0KSk7XG4gICAgICB9O1xuXG4gICAgICAvLyBUZXN0IHN1cHBvcnQgZm9yIHByb2dyZXNzIGV2ZW50cyBiZWZvcmUgYXR0YWNoaW5nIGFuIGV2ZW50IGxpc3RlbmVyXG4gICAgICBpZiAoXCJ1cGxvYWRcIiBpbiB4aHIpIHtcbiAgICAgICAgeGhyLnVwbG9hZC5vbnByb2dyZXNzID0gZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgICBpZiAoIWUubGVuZ3RoQ29tcHV0YWJsZSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIF90aGlzMy5fZW1pdFByb2dyZXNzKHN0YXJ0ICsgZS5sb2FkZWQsIF90aGlzMy5maWxlLnNpemUpO1xuICAgICAgICB9O1xuICAgICAgfVxuXG4gICAgICB0aGlzLl9zZXR1cFhIUih4aHIpO1xuXG4gICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcihcIlVwbG9hZC1PZmZzZXRcIiwgdGhpcy5fb2Zmc2V0KTtcbiAgICAgIHhoci5zZXRSZXF1ZXN0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24vb2Zmc2V0K29jdGV0LXN0cmVhbVwiKTtcblxuICAgICAgdmFyIHN0YXJ0ID0gdGhpcy5fb2Zmc2V0O1xuICAgICAgdmFyIGVuZCA9IHRoaXMuX29mZnNldCArIHRoaXMub3B0aW9ucy5jaHVua1NpemU7XG5cbiAgICAgIGlmIChlbmQgPT09IEluZmluaXR5KSB7XG4gICAgICAgIGVuZCA9IHRoaXMuZmlsZS5zaXplO1xuICAgICAgfVxuXG4gICAgICB4aHIuc2VuZCh0aGlzLmZpbGUuc2xpY2Uoc3RhcnQsIGVuZCkpO1xuICAgIH1cbiAgfV0pO1xuXG4gIHJldHVybiBVcGxvYWQ7XG59KSgpO1xuXG5mdW5jdGlvbiBlbmNvZGVNZXRhZGF0YShtZXRhZGF0YSkge1xuICBpZiAoIShcImJ0b2FcIiBpbiB3aW5kb3cpKSB7XG4gICAgcmV0dXJuIFwiXCI7XG4gIH1cblxuICB2YXIgZW5jb2RlZCA9IFtdO1xuXG4gIGZvciAodmFyIGtleSBpbiBtZXRhZGF0YSkge1xuICAgIGVuY29kZWQucHVzaChrZXkgKyBcIiBcIiArIGJ0b2EodW5lc2NhcGUoZW5jb2RlVVJJQ29tcG9uZW50KG1ldGFkYXRhW2tleV0pKSkpO1xuICB9XG5cbiAgcmV0dXJuIGVuY29kZWQuam9pbihcIixcIik7XG59XG5cblVwbG9hZC5kZWZhdWx0T3B0aW9ucyA9IGRlZmF1bHRPcHRpb25zO1xuXG5leHBvcnRzLmRlZmF1bHQgPSBVcGxvYWQ7XG5cbn0se1wiLi9maW5nZXJwcmludFwiOjEsXCJleHRlbmRcIjo0fV0sNDpbZnVuY3Rpb24oX2RlcmVxXyxtb2R1bGUsZXhwb3J0cyl7XG4ndXNlIHN0cmljdCc7XG5cbnZhciBoYXNPd24gPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xudmFyIHRvU3RyID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZztcblxudmFyIGlzQXJyYXkgPSBmdW5jdGlvbiBpc0FycmF5KGFycikge1xuXHRpZiAodHlwZW9mIEFycmF5LmlzQXJyYXkgPT09ICdmdW5jdGlvbicpIHtcblx0XHRyZXR1cm4gQXJyYXkuaXNBcnJheShhcnIpO1xuXHR9XG5cblx0cmV0dXJuIHRvU3RyLmNhbGwoYXJyKSA9PT0gJ1tvYmplY3QgQXJyYXldJztcbn07XG5cbnZhciBpc1BsYWluT2JqZWN0ID0gZnVuY3Rpb24gaXNQbGFpbk9iamVjdChvYmopIHtcblx0aWYgKCFvYmogfHwgdG9TdHIuY2FsbChvYmopICE9PSAnW29iamVjdCBPYmplY3RdJykge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHZhciBoYXNPd25Db25zdHJ1Y3RvciA9IGhhc093bi5jYWxsKG9iaiwgJ2NvbnN0cnVjdG9yJyk7XG5cdHZhciBoYXNJc1Byb3RvdHlwZU9mID0gb2JqLmNvbnN0cnVjdG9yICYmIG9iai5jb25zdHJ1Y3Rvci5wcm90b3R5cGUgJiYgaGFzT3duLmNhbGwob2JqLmNvbnN0cnVjdG9yLnByb3RvdHlwZSwgJ2lzUHJvdG90eXBlT2YnKTtcblx0Ly8gTm90IG93biBjb25zdHJ1Y3RvciBwcm9wZXJ0eSBtdXN0IGJlIE9iamVjdFxuXHRpZiAob2JqLmNvbnN0cnVjdG9yICYmICFoYXNPd25Db25zdHJ1Y3RvciAmJiAhaGFzSXNQcm90b3R5cGVPZikge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdC8vIE93biBwcm9wZXJ0aWVzIGFyZSBlbnVtZXJhdGVkIGZpcnN0bHksIHNvIHRvIHNwZWVkIHVwLFxuXHQvLyBpZiBsYXN0IG9uZSBpcyBvd24sIHRoZW4gYWxsIHByb3BlcnRpZXMgYXJlIG93bi5cblx0dmFyIGtleTtcblx0Zm9yIChrZXkgaW4gb2JqKSB7LyoqL31cblxuXHRyZXR1cm4gdHlwZW9mIGtleSA9PT0gJ3VuZGVmaW5lZCcgfHwgaGFzT3duLmNhbGwob2JqLCBrZXkpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBleHRlbmQoKSB7XG5cdHZhciBvcHRpb25zLCBuYW1lLCBzcmMsIGNvcHksIGNvcHlJc0FycmF5LCBjbG9uZSxcblx0XHR0YXJnZXQgPSBhcmd1bWVudHNbMF0sXG5cdFx0aSA9IDEsXG5cdFx0bGVuZ3RoID0gYXJndW1lbnRzLmxlbmd0aCxcblx0XHRkZWVwID0gZmFsc2U7XG5cblx0Ly8gSGFuZGxlIGEgZGVlcCBjb3B5IHNpdHVhdGlvblxuXHRpZiAodHlwZW9mIHRhcmdldCA9PT0gJ2Jvb2xlYW4nKSB7XG5cdFx0ZGVlcCA9IHRhcmdldDtcblx0XHR0YXJnZXQgPSBhcmd1bWVudHNbMV0gfHwge307XG5cdFx0Ly8gc2tpcCB0aGUgYm9vbGVhbiBhbmQgdGhlIHRhcmdldFxuXHRcdGkgPSAyO1xuXHR9IGVsc2UgaWYgKCh0eXBlb2YgdGFyZ2V0ICE9PSAnb2JqZWN0JyAmJiB0eXBlb2YgdGFyZ2V0ICE9PSAnZnVuY3Rpb24nKSB8fCB0YXJnZXQgPT0gbnVsbCkge1xuXHRcdHRhcmdldCA9IHt9O1xuXHR9XG5cblx0Zm9yICg7IGkgPCBsZW5ndGg7ICsraSkge1xuXHRcdG9wdGlvbnMgPSBhcmd1bWVudHNbaV07XG5cdFx0Ly8gT25seSBkZWFsIHdpdGggbm9uLW51bGwvdW5kZWZpbmVkIHZhbHVlc1xuXHRcdGlmIChvcHRpb25zICE9IG51bGwpIHtcblx0XHRcdC8vIEV4dGVuZCB0aGUgYmFzZSBvYmplY3Rcblx0XHRcdGZvciAobmFtZSBpbiBvcHRpb25zKSB7XG5cdFx0XHRcdHNyYyA9IHRhcmdldFtuYW1lXTtcblx0XHRcdFx0Y29weSA9IG9wdGlvbnNbbmFtZV07XG5cblx0XHRcdFx0Ly8gUHJldmVudCBuZXZlci1lbmRpbmcgbG9vcFxuXHRcdFx0XHRpZiAodGFyZ2V0ICE9PSBjb3B5KSB7XG5cdFx0XHRcdFx0Ly8gUmVjdXJzZSBpZiB3ZSdyZSBtZXJnaW5nIHBsYWluIG9iamVjdHMgb3IgYXJyYXlzXG5cdFx0XHRcdFx0aWYgKGRlZXAgJiYgY29weSAmJiAoaXNQbGFpbk9iamVjdChjb3B5KSB8fCAoY29weUlzQXJyYXkgPSBpc0FycmF5KGNvcHkpKSkpIHtcblx0XHRcdFx0XHRcdGlmIChjb3B5SXNBcnJheSkge1xuXHRcdFx0XHRcdFx0XHRjb3B5SXNBcnJheSA9IGZhbHNlO1xuXHRcdFx0XHRcdFx0XHRjbG9uZSA9IHNyYyAmJiBpc0FycmF5KHNyYykgPyBzcmMgOiBbXTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdGNsb25lID0gc3JjICYmIGlzUGxhaW5PYmplY3Qoc3JjKSA/IHNyYyA6IHt9O1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHQvLyBOZXZlciBtb3ZlIG9yaWdpbmFsIG9iamVjdHMsIGNsb25lIHRoZW1cblx0XHRcdFx0XHRcdHRhcmdldFtuYW1lXSA9IGV4dGVuZChkZWVwLCBjbG9uZSwgY29weSk7XG5cblx0XHRcdFx0XHQvLyBEb24ndCBicmluZyBpbiB1bmRlZmluZWQgdmFsdWVzXG5cdFx0XHRcdFx0fSBlbHNlIGlmICh0eXBlb2YgY29weSAhPT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdFx0XHRcdHRhcmdldFtuYW1lXSA9IGNvcHk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Ly8gUmV0dXJuIHRoZSBtb2RpZmllZCBvYmplY3Rcblx0cmV0dXJuIHRhcmdldDtcbn07XG5cblxufSx7fV19LHt9LFsyXSkoMilcbn0pOyIsIihmdW5jdGlvbihzZWxmKSB7XG4gICd1c2Ugc3RyaWN0JztcblxuICBpZiAoc2VsZi5mZXRjaCkge1xuICAgIHJldHVyblxuICB9XG5cbiAgdmFyIHN1cHBvcnQgPSB7XG4gICAgc2VhcmNoUGFyYW1zOiAnVVJMU2VhcmNoUGFyYW1zJyBpbiBzZWxmLFxuICAgIGl0ZXJhYmxlOiAnU3ltYm9sJyBpbiBzZWxmICYmICdpdGVyYXRvcicgaW4gU3ltYm9sLFxuICAgIGJsb2I6ICdGaWxlUmVhZGVyJyBpbiBzZWxmICYmICdCbG9iJyBpbiBzZWxmICYmIChmdW5jdGlvbigpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIG5ldyBCbG9iKClcbiAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgIH0gY2F0Y2goZSkge1xuICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgIH1cbiAgICB9KSgpLFxuICAgIGZvcm1EYXRhOiAnRm9ybURhdGEnIGluIHNlbGYsXG4gICAgYXJyYXlCdWZmZXI6ICdBcnJheUJ1ZmZlcicgaW4gc2VsZlxuICB9XG5cbiAgZnVuY3Rpb24gbm9ybWFsaXplTmFtZShuYW1lKSB7XG4gICAgaWYgKHR5cGVvZiBuYW1lICE9PSAnc3RyaW5nJykge1xuICAgICAgbmFtZSA9IFN0cmluZyhuYW1lKVxuICAgIH1cbiAgICBpZiAoL1teYS16MC05XFwtIyQlJicqKy5cXF5fYHx+XS9pLnRlc3QobmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0ludmFsaWQgY2hhcmFjdGVyIGluIGhlYWRlciBmaWVsZCBuYW1lJylcbiAgICB9XG4gICAgcmV0dXJuIG5hbWUudG9Mb3dlckNhc2UoKVxuICB9XG5cbiAgZnVuY3Rpb24gbm9ybWFsaXplVmFsdWUodmFsdWUpIHtcbiAgICBpZiAodHlwZW9mIHZhbHVlICE9PSAnc3RyaW5nJykge1xuICAgICAgdmFsdWUgPSBTdHJpbmcodmFsdWUpXG4gICAgfVxuICAgIHJldHVybiB2YWx1ZVxuICB9XG5cbiAgLy8gQnVpbGQgYSBkZXN0cnVjdGl2ZSBpdGVyYXRvciBmb3IgdGhlIHZhbHVlIGxpc3RcbiAgZnVuY3Rpb24gaXRlcmF0b3JGb3IoaXRlbXMpIHtcbiAgICB2YXIgaXRlcmF0b3IgPSB7XG4gICAgICBuZXh0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHZhbHVlID0gaXRlbXMuc2hpZnQoKVxuICAgICAgICByZXR1cm4ge2RvbmU6IHZhbHVlID09PSB1bmRlZmluZWQsIHZhbHVlOiB2YWx1ZX1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoc3VwcG9ydC5pdGVyYWJsZSkge1xuICAgICAgaXRlcmF0b3JbU3ltYm9sLml0ZXJhdG9yXSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gaXRlcmF0b3JcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gaXRlcmF0b3JcbiAgfVxuXG4gIGZ1bmN0aW9uIEhlYWRlcnMoaGVhZGVycykge1xuICAgIHRoaXMubWFwID0ge31cblxuICAgIGlmIChoZWFkZXJzIGluc3RhbmNlb2YgSGVhZGVycykge1xuICAgICAgaGVhZGVycy5mb3JFYWNoKGZ1bmN0aW9uKHZhbHVlLCBuYW1lKSB7XG4gICAgICAgIHRoaXMuYXBwZW5kKG5hbWUsIHZhbHVlKVxuICAgICAgfSwgdGhpcylcblxuICAgIH0gZWxzZSBpZiAoaGVhZGVycykge1xuICAgICAgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMoaGVhZGVycykuZm9yRWFjaChmdW5jdGlvbihuYW1lKSB7XG4gICAgICAgIHRoaXMuYXBwZW5kKG5hbWUsIGhlYWRlcnNbbmFtZV0pXG4gICAgICB9LCB0aGlzKVxuICAgIH1cbiAgfVxuXG4gIEhlYWRlcnMucHJvdG90eXBlLmFwcGVuZCA9IGZ1bmN0aW9uKG5hbWUsIHZhbHVlKSB7XG4gICAgbmFtZSA9IG5vcm1hbGl6ZU5hbWUobmFtZSlcbiAgICB2YWx1ZSA9IG5vcm1hbGl6ZVZhbHVlKHZhbHVlKVxuICAgIHZhciBsaXN0ID0gdGhpcy5tYXBbbmFtZV1cbiAgICBpZiAoIWxpc3QpIHtcbiAgICAgIGxpc3QgPSBbXVxuICAgICAgdGhpcy5tYXBbbmFtZV0gPSBsaXN0XG4gICAgfVxuICAgIGxpc3QucHVzaCh2YWx1ZSlcbiAgfVxuXG4gIEhlYWRlcnMucHJvdG90eXBlWydkZWxldGUnXSA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICBkZWxldGUgdGhpcy5tYXBbbm9ybWFsaXplTmFtZShuYW1lKV1cbiAgfVxuXG4gIEhlYWRlcnMucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICB2YXIgdmFsdWVzID0gdGhpcy5tYXBbbm9ybWFsaXplTmFtZShuYW1lKV1cbiAgICByZXR1cm4gdmFsdWVzID8gdmFsdWVzWzBdIDogbnVsbFxuICB9XG5cbiAgSGVhZGVycy5wcm90b3R5cGUuZ2V0QWxsID0gZnVuY3Rpb24obmFtZSkge1xuICAgIHJldHVybiB0aGlzLm1hcFtub3JtYWxpemVOYW1lKG5hbWUpXSB8fCBbXVxuICB9XG5cbiAgSGVhZGVycy5wcm90b3R5cGUuaGFzID0gZnVuY3Rpb24obmFtZSkge1xuICAgIHJldHVybiB0aGlzLm1hcC5oYXNPd25Qcm9wZXJ0eShub3JtYWxpemVOYW1lKG5hbWUpKVxuICB9XG5cbiAgSGVhZGVycy5wcm90b3R5cGUuc2V0ID0gZnVuY3Rpb24obmFtZSwgdmFsdWUpIHtcbiAgICB0aGlzLm1hcFtub3JtYWxpemVOYW1lKG5hbWUpXSA9IFtub3JtYWxpemVWYWx1ZSh2YWx1ZSldXG4gIH1cblxuICBIZWFkZXJzLnByb3RvdHlwZS5mb3JFYWNoID0gZnVuY3Rpb24oY2FsbGJhY2ssIHRoaXNBcmcpIHtcbiAgICBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyh0aGlzLm1hcCkuZm9yRWFjaChmdW5jdGlvbihuYW1lKSB7XG4gICAgICB0aGlzLm1hcFtuYW1lXS5mb3JFYWNoKGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIGNhbGxiYWNrLmNhbGwodGhpc0FyZywgdmFsdWUsIG5hbWUsIHRoaXMpXG4gICAgICB9LCB0aGlzKVxuICAgIH0sIHRoaXMpXG4gIH1cblxuICBIZWFkZXJzLnByb3RvdHlwZS5rZXlzID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGl0ZW1zID0gW11cbiAgICB0aGlzLmZvckVhY2goZnVuY3Rpb24odmFsdWUsIG5hbWUpIHsgaXRlbXMucHVzaChuYW1lKSB9KVxuICAgIHJldHVybiBpdGVyYXRvckZvcihpdGVtcylcbiAgfVxuXG4gIEhlYWRlcnMucHJvdG90eXBlLnZhbHVlcyA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBpdGVtcyA9IFtdXG4gICAgdGhpcy5mb3JFYWNoKGZ1bmN0aW9uKHZhbHVlKSB7IGl0ZW1zLnB1c2godmFsdWUpIH0pXG4gICAgcmV0dXJuIGl0ZXJhdG9yRm9yKGl0ZW1zKVxuICB9XG5cbiAgSGVhZGVycy5wcm90b3R5cGUuZW50cmllcyA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBpdGVtcyA9IFtdXG4gICAgdGhpcy5mb3JFYWNoKGZ1bmN0aW9uKHZhbHVlLCBuYW1lKSB7IGl0ZW1zLnB1c2goW25hbWUsIHZhbHVlXSkgfSlcbiAgICByZXR1cm4gaXRlcmF0b3JGb3IoaXRlbXMpXG4gIH1cblxuICBpZiAoc3VwcG9ydC5pdGVyYWJsZSkge1xuICAgIEhlYWRlcnMucHJvdG90eXBlW1N5bWJvbC5pdGVyYXRvcl0gPSBIZWFkZXJzLnByb3RvdHlwZS5lbnRyaWVzXG4gIH1cblxuICBmdW5jdGlvbiBjb25zdW1lZChib2R5KSB7XG4gICAgaWYgKGJvZHkuYm9keVVzZWQpIHtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChuZXcgVHlwZUVycm9yKCdBbHJlYWR5IHJlYWQnKSlcbiAgICB9XG4gICAgYm9keS5ib2R5VXNlZCA9IHRydWVcbiAgfVxuXG4gIGZ1bmN0aW9uIGZpbGVSZWFkZXJSZWFkeShyZWFkZXIpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICByZWFkZXIub25sb2FkID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJlc29sdmUocmVhZGVyLnJlc3VsdClcbiAgICAgIH1cbiAgICAgIHJlYWRlci5vbmVycm9yID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJlamVjdChyZWFkZXIuZXJyb3IpXG4gICAgICB9XG4gICAgfSlcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlYWRCbG9iQXNBcnJheUJ1ZmZlcihibG9iKSB7XG4gICAgdmFyIHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKClcbiAgICByZWFkZXIucmVhZEFzQXJyYXlCdWZmZXIoYmxvYilcbiAgICByZXR1cm4gZmlsZVJlYWRlclJlYWR5KHJlYWRlcilcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlYWRCbG9iQXNUZXh0KGJsb2IpIHtcbiAgICB2YXIgcmVhZGVyID0gbmV3IEZpbGVSZWFkZXIoKVxuICAgIHJlYWRlci5yZWFkQXNUZXh0KGJsb2IpXG4gICAgcmV0dXJuIGZpbGVSZWFkZXJSZWFkeShyZWFkZXIpXG4gIH1cblxuICBmdW5jdGlvbiBCb2R5KCkge1xuICAgIHRoaXMuYm9keVVzZWQgPSBmYWxzZVxuXG4gICAgdGhpcy5faW5pdEJvZHkgPSBmdW5jdGlvbihib2R5KSB7XG4gICAgICB0aGlzLl9ib2R5SW5pdCA9IGJvZHlcbiAgICAgIGlmICh0eXBlb2YgYm9keSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgdGhpcy5fYm9keVRleHQgPSBib2R5XG4gICAgICB9IGVsc2UgaWYgKHN1cHBvcnQuYmxvYiAmJiBCbG9iLnByb3RvdHlwZS5pc1Byb3RvdHlwZU9mKGJvZHkpKSB7XG4gICAgICAgIHRoaXMuX2JvZHlCbG9iID0gYm9keVxuICAgICAgfSBlbHNlIGlmIChzdXBwb3J0LmZvcm1EYXRhICYmIEZvcm1EYXRhLnByb3RvdHlwZS5pc1Byb3RvdHlwZU9mKGJvZHkpKSB7XG4gICAgICAgIHRoaXMuX2JvZHlGb3JtRGF0YSA9IGJvZHlcbiAgICAgIH0gZWxzZSBpZiAoc3VwcG9ydC5zZWFyY2hQYXJhbXMgJiYgVVJMU2VhcmNoUGFyYW1zLnByb3RvdHlwZS5pc1Byb3RvdHlwZU9mKGJvZHkpKSB7XG4gICAgICAgIHRoaXMuX2JvZHlUZXh0ID0gYm9keS50b1N0cmluZygpXG4gICAgICB9IGVsc2UgaWYgKCFib2R5KSB7XG4gICAgICAgIHRoaXMuX2JvZHlUZXh0ID0gJydcbiAgICAgIH0gZWxzZSBpZiAoc3VwcG9ydC5hcnJheUJ1ZmZlciAmJiBBcnJheUJ1ZmZlci5wcm90b3R5cGUuaXNQcm90b3R5cGVPZihib2R5KSkge1xuICAgICAgICAvLyBPbmx5IHN1cHBvcnQgQXJyYXlCdWZmZXJzIGZvciBQT1NUIG1ldGhvZC5cbiAgICAgICAgLy8gUmVjZWl2aW5nIEFycmF5QnVmZmVycyBoYXBwZW5zIHZpYSBCbG9icywgaW5zdGVhZC5cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcigndW5zdXBwb3J0ZWQgQm9keUluaXQgdHlwZScpXG4gICAgICB9XG5cbiAgICAgIGlmICghdGhpcy5oZWFkZXJzLmdldCgnY29udGVudC10eXBlJykpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBib2R5ID09PSAnc3RyaW5nJykge1xuICAgICAgICAgIHRoaXMuaGVhZGVycy5zZXQoJ2NvbnRlbnQtdHlwZScsICd0ZXh0L3BsYWluO2NoYXJzZXQ9VVRGLTgnKVxuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX2JvZHlCbG9iICYmIHRoaXMuX2JvZHlCbG9iLnR5cGUpIHtcbiAgICAgICAgICB0aGlzLmhlYWRlcnMuc2V0KCdjb250ZW50LXR5cGUnLCB0aGlzLl9ib2R5QmxvYi50eXBlKVxuICAgICAgICB9IGVsc2UgaWYgKHN1cHBvcnQuc2VhcmNoUGFyYW1zICYmIFVSTFNlYXJjaFBhcmFtcy5wcm90b3R5cGUuaXNQcm90b3R5cGVPZihib2R5KSkge1xuICAgICAgICAgIHRoaXMuaGVhZGVycy5zZXQoJ2NvbnRlbnQtdHlwZScsICdhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWQ7Y2hhcnNldD1VVEYtOCcpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoc3VwcG9ydC5ibG9iKSB7XG4gICAgICB0aGlzLmJsb2IgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHJlamVjdGVkID0gY29uc3VtZWQodGhpcylcbiAgICAgICAgaWYgKHJlamVjdGVkKSB7XG4gICAgICAgICAgcmV0dXJuIHJlamVjdGVkXG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fYm9keUJsb2IpIHtcbiAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHRoaXMuX2JvZHlCbG9iKVxuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX2JvZHlGb3JtRGF0YSkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignY291bGQgbm90IHJlYWQgRm9ybURhdGEgYm9keSBhcyBibG9iJylcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKG5ldyBCbG9iKFt0aGlzLl9ib2R5VGV4dF0pKVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHRoaXMuYXJyYXlCdWZmZXIgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuYmxvYigpLnRoZW4ocmVhZEJsb2JBc0FycmF5QnVmZmVyKVxuICAgICAgfVxuXG4gICAgICB0aGlzLnRleHQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHJlamVjdGVkID0gY29uc3VtZWQodGhpcylcbiAgICAgICAgaWYgKHJlamVjdGVkKSB7XG4gICAgICAgICAgcmV0dXJuIHJlamVjdGVkXG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fYm9keUJsb2IpIHtcbiAgICAgICAgICByZXR1cm4gcmVhZEJsb2JBc1RleHQodGhpcy5fYm9keUJsb2IpXG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5fYm9keUZvcm1EYXRhKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdjb3VsZCBub3QgcmVhZCBGb3JtRGF0YSBib2R5IGFzIHRleHQnKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUodGhpcy5fYm9keVRleHQpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy50ZXh0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciByZWplY3RlZCA9IGNvbnN1bWVkKHRoaXMpXG4gICAgICAgIHJldHVybiByZWplY3RlZCA/IHJlamVjdGVkIDogUHJvbWlzZS5yZXNvbHZlKHRoaXMuX2JvZHlUZXh0KVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChzdXBwb3J0LmZvcm1EYXRhKSB7XG4gICAgICB0aGlzLmZvcm1EYXRhID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnRleHQoKS50aGVuKGRlY29kZSlcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLmpzb24gPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzLnRleHQoKS50aGVuKEpTT04ucGFyc2UpXG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIC8vIEhUVFAgbWV0aG9kcyB3aG9zZSBjYXBpdGFsaXphdGlvbiBzaG91bGQgYmUgbm9ybWFsaXplZFxuICB2YXIgbWV0aG9kcyA9IFsnREVMRVRFJywgJ0dFVCcsICdIRUFEJywgJ09QVElPTlMnLCAnUE9TVCcsICdQVVQnXVxuXG4gIGZ1bmN0aW9uIG5vcm1hbGl6ZU1ldGhvZChtZXRob2QpIHtcbiAgICB2YXIgdXBjYXNlZCA9IG1ldGhvZC50b1VwcGVyQ2FzZSgpXG4gICAgcmV0dXJuIChtZXRob2RzLmluZGV4T2YodXBjYXNlZCkgPiAtMSkgPyB1cGNhc2VkIDogbWV0aG9kXG4gIH1cblxuICBmdW5jdGlvbiBSZXF1ZXN0KGlucHV0LCBvcHRpb25zKSB7XG4gICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge31cbiAgICB2YXIgYm9keSA9IG9wdGlvbnMuYm9keVxuICAgIGlmIChSZXF1ZXN0LnByb3RvdHlwZS5pc1Byb3RvdHlwZU9mKGlucHV0KSkge1xuICAgICAgaWYgKGlucHV0LmJvZHlVc2VkKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FscmVhZHkgcmVhZCcpXG4gICAgICB9XG4gICAgICB0aGlzLnVybCA9IGlucHV0LnVybFxuICAgICAgdGhpcy5jcmVkZW50aWFscyA9IGlucHV0LmNyZWRlbnRpYWxzXG4gICAgICBpZiAoIW9wdGlvbnMuaGVhZGVycykge1xuICAgICAgICB0aGlzLmhlYWRlcnMgPSBuZXcgSGVhZGVycyhpbnB1dC5oZWFkZXJzKVxuICAgICAgfVxuICAgICAgdGhpcy5tZXRob2QgPSBpbnB1dC5tZXRob2RcbiAgICAgIHRoaXMubW9kZSA9IGlucHV0Lm1vZGVcbiAgICAgIGlmICghYm9keSkge1xuICAgICAgICBib2R5ID0gaW5wdXQuX2JvZHlJbml0XG4gICAgICAgIGlucHV0LmJvZHlVc2VkID0gdHJ1ZVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnVybCA9IGlucHV0XG4gICAgfVxuXG4gICAgdGhpcy5jcmVkZW50aWFscyA9IG9wdGlvbnMuY3JlZGVudGlhbHMgfHwgdGhpcy5jcmVkZW50aWFscyB8fCAnb21pdCdcbiAgICBpZiAob3B0aW9ucy5oZWFkZXJzIHx8ICF0aGlzLmhlYWRlcnMpIHtcbiAgICAgIHRoaXMuaGVhZGVycyA9IG5ldyBIZWFkZXJzKG9wdGlvbnMuaGVhZGVycylcbiAgICB9XG4gICAgdGhpcy5tZXRob2QgPSBub3JtYWxpemVNZXRob2Qob3B0aW9ucy5tZXRob2QgfHwgdGhpcy5tZXRob2QgfHwgJ0dFVCcpXG4gICAgdGhpcy5tb2RlID0gb3B0aW9ucy5tb2RlIHx8IHRoaXMubW9kZSB8fCBudWxsXG4gICAgdGhpcy5yZWZlcnJlciA9IG51bGxcblxuICAgIGlmICgodGhpcy5tZXRob2QgPT09ICdHRVQnIHx8IHRoaXMubWV0aG9kID09PSAnSEVBRCcpICYmIGJvZHkpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0JvZHkgbm90IGFsbG93ZWQgZm9yIEdFVCBvciBIRUFEIHJlcXVlc3RzJylcbiAgICB9XG4gICAgdGhpcy5faW5pdEJvZHkoYm9keSlcbiAgfVxuXG4gIFJlcXVlc3QucHJvdG90eXBlLmNsb25lID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIG5ldyBSZXF1ZXN0KHRoaXMpXG4gIH1cblxuICBmdW5jdGlvbiBkZWNvZGUoYm9keSkge1xuICAgIHZhciBmb3JtID0gbmV3IEZvcm1EYXRhKClcbiAgICBib2R5LnRyaW0oKS5zcGxpdCgnJicpLmZvckVhY2goZnVuY3Rpb24oYnl0ZXMpIHtcbiAgICAgIGlmIChieXRlcykge1xuICAgICAgICB2YXIgc3BsaXQgPSBieXRlcy5zcGxpdCgnPScpXG4gICAgICAgIHZhciBuYW1lID0gc3BsaXQuc2hpZnQoKS5yZXBsYWNlKC9cXCsvZywgJyAnKVxuICAgICAgICB2YXIgdmFsdWUgPSBzcGxpdC5qb2luKCc9JykucmVwbGFjZSgvXFwrL2csICcgJylcbiAgICAgICAgZm9ybS5hcHBlbmQoZGVjb2RlVVJJQ29tcG9uZW50KG5hbWUpLCBkZWNvZGVVUklDb21wb25lbnQodmFsdWUpKVxuICAgICAgfVxuICAgIH0pXG4gICAgcmV0dXJuIGZvcm1cbiAgfVxuXG4gIGZ1bmN0aW9uIGhlYWRlcnMoeGhyKSB7XG4gICAgdmFyIGhlYWQgPSBuZXcgSGVhZGVycygpXG4gICAgdmFyIHBhaXJzID0gKHhoci5nZXRBbGxSZXNwb25zZUhlYWRlcnMoKSB8fCAnJykudHJpbSgpLnNwbGl0KCdcXG4nKVxuICAgIHBhaXJzLmZvckVhY2goZnVuY3Rpb24oaGVhZGVyKSB7XG4gICAgICB2YXIgc3BsaXQgPSBoZWFkZXIudHJpbSgpLnNwbGl0KCc6JylcbiAgICAgIHZhciBrZXkgPSBzcGxpdC5zaGlmdCgpLnRyaW0oKVxuICAgICAgdmFyIHZhbHVlID0gc3BsaXQuam9pbignOicpLnRyaW0oKVxuICAgICAgaGVhZC5hcHBlbmQoa2V5LCB2YWx1ZSlcbiAgICB9KVxuICAgIHJldHVybiBoZWFkXG4gIH1cblxuICBCb2R5LmNhbGwoUmVxdWVzdC5wcm90b3R5cGUpXG5cbiAgZnVuY3Rpb24gUmVzcG9uc2UoYm9keUluaXQsIG9wdGlvbnMpIHtcbiAgICBpZiAoIW9wdGlvbnMpIHtcbiAgICAgIG9wdGlvbnMgPSB7fVxuICAgIH1cblxuICAgIHRoaXMudHlwZSA9ICdkZWZhdWx0J1xuICAgIHRoaXMuc3RhdHVzID0gb3B0aW9ucy5zdGF0dXNcbiAgICB0aGlzLm9rID0gdGhpcy5zdGF0dXMgPj0gMjAwICYmIHRoaXMuc3RhdHVzIDwgMzAwXG4gICAgdGhpcy5zdGF0dXNUZXh0ID0gb3B0aW9ucy5zdGF0dXNUZXh0XG4gICAgdGhpcy5oZWFkZXJzID0gb3B0aW9ucy5oZWFkZXJzIGluc3RhbmNlb2YgSGVhZGVycyA/IG9wdGlvbnMuaGVhZGVycyA6IG5ldyBIZWFkZXJzKG9wdGlvbnMuaGVhZGVycylcbiAgICB0aGlzLnVybCA9IG9wdGlvbnMudXJsIHx8ICcnXG4gICAgdGhpcy5faW5pdEJvZHkoYm9keUluaXQpXG4gIH1cblxuICBCb2R5LmNhbGwoUmVzcG9uc2UucHJvdG90eXBlKVxuXG4gIFJlc3BvbnNlLnByb3RvdHlwZS5jbG9uZSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBuZXcgUmVzcG9uc2UodGhpcy5fYm9keUluaXQsIHtcbiAgICAgIHN0YXR1czogdGhpcy5zdGF0dXMsXG4gICAgICBzdGF0dXNUZXh0OiB0aGlzLnN0YXR1c1RleHQsXG4gICAgICBoZWFkZXJzOiBuZXcgSGVhZGVycyh0aGlzLmhlYWRlcnMpLFxuICAgICAgdXJsOiB0aGlzLnVybFxuICAgIH0pXG4gIH1cblxuICBSZXNwb25zZS5lcnJvciA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciByZXNwb25zZSA9IG5ldyBSZXNwb25zZShudWxsLCB7c3RhdHVzOiAwLCBzdGF0dXNUZXh0OiAnJ30pXG4gICAgcmVzcG9uc2UudHlwZSA9ICdlcnJvcidcbiAgICByZXR1cm4gcmVzcG9uc2VcbiAgfVxuXG4gIHZhciByZWRpcmVjdFN0YXR1c2VzID0gWzMwMSwgMzAyLCAzMDMsIDMwNywgMzA4XVxuXG4gIFJlc3BvbnNlLnJlZGlyZWN0ID0gZnVuY3Rpb24odXJsLCBzdGF0dXMpIHtcbiAgICBpZiAocmVkaXJlY3RTdGF0dXNlcy5pbmRleE9mKHN0YXR1cykgPT09IC0xKSB7XG4gICAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignSW52YWxpZCBzdGF0dXMgY29kZScpXG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBSZXNwb25zZShudWxsLCB7c3RhdHVzOiBzdGF0dXMsIGhlYWRlcnM6IHtsb2NhdGlvbjogdXJsfX0pXG4gIH1cblxuICBzZWxmLkhlYWRlcnMgPSBIZWFkZXJzXG4gIHNlbGYuUmVxdWVzdCA9IFJlcXVlc3RcbiAgc2VsZi5SZXNwb25zZSA9IFJlc3BvbnNlXG5cbiAgc2VsZi5mZXRjaCA9IGZ1bmN0aW9uKGlucHV0LCBpbml0KSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgdmFyIHJlcXVlc3RcbiAgICAgIGlmIChSZXF1ZXN0LnByb3RvdHlwZS5pc1Byb3RvdHlwZU9mKGlucHV0KSAmJiAhaW5pdCkge1xuICAgICAgICByZXF1ZXN0ID0gaW5wdXRcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlcXVlc3QgPSBuZXcgUmVxdWVzdChpbnB1dCwgaW5pdClcbiAgICAgIH1cblxuICAgICAgdmFyIHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpXG5cbiAgICAgIGZ1bmN0aW9uIHJlc3BvbnNlVVJMKCkge1xuICAgICAgICBpZiAoJ3Jlc3BvbnNlVVJMJyBpbiB4aHIpIHtcbiAgICAgICAgICByZXR1cm4geGhyLnJlc3BvbnNlVVJMXG4gICAgICAgIH1cblxuICAgICAgICAvLyBBdm9pZCBzZWN1cml0eSB3YXJuaW5ncyBvbiBnZXRSZXNwb25zZUhlYWRlciB3aGVuIG5vdCBhbGxvd2VkIGJ5IENPUlNcbiAgICAgICAgaWYgKC9eWC1SZXF1ZXN0LVVSTDovbS50ZXN0KHhoci5nZXRBbGxSZXNwb25zZUhlYWRlcnMoKSkpIHtcbiAgICAgICAgICByZXR1cm4geGhyLmdldFJlc3BvbnNlSGVhZGVyKCdYLVJlcXVlc3QtVVJMJylcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVyblxuICAgICAgfVxuXG4gICAgICB4aHIub25sb2FkID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBvcHRpb25zID0ge1xuICAgICAgICAgIHN0YXR1czogeGhyLnN0YXR1cyxcbiAgICAgICAgICBzdGF0dXNUZXh0OiB4aHIuc3RhdHVzVGV4dCxcbiAgICAgICAgICBoZWFkZXJzOiBoZWFkZXJzKHhociksXG4gICAgICAgICAgdXJsOiByZXNwb25zZVVSTCgpXG4gICAgICAgIH1cbiAgICAgICAgdmFyIGJvZHkgPSAncmVzcG9uc2UnIGluIHhociA/IHhoci5yZXNwb25zZSA6IHhoci5yZXNwb25zZVRleHRcbiAgICAgICAgcmVzb2x2ZShuZXcgUmVzcG9uc2UoYm9keSwgb3B0aW9ucykpXG4gICAgICB9XG5cbiAgICAgIHhoci5vbmVycm9yID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJlamVjdChuZXcgVHlwZUVycm9yKCdOZXR3b3JrIHJlcXVlc3QgZmFpbGVkJykpXG4gICAgICB9XG5cbiAgICAgIHhoci5vbnRpbWVvdXQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmVqZWN0KG5ldyBUeXBlRXJyb3IoJ05ldHdvcmsgcmVxdWVzdCBmYWlsZWQnKSlcbiAgICAgIH1cblxuICAgICAgeGhyLm9wZW4ocmVxdWVzdC5tZXRob2QsIHJlcXVlc3QudXJsLCB0cnVlKVxuXG4gICAgICBpZiAocmVxdWVzdC5jcmVkZW50aWFscyA9PT0gJ2luY2x1ZGUnKSB7XG4gICAgICAgIHhoci53aXRoQ3JlZGVudGlhbHMgPSB0cnVlXG4gICAgICB9XG5cbiAgICAgIGlmICgncmVzcG9uc2VUeXBlJyBpbiB4aHIgJiYgc3VwcG9ydC5ibG9iKSB7XG4gICAgICAgIHhoci5yZXNwb25zZVR5cGUgPSAnYmxvYidcbiAgICAgIH1cblxuICAgICAgcmVxdWVzdC5oZWFkZXJzLmZvckVhY2goZnVuY3Rpb24odmFsdWUsIG5hbWUpIHtcbiAgICAgICAgeGhyLnNldFJlcXVlc3RIZWFkZXIobmFtZSwgdmFsdWUpXG4gICAgICB9KVxuXG4gICAgICB4aHIuc2VuZCh0eXBlb2YgcmVxdWVzdC5fYm9keUluaXQgPT09ICd1bmRlZmluZWQnID8gbnVsbCA6IHJlcXVlc3QuX2JvZHlJbml0KVxuICAgIH0pXG4gIH1cbiAgc2VsZi5mZXRjaC5wb2x5ZmlsbCA9IHRydWVcbn0pKHR5cGVvZiBzZWxmICE9PSAndW5kZWZpbmVkJyA/IHNlbGYgOiB0aGlzKTtcbiIsInZhciBiZWwgPSByZXF1aXJlKCdiZWwnKSAvLyB0dXJucyB0ZW1wbGF0ZSB0YWcgaW50byBET00gZWxlbWVudHNcbnZhciBtb3JwaGRvbSA9IHJlcXVpcmUoJ21vcnBoZG9tJykgLy8gZWZmaWNpZW50bHkgZGlmZnMgKyBtb3JwaHMgdHdvIERPTSBlbGVtZW50c1xudmFyIGRlZmF1bHRFdmVudHMgPSByZXF1aXJlKCcuL3VwZGF0ZS1ldmVudHMuanMnKSAvLyBkZWZhdWx0IGV2ZW50cyB0byBiZSBjb3BpZWQgd2hlbiBkb20gZWxlbWVudHMgdXBkYXRlXG5cbm1vZHVsZS5leHBvcnRzID0gYmVsXG5cbi8vIFRPRE8gbW92ZSB0aGlzICsgZGVmYXVsdEV2ZW50cyB0byBhIG5ldyBtb2R1bGUgb25jZSB3ZSByZWNlaXZlIG1vcmUgZmVlZGJhY2tcbm1vZHVsZS5leHBvcnRzLnVwZGF0ZSA9IGZ1bmN0aW9uIChmcm9tTm9kZSwgdG9Ob2RlLCBvcHRzKSB7XG4gIGlmICghb3B0cykgb3B0cyA9IHt9XG4gIGlmIChvcHRzLmV2ZW50cyAhPT0gZmFsc2UpIHtcbiAgICBpZiAoIW9wdHMub25CZWZvcmVNb3JwaEVsKSBvcHRzLm9uQmVmb3JlTW9ycGhFbCA9IGNvcGllclxuICB9XG5cbiAgcmV0dXJuIG1vcnBoZG9tKGZyb21Ob2RlLCB0b05vZGUsIG9wdHMpXG5cbiAgLy8gbW9ycGhkb20gb25seSBjb3BpZXMgYXR0cmlidXRlcy4gd2UgZGVjaWRlZCB3ZSBhbHNvIHdhbnRlZCB0byBjb3B5IGV2ZW50c1xuICAvLyB0aGF0IGNhbiBiZSBzZXQgdmlhIGF0dHJpYnV0ZXNcbiAgZnVuY3Rpb24gY29waWVyIChmLCB0KSB7XG4gICAgLy8gY29weSBldmVudHM6XG4gICAgdmFyIGV2ZW50cyA9IG9wdHMuZXZlbnRzIHx8IGRlZmF1bHRFdmVudHNcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGV2ZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGV2ID0gZXZlbnRzW2ldXG4gICAgICBpZiAodFtldl0pIHsgLy8gaWYgbmV3IGVsZW1lbnQgaGFzIGEgd2hpdGVsaXN0ZWQgYXR0cmlidXRlXG4gICAgICAgIGZbZXZdID0gdFtldl0gLy8gdXBkYXRlIGV4aXN0aW5nIGVsZW1lbnRcbiAgICAgIH0gZWxzZSBpZiAoZltldl0pIHsgLy8gaWYgZXhpc3RpbmcgZWxlbWVudCBoYXMgaXQgYW5kIG5ldyBvbmUgZG9lc250XG4gICAgICAgIGZbZXZdID0gdW5kZWZpbmVkIC8vIHJlbW92ZSBpdCBmcm9tIGV4aXN0aW5nIGVsZW1lbnRcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gY29weSB2YWx1ZXMgZm9yIGZvcm0gZWxlbWVudHNcbiAgICBpZiAoZi5ub2RlTmFtZSA9PT0gJ0lOUFVUJyB8fCBmLm5vZGVOYW1lID09PSAnVEVYVEFSRUEnIHx8IGYubm9kZU5BTUUgPT09ICdTRUxFQ1QnKSB7XG4gICAgICBpZiAodC5nZXRBdHRyaWJ1dGUoJ3ZhbHVlJykgPT09IG51bGwpIHQudmFsdWUgPSBmLnZhbHVlXG4gICAgfVxuICB9XG59XG4iLCJ2YXIgZG9jdW1lbnQgPSByZXF1aXJlKCdnbG9iYWwvZG9jdW1lbnQnKVxudmFyIGh5cGVyeCA9IHJlcXVpcmUoJ2h5cGVyeCcpXG5cbnZhciBTVkdOUyA9ICdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZydcbnZhciBCT09MX1BST1BTID0ge1xuICBhdXRvZm9jdXM6IDEsXG4gIGNoZWNrZWQ6IDEsXG4gIGRlZmF1bHRjaGVja2VkOiAxLFxuICBkaXNhYmxlZDogMSxcbiAgZm9ybW5vdmFsaWRhdGU6IDEsXG4gIGluZGV0ZXJtaW5hdGU6IDEsXG4gIHJlYWRvbmx5OiAxLFxuICByZXF1aXJlZDogMSxcbiAgd2lsbHZhbGlkYXRlOiAxXG59XG52YXIgU1ZHX1RBR1MgPSBbXG4gICdzdmcnLFxuICAnYWx0R2x5cGgnLCAnYWx0R2x5cGhEZWYnLCAnYWx0R2x5cGhJdGVtJywgJ2FuaW1hdGUnLCAnYW5pbWF0ZUNvbG9yJyxcbiAgJ2FuaW1hdGVNb3Rpb24nLCAnYW5pbWF0ZVRyYW5zZm9ybScsICdjaXJjbGUnLCAnY2xpcFBhdGgnLCAnY29sb3ItcHJvZmlsZScsXG4gICdjdXJzb3InLCAnZGVmcycsICdkZXNjJywgJ2VsbGlwc2UnLCAnZmVCbGVuZCcsICdmZUNvbG9yTWF0cml4JyxcbiAgJ2ZlQ29tcG9uZW50VHJhbnNmZXInLCAnZmVDb21wb3NpdGUnLCAnZmVDb252b2x2ZU1hdHJpeCcsICdmZURpZmZ1c2VMaWdodGluZycsXG4gICdmZURpc3BsYWNlbWVudE1hcCcsICdmZURpc3RhbnRMaWdodCcsICdmZUZsb29kJywgJ2ZlRnVuY0EnLCAnZmVGdW5jQicsXG4gICdmZUZ1bmNHJywgJ2ZlRnVuY1InLCAnZmVHYXVzc2lhbkJsdXInLCAnZmVJbWFnZScsICdmZU1lcmdlJywgJ2ZlTWVyZ2VOb2RlJyxcbiAgJ2ZlTW9ycGhvbG9neScsICdmZU9mZnNldCcsICdmZVBvaW50TGlnaHQnLCAnZmVTcGVjdWxhckxpZ2h0aW5nJyxcbiAgJ2ZlU3BvdExpZ2h0JywgJ2ZlVGlsZScsICdmZVR1cmJ1bGVuY2UnLCAnZmlsdGVyJywgJ2ZvbnQnLCAnZm9udC1mYWNlJyxcbiAgJ2ZvbnQtZmFjZS1mb3JtYXQnLCAnZm9udC1mYWNlLW5hbWUnLCAnZm9udC1mYWNlLXNyYycsICdmb250LWZhY2UtdXJpJyxcbiAgJ2ZvcmVpZ25PYmplY3QnLCAnZycsICdnbHlwaCcsICdnbHlwaFJlZicsICdoa2VybicsICdpbWFnZScsICdsaW5lJyxcbiAgJ2xpbmVhckdyYWRpZW50JywgJ21hcmtlcicsICdtYXNrJywgJ21ldGFkYXRhJywgJ21pc3NpbmctZ2x5cGgnLCAnbXBhdGgnLFxuICAncGF0aCcsICdwYXR0ZXJuJywgJ3BvbHlnb24nLCAncG9seWxpbmUnLCAncmFkaWFsR3JhZGllbnQnLCAncmVjdCcsXG4gICdzZXQnLCAnc3RvcCcsICdzd2l0Y2gnLCAnc3ltYm9sJywgJ3RleHQnLCAndGV4dFBhdGgnLCAndGl0bGUnLCAndHJlZicsXG4gICd0c3BhbicsICd1c2UnLCAndmlldycsICd2a2Vybidcbl1cblxuZnVuY3Rpb24gYmVsQ3JlYXRlRWxlbWVudCAodGFnLCBwcm9wcywgY2hpbGRyZW4pIHtcbiAgdmFyIGVsXG5cbiAgLy8gSWYgYW4gc3ZnIHRhZywgaXQgbmVlZHMgYSBuYW1lc3BhY2VcbiAgaWYgKFNWR19UQUdTLmluZGV4T2YodGFnKSAhPT0gLTEpIHtcbiAgICBwcm9wcy5uYW1lc3BhY2UgPSBTVkdOU1xuICB9XG5cbiAgLy8gSWYgd2UgYXJlIHVzaW5nIGEgbmFtZXNwYWNlXG4gIHZhciBucyA9IGZhbHNlXG4gIGlmIChwcm9wcy5uYW1lc3BhY2UpIHtcbiAgICBucyA9IHByb3BzLm5hbWVzcGFjZVxuICAgIGRlbGV0ZSBwcm9wcy5uYW1lc3BhY2VcbiAgfVxuXG4gIC8vIENyZWF0ZSB0aGUgZWxlbWVudFxuICBpZiAobnMpIHtcbiAgICBlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhucywgdGFnKVxuICB9IGVsc2Uge1xuICAgIGVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCh0YWcpXG4gIH1cblxuICAvLyBDcmVhdGUgdGhlIHByb3BlcnRpZXNcbiAgZm9yICh2YXIgcCBpbiBwcm9wcykge1xuICAgIGlmIChwcm9wcy5oYXNPd25Qcm9wZXJ0eShwKSkge1xuICAgICAgdmFyIGtleSA9IHAudG9Mb3dlckNhc2UoKVxuICAgICAgdmFyIHZhbCA9IHByb3BzW3BdXG4gICAgICAvLyBOb3JtYWxpemUgY2xhc3NOYW1lXG4gICAgICBpZiAoa2V5ID09PSAnY2xhc3NuYW1lJykge1xuICAgICAgICBrZXkgPSAnY2xhc3MnXG4gICAgICAgIHAgPSAnY2xhc3MnXG4gICAgICB9XG4gICAgICAvLyBJZiBhIHByb3BlcnR5IGlzIGJvb2xlYW4sIHNldCBpdHNlbGYgdG8gdGhlIGtleVxuICAgICAgaWYgKEJPT0xfUFJPUFNba2V5XSkge1xuICAgICAgICBpZiAodmFsID09PSAndHJ1ZScpIHZhbCA9IGtleVxuICAgICAgICBlbHNlIGlmICh2YWwgPT09ICdmYWxzZScpIGNvbnRpbnVlXG4gICAgICB9XG4gICAgICAvLyBJZiBhIHByb3BlcnR5IHByZWZlcnMgYmVpbmcgc2V0IGRpcmVjdGx5IHZzIHNldEF0dHJpYnV0ZVxuICAgICAgaWYgKGtleS5zbGljZSgwLCAyKSA9PT0gJ29uJykge1xuICAgICAgICBlbFtwXSA9IHZhbFxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKG5zKSB7XG4gICAgICAgICAgZWwuc2V0QXR0cmlidXRlTlMobnVsbCwgcCwgdmFsKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGVsLnNldEF0dHJpYnV0ZShwLCB2YWwpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBhcHBlbmRDaGlsZCAoY2hpbGRzKSB7XG4gICAgaWYgKCFBcnJheS5pc0FycmF5KGNoaWxkcykpIHJldHVyblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY2hpbGRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgbm9kZSA9IGNoaWxkc1tpXVxuICAgICAgaWYgKEFycmF5LmlzQXJyYXkobm9kZSkpIHtcbiAgICAgICAgYXBwZW5kQ2hpbGQobm9kZSlcbiAgICAgICAgY29udGludWVcbiAgICAgIH1cblxuICAgICAgaWYgKHR5cGVvZiBub2RlID09PSAnbnVtYmVyJyB8fFxuICAgICAgICB0eXBlb2Ygbm9kZSA9PT0gJ2Jvb2xlYW4nIHx8XG4gICAgICAgIG5vZGUgaW5zdGFuY2VvZiBEYXRlIHx8XG4gICAgICAgIG5vZGUgaW5zdGFuY2VvZiBSZWdFeHApIHtcbiAgICAgICAgbm9kZSA9IG5vZGUudG9TdHJpbmcoKVxuICAgICAgfVxuXG4gICAgICBpZiAodHlwZW9mIG5vZGUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGlmIChlbC5sYXN0Q2hpbGQgJiYgZWwubGFzdENoaWxkLm5vZGVOYW1lID09PSAnI3RleHQnKSB7XG4gICAgICAgICAgZWwubGFzdENoaWxkLm5vZGVWYWx1ZSArPSBub2RlXG4gICAgICAgICAgY29udGludWVcbiAgICAgICAgfVxuICAgICAgICBub2RlID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUobm9kZSlcbiAgICAgIH1cblxuICAgICAgaWYgKG5vZGUgJiYgbm9kZS5ub2RlVHlwZSkge1xuICAgICAgICBlbC5hcHBlbmRDaGlsZChub2RlKVxuICAgICAgfVxuICAgIH1cbiAgfVxuICBhcHBlbmRDaGlsZChjaGlsZHJlbilcblxuICByZXR1cm4gZWxcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBoeXBlcngoYmVsQ3JlYXRlRWxlbWVudClcbm1vZHVsZS5leHBvcnRzLmNyZWF0ZUVsZW1lbnQgPSBiZWxDcmVhdGVFbGVtZW50XG4iLCJ2YXIgdG9wTGV2ZWwgPSB0eXBlb2YgZ2xvYmFsICE9PSAndW5kZWZpbmVkJyA/IGdsb2JhbCA6XG4gICAgdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgPyB3aW5kb3cgOiB7fVxudmFyIG1pbkRvYyA9IHJlcXVpcmUoJ21pbi1kb2N1bWVudCcpO1xuXG5pZiAodHlwZW9mIGRvY3VtZW50ICE9PSAndW5kZWZpbmVkJykge1xuICAgIG1vZHVsZS5leHBvcnRzID0gZG9jdW1lbnQ7XG59IGVsc2Uge1xuICAgIHZhciBkb2NjeSA9IHRvcExldmVsWydfX0dMT0JBTF9ET0NVTUVOVF9DQUNIRUA0J107XG5cbiAgICBpZiAoIWRvY2N5KSB7XG4gICAgICAgIGRvY2N5ID0gdG9wTGV2ZWxbJ19fR0xPQkFMX0RPQ1VNRU5UX0NBQ0hFQDQnXSA9IG1pbkRvYztcbiAgICB9XG5cbiAgICBtb2R1bGUuZXhwb3J0cyA9IGRvY2N5O1xufVxuIiwidmFyIGF0dHJUb1Byb3AgPSByZXF1aXJlKCdoeXBlcnNjcmlwdC1hdHRyaWJ1dGUtdG8tcHJvcGVydHknKVxuXG52YXIgVkFSID0gMCwgVEVYVCA9IDEsIE9QRU4gPSAyLCBDTE9TRSA9IDMsIEFUVFIgPSA0XG52YXIgQVRUUl9LRVkgPSA1LCBBVFRSX0tFWV9XID0gNlxudmFyIEFUVFJfVkFMVUVfVyA9IDcsIEFUVFJfVkFMVUUgPSA4XG52YXIgQVRUUl9WQUxVRV9TUSA9IDksIEFUVFJfVkFMVUVfRFEgPSAxMFxudmFyIEFUVFJfRVEgPSAxMSwgQVRUUl9CUkVBSyA9IDEyXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGgsIG9wdHMpIHtcbiAgaCA9IGF0dHJUb1Byb3AoaClcbiAgaWYgKCFvcHRzKSBvcHRzID0ge31cbiAgdmFyIGNvbmNhdCA9IG9wdHMuY29uY2F0IHx8IGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgcmV0dXJuIFN0cmluZyhhKSArIFN0cmluZyhiKVxuICB9XG5cbiAgcmV0dXJuIGZ1bmN0aW9uIChzdHJpbmdzKSB7XG4gICAgdmFyIHN0YXRlID0gVEVYVCwgcmVnID0gJydcbiAgICB2YXIgYXJnbGVuID0gYXJndW1lbnRzLmxlbmd0aFxuICAgIHZhciBwYXJ0cyA9IFtdXG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHN0cmluZ3MubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChpIDwgYXJnbGVuIC0gMSkge1xuICAgICAgICB2YXIgYXJnID0gYXJndW1lbnRzW2krMV1cbiAgICAgICAgdmFyIHAgPSBwYXJzZShzdHJpbmdzW2ldKVxuICAgICAgICB2YXIgeHN0YXRlID0gc3RhdGVcbiAgICAgICAgaWYgKHhzdGF0ZSA9PT0gQVRUUl9WQUxVRV9EUSkgeHN0YXRlID0gQVRUUl9WQUxVRVxuICAgICAgICBpZiAoeHN0YXRlID09PSBBVFRSX1ZBTFVFX1NRKSB4c3RhdGUgPSBBVFRSX1ZBTFVFXG4gICAgICAgIGlmICh4c3RhdGUgPT09IEFUVFJfVkFMVUVfVykgeHN0YXRlID0gQVRUUl9WQUxVRVxuICAgICAgICBpZiAoeHN0YXRlID09PSBBVFRSKSB4c3RhdGUgPSBBVFRSX0tFWVxuICAgICAgICBwLnB1c2goWyBWQVIsIHhzdGF0ZSwgYXJnIF0pXG4gICAgICAgIHBhcnRzLnB1c2guYXBwbHkocGFydHMsIHApXG4gICAgICB9IGVsc2UgcGFydHMucHVzaC5hcHBseShwYXJ0cywgcGFyc2Uoc3RyaW5nc1tpXSkpXG4gICAgfVxuXG4gICAgdmFyIHRyZWUgPSBbbnVsbCx7fSxbXV1cbiAgICB2YXIgc3RhY2sgPSBbW3RyZWUsLTFdXVxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcGFydHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBjdXIgPSBzdGFja1tzdGFjay5sZW5ndGgtMV1bMF1cbiAgICAgIHZhciBwID0gcGFydHNbaV0sIHMgPSBwWzBdXG4gICAgICBpZiAocyA9PT0gT1BFTiAmJiAvXlxcLy8udGVzdChwWzFdKSkge1xuICAgICAgICB2YXIgaXggPSBzdGFja1tzdGFjay5sZW5ndGgtMV1bMV1cbiAgICAgICAgaWYgKHN0YWNrLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICBzdGFjay5wb3AoKVxuICAgICAgICAgIHN0YWNrW3N0YWNrLmxlbmd0aC0xXVswXVsyXVtpeF0gPSBoKFxuICAgICAgICAgICAgY3VyWzBdLCBjdXJbMV0sIGN1clsyXS5sZW5ndGggPyBjdXJbMl0gOiB1bmRlZmluZWRcbiAgICAgICAgICApXG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAocyA9PT0gT1BFTikge1xuICAgICAgICB2YXIgYyA9IFtwWzFdLHt9LFtdXVxuICAgICAgICBjdXJbMl0ucHVzaChjKVxuICAgICAgICBzdGFjay5wdXNoKFtjLGN1clsyXS5sZW5ndGgtMV0pXG4gICAgICB9IGVsc2UgaWYgKHMgPT09IEFUVFJfS0VZIHx8IChzID09PSBWQVIgJiYgcFsxXSA9PT0gQVRUUl9LRVkpKSB7XG4gICAgICAgIHZhciBrZXkgPSAnJ1xuICAgICAgICB2YXIgY29weUtleVxuICAgICAgICBmb3IgKDsgaSA8IHBhcnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgaWYgKHBhcnRzW2ldWzBdID09PSBBVFRSX0tFWSkge1xuICAgICAgICAgICAga2V5ID0gY29uY2F0KGtleSwgcGFydHNbaV1bMV0pXG4gICAgICAgICAgfSBlbHNlIGlmIChwYXJ0c1tpXVswXSA9PT0gVkFSICYmIHBhcnRzW2ldWzFdID09PSBBVFRSX0tFWSkge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBwYXJ0c1tpXVsyXSA9PT0gJ29iamVjdCcgJiYgIWtleSkge1xuICAgICAgICAgICAgICBmb3IgKGNvcHlLZXkgaW4gcGFydHNbaV1bMl0pIHtcbiAgICAgICAgICAgICAgICBpZiAocGFydHNbaV1bMl0uaGFzT3duUHJvcGVydHkoY29weUtleSkgJiYgIWN1clsxXVtjb3B5S2V5XSkge1xuICAgICAgICAgICAgICAgICAgY3VyWzFdW2NvcHlLZXldID0gcGFydHNbaV1bMl1bY29weUtleV1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGtleSA9IGNvbmNhdChrZXksIHBhcnRzW2ldWzJdKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSBicmVha1xuICAgICAgICB9XG4gICAgICAgIGlmIChwYXJ0c1tpXVswXSA9PT0gQVRUUl9FUSkgaSsrXG4gICAgICAgIHZhciBqID0gaVxuICAgICAgICBmb3IgKDsgaSA8IHBhcnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgaWYgKHBhcnRzW2ldWzBdID09PSBBVFRSX1ZBTFVFIHx8IHBhcnRzW2ldWzBdID09PSBBVFRSX0tFWSkge1xuICAgICAgICAgICAgaWYgKCFjdXJbMV1ba2V5XSkgY3VyWzFdW2tleV0gPSBzdHJmbihwYXJ0c1tpXVsxXSlcbiAgICAgICAgICAgIGVsc2UgY3VyWzFdW2tleV0gPSBjb25jYXQoY3VyWzFdW2tleV0sIHBhcnRzW2ldWzFdKVxuICAgICAgICAgIH0gZWxzZSBpZiAocGFydHNbaV1bMF0gPT09IFZBUlxuICAgICAgICAgICYmIChwYXJ0c1tpXVsxXSA9PT0gQVRUUl9WQUxVRSB8fCBwYXJ0c1tpXVsxXSA9PT0gQVRUUl9LRVkpKSB7XG4gICAgICAgICAgICBpZiAoIWN1clsxXVtrZXldKSBjdXJbMV1ba2V5XSA9IHN0cmZuKHBhcnRzW2ldWzJdKVxuICAgICAgICAgICAgZWxzZSBjdXJbMV1ba2V5XSA9IGNvbmNhdChjdXJbMV1ba2V5XSwgcGFydHNbaV1bMl0pXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmIChrZXkubGVuZ3RoICYmICFjdXJbMV1ba2V5XSAmJiBpID09PSBqXG4gICAgICAgICAgICAmJiAocGFydHNbaV1bMF0gPT09IENMT1NFIHx8IHBhcnRzW2ldWzBdID09PSBBVFRSX0JSRUFLKSkge1xuICAgICAgICAgICAgICAvLyBodHRwczovL2h0bWwuc3BlYy53aGF0d2cub3JnL211bHRpcGFnZS9pbmZyYXN0cnVjdHVyZS5odG1sI2Jvb2xlYW4tYXR0cmlidXRlc1xuICAgICAgICAgICAgICAvLyBlbXB0eSBzdHJpbmcgaXMgZmFsc3ksIG5vdCB3ZWxsIGJlaGF2ZWQgdmFsdWUgaW4gYnJvd3NlclxuICAgICAgICAgICAgICBjdXJbMV1ba2V5XSA9IGtleS50b0xvd2VyQ2FzZSgpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChzID09PSBBVFRSX0tFWSkge1xuICAgICAgICBjdXJbMV1bcFsxXV0gPSB0cnVlXG4gICAgICB9IGVsc2UgaWYgKHMgPT09IFZBUiAmJiBwWzFdID09PSBBVFRSX0tFWSkge1xuICAgICAgICBjdXJbMV1bcFsyXV0gPSB0cnVlXG4gICAgICB9IGVsc2UgaWYgKHMgPT09IENMT1NFKSB7XG4gICAgICAgIGlmIChzZWxmQ2xvc2luZyhjdXJbMF0pICYmIHN0YWNrLmxlbmd0aCkge1xuICAgICAgICAgIHZhciBpeCA9IHN0YWNrW3N0YWNrLmxlbmd0aC0xXVsxXVxuICAgICAgICAgIHN0YWNrLnBvcCgpXG4gICAgICAgICAgc3RhY2tbc3RhY2subGVuZ3RoLTFdWzBdWzJdW2l4XSA9IGgoXG4gICAgICAgICAgICBjdXJbMF0sIGN1clsxXSwgY3VyWzJdLmxlbmd0aCA/IGN1clsyXSA6IHVuZGVmaW5lZFxuICAgICAgICAgIClcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChzID09PSBWQVIgJiYgcFsxXSA9PT0gVEVYVCkge1xuICAgICAgICBpZiAocFsyXSA9PT0gdW5kZWZpbmVkIHx8IHBbMl0gPT09IG51bGwpIHBbMl0gPSAnJ1xuICAgICAgICBlbHNlIGlmICghcFsyXSkgcFsyXSA9IGNvbmNhdCgnJywgcFsyXSlcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkocFsyXVswXSkpIHtcbiAgICAgICAgICBjdXJbMl0ucHVzaC5hcHBseShjdXJbMl0sIHBbMl0pXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY3VyWzJdLnB1c2gocFsyXSlcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChzID09PSBURVhUKSB7XG4gICAgICAgIGN1clsyXS5wdXNoKHBbMV0pXG4gICAgICB9IGVsc2UgaWYgKHMgPT09IEFUVFJfRVEgfHwgcyA9PT0gQVRUUl9CUkVBSykge1xuICAgICAgICAvLyBuby1vcFxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmhhbmRsZWQ6ICcgKyBzKVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmICh0cmVlWzJdLmxlbmd0aCA+IDEgJiYgL15cXHMqJC8udGVzdCh0cmVlWzJdWzBdKSkge1xuICAgICAgdHJlZVsyXS5zaGlmdCgpXG4gICAgfVxuXG4gICAgaWYgKHRyZWVbMl0ubGVuZ3RoID4gMlxuICAgIHx8ICh0cmVlWzJdLmxlbmd0aCA9PT0gMiAmJiAvXFxTLy50ZXN0KHRyZWVbMl1bMV0pKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAnbXVsdGlwbGUgcm9vdCBlbGVtZW50cyBtdXN0IGJlIHdyYXBwZWQgaW4gYW4gZW5jbG9zaW5nIHRhZydcbiAgICAgIClcbiAgICB9XG4gICAgaWYgKEFycmF5LmlzQXJyYXkodHJlZVsyXVswXSkgJiYgdHlwZW9mIHRyZWVbMl1bMF1bMF0gPT09ICdzdHJpbmcnXG4gICAgJiYgQXJyYXkuaXNBcnJheSh0cmVlWzJdWzBdWzJdKSkge1xuICAgICAgdHJlZVsyXVswXSA9IGgodHJlZVsyXVswXVswXSwgdHJlZVsyXVswXVsxXSwgdHJlZVsyXVswXVsyXSlcbiAgICB9XG4gICAgcmV0dXJuIHRyZWVbMl1bMF1cblxuICAgIGZ1bmN0aW9uIHBhcnNlIChzdHIpIHtcbiAgICAgIHZhciByZXMgPSBbXVxuICAgICAgaWYgKHN0YXRlID09PSBBVFRSX1ZBTFVFX1cpIHN0YXRlID0gQVRUUlxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIGMgPSBzdHIuY2hhckF0KGkpXG4gICAgICAgIGlmIChzdGF0ZSA9PT0gVEVYVCAmJiBjID09PSAnPCcpIHtcbiAgICAgICAgICBpZiAocmVnLmxlbmd0aCkgcmVzLnB1c2goW1RFWFQsIHJlZ10pXG4gICAgICAgICAgcmVnID0gJydcbiAgICAgICAgICBzdGF0ZSA9IE9QRU5cbiAgICAgICAgfSBlbHNlIGlmIChjID09PSAnPicgJiYgIXF1b3Qoc3RhdGUpKSB7XG4gICAgICAgICAgaWYgKHN0YXRlID09PSBPUEVOKSB7XG4gICAgICAgICAgICByZXMucHVzaChbT1BFTixyZWddKVxuICAgICAgICAgIH0gZWxzZSBpZiAoc3RhdGUgPT09IEFUVFJfS0VZKSB7XG4gICAgICAgICAgICByZXMucHVzaChbQVRUUl9LRVkscmVnXSlcbiAgICAgICAgICB9IGVsc2UgaWYgKHN0YXRlID09PSBBVFRSX1ZBTFVFICYmIHJlZy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHJlcy5wdXNoKFtBVFRSX1ZBTFVFLHJlZ10pXG4gICAgICAgICAgfVxuICAgICAgICAgIHJlcy5wdXNoKFtDTE9TRV0pXG4gICAgICAgICAgcmVnID0gJydcbiAgICAgICAgICBzdGF0ZSA9IFRFWFRcbiAgICAgICAgfSBlbHNlIGlmIChzdGF0ZSA9PT0gVEVYVCkge1xuICAgICAgICAgIHJlZyArPSBjXG4gICAgICAgIH0gZWxzZSBpZiAoc3RhdGUgPT09IE9QRU4gJiYgL1xccy8udGVzdChjKSkge1xuICAgICAgICAgIHJlcy5wdXNoKFtPUEVOLCByZWddKVxuICAgICAgICAgIHJlZyA9ICcnXG4gICAgICAgICAgc3RhdGUgPSBBVFRSXG4gICAgICAgIH0gZWxzZSBpZiAoc3RhdGUgPT09IE9QRU4pIHtcbiAgICAgICAgICByZWcgKz0gY1xuICAgICAgICB9IGVsc2UgaWYgKHN0YXRlID09PSBBVFRSICYmIC9bXFx3LV0vLnRlc3QoYykpIHtcbiAgICAgICAgICBzdGF0ZSA9IEFUVFJfS0VZXG4gICAgICAgICAgcmVnID0gY1xuICAgICAgICB9IGVsc2UgaWYgKHN0YXRlID09PSBBVFRSICYmIC9cXHMvLnRlc3QoYykpIHtcbiAgICAgICAgICBpZiAocmVnLmxlbmd0aCkgcmVzLnB1c2goW0FUVFJfS0VZLHJlZ10pXG4gICAgICAgICAgcmVzLnB1c2goW0FUVFJfQlJFQUtdKVxuICAgICAgICB9IGVsc2UgaWYgKHN0YXRlID09PSBBVFRSX0tFWSAmJiAvXFxzLy50ZXN0KGMpKSB7XG4gICAgICAgICAgcmVzLnB1c2goW0FUVFJfS0VZLHJlZ10pXG4gICAgICAgICAgcmVnID0gJydcbiAgICAgICAgICBzdGF0ZSA9IEFUVFJfS0VZX1dcbiAgICAgICAgfSBlbHNlIGlmIChzdGF0ZSA9PT0gQVRUUl9LRVkgJiYgYyA9PT0gJz0nKSB7XG4gICAgICAgICAgcmVzLnB1c2goW0FUVFJfS0VZLHJlZ10sW0FUVFJfRVFdKVxuICAgICAgICAgIHJlZyA9ICcnXG4gICAgICAgICAgc3RhdGUgPSBBVFRSX1ZBTFVFX1dcbiAgICAgICAgfSBlbHNlIGlmIChzdGF0ZSA9PT0gQVRUUl9LRVkpIHtcbiAgICAgICAgICByZWcgKz0gY1xuICAgICAgICB9IGVsc2UgaWYgKChzdGF0ZSA9PT0gQVRUUl9LRVlfVyB8fCBzdGF0ZSA9PT0gQVRUUikgJiYgYyA9PT0gJz0nKSB7XG4gICAgICAgICAgcmVzLnB1c2goW0FUVFJfRVFdKVxuICAgICAgICAgIHN0YXRlID0gQVRUUl9WQUxVRV9XXG4gICAgICAgIH0gZWxzZSBpZiAoKHN0YXRlID09PSBBVFRSX0tFWV9XIHx8IHN0YXRlID09PSBBVFRSKSAmJiAhL1xccy8udGVzdChjKSkge1xuICAgICAgICAgIHJlcy5wdXNoKFtBVFRSX0JSRUFLXSlcbiAgICAgICAgICBpZiAoL1tcXHctXS8udGVzdChjKSkge1xuICAgICAgICAgICAgcmVnICs9IGNcbiAgICAgICAgICAgIHN0YXRlID0gQVRUUl9LRVlcbiAgICAgICAgICB9IGVsc2Ugc3RhdGUgPSBBVFRSXG4gICAgICAgIH0gZWxzZSBpZiAoc3RhdGUgPT09IEFUVFJfVkFMVUVfVyAmJiBjID09PSAnXCInKSB7XG4gICAgICAgICAgc3RhdGUgPSBBVFRSX1ZBTFVFX0RRXG4gICAgICAgIH0gZWxzZSBpZiAoc3RhdGUgPT09IEFUVFJfVkFMVUVfVyAmJiBjID09PSBcIidcIikge1xuICAgICAgICAgIHN0YXRlID0gQVRUUl9WQUxVRV9TUVxuICAgICAgICB9IGVsc2UgaWYgKHN0YXRlID09PSBBVFRSX1ZBTFVFX0RRICYmIGMgPT09ICdcIicpIHtcbiAgICAgICAgICByZXMucHVzaChbQVRUUl9WQUxVRSxyZWddLFtBVFRSX0JSRUFLXSlcbiAgICAgICAgICByZWcgPSAnJ1xuICAgICAgICAgIHN0YXRlID0gQVRUUlxuICAgICAgICB9IGVsc2UgaWYgKHN0YXRlID09PSBBVFRSX1ZBTFVFX1NRICYmIGMgPT09IFwiJ1wiKSB7XG4gICAgICAgICAgcmVzLnB1c2goW0FUVFJfVkFMVUUscmVnXSxbQVRUUl9CUkVBS10pXG4gICAgICAgICAgcmVnID0gJydcbiAgICAgICAgICBzdGF0ZSA9IEFUVFJcbiAgICAgICAgfSBlbHNlIGlmIChzdGF0ZSA9PT0gQVRUUl9WQUxVRV9XICYmICEvXFxzLy50ZXN0KGMpKSB7XG4gICAgICAgICAgc3RhdGUgPSBBVFRSX1ZBTFVFXG4gICAgICAgICAgaS0tXG4gICAgICAgIH0gZWxzZSBpZiAoc3RhdGUgPT09IEFUVFJfVkFMVUUgJiYgL1xccy8udGVzdChjKSkge1xuICAgICAgICAgIHJlcy5wdXNoKFtBVFRSX0JSRUFLXSxbQVRUUl9WQUxVRSxyZWddKVxuICAgICAgICAgIHJlZyA9ICcnXG4gICAgICAgICAgc3RhdGUgPSBBVFRSXG4gICAgICAgIH0gZWxzZSBpZiAoc3RhdGUgPT09IEFUVFJfVkFMVUUgfHwgc3RhdGUgPT09IEFUVFJfVkFMVUVfU1FcbiAgICAgICAgfHwgc3RhdGUgPT09IEFUVFJfVkFMVUVfRFEpIHtcbiAgICAgICAgICByZWcgKz0gY1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoc3RhdGUgPT09IFRFWFQgJiYgcmVnLmxlbmd0aCkge1xuICAgICAgICByZXMucHVzaChbVEVYVCxyZWddKVxuICAgICAgICByZWcgPSAnJ1xuICAgICAgfSBlbHNlIGlmIChzdGF0ZSA9PT0gQVRUUl9WQUxVRSAmJiByZWcubGVuZ3RoKSB7XG4gICAgICAgIHJlcy5wdXNoKFtBVFRSX1ZBTFVFLHJlZ10pXG4gICAgICAgIHJlZyA9ICcnXG4gICAgICB9IGVsc2UgaWYgKHN0YXRlID09PSBBVFRSX1ZBTFVFX0RRICYmIHJlZy5sZW5ndGgpIHtcbiAgICAgICAgcmVzLnB1c2goW0FUVFJfVkFMVUUscmVnXSlcbiAgICAgICAgcmVnID0gJydcbiAgICAgIH0gZWxzZSBpZiAoc3RhdGUgPT09IEFUVFJfVkFMVUVfU1EgJiYgcmVnLmxlbmd0aCkge1xuICAgICAgICByZXMucHVzaChbQVRUUl9WQUxVRSxyZWddKVxuICAgICAgICByZWcgPSAnJ1xuICAgICAgfSBlbHNlIGlmIChzdGF0ZSA9PT0gQVRUUl9LRVkpIHtcbiAgICAgICAgcmVzLnB1c2goW0FUVFJfS0VZLHJlZ10pXG4gICAgICAgIHJlZyA9ICcnXG4gICAgICB9XG4gICAgICByZXR1cm4gcmVzXG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gc3RyZm4gKHgpIHtcbiAgICBpZiAodHlwZW9mIHggPT09ICdmdW5jdGlvbicpIHJldHVybiB4XG4gICAgZWxzZSBpZiAodHlwZW9mIHggPT09ICdzdHJpbmcnKSByZXR1cm4geFxuICAgIGVsc2UgaWYgKHggJiYgdHlwZW9mIHggPT09ICdvYmplY3QnKSByZXR1cm4geFxuICAgIGVsc2UgcmV0dXJuIGNvbmNhdCgnJywgeClcbiAgfVxufVxuXG5mdW5jdGlvbiBxdW90IChzdGF0ZSkge1xuICByZXR1cm4gc3RhdGUgPT09IEFUVFJfVkFMVUVfU1EgfHwgc3RhdGUgPT09IEFUVFJfVkFMVUVfRFFcbn1cblxudmFyIGhhc093biA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHlcbmZ1bmN0aW9uIGhhcyAob2JqLCBrZXkpIHsgcmV0dXJuIGhhc093bi5jYWxsKG9iaiwga2V5KSB9XG5cbnZhciBjbG9zZVJFID0gUmVnRXhwKCdeKCcgKyBbXG4gICdhcmVhJywgJ2Jhc2UnLCAnYmFzZWZvbnQnLCAnYmdzb3VuZCcsICdicicsICdjb2wnLCAnY29tbWFuZCcsICdlbWJlZCcsXG4gICdmcmFtZScsICdocicsICdpbWcnLCAnaW5wdXQnLCAnaXNpbmRleCcsICdrZXlnZW4nLCAnbGluaycsICdtZXRhJywgJ3BhcmFtJyxcbiAgJ3NvdXJjZScsICd0cmFjaycsICd3YnInLFxuICAvLyBTVkcgVEFHU1xuICAnYW5pbWF0ZScsICdhbmltYXRlVHJhbnNmb3JtJywgJ2NpcmNsZScsICdjdXJzb3InLCAnZGVzYycsICdlbGxpcHNlJyxcbiAgJ2ZlQmxlbmQnLCAnZmVDb2xvck1hdHJpeCcsICdmZUNvbXBvbmVudFRyYW5zZmVyJywgJ2ZlQ29tcG9zaXRlJyxcbiAgJ2ZlQ29udm9sdmVNYXRyaXgnLCAnZmVEaWZmdXNlTGlnaHRpbmcnLCAnZmVEaXNwbGFjZW1lbnRNYXAnLFxuICAnZmVEaXN0YW50TGlnaHQnLCAnZmVGbG9vZCcsICdmZUZ1bmNBJywgJ2ZlRnVuY0InLCAnZmVGdW5jRycsICdmZUZ1bmNSJyxcbiAgJ2ZlR2F1c3NpYW5CbHVyJywgJ2ZlSW1hZ2UnLCAnZmVNZXJnZU5vZGUnLCAnZmVNb3JwaG9sb2d5JyxcbiAgJ2ZlT2Zmc2V0JywgJ2ZlUG9pbnRMaWdodCcsICdmZVNwZWN1bGFyTGlnaHRpbmcnLCAnZmVTcG90TGlnaHQnLCAnZmVUaWxlJyxcbiAgJ2ZlVHVyYnVsZW5jZScsICdmb250LWZhY2UtZm9ybWF0JywgJ2ZvbnQtZmFjZS1uYW1lJywgJ2ZvbnQtZmFjZS11cmknLFxuICAnZ2x5cGgnLCAnZ2x5cGhSZWYnLCAnaGtlcm4nLCAnaW1hZ2UnLCAnbGluZScsICdtaXNzaW5nLWdseXBoJywgJ21wYXRoJyxcbiAgJ3BhdGgnLCAncG9seWdvbicsICdwb2x5bGluZScsICdyZWN0JywgJ3NldCcsICdzdG9wJywgJ3RyZWYnLCAndXNlJywgJ3ZpZXcnLFxuICAndmtlcm4nXG5dLmpvaW4oJ3wnKSArICcpKD86W1xcLiNdW2EtekEtWjAtOVxcdTAwN0YtXFx1RkZGRl86LV0rKSokJylcbmZ1bmN0aW9uIHNlbGZDbG9zaW5nICh0YWcpIHsgcmV0dXJuIGNsb3NlUkUudGVzdCh0YWcpIH1cbiIsIm1vZHVsZS5leHBvcnRzID0gYXR0cmlidXRlVG9Qcm9wZXJ0eVxuXG52YXIgdHJhbnNmb3JtID0ge1xuICAnY2xhc3MnOiAnY2xhc3NOYW1lJyxcbiAgJ2Zvcic6ICdodG1sRm9yJyxcbiAgJ2h0dHAtZXF1aXYnOiAnaHR0cEVxdWl2J1xufVxuXG5mdW5jdGlvbiBhdHRyaWJ1dGVUb1Byb3BlcnR5IChoKSB7XG4gIHJldHVybiBmdW5jdGlvbiAodGFnTmFtZSwgYXR0cnMsIGNoaWxkcmVuKSB7XG4gICAgZm9yICh2YXIgYXR0ciBpbiBhdHRycykge1xuICAgICAgaWYgKGF0dHIgaW4gdHJhbnNmb3JtKSB7XG4gICAgICAgIGF0dHJzW3RyYW5zZm9ybVthdHRyXV0gPSBhdHRyc1thdHRyXVxuICAgICAgICBkZWxldGUgYXR0cnNbYXR0cl1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGgodGFnTmFtZSwgYXR0cnMsIGNoaWxkcmVuKVxuICB9XG59XG4iLCIvLyBDcmVhdGUgYSByYW5nZSBvYmplY3QgZm9yIGVmZmljZW50bHkgcmVuZGVyaW5nIHN0cmluZ3MgdG8gZWxlbWVudHMuXG52YXIgcmFuZ2U7XG5cbnZhciB0ZXN0RWwgPSAodHlwZW9mIGRvY3VtZW50ICE9PSAndW5kZWZpbmVkJykgP1xuICAgIGRvY3VtZW50LmJvZHkgfHwgZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JykgOlxuICAgIHt9O1xuXG52YXIgWEhUTUwgPSAnaHR0cDovL3d3dy53My5vcmcvMTk5OS94aHRtbCc7XG52YXIgRUxFTUVOVF9OT0RFID0gMTtcbnZhciBURVhUX05PREUgPSAzO1xuXG4vLyBGaXhlcyA8aHR0cHM6Ly9naXRodWIuY29tL3BhdHJpY2stc3RlZWxlLWlkZW0vbW9ycGhkb20vaXNzdWVzLzMyPlxuLy8gKElFNysgc3VwcG9ydCkgPD1JRTcgZG9lcyBub3Qgc3VwcG9ydCBlbC5oYXNBdHRyaWJ1dGUobmFtZSlcbnZhciBoYXNBdHRyaWJ1dGVOUztcblxuaWYgKHRlc3RFbC5oYXNBdHRyaWJ1dGVOUykge1xuICAgIGhhc0F0dHJpYnV0ZU5TID0gZnVuY3Rpb24oZWwsIG5hbWVzcGFjZVVSSSwgbmFtZSkge1xuICAgICAgICByZXR1cm4gZWwuaGFzQXR0cmlidXRlTlMobmFtZXNwYWNlVVJJLCBuYW1lKTtcbiAgICB9O1xufSBlbHNlIGlmICh0ZXN0RWwuaGFzQXR0cmlidXRlKSB7XG4gICAgaGFzQXR0cmlidXRlTlMgPSBmdW5jdGlvbihlbCwgbmFtZXNwYWNlVVJJLCBuYW1lKSB7XG4gICAgICAgIHJldHVybiBlbC5oYXNBdHRyaWJ1dGUobmFtZSk7XG4gICAgfTtcbn0gZWxzZSB7XG4gICAgaGFzQXR0cmlidXRlTlMgPSBmdW5jdGlvbihlbCwgbmFtZXNwYWNlVVJJLCBuYW1lKSB7XG4gICAgICAgIHJldHVybiAhIWVsLmdldEF0dHJpYnV0ZU5vZGUobmFtZSk7XG4gICAgfTtcbn1cblxuZnVuY3Rpb24gZW1wdHkobykge1xuICAgIGZvciAodmFyIGsgaW4gbykge1xuICAgICAgICBpZiAoby5oYXNPd25Qcm9wZXJ0eShrKSkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiB0b0VsZW1lbnQoc3RyKSB7XG4gICAgaWYgKCFyYW5nZSAmJiBkb2N1bWVudC5jcmVhdGVSYW5nZSkge1xuICAgICAgICByYW5nZSA9IGRvY3VtZW50LmNyZWF0ZVJhbmdlKCk7XG4gICAgICAgIHJhbmdlLnNlbGVjdE5vZGUoZG9jdW1lbnQuYm9keSk7XG4gICAgfVxuXG4gICAgdmFyIGZyYWdtZW50O1xuICAgIGlmIChyYW5nZSAmJiByYW5nZS5jcmVhdGVDb250ZXh0dWFsRnJhZ21lbnQpIHtcbiAgICAgICAgZnJhZ21lbnQgPSByYW5nZS5jcmVhdGVDb250ZXh0dWFsRnJhZ21lbnQoc3RyKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBmcmFnbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2JvZHknKTtcbiAgICAgICAgZnJhZ21lbnQuaW5uZXJIVE1MID0gc3RyO1xuICAgIH1cbiAgICByZXR1cm4gZnJhZ21lbnQuY2hpbGROb2Rlc1swXTtcbn1cblxudmFyIHNwZWNpYWxFbEhhbmRsZXJzID0ge1xuICAgIC8qKlxuICAgICAqIE5lZWRlZCBmb3IgSUUuIEFwcGFyZW50bHkgSUUgZG9lc24ndCB0aGluayB0aGF0IFwic2VsZWN0ZWRcIiBpcyBhblxuICAgICAqIGF0dHJpYnV0ZSB3aGVuIHJlYWRpbmcgb3ZlciB0aGUgYXR0cmlidXRlcyB1c2luZyBzZWxlY3RFbC5hdHRyaWJ1dGVzXG4gICAgICovXG4gICAgT1BUSU9OOiBmdW5jdGlvbihmcm9tRWwsIHRvRWwpIHtcbiAgICAgICAgZnJvbUVsLnNlbGVjdGVkID0gdG9FbC5zZWxlY3RlZDtcbiAgICAgICAgaWYgKGZyb21FbC5zZWxlY3RlZCkge1xuICAgICAgICAgICAgZnJvbUVsLnNldEF0dHJpYnV0ZSgnc2VsZWN0ZWQnLCAnJyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBmcm9tRWwucmVtb3ZlQXR0cmlidXRlKCdzZWxlY3RlZCcsICcnKTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgLyoqXG4gICAgICogVGhlIFwidmFsdWVcIiBhdHRyaWJ1dGUgaXMgc3BlY2lhbCBmb3IgdGhlIDxpbnB1dD4gZWxlbWVudCBzaW5jZSBpdCBzZXRzXG4gICAgICogdGhlIGluaXRpYWwgdmFsdWUuIENoYW5naW5nIHRoZSBcInZhbHVlXCIgYXR0cmlidXRlIHdpdGhvdXQgY2hhbmdpbmcgdGhlXG4gICAgICogXCJ2YWx1ZVwiIHByb3BlcnR5IHdpbGwgaGF2ZSBubyBlZmZlY3Qgc2luY2UgaXQgaXMgb25seSB1c2VkIHRvIHRoZSBzZXQgdGhlXG4gICAgICogaW5pdGlhbCB2YWx1ZS4gIFNpbWlsYXIgZm9yIHRoZSBcImNoZWNrZWRcIiBhdHRyaWJ1dGUsIGFuZCBcImRpc2FibGVkXCIuXG4gICAgICovXG4gICAgSU5QVVQ6IGZ1bmN0aW9uKGZyb21FbCwgdG9FbCkge1xuICAgICAgICBmcm9tRWwuY2hlY2tlZCA9IHRvRWwuY2hlY2tlZDtcbiAgICAgICAgaWYgKGZyb21FbC5jaGVja2VkKSB7XG4gICAgICAgICAgICBmcm9tRWwuc2V0QXR0cmlidXRlKCdjaGVja2VkJywgJycpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZnJvbUVsLnJlbW92ZUF0dHJpYnV0ZSgnY2hlY2tlZCcpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGZyb21FbC52YWx1ZSAhPT0gdG9FbC52YWx1ZSkge1xuICAgICAgICAgICAgZnJvbUVsLnZhbHVlID0gdG9FbC52YWx1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghaGFzQXR0cmlidXRlTlModG9FbCwgbnVsbCwgJ3ZhbHVlJykpIHtcbiAgICAgICAgICAgIGZyb21FbC5yZW1vdmVBdHRyaWJ1dGUoJ3ZhbHVlJyk7XG4gICAgICAgIH1cblxuICAgICAgICBmcm9tRWwuZGlzYWJsZWQgPSB0b0VsLmRpc2FibGVkO1xuICAgICAgICBpZiAoZnJvbUVsLmRpc2FibGVkKSB7XG4gICAgICAgICAgICBmcm9tRWwuc2V0QXR0cmlidXRlKCdkaXNhYmxlZCcsICcnKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGZyb21FbC5yZW1vdmVBdHRyaWJ1dGUoJ2Rpc2FibGVkJyk7XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgVEVYVEFSRUE6IGZ1bmN0aW9uKGZyb21FbCwgdG9FbCkge1xuICAgICAgICB2YXIgbmV3VmFsdWUgPSB0b0VsLnZhbHVlO1xuICAgICAgICBpZiAoZnJvbUVsLnZhbHVlICE9PSBuZXdWYWx1ZSkge1xuICAgICAgICAgICAgZnJvbUVsLnZhbHVlID0gbmV3VmFsdWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZnJvbUVsLmZpcnN0Q2hpbGQpIHtcbiAgICAgICAgICAgIGZyb21FbC5maXJzdENoaWxkLm5vZGVWYWx1ZSA9IG5ld1ZhbHVlO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuZnVuY3Rpb24gbm9vcCgpIHt9XG5cbi8qKlxuICogUmV0dXJucyB0cnVlIGlmIHR3byBub2RlJ3MgbmFtZXMgYW5kIG5hbWVzcGFjZSBVUklzIGFyZSB0aGUgc2FtZS5cbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IGFcbiAqIEBwYXJhbSB7RWxlbWVudH0gYlxuICogQHJldHVybiB7Ym9vbGVhbn1cbiAqL1xudmFyIGNvbXBhcmVOb2RlTmFtZXMgPSBmdW5jdGlvbihhLCBiKSB7XG4gICAgcmV0dXJuIGEubm9kZU5hbWUgPT09IGIubm9kZU5hbWUgJiZcbiAgICAgICAgICAgYS5uYW1lc3BhY2VVUkkgPT09IGIubmFtZXNwYWNlVVJJO1xufTtcblxuLyoqXG4gKiBDcmVhdGUgYW4gZWxlbWVudCwgb3B0aW9uYWxseSB3aXRoIGEga25vd24gbmFtZXNwYWNlIFVSSS5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gbmFtZSB0aGUgZWxlbWVudCBuYW1lLCBlLmcuICdkaXYnIG9yICdzdmcnXG4gKiBAcGFyYW0ge3N0cmluZ30gW25hbWVzcGFjZVVSSV0gdGhlIGVsZW1lbnQncyBuYW1lc3BhY2UgVVJJLCBpLmUuIHRoZSB2YWx1ZSBvZlxuICogaXRzIGB4bWxuc2AgYXR0cmlidXRlIG9yIGl0cyBpbmZlcnJlZCBuYW1lc3BhY2UuXG4gKlxuICogQHJldHVybiB7RWxlbWVudH1cbiAqL1xuZnVuY3Rpb24gY3JlYXRlRWxlbWVudE5TKG5hbWUsIG5hbWVzcGFjZVVSSSkge1xuICAgIHJldHVybiAhbmFtZXNwYWNlVVJJIHx8IG5hbWVzcGFjZVVSSSA9PT0gWEhUTUwgP1xuICAgICAgICBkb2N1bWVudC5jcmVhdGVFbGVtZW50KG5hbWUpIDpcbiAgICAgICAgZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKG5hbWVzcGFjZVVSSSwgbmFtZSk7XG59XG5cbi8qKlxuICogTG9vcCBvdmVyIGFsbCBvZiB0aGUgYXR0cmlidXRlcyBvbiB0aGUgdGFyZ2V0IG5vZGUgYW5kIG1ha2Ugc3VyZSB0aGUgb3JpZ2luYWxcbiAqIERPTSBub2RlIGhhcyB0aGUgc2FtZSBhdHRyaWJ1dGVzLiBJZiBhbiBhdHRyaWJ1dGUgZm91bmQgb24gdGhlIG9yaWdpbmFsIG5vZGVcbiAqIGlzIG5vdCBvbiB0aGUgbmV3IG5vZGUgdGhlbiByZW1vdmUgaXQgZnJvbSB0aGUgb3JpZ2luYWwgbm9kZS5cbiAqXG4gKiBAcGFyYW0gIHtFbGVtZW50fSBmcm9tTm9kZVxuICogQHBhcmFtICB7RWxlbWVudH0gdG9Ob2RlXG4gKi9cbmZ1bmN0aW9uIG1vcnBoQXR0cnMoZnJvbU5vZGUsIHRvTm9kZSkge1xuICAgIHZhciBhdHRycyA9IHRvTm9kZS5hdHRyaWJ1dGVzO1xuICAgIHZhciBpO1xuICAgIHZhciBhdHRyO1xuICAgIHZhciBhdHRyTmFtZTtcbiAgICB2YXIgYXR0ck5hbWVzcGFjZVVSSTtcbiAgICB2YXIgYXR0clZhbHVlO1xuICAgIHZhciBmcm9tVmFsdWU7XG5cbiAgICBmb3IgKGkgPSBhdHRycy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgICBhdHRyID0gYXR0cnNbaV07XG4gICAgICAgIGF0dHJOYW1lID0gYXR0ci5uYW1lO1xuICAgICAgICBhdHRyVmFsdWUgPSBhdHRyLnZhbHVlO1xuICAgICAgICBhdHRyTmFtZXNwYWNlVVJJID0gYXR0ci5uYW1lc3BhY2VVUkk7XG5cbiAgICAgICAgaWYgKGF0dHJOYW1lc3BhY2VVUkkpIHtcbiAgICAgICAgICAgIGF0dHJOYW1lID0gYXR0ci5sb2NhbE5hbWUgfHwgYXR0ck5hbWU7XG4gICAgICAgICAgICBmcm9tVmFsdWUgPSBmcm9tTm9kZS5nZXRBdHRyaWJ1dGVOUyhhdHRyTmFtZXNwYWNlVVJJLCBhdHRyTmFtZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBmcm9tVmFsdWUgPSBmcm9tTm9kZS5nZXRBdHRyaWJ1dGUoYXR0ck5hbWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGZyb21WYWx1ZSAhPT0gYXR0clZhbHVlKSB7XG4gICAgICAgICAgICBpZiAoYXR0ck5hbWVzcGFjZVVSSSkge1xuICAgICAgICAgICAgICAgIGZyb21Ob2RlLnNldEF0dHJpYnV0ZU5TKGF0dHJOYW1lc3BhY2VVUkksIGF0dHJOYW1lLCBhdHRyVmFsdWUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBmcm9tTm9kZS5zZXRBdHRyaWJ1dGUoYXR0ck5hbWUsIGF0dHJWYWx1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBSZW1vdmUgYW55IGV4dHJhIGF0dHJpYnV0ZXMgZm91bmQgb24gdGhlIG9yaWdpbmFsIERPTSBlbGVtZW50IHRoYXRcbiAgICAvLyB3ZXJlbid0IGZvdW5kIG9uIHRoZSB0YXJnZXQgZWxlbWVudC5cbiAgICBhdHRycyA9IGZyb21Ob2RlLmF0dHJpYnV0ZXM7XG5cbiAgICBmb3IgKGkgPSBhdHRycy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgICBhdHRyID0gYXR0cnNbaV07XG4gICAgICAgIGlmIChhdHRyLnNwZWNpZmllZCAhPT0gZmFsc2UpIHtcbiAgICAgICAgICAgIGF0dHJOYW1lID0gYXR0ci5uYW1lO1xuICAgICAgICAgICAgYXR0ck5hbWVzcGFjZVVSSSA9IGF0dHIubmFtZXNwYWNlVVJJO1xuXG4gICAgICAgICAgICBpZiAoIWhhc0F0dHJpYnV0ZU5TKHRvTm9kZSwgYXR0ck5hbWVzcGFjZVVSSSwgYXR0ck5hbWVzcGFjZVVSSSA/IGF0dHJOYW1lID0gYXR0ci5sb2NhbE5hbWUgfHwgYXR0ck5hbWUgOiBhdHRyTmFtZSkpIHtcbiAgICAgICAgICAgICAgICBmcm9tTm9kZS5yZW1vdmVBdHRyaWJ1dGVOb2RlKGF0dHIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuXG4vKipcbiAqIENvcGllcyB0aGUgY2hpbGRyZW4gb2Ygb25lIERPTSBlbGVtZW50IHRvIGFub3RoZXIgRE9NIGVsZW1lbnRcbiAqL1xuZnVuY3Rpb24gbW92ZUNoaWxkcmVuKGZyb21FbCwgdG9FbCkge1xuICAgIHZhciBjdXJDaGlsZCA9IGZyb21FbC5maXJzdENoaWxkO1xuICAgIHdoaWxlIChjdXJDaGlsZCkge1xuICAgICAgICB2YXIgbmV4dENoaWxkID0gY3VyQ2hpbGQubmV4dFNpYmxpbmc7XG4gICAgICAgIHRvRWwuYXBwZW5kQ2hpbGQoY3VyQ2hpbGQpO1xuICAgICAgICBjdXJDaGlsZCA9IG5leHRDaGlsZDtcbiAgICB9XG4gICAgcmV0dXJuIHRvRWw7XG59XG5cbmZ1bmN0aW9uIGRlZmF1bHRHZXROb2RlS2V5KG5vZGUpIHtcbiAgICByZXR1cm4gbm9kZS5pZDtcbn1cblxuZnVuY3Rpb24gbW9ycGhkb20oZnJvbU5vZGUsIHRvTm9kZSwgb3B0aW9ucykge1xuICAgIGlmICghb3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0ge307XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiB0b05vZGUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGlmIChmcm9tTm9kZS5ub2RlTmFtZSA9PT0gJyNkb2N1bWVudCcgfHwgZnJvbU5vZGUubm9kZU5hbWUgPT09ICdIVE1MJykge1xuICAgICAgICAgICAgdmFyIHRvTm9kZUh0bWwgPSB0b05vZGU7XG4gICAgICAgICAgICB0b05vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdodG1sJyk7XG4gICAgICAgICAgICB0b05vZGUuaW5uZXJIVE1MID0gdG9Ob2RlSHRtbDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRvTm9kZSA9IHRvRWxlbWVudCh0b05vZGUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gWFhYIG9wdGltaXphdGlvbjogaWYgdGhlIG5vZGVzIGFyZSBlcXVhbCwgZG9uJ3QgbW9ycGggdGhlbVxuICAgIC8qXG4gICAgaWYgKGZyb21Ob2RlLmlzRXF1YWxOb2RlKHRvTm9kZSkpIHtcbiAgICAgIHJldHVybiBmcm9tTm9kZTtcbiAgICB9XG4gICAgKi9cblxuICAgIHZhciBzYXZlZEVscyA9IHt9OyAvLyBVc2VkIHRvIHNhdmUgb2ZmIERPTSBlbGVtZW50cyB3aXRoIElEc1xuICAgIHZhciB1bm1hdGNoZWRFbHMgPSB7fTtcbiAgICB2YXIgZ2V0Tm9kZUtleSA9IG9wdGlvbnMuZ2V0Tm9kZUtleSB8fCBkZWZhdWx0R2V0Tm9kZUtleTtcbiAgICB2YXIgb25CZWZvcmVOb2RlQWRkZWQgPSBvcHRpb25zLm9uQmVmb3JlTm9kZUFkZGVkIHx8IG5vb3A7XG4gICAgdmFyIG9uTm9kZUFkZGVkID0gb3B0aW9ucy5vbk5vZGVBZGRlZCB8fCBub29wO1xuICAgIHZhciBvbkJlZm9yZUVsVXBkYXRlZCA9IG9wdGlvbnMub25CZWZvcmVFbFVwZGF0ZWQgfHwgb3B0aW9ucy5vbkJlZm9yZU1vcnBoRWwgfHwgbm9vcDtcbiAgICB2YXIgb25FbFVwZGF0ZWQgPSBvcHRpb25zLm9uRWxVcGRhdGVkIHx8IG5vb3A7XG4gICAgdmFyIG9uQmVmb3JlTm9kZURpc2NhcmRlZCA9IG9wdGlvbnMub25CZWZvcmVOb2RlRGlzY2FyZGVkIHx8IG5vb3A7XG4gICAgdmFyIG9uTm9kZURpc2NhcmRlZCA9IG9wdGlvbnMub25Ob2RlRGlzY2FyZGVkIHx8IG5vb3A7XG4gICAgdmFyIG9uQmVmb3JlRWxDaGlsZHJlblVwZGF0ZWQgPSBvcHRpb25zLm9uQmVmb3JlRWxDaGlsZHJlblVwZGF0ZWQgfHwgb3B0aW9ucy5vbkJlZm9yZU1vcnBoRWxDaGlsZHJlbiB8fCBub29wO1xuICAgIHZhciBjaGlsZHJlbk9ubHkgPSBvcHRpb25zLmNoaWxkcmVuT25seSA9PT0gdHJ1ZTtcbiAgICB2YXIgbW92ZWRFbHMgPSBbXTtcblxuICAgIGZ1bmN0aW9uIHJlbW92ZU5vZGVIZWxwZXIobm9kZSwgbmVzdGVkSW5TYXZlZEVsKSB7XG4gICAgICAgIHZhciBpZCA9IGdldE5vZGVLZXkobm9kZSk7XG4gICAgICAgIC8vIElmIHRoZSBub2RlIGhhcyBhbiBJRCB0aGVuIHNhdmUgaXQgb2ZmIHNpbmNlIHdlIHdpbGwgd2FudFxuICAgICAgICAvLyB0byByZXVzZSBpdCBpbiBjYXNlIHRoZSB0YXJnZXQgRE9NIHRyZWUgaGFzIGEgRE9NIGVsZW1lbnRcbiAgICAgICAgLy8gd2l0aCB0aGUgc2FtZSBJRFxuICAgICAgICBpZiAoaWQpIHtcbiAgICAgICAgICAgIHNhdmVkRWxzW2lkXSA9IG5vZGU7XG4gICAgICAgIH0gZWxzZSBpZiAoIW5lc3RlZEluU2F2ZWRFbCkge1xuICAgICAgICAgICAgLy8gSWYgd2UgYXJlIG5vdCBuZXN0ZWQgaW4gYSBzYXZlZCBlbGVtZW50IHRoZW4gd2Uga25vdyB0aGF0IHRoaXMgbm9kZSBoYXMgYmVlblxuICAgICAgICAgICAgLy8gY29tcGxldGVseSBkaXNjYXJkZWQgYW5kIHdpbGwgbm90IGV4aXN0IGluIHRoZSBmaW5hbCBET00uXG4gICAgICAgICAgICBvbk5vZGVEaXNjYXJkZWQobm9kZSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobm9kZS5ub2RlVHlwZSA9PT0gRUxFTUVOVF9OT0RFKSB7XG4gICAgICAgICAgICB2YXIgY3VyQ2hpbGQgPSBub2RlLmZpcnN0Q2hpbGQ7XG4gICAgICAgICAgICB3aGlsZSAoY3VyQ2hpbGQpIHtcbiAgICAgICAgICAgICAgICByZW1vdmVOb2RlSGVscGVyKGN1ckNoaWxkLCBuZXN0ZWRJblNhdmVkRWwgfHwgaWQpO1xuICAgICAgICAgICAgICAgIGN1ckNoaWxkID0gY3VyQ2hpbGQubmV4dFNpYmxpbmc7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiB3YWxrRGlzY2FyZGVkQ2hpbGROb2Rlcyhub2RlKSB7XG4gICAgICAgIGlmIChub2RlLm5vZGVUeXBlID09PSBFTEVNRU5UX05PREUpIHtcbiAgICAgICAgICAgIHZhciBjdXJDaGlsZCA9IG5vZGUuZmlyc3RDaGlsZDtcbiAgICAgICAgICAgIHdoaWxlIChjdXJDaGlsZCkge1xuXG5cbiAgICAgICAgICAgICAgICBpZiAoIWdldE5vZGVLZXkoY3VyQ2hpbGQpKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFdlIG9ubHkgd2FudCB0byBoYW5kbGUgbm9kZXMgdGhhdCBkb24ndCBoYXZlIGFuIElEIHRvIGF2b2lkIGRvdWJsZVxuICAgICAgICAgICAgICAgICAgICAvLyB3YWxraW5nIHRoZSBzYW1lIHNhdmVkIGVsZW1lbnQuXG5cbiAgICAgICAgICAgICAgICAgICAgb25Ob2RlRGlzY2FyZGVkKGN1ckNoaWxkKTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBXYWxrIHJlY3Vyc2l2ZWx5XG4gICAgICAgICAgICAgICAgICAgIHdhbGtEaXNjYXJkZWRDaGlsZE5vZGVzKGN1ckNoaWxkKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjdXJDaGlsZCA9IGN1ckNoaWxkLm5leHRTaWJsaW5nO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcmVtb3ZlTm9kZShub2RlLCBwYXJlbnROb2RlLCBhbHJlYWR5VmlzaXRlZCkge1xuICAgICAgICBpZiAob25CZWZvcmVOb2RlRGlzY2FyZGVkKG5vZGUpID09PSBmYWxzZSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgcGFyZW50Tm9kZS5yZW1vdmVDaGlsZChub2RlKTtcbiAgICAgICAgaWYgKGFscmVhZHlWaXNpdGVkKSB7XG4gICAgICAgICAgICBpZiAoIWdldE5vZGVLZXkobm9kZSkpIHtcbiAgICAgICAgICAgICAgICBvbk5vZGVEaXNjYXJkZWQobm9kZSk7XG4gICAgICAgICAgICAgICAgd2Fsa0Rpc2NhcmRlZENoaWxkTm9kZXMobm9kZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZW1vdmVOb2RlSGVscGVyKG5vZGUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbW9ycGhFbChmcm9tRWwsIHRvRWwsIGFscmVhZHlWaXNpdGVkLCBjaGlsZHJlbk9ubHkpIHtcbiAgICAgICAgdmFyIHRvRWxLZXkgPSBnZXROb2RlS2V5KHRvRWwpO1xuICAgICAgICBpZiAodG9FbEtleSkge1xuICAgICAgICAgICAgLy8gSWYgYW4gZWxlbWVudCB3aXRoIGFuIElEIGlzIGJlaW5nIG1vcnBoZWQgdGhlbiBpdCBpcyB3aWxsIGJlIGluIHRoZSBmaW5hbFxuICAgICAgICAgICAgLy8gRE9NIHNvIGNsZWFyIGl0IG91dCBvZiB0aGUgc2F2ZWQgZWxlbWVudHMgY29sbGVjdGlvblxuICAgICAgICAgICAgZGVsZXRlIHNhdmVkRWxzW3RvRWxLZXldO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFjaGlsZHJlbk9ubHkpIHtcbiAgICAgICAgICAgIGlmIChvbkJlZm9yZUVsVXBkYXRlZChmcm9tRWwsIHRvRWwpID09PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbW9ycGhBdHRycyhmcm9tRWwsIHRvRWwpO1xuICAgICAgICAgICAgb25FbFVwZGF0ZWQoZnJvbUVsKTtcblxuICAgICAgICAgICAgaWYgKG9uQmVmb3JlRWxDaGlsZHJlblVwZGF0ZWQoZnJvbUVsLCB0b0VsKSA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZnJvbUVsLm5vZGVOYW1lICE9PSAnVEVYVEFSRUEnKSB7XG4gICAgICAgICAgICB2YXIgY3VyVG9Ob2RlQ2hpbGQgPSB0b0VsLmZpcnN0Q2hpbGQ7XG4gICAgICAgICAgICB2YXIgY3VyRnJvbU5vZGVDaGlsZCA9IGZyb21FbC5maXJzdENoaWxkO1xuICAgICAgICAgICAgdmFyIGN1clRvTm9kZUlkO1xuXG4gICAgICAgICAgICB2YXIgZnJvbU5leHRTaWJsaW5nO1xuICAgICAgICAgICAgdmFyIHRvTmV4dFNpYmxpbmc7XG4gICAgICAgICAgICB2YXIgc2F2ZWRFbDtcbiAgICAgICAgICAgIHZhciB1bm1hdGNoZWRFbDtcblxuICAgICAgICAgICAgb3V0ZXI6IHdoaWxlIChjdXJUb05vZGVDaGlsZCkge1xuICAgICAgICAgICAgICAgIHRvTmV4dFNpYmxpbmcgPSBjdXJUb05vZGVDaGlsZC5uZXh0U2libGluZztcbiAgICAgICAgICAgICAgICBjdXJUb05vZGVJZCA9IGdldE5vZGVLZXkoY3VyVG9Ob2RlQ2hpbGQpO1xuXG4gICAgICAgICAgICAgICAgd2hpbGUgKGN1ckZyb21Ob2RlQ2hpbGQpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGN1ckZyb21Ob2RlSWQgPSBnZXROb2RlS2V5KGN1ckZyb21Ob2RlQ2hpbGQpO1xuICAgICAgICAgICAgICAgICAgICBmcm9tTmV4dFNpYmxpbmcgPSBjdXJGcm9tTm9kZUNoaWxkLm5leHRTaWJsaW5nO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmICghYWxyZWFkeVZpc2l0ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjdXJGcm9tTm9kZUlkICYmICh1bm1hdGNoZWRFbCA9IHVubWF0Y2hlZEVsc1tjdXJGcm9tTm9kZUlkXSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB1bm1hdGNoZWRFbC5wYXJlbnROb2RlLnJlcGxhY2VDaGlsZChjdXJGcm9tTm9kZUNoaWxkLCB1bm1hdGNoZWRFbCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbW9ycGhFbChjdXJGcm9tTm9kZUNoaWxkLCB1bm1hdGNoZWRFbCwgYWxyZWFkeVZpc2l0ZWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGN1ckZyb21Ob2RlQ2hpbGQgPSBmcm9tTmV4dFNpYmxpbmc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICB2YXIgY3VyRnJvbU5vZGVUeXBlID0gY3VyRnJvbU5vZGVDaGlsZC5ub2RlVHlwZTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoY3VyRnJvbU5vZGVUeXBlID09PSBjdXJUb05vZGVDaGlsZC5ub2RlVHlwZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGlzQ29tcGF0aWJsZSA9IGZhbHNlO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBCb3RoIG5vZGVzIGJlaW5nIGNvbXBhcmVkIGFyZSBFbGVtZW50IG5vZGVzXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY3VyRnJvbU5vZGVUeXBlID09PSBFTEVNRU5UX05PREUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoY29tcGFyZU5vZGVOYW1lcyhjdXJGcm9tTm9kZUNoaWxkLCBjdXJUb05vZGVDaGlsZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gV2UgaGF2ZSBjb21wYXRpYmxlIERPTSBlbGVtZW50c1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoY3VyRnJvbU5vZGVJZCB8fCBjdXJUb05vZGVJZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gSWYgZWl0aGVyIERPTSBlbGVtZW50IGhhcyBhbiBJRCB0aGVuIHdlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBoYW5kbGUgdGhvc2UgZGlmZmVyZW50bHkgc2luY2Ugd2Ugd2FudCB0b1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gbWF0Y2ggdXAgYnkgSURcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjdXJUb05vZGVJZCA9PT0gY3VyRnJvbU5vZGVJZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlzQ29tcGF0aWJsZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpc0NvbXBhdGlibGUgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlzQ29tcGF0aWJsZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBXZSBmb3VuZCBjb21wYXRpYmxlIERPTSBlbGVtZW50cyBzbyB0cmFuc2Zvcm1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gdGhlIGN1cnJlbnQgXCJmcm9tXCIgbm9kZSB0byBtYXRjaCB0aGUgY3VycmVudFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB0YXJnZXQgRE9NIG5vZGUuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1vcnBoRWwoY3VyRnJvbU5vZGVDaGlsZCwgY3VyVG9Ob2RlQ2hpbGQsIGFscmVhZHlWaXNpdGVkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBCb3RoIG5vZGVzIGJlaW5nIGNvbXBhcmVkIGFyZSBUZXh0IG5vZGVzXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoY3VyRnJvbU5vZGVUeXBlID09PSBURVhUX05PREUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpc0NvbXBhdGlibGUgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFNpbXBseSB1cGRhdGUgbm9kZVZhbHVlIG9uIHRoZSBvcmlnaW5hbCBub2RlIHRvXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gY2hhbmdlIHRoZSB0ZXh0IHZhbHVlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY3VyRnJvbU5vZGVDaGlsZC5ub2RlVmFsdWUgPSBjdXJUb05vZGVDaGlsZC5ub2RlVmFsdWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpc0NvbXBhdGlibGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjdXJUb05vZGVDaGlsZCA9IHRvTmV4dFNpYmxpbmc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY3VyRnJvbU5vZGVDaGlsZCA9IGZyb21OZXh0U2libGluZztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZSBvdXRlcjtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIE5vIGNvbXBhdGlibGUgbWF0Y2ggc28gcmVtb3ZlIHRoZSBvbGQgbm9kZSBmcm9tIHRoZSBET01cbiAgICAgICAgICAgICAgICAgICAgLy8gYW5kIGNvbnRpbnVlIHRyeWluZyB0byBmaW5kIGEgbWF0Y2ggaW4gdGhlIG9yaWdpbmFsIERPTVxuICAgICAgICAgICAgICAgICAgICByZW1vdmVOb2RlKGN1ckZyb21Ob2RlQ2hpbGQsIGZyb21FbCwgYWxyZWFkeVZpc2l0ZWQpO1xuICAgICAgICAgICAgICAgICAgICBjdXJGcm9tTm9kZUNoaWxkID0gZnJvbU5leHRTaWJsaW5nO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChjdXJUb05vZGVJZCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoKHNhdmVkRWwgPSBzYXZlZEVsc1tjdXJUb05vZGVJZF0pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtb3JwaEVsKHNhdmVkRWwsIGN1clRvTm9kZUNoaWxkLCB0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFdlIHdhbnQgdG8gYXBwZW5kIHRoZSBzYXZlZCBlbGVtZW50IGluc3RlYWRcbiAgICAgICAgICAgICAgICAgICAgICAgIGN1clRvTm9kZUNoaWxkID0gc2F2ZWRFbDtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFRoZSBjdXJyZW50IERPTSBlbGVtZW50IGluIHRoZSB0YXJnZXQgdHJlZSBoYXMgYW4gSURcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGJ1dCB3ZSBkaWQgbm90IGZpbmQgYSBtYXRjaCBpbiBhbnkgb2YgdGhlXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBjb3JyZXNwb25kaW5nIHNpYmxpbmdzLiBXZSBqdXN0IHB1dCB0aGUgdGFyZ2V0XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBlbGVtZW50IGluIHRoZSBvbGQgRE9NIHRyZWUgYnV0IGlmIHdlIGxhdGVyIGZpbmQgYW5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGVsZW1lbnQgaW4gdGhlIG9sZCBET00gdHJlZSB0aGF0IGhhcyBhIG1hdGNoaW5nIElEXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyB0aGVuIHdlIHdpbGwgcmVwbGFjZSB0aGUgdGFyZ2V0IGVsZW1lbnQgd2l0aCB0aGVcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNvcnJlc3BvbmRpbmcgb2xkIGVsZW1lbnQgYW5kIG1vcnBoIHRoZSBvbGQgZWxlbWVudFxuICAgICAgICAgICAgICAgICAgICAgICAgdW5tYXRjaGVkRWxzW2N1clRvTm9kZUlkXSA9IGN1clRvTm9kZUNoaWxkO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gSWYgd2UgZ290IHRoaXMgZmFyIHRoZW4gd2UgZGlkIG5vdCBmaW5kIGEgY2FuZGlkYXRlIG1hdGNoIGZvclxuICAgICAgICAgICAgICAgIC8vIG91ciBcInRvIG5vZGVcIiBhbmQgd2UgZXhoYXVzdGVkIGFsbCBvZiB0aGUgY2hpbGRyZW4gXCJmcm9tXCJcbiAgICAgICAgICAgICAgICAvLyBub2Rlcy4gVGhlcmVmb3JlLCB3ZSB3aWxsIGp1c3QgYXBwZW5kIHRoZSBjdXJyZW50IFwidG8gbm9kZVwiXG4gICAgICAgICAgICAgICAgLy8gdG8gdGhlIGVuZFxuICAgICAgICAgICAgICAgIGlmIChvbkJlZm9yZU5vZGVBZGRlZChjdXJUb05vZGVDaGlsZCkgIT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgICAgIGZyb21FbC5hcHBlbmRDaGlsZChjdXJUb05vZGVDaGlsZCk7XG4gICAgICAgICAgICAgICAgICAgIG9uTm9kZUFkZGVkKGN1clRvTm9kZUNoaWxkKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoY3VyVG9Ob2RlQ2hpbGQubm9kZVR5cGUgPT09IEVMRU1FTlRfTk9ERSAmJlxuICAgICAgICAgICAgICAgICAgICAoY3VyVG9Ob2RlSWQgfHwgY3VyVG9Ob2RlQ2hpbGQuZmlyc3RDaGlsZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gVGhlIGVsZW1lbnQgdGhhdCB3YXMganVzdCBhZGRlZCB0byB0aGUgb3JpZ2luYWwgRE9NIG1heVxuICAgICAgICAgICAgICAgICAgICAvLyBoYXZlIHNvbWUgbmVzdGVkIGVsZW1lbnRzIHdpdGggYSBrZXkvSUQgdGhhdCBuZWVkcyB0byBiZVxuICAgICAgICAgICAgICAgICAgICAvLyBtYXRjaGVkIHVwIHdpdGggb3RoZXIgZWxlbWVudHMuIFdlJ2xsIGFkZCB0aGUgZWxlbWVudCB0b1xuICAgICAgICAgICAgICAgICAgICAvLyBhIGxpc3Qgc28gdGhhdCB3ZSBjYW4gbGF0ZXIgcHJvY2VzcyB0aGUgbmVzdGVkIGVsZW1lbnRzXG4gICAgICAgICAgICAgICAgICAgIC8vIGlmIHRoZXJlIGFyZSBhbnkgdW5tYXRjaGVkIGtleWVkIGVsZW1lbnRzIHRoYXQgd2VyZVxuICAgICAgICAgICAgICAgICAgICAvLyBkaXNjYXJkZWRcbiAgICAgICAgICAgICAgICAgICAgbW92ZWRFbHMucHVzaChjdXJUb05vZGVDaGlsZCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY3VyVG9Ob2RlQ2hpbGQgPSB0b05leHRTaWJsaW5nO1xuICAgICAgICAgICAgICAgIGN1ckZyb21Ob2RlQ2hpbGQgPSBmcm9tTmV4dFNpYmxpbmc7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFdlIGhhdmUgcHJvY2Vzc2VkIGFsbCBvZiB0aGUgXCJ0byBub2Rlc1wiLiBJZiBjdXJGcm9tTm9kZUNoaWxkIGlzXG4gICAgICAgICAgICAvLyBub24tbnVsbCB0aGVuIHdlIHN0aWxsIGhhdmUgc29tZSBmcm9tIG5vZGVzIGxlZnQgb3ZlciB0aGF0IG5lZWRcbiAgICAgICAgICAgIC8vIHRvIGJlIHJlbW92ZWRcbiAgICAgICAgICAgIHdoaWxlIChjdXJGcm9tTm9kZUNoaWxkKSB7XG4gICAgICAgICAgICAgICAgZnJvbU5leHRTaWJsaW5nID0gY3VyRnJvbU5vZGVDaGlsZC5uZXh0U2libGluZztcbiAgICAgICAgICAgICAgICByZW1vdmVOb2RlKGN1ckZyb21Ob2RlQ2hpbGQsIGZyb21FbCwgYWxyZWFkeVZpc2l0ZWQpO1xuICAgICAgICAgICAgICAgIGN1ckZyb21Ob2RlQ2hpbGQgPSBmcm9tTmV4dFNpYmxpbmc7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgc3BlY2lhbEVsSGFuZGxlciA9IHNwZWNpYWxFbEhhbmRsZXJzW2Zyb21FbC5ub2RlTmFtZV07XG4gICAgICAgIGlmIChzcGVjaWFsRWxIYW5kbGVyKSB7XG4gICAgICAgICAgICBzcGVjaWFsRWxIYW5kbGVyKGZyb21FbCwgdG9FbCk7XG4gICAgICAgIH1cbiAgICB9IC8vIEVORDogbW9ycGhFbCguLi4pXG5cbiAgICB2YXIgbW9ycGhlZE5vZGUgPSBmcm9tTm9kZTtcbiAgICB2YXIgbW9ycGhlZE5vZGVUeXBlID0gbW9ycGhlZE5vZGUubm9kZVR5cGU7XG4gICAgdmFyIHRvTm9kZVR5cGUgPSB0b05vZGUubm9kZVR5cGU7XG5cbiAgICBpZiAoIWNoaWxkcmVuT25seSkge1xuICAgICAgICAvLyBIYW5kbGUgdGhlIGNhc2Ugd2hlcmUgd2UgYXJlIGdpdmVuIHR3byBET00gbm9kZXMgdGhhdCBhcmUgbm90XG4gICAgICAgIC8vIGNvbXBhdGlibGUgKGUuZy4gPGRpdj4gLS0+IDxzcGFuPiBvciA8ZGl2PiAtLT4gVEVYVClcbiAgICAgICAgaWYgKG1vcnBoZWROb2RlVHlwZSA9PT0gRUxFTUVOVF9OT0RFKSB7XG4gICAgICAgICAgICBpZiAodG9Ob2RlVHlwZSA9PT0gRUxFTUVOVF9OT0RFKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFjb21wYXJlTm9kZU5hbWVzKGZyb21Ob2RlLCB0b05vZGUpKSB7XG4gICAgICAgICAgICAgICAgICAgIG9uTm9kZURpc2NhcmRlZChmcm9tTm9kZSk7XG4gICAgICAgICAgICAgICAgICAgIG1vcnBoZWROb2RlID0gbW92ZUNoaWxkcmVuKGZyb21Ob2RlLCBjcmVhdGVFbGVtZW50TlModG9Ob2RlLm5vZGVOYW1lLCB0b05vZGUubmFtZXNwYWNlVVJJKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBHb2luZyBmcm9tIGFuIGVsZW1lbnQgbm9kZSB0byBhIHRleHQgbm9kZVxuICAgICAgICAgICAgICAgIG1vcnBoZWROb2RlID0gdG9Ob2RlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKG1vcnBoZWROb2RlVHlwZSA9PT0gVEVYVF9OT0RFKSB7IC8vIFRleHQgbm9kZVxuICAgICAgICAgICAgaWYgKHRvTm9kZVR5cGUgPT09IFRFWFRfTk9ERSkge1xuICAgICAgICAgICAgICAgIG1vcnBoZWROb2RlLm5vZGVWYWx1ZSA9IHRvTm9kZS5ub2RlVmFsdWU7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG1vcnBoZWROb2RlO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBUZXh0IG5vZGUgdG8gc29tZXRoaW5nIGVsc2VcbiAgICAgICAgICAgICAgICBtb3JwaGVkTm9kZSA9IHRvTm9kZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmIChtb3JwaGVkTm9kZSA9PT0gdG9Ob2RlKSB7XG4gICAgICAgIC8vIFRoZSBcInRvIG5vZGVcIiB3YXMgbm90IGNvbXBhdGlibGUgd2l0aCB0aGUgXCJmcm9tIG5vZGVcIiBzbyB3ZSBoYWQgdG9cbiAgICAgICAgLy8gdG9zcyBvdXQgdGhlIFwiZnJvbSBub2RlXCIgYW5kIHVzZSB0aGUgXCJ0byBub2RlXCJcbiAgICAgICAgb25Ob2RlRGlzY2FyZGVkKGZyb21Ob2RlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBtb3JwaEVsKG1vcnBoZWROb2RlLCB0b05vZGUsIGZhbHNlLCBjaGlsZHJlbk9ubHkpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBXaGF0IHdlIHdpbGwgZG8gaGVyZSBpcyB3YWxrIHRoZSB0cmVlIGZvciB0aGUgRE9NIGVsZW1lbnQgdGhhdCB3YXNcbiAgICAgICAgICogbW92ZWQgZnJvbSB0aGUgdGFyZ2V0IERPTSB0cmVlIHRvIHRoZSBvcmlnaW5hbCBET00gdHJlZSBhbmQgd2Ugd2lsbFxuICAgICAgICAgKiBsb29rIGZvciBrZXllZCBlbGVtZW50cyB0aGF0IGNvdWxkIGJlIG1hdGNoZWQgdG8ga2V5ZWQgZWxlbWVudHMgdGhhdFxuICAgICAgICAgKiB3ZXJlIGVhcmxpZXIgZGlzY2FyZGVkLiAgSWYgd2UgZmluZCBhIG1hdGNoIHRoZW4gd2Ugd2lsbCBtb3ZlIHRoZVxuICAgICAgICAgKiBzYXZlZCBlbGVtZW50IGludG8gdGhlIGZpbmFsIERPTSB0cmVlLlxuICAgICAgICAgKi9cbiAgICAgICAgdmFyIGhhbmRsZU1vdmVkRWwgPSBmdW5jdGlvbihlbCkge1xuICAgICAgICAgICAgdmFyIGN1ckNoaWxkID0gZWwuZmlyc3RDaGlsZDtcbiAgICAgICAgICAgIHdoaWxlIChjdXJDaGlsZCkge1xuICAgICAgICAgICAgICAgIHZhciBuZXh0U2libGluZyA9IGN1ckNoaWxkLm5leHRTaWJsaW5nO1xuXG4gICAgICAgICAgICAgICAgdmFyIGtleSA9IGdldE5vZGVLZXkoY3VyQ2hpbGQpO1xuICAgICAgICAgICAgICAgIGlmIChrZXkpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHNhdmVkRWwgPSBzYXZlZEVsc1trZXldO1xuICAgICAgICAgICAgICAgICAgICBpZiAoc2F2ZWRFbCAmJiBjb21wYXJlTm9kZU5hbWVzKGN1ckNoaWxkLCBzYXZlZEVsKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY3VyQ2hpbGQucGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQoc2F2ZWRFbCwgY3VyQ2hpbGQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gdHJ1ZTogYWxyZWFkeSB2aXNpdGVkIHRoZSBzYXZlZCBlbCB0cmVlXG4gICAgICAgICAgICAgICAgICAgICAgICBtb3JwaEVsKHNhdmVkRWwsIGN1ckNoaWxkLCB0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGN1ckNoaWxkID0gbmV4dFNpYmxpbmc7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZW1wdHkoc2F2ZWRFbHMpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoY3VyQ2hpbGQubm9kZVR5cGUgPT09IEVMRU1FTlRfTk9ERSkge1xuICAgICAgICAgICAgICAgICAgICBoYW5kbGVNb3ZlZEVsKGN1ckNoaWxkKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjdXJDaGlsZCA9IG5leHRTaWJsaW5nO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIC8vIFRoZSBsb29wIGJlbG93IGlzIHVzZWQgdG8gcG9zc2libHkgbWF0Y2ggdXAgYW55IGRpc2NhcmRlZFxuICAgICAgICAvLyBlbGVtZW50cyBpbiB0aGUgb3JpZ2luYWwgRE9NIHRyZWUgd2l0aCBlbGVtZW5ldHMgZnJvbSB0aGVcbiAgICAgICAgLy8gdGFyZ2V0IHRyZWUgdGhhdCB3ZXJlIG1vdmVkIG92ZXIgd2l0aG91dCB2aXNpdGluZyB0aGVpclxuICAgICAgICAvLyBjaGlsZHJlblxuICAgICAgICBpZiAoIWVtcHR5KHNhdmVkRWxzKSkge1xuICAgICAgICAgICAgaGFuZGxlTW92ZWRFbHNMb29wOlxuICAgICAgICAgICAgd2hpbGUgKG1vdmVkRWxzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHZhciBtb3ZlZEVsc1RlbXAgPSBtb3ZlZEVscztcbiAgICAgICAgICAgICAgICBtb3ZlZEVscyA9IFtdO1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGk9MDsgaTxtb3ZlZEVsc1RlbXAubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGhhbmRsZU1vdmVkRWwobW92ZWRFbHNUZW1wW2ldKSA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFRoZXJlIGFyZSBubyBtb3JlIHVubWF0Y2hlZCBlbGVtZW50cyBzbyBjb21wbGV0ZWx5IGVuZFxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gdGhlIGxvb3BcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrIGhhbmRsZU1vdmVkRWxzTG9vcDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEZpcmUgdGhlIFwib25Ob2RlRGlzY2FyZGVkXCIgZXZlbnQgZm9yIGFueSBzYXZlZCBlbGVtZW50c1xuICAgICAgICAvLyB0aGF0IG5ldmVyIGZvdW5kIGEgbmV3IGhvbWUgaW4gdGhlIG1vcnBoZWQgRE9NXG4gICAgICAgIGZvciAodmFyIHNhdmVkRWxJZCBpbiBzYXZlZEVscykge1xuICAgICAgICAgICAgaWYgKHNhdmVkRWxzLmhhc093blByb3BlcnR5KHNhdmVkRWxJZCkpIHtcbiAgICAgICAgICAgICAgICB2YXIgc2F2ZWRFbCA9IHNhdmVkRWxzW3NhdmVkRWxJZF07XG4gICAgICAgICAgICAgICAgb25Ob2RlRGlzY2FyZGVkKHNhdmVkRWwpO1xuICAgICAgICAgICAgICAgIHdhbGtEaXNjYXJkZWRDaGlsZE5vZGVzKHNhdmVkRWwpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCFjaGlsZHJlbk9ubHkgJiYgbW9ycGhlZE5vZGUgIT09IGZyb21Ob2RlICYmIGZyb21Ob2RlLnBhcmVudE5vZGUpIHtcbiAgICAgICAgLy8gSWYgd2UgaGFkIHRvIHN3YXAgb3V0IHRoZSBmcm9tIG5vZGUgd2l0aCBhIG5ldyBub2RlIGJlY2F1c2UgdGhlIG9sZFxuICAgICAgICAvLyBub2RlIHdhcyBub3QgY29tcGF0aWJsZSB3aXRoIHRoZSB0YXJnZXQgbm9kZSB0aGVuIHdlIG5lZWQgdG9cbiAgICAgICAgLy8gcmVwbGFjZSB0aGUgb2xkIERPTSBub2RlIGluIHRoZSBvcmlnaW5hbCBET00gdHJlZS4gVGhpcyBpcyBvbmx5XG4gICAgICAgIC8vIHBvc3NpYmxlIGlmIHRoZSBvcmlnaW5hbCBET00gbm9kZSB3YXMgcGFydCBvZiBhIERPTSB0cmVlIHdoaWNoXG4gICAgICAgIC8vIHdlIGtub3cgaXMgdGhlIGNhc2UgaWYgaXQgaGFzIGEgcGFyZW50IG5vZGUuXG4gICAgICAgIGZyb21Ob2RlLnBhcmVudE5vZGUucmVwbGFjZUNoaWxkKG1vcnBoZWROb2RlLCBmcm9tTm9kZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG1vcnBoZWROb2RlO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IG1vcnBoZG9tO1xuIiwibW9kdWxlLmV4cG9ydHMgPSBbXG4gIC8vIGF0dHJpYnV0ZSBldmVudHMgKGNhbiBiZSBzZXQgd2l0aCBhdHRyaWJ1dGVzKVxuICAnb25jbGljaycsXG4gICdvbmRibGNsaWNrJyxcbiAgJ29ubW91c2Vkb3duJyxcbiAgJ29ubW91c2V1cCcsXG4gICdvbm1vdXNlb3ZlcicsXG4gICdvbm1vdXNlbW92ZScsXG4gICdvbm1vdXNlb3V0JyxcbiAgJ29uZHJhZ3N0YXJ0JyxcbiAgJ29uZHJhZycsXG4gICdvbmRyYWdlbnRlcicsXG4gICdvbmRyYWdsZWF2ZScsXG4gICdvbmRyYWdvdmVyJyxcbiAgJ29uZHJvcCcsXG4gICdvbmRyYWdlbmQnLFxuICAnb25rZXlkb3duJyxcbiAgJ29ua2V5cHJlc3MnLFxuICAnb25rZXl1cCcsXG4gICdvbnVubG9hZCcsXG4gICdvbmFib3J0JyxcbiAgJ29uZXJyb3InLFxuICAnb25yZXNpemUnLFxuICAnb25zY3JvbGwnLFxuICAnb25zZWxlY3QnLFxuICAnb25jaGFuZ2UnLFxuICAnb25zdWJtaXQnLFxuICAnb25yZXNldCcsXG4gICdvbmZvY3VzJyxcbiAgJ29uYmx1cicsXG4gICdvbmlucHV0JyxcbiAgLy8gb3RoZXIgY29tbW9uIGV2ZW50c1xuICAnb25jb250ZXh0bWVudScsXG4gICdvbmZvY3VzaW4nLFxuICAnb25mb2N1c291dCdcbl1cbiIsImltcG9ydCBVdGlscyBmcm9tICcuLi9jb3JlL1V0aWxzJ1xuaW1wb3J0IFRyYW5zbGF0b3IgZnJvbSAnLi4vY29yZS9UcmFuc2xhdG9yJ1xuaW1wb3J0IHlvIGZyb20gJ3lvLXlvJ1xuaW1wb3J0IGVlIGZyb20gJ2V2ZW50cydcbmltcG9ydCBVcHB5U29ja2V0IGZyb20gJy4vVXBweVNvY2tldCdcblxuLyoqXG4gKiBNYWluIFVwcHkgY29yZVxuICpcbiAqIEBwYXJhbSB7b2JqZWN0fSBvcHRzIGdlbmVyYWwgb3B0aW9ucywgbGlrZSBsb2NhbGVzLCB0byBzaG93IG1vZGFsIG9yIG5vdCB0byBzaG93XG4gKi9cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIENvcmUge1xuICBjb25zdHJ1Y3RvciAob3B0cykge1xuICAgIC8vIHNldCBkZWZhdWx0IG9wdGlvbnNcbiAgICBjb25zdCBkZWZhdWx0T3B0aW9ucyA9IHtcbiAgICAgIC8vIGxvYWQgRW5nbGlzaCBhcyB0aGUgZGVmYXVsdCBsb2NhbGVzXG4gICAgICBsb2NhbGVzOiByZXF1aXJlKCcuLi9sb2NhbGVzL2VuX1VTLmpzJyksXG4gICAgICBhdXRvUHJvY2VlZDogdHJ1ZSxcbiAgICAgIGRlYnVnOiBmYWxzZVxuICAgIH1cblxuICAgIC8vIE1lcmdlIGRlZmF1bHQgb3B0aW9ucyB3aXRoIHRoZSBvbmVzIHNldCBieSB1c2VyXG4gICAgdGhpcy5vcHRzID0gT2JqZWN0LmFzc2lnbih7fSwgZGVmYXVsdE9wdGlvbnMsIG9wdHMpXG5cbiAgICAvLyBEaWN0YXRlcyBpbiB3aGF0IG9yZGVyIGRpZmZlcmVudCBwbHVnaW4gdHlwZXMgYXJlIHJhbjpcbiAgICB0aGlzLnR5cGVzID0gWyAncHJlc2V0dGVyJywgJ29yY2hlc3RyYXRvcicsICdwcm9ncmVzc2luZGljYXRvcicsICdhY3F1aXJlcicsICd1cGxvYWRlcicsICdwcmVzZW50ZXInIF1cblxuICAgIHRoaXMudHlwZSA9ICdjb3JlJ1xuXG4gICAgLy8gQ29udGFpbmVyIGZvciBkaWZmZXJlbnQgdHlwZXMgb2YgcGx1Z2luc1xuICAgIHRoaXMucGx1Z2lucyA9IHt9XG5cbiAgICB0aGlzLnRyYW5zbGF0b3IgPSBuZXcgVHJhbnNsYXRvcih7bG9jYWxlczogdGhpcy5vcHRzLmxvY2FsZXN9KVxuICAgIHRoaXMuaTE4biA9IHRoaXMudHJhbnNsYXRvci50cmFuc2xhdGUuYmluZCh0aGlzLnRyYW5zbGF0b3IpXG4gICAgdGhpcy5pbml0U29ja2V0ID0gdGhpcy5pbml0U29ja2V0LmJpbmQodGhpcylcblxuICAgIHRoaXMuZW1pdHRlciA9IG5ldyBlZS5FdmVudEVtaXR0ZXIoKVxuXG4gICAgdGhpcy5zdGF0ZSA9IHtcbiAgICAgIGZpbGVzOiB7fVxuICAgIH1cblxuICAgIGlmICh0aGlzLm9wdHMuZGVidWcpIHtcbiAgICAgIC8vIGZvciBkZWJ1Z2dpbmcgYW5kIHRlc3RpbmdcbiAgICAgIGdsb2JhbC5VcHB5U3RhdGUgPSB0aGlzLnN0YXRlXG4gICAgICBnbG9iYWwudXBweUxvZyA9ICcnXG4gICAgICBnbG9iYWwuVXBweUFkZEZpbGUgPSB0aGlzLmFkZEZpbGUuYmluZCh0aGlzKVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBJdGVyYXRlIG9uIGFsbCBwbHVnaW5zIGFuZCBydW4gYHVwZGF0ZWAgb24gdGhlbS4gQ2FsbGVkIGVhY2ggdGltZSB3aGVuIHN0YXRlIGNoYW5nZXNcbiAgICpcbiAgICovXG4gIHVwZGF0ZUFsbCAoKSB7XG4gICAgT2JqZWN0LmtleXModGhpcy5wbHVnaW5zKS5mb3JFYWNoKChwbHVnaW5UeXBlKSA9PiB7XG4gICAgICB0aGlzLnBsdWdpbnNbcGx1Z2luVHlwZV0uZm9yRWFjaCgocGx1Z2luKSA9PiB7XG4gICAgICAgIHBsdWdpbi51cGRhdGUoKVxuICAgICAgfSlcbiAgICB9KVxuICB9XG5cbiAgLyoqXG4gICAqIFVwZGF0ZXMgc3RhdGVcbiAgICpcbiAgICogQHBhcmFtIHtuZXdTdGF0ZX0gb2JqZWN0XG4gICAqL1xuICBzZXRTdGF0ZSAobmV3U3RhdGUpIHtcbiAgICB0aGlzLmxvZygnU2V0dGluZyBzdGF0ZSB0bzogJylcbiAgICB0aGlzLmxvZyhuZXdTdGF0ZSlcbiAgICB0aGlzLnN0YXRlID0gT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5zdGF0ZSwgbmV3U3RhdGUpXG4gICAgdGhpcy51cGRhdGVBbGwoKVxuICB9XG5cbiAgLyoqXG4gICAqIEdldHMgY3VycmVudCBzdGF0ZSwgbWFraW5nIHN1cmUgdG8gbWFrZSBhIGNvcHkgb2YgdGhlIHN0YXRlIG9iamVjdCBhbmQgcGFzcyB0aGF0LFxuICAgKiBpbnN0ZWFkIG9mIGFuIGFjdHVhbCByZWZlcmVuY2UgdG8gYHRoaXMuc3RhdGVgXG4gICAqXG4gICAqL1xuICBnZXRTdGF0ZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RhdGVcbiAgfVxuXG4gIGFkZEltZ1ByZXZpZXdUb0ZpbGUgKGZpbGUpIHtcbiAgICBjb25zdCByZWFkZXIgPSBuZXcgRmlsZVJlYWRlcigpXG4gICAgcmVhZGVyLmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWQnLCAoZXYpID0+IHtcbiAgICAgIGNvbnN0IGltZ1NyYyA9IGV2LnRhcmdldC5yZXN1bHRcbiAgICAgIGNvbnN0IHVwZGF0ZWRGaWxlcyA9IE9iamVjdC5hc3NpZ24oe30sIHRoaXMuc3RhdGUuZmlsZXMpXG4gICAgICB1cGRhdGVkRmlsZXNbZmlsZS5pZF0ucHJldmlldyA9IGltZ1NyY1xuICAgICAgdXBkYXRlZEZpbGVzW2ZpbGUuaWRdLnByZXZpZXdFbCA9IHlvYDxpbWcgYWx0PVwiJHtmaWxlLm5hbWV9XCIgc3JjPVwiJHtpbWdTcmN9XCI+YFxuICAgICAgdGhpcy5zZXRTdGF0ZSh7ZmlsZXM6IHVwZGF0ZWRGaWxlc30pXG4gICAgfSlcbiAgICByZWFkZXIuYWRkRXZlbnRMaXN0ZW5lcignZXJyb3InLCAoZXJyKSA9PiB7XG4gICAgICB0aGlzLmNvcmUubG9nKCdGaWxlUmVhZGVyIGVycm9yJyArIGVycilcbiAgICB9KVxuICAgIHJlYWRlci5yZWFkQXNEYXRhVVJMKGZpbGUuZGF0YSlcbiAgfVxuXG4gIGFkZE1ldGEgKG1ldGEsIGZpbGVJRCkge1xuICAgIGlmICh0eXBlb2YgZmlsZUlEID09PSAndW5kZWZpbmVkJykge1xuICAgICAgY29uc3QgdXBkYXRlZEZpbGVzID0gT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5zdGF0ZS5maWxlcylcbiAgICAgIGZvciAobGV0IGZpbGUgaW4gdXBkYXRlZEZpbGVzKSB7XG4gICAgICAgIHVwZGF0ZWRGaWxlc1tmaWxlXS5tZXRhID0gbWV0YVxuICAgICAgfVxuICAgICAgdGhpcy5zZXRTdGF0ZSh7ZmlsZXM6IHVwZGF0ZWRGaWxlc30pXG4gICAgfVxuICB9XG5cbiAgYWRkRmlsZSAoZmlsZSkge1xuICAgIGNvbnN0IHVwZGF0ZWRGaWxlcyA9IE9iamVjdC5hc3NpZ24oe30sIHRoaXMuc3RhdGUuZmlsZXMpXG5cbiAgICBjb25zdCBmaWxlVHlwZSA9IGZpbGUudHlwZS5zcGxpdCgnLycpXG4gICAgY29uc3QgZmlsZVR5cGVHZW5lcmFsID0gZmlsZVR5cGVbMF1cbiAgICBjb25zdCBmaWxlVHlwZVNwZWNpZmljID0gZmlsZVR5cGVbMV1cbiAgICBjb25zdCBmaWxlSUQgPSBVdGlscy5nZW5lcmF0ZUZpbGVJRChmaWxlLm5hbWUpXG5cbiAgICB1cGRhdGVkRmlsZXNbZmlsZUlEXSA9IHtcbiAgICAgIHNvdXJjZTogZmlsZS5zb3VyY2UgfHwgJycsXG4gICAgICBpZDogZmlsZUlELFxuICAgICAgbmFtZTogZmlsZS5uYW1lLFxuICAgICAgdHlwZToge1xuICAgICAgICBnZW5lcmFsOiBmaWxlVHlwZUdlbmVyYWwsXG4gICAgICAgIHNwZWNpZmljOiBmaWxlVHlwZVNwZWNpZmljXG4gICAgICB9LFxuICAgICAgZGF0YTogZmlsZS5kYXRhLFxuICAgICAgcHJvZ3Jlc3M6IDAsXG4gICAgICBpc1JlbW90ZTogZmlsZS5pc1JlbW90ZSB8fCBmYWxzZSxcbiAgICAgIHJlbW90ZTogZmlsZS5yZW1vdGVcbiAgICB9XG5cbiAgICB0aGlzLnNldFN0YXRlKHtmaWxlczogdXBkYXRlZEZpbGVzfSlcblxuICAgIGlmIChmaWxlVHlwZUdlbmVyYWwgPT09ICdpbWFnZScpIHtcbiAgICAgIHRoaXMuYWRkSW1nUHJldmlld1RvRmlsZSh1cGRhdGVkRmlsZXNbZmlsZUlEXSlcbiAgICB9XG5cbiAgICBpZiAodGhpcy5vcHRzLmF1dG9Qcm9jZWVkKSB7XG4gICAgICB0aGlzLmVtaXR0ZXIuZW1pdCgnbmV4dCcpXG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJlZ2lzdGVycyBsaXN0ZW5lcnMgZm9yIGFsbCBnbG9iYWwgYWN0aW9ucywgbGlrZTpcbiAgICogYGZpbGUtYWRkYCwgYGZpbGUtcmVtb3ZlYCwgYHVwbG9hZC1wcm9ncmVzc2AsIGByZXNldGBcbiAgICpcbiAgICovXG4gIGFjdGlvbnMgKCkge1xuICAgIHRoaXMuZW1pdHRlci5vbignZmlsZS1hZGQnLCAoZGF0YSkgPT4ge1xuICAgICAgdGhpcy5hZGRGaWxlKGRhdGEpXG4gICAgfSlcblxuICAgIC8vIGByZW1vdmUtZmlsZWAgcmVtb3ZlcyBhIGZpbGUgZnJvbSBgc3RhdGUuZmlsZXNgLCBmb3IgZXhhbXBsZSB3aGVuXG4gICAgLy8gYSB1c2VyIGRlY2lkZXMgbm90IHRvIHVwbG9hZCBwYXJ0aWN1bGFyIGZpbGUgYW5kIGNsaWNrcyBhIGJ1dHRvbiB0byByZW1vdmUgaXRcbiAgICB0aGlzLmVtaXR0ZXIub24oJ2ZpbGUtcmVtb3ZlJywgKGZpbGVJRCkgPT4ge1xuICAgICAgY29uc3QgdXBkYXRlZEZpbGVzID0gT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5zdGF0ZS5maWxlcylcbiAgICAgIGRlbGV0ZSB1cGRhdGVkRmlsZXNbZmlsZUlEXVxuICAgICAgdGhpcy5zZXRTdGF0ZSh7ZmlsZXM6IHVwZGF0ZWRGaWxlc30pXG4gICAgfSlcblxuICAgIHRoaXMuZW1pdHRlci5vbigndXBsb2FkLXByb2dyZXNzJywgKHByb2dyZXNzRGF0YSkgPT4ge1xuICAgICAgY29uc3QgdXBkYXRlZEZpbGVzID0gT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5zdGF0ZS5maWxlcylcbiAgICAgIHVwZGF0ZWRGaWxlc1twcm9ncmVzc0RhdGEuaWRdLnByb2dyZXNzID0gcHJvZ3Jlc3NEYXRhLnBlcmNlbnRhZ2VcblxuICAgICAgY29uc3QgaW5Qcm9ncmVzcyA9IE9iamVjdC5rZXlzKHVwZGF0ZWRGaWxlcykubWFwKChmaWxlKSA9PiB7XG4gICAgICAgIHJldHVybiBmaWxlLnByb2dyZXNzICE9PSAwXG4gICAgICB9KVxuXG4gICAgICAvLyBjYWxjdWxhdGUgdG90YWwgcHJvZ3Jlc3MsIHVzaW5nIHRoZSBudW1iZXIgb2YgZmlsZXMgY3VycmVudGx5IHVwbG9hZGluZyxcbiAgICAgIC8vIG11bHRpcGxpZWQgYnkgMTAwIGFuZCB0aGUgc3VtbSBvZiBpbmRpdmlkdWFsIHByb2dyZXNzIG9mIGVhY2ggZmlsZVxuICAgICAgY29uc3QgcHJvZ3Jlc3NNYXggPSBPYmplY3Qua2V5cyhpblByb2dyZXNzKS5sZW5ndGggKiAxMDBcbiAgICAgIGxldCBwcm9ncmVzc0FsbCA9IDBcbiAgICAgIE9iamVjdC5rZXlzKHVwZGF0ZWRGaWxlcykuZm9yRWFjaCgoZmlsZSkgPT4ge1xuICAgICAgICBwcm9ncmVzc0FsbCA9IHByb2dyZXNzQWxsICsgdXBkYXRlZEZpbGVzW2ZpbGVdLnByb2dyZXNzXG4gICAgICB9KVxuXG4gICAgICBjb25zdCB0b3RhbFByb2dyZXNzID0gcHJvZ3Jlc3NBbGwgKiAxMDAgLyBwcm9ncmVzc01heFxuXG4gICAgICB0aGlzLnNldFN0YXRlKHtcbiAgICAgICAgdG90YWxQcm9ncmVzczogdG90YWxQcm9ncmVzcyxcbiAgICAgICAgZmlsZXM6IHVwZGF0ZWRGaWxlc1xuICAgICAgfSlcbiAgICB9KVxuXG4gICAgLy8gYHVwbG9hZC1zdWNjZXNzYCBhZGRzIHN1Y2Nlc3NmdWxseSB1cGxvYWRlZCBmaWxlIHRvIGBzdGF0ZS51cGxvYWRlZEZpbGVzYFxuICAgIC8vIGFuZCBmaXJlcyBgcmVtb3ZlLWZpbGVgIHRvIHJlbW92ZSBpdCBmcm9tIGBzdGF0ZS5maWxlc2BcbiAgICB0aGlzLmVtaXR0ZXIub24oJ3VwbG9hZC1zdWNjZXNzJywgKGZpbGUpID0+IHtcbiAgICAgIGNvbnN0IHVwZGF0ZWRGaWxlcyA9IE9iamVjdC5hc3NpZ24oe30sIHRoaXMuc3RhdGUuZmlsZXMpXG4gICAgICB1cGRhdGVkRmlsZXNbZmlsZS5pZF0gPSBmaWxlXG4gICAgICB0aGlzLnNldFN0YXRlKHtmaWxlczogdXBkYXRlZEZpbGVzfSlcbiAgICAgIC8vIHRoaXMubG9nKHRoaXMuc3RhdGUudXBsb2FkZWRGaWxlcylcbiAgICAgIC8vIHRoaXMuZW1pdHRlci5lbWl0KCdmaWxlLXJlbW92ZScsIGZpbGUuaWQpXG4gICAgfSlcbiAgfVxuXG4vKipcbiAqIFJlZ2lzdGVycyBhIHBsdWdpbiB3aXRoIENvcmVcbiAqXG4gKiBAcGFyYW0ge0NsYXNzfSBQbHVnaW4gb2JqZWN0XG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucyBvYmplY3QgdGhhdCB3aWxsIGJlIHBhc3NlZCB0byBQbHVnaW4gbGF0ZXJcbiAqIEByZXR1cm4ge09iamVjdH0gc2VsZiBmb3IgY2hhaW5pbmdcbiAqL1xuICB1c2UgKFBsdWdpbiwgb3B0cykge1xuICAgIC8vIEluc3RhbnRpYXRlXG4gICAgY29uc3QgcGx1Z2luID0gbmV3IFBsdWdpbih0aGlzLCBvcHRzKVxuICAgIGNvbnN0IHBsdWdpbk5hbWUgPSBwbHVnaW4uaWRcbiAgICB0aGlzLnBsdWdpbnNbcGx1Z2luLnR5cGVdID0gdGhpcy5wbHVnaW5zW3BsdWdpbi50eXBlXSB8fCBbXVxuXG4gICAgaWYgKCFwbHVnaW5OYW1lKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1lvdXIgcGx1Z2luIG11c3QgaGF2ZSBhIG5hbWUnKVxuICAgIH1cblxuICAgIGlmICghcGx1Z2luLnR5cGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignWW91ciBwbHVnaW4gbXVzdCBoYXZlIGEgdHlwZScpXG4gICAgfVxuXG4gICAgbGV0IGV4aXN0c1BsdWdpbkFscmVhZHkgPSB0aGlzLmdldFBsdWdpbihwbHVnaW5OYW1lKVxuICAgIGlmIChleGlzdHNQbHVnaW5BbHJlYWR5KSB7XG4gICAgICBsZXQgbXNnID0gYEFscmVhZHkgZm91bmQgYSBwbHVnaW4gbmFtZWQgJyR7ZXhpc3RzUGx1Z2luQWxyZWFkeS5uYW1lfScuXG4gICAgICAgIFRyaWVkIHRvIHVzZTogJyR7cGx1Z2luTmFtZX0nLlxuICAgICAgICBVcHB5IGlzIGN1cnJlbnRseSBsaW1pdGVkIHRvIHJ1bm5pbmcgb25lIG9mIGV2ZXJ5IHBsdWdpbi5cbiAgICAgICAgU2hhcmUgeW91ciB1c2UgY2FzZSB3aXRoIHVzIG92ZXIgYXRcbiAgICAgICAgaHR0cHM6Ly9naXRodWIuY29tL3RyYW5zbG9hZGl0L3VwcHkvaXNzdWVzL1xuICAgICAgICBpZiB5b3Ugd2FudCB1cyB0byByZWNvbnNpZGVyLmBcbiAgICAgIHRocm93IG5ldyBFcnJvcihtc2cpXG4gICAgfVxuXG4gICAgdGhpcy5wbHVnaW5zW3BsdWdpbi50eXBlXS5wdXNoKHBsdWdpbilcblxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuLyoqXG4gKiBGaW5kIG9uZSBQbHVnaW4gYnkgbmFtZVxuICpcbiAqIEBwYXJhbSBzdHJpbmcgbmFtZSBkZXNjcmlwdGlvblxuICovXG4gIGdldFBsdWdpbiAobmFtZSkge1xuICAgIGxldCBmb3VuZFBsdWdpbiA9IGZhbHNlXG4gICAgdGhpcy5pdGVyYXRlUGx1Z2lucygocGx1Z2luKSA9PiB7XG4gICAgICBjb25zdCBwbHVnaW5OYW1lID0gcGx1Z2luLmlkXG4gICAgICBpZiAocGx1Z2luTmFtZSA9PT0gbmFtZSkge1xuICAgICAgICBmb3VuZFBsdWdpbiA9IHBsdWdpblxuICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgIH1cbiAgICB9KVxuICAgIHJldHVybiBmb3VuZFBsdWdpblxuICB9XG5cbi8qKlxuICogSXRlcmF0ZSB0aHJvdWdoIGFsbCBgdXNlYGQgcGx1Z2luc1xuICpcbiAqIEBwYXJhbSBmdW5jdGlvbiBtZXRob2QgZGVzY3JpcHRpb25cbiAqL1xuICBpdGVyYXRlUGx1Z2lucyAobWV0aG9kKSB7XG4gICAgT2JqZWN0LmtleXModGhpcy5wbHVnaW5zKS5mb3JFYWNoKChwbHVnaW5UeXBlKSA9PiB7XG4gICAgICB0aGlzLnBsdWdpbnNbcGx1Z2luVHlwZV0uZm9yRWFjaChtZXRob2QpXG4gICAgfSlcbiAgfVxuXG4vKipcbiAqIExvZ3Mgc3R1ZmYgdG8gY29uc29sZSwgb25seSBpZiBgZGVidWdgIGlzIHNldCB0byB0cnVlLiBTaWxlbnQgaW4gcHJvZHVjdGlvbi5cbiAqXG4gKiBAcmV0dXJuIHtTdHJpbmd8T2JqZWN0fSB0byBsb2dcbiAqL1xuICBsb2cgKG1zZykge1xuICAgIGlmICghdGhpcy5vcHRzLmRlYnVnKSB7XG4gICAgICByZXR1cm5cbiAgICB9XG4gICAgaWYgKG1zZyA9PT0gYCR7bXNnfWApIHtcbiAgICAgIGNvbnNvbGUubG9nKGBMT0c6ICR7bXNnfWApXG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUubG9nKCdMT0fihpMnKVxuICAgICAgY29uc29sZS5kaXIobXNnKVxuICAgIH1cbiAgICBnbG9iYWwudXBweUxvZyA9IGdsb2JhbC51cHB5TG9nICsgJ1xcbicgKyAnREVCVUcgTE9HOiAnICsgbXNnXG4gIH1cblxuLyoqXG4gKiBSdW5zIGFsbCBwbHVnaW5zIG9mIHRoZSBzYW1lIHR5cGUgaW4gcGFyYWxsZWxcbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gdHlwZSB0aGF0IHdhbnRzIHRvIHNldCBwcm9ncmVzc1xuICogQHBhcmFtIHthcnJheX0gZmlsZXNcbiAqIEByZXR1cm4ge1Byb21pc2V9IG9mIGFsbCBtZXRob2RzXG4gKi9cbiAgcnVuVHlwZSAodHlwZSwgbWV0aG9kLCBmaWxlcykge1xuICAgIGNvbnN0IG1ldGhvZHMgPSB0aGlzLnBsdWdpbnNbdHlwZV0ubWFwKFxuICAgICAgKHBsdWdpbikgPT4gcGx1Z2luW21ldGhvZF0oVXRpbHMuZmxhdHRlbihmaWxlcykpXG4gICAgKVxuXG4gICAgcmV0dXJuIFByb21pc2UuYWxsKG1ldGhvZHMpXG4gICAgICAuY2F0Y2goKGVycm9yKSA9PiBjb25zb2xlLmVycm9yKGVycm9yKSlcbiAgfVxuXG4vKipcbiAqIFJ1bnMgYSB3YXRlcmZhbGwgb2YgcnVuVHlwZSBwbHVnaW4gcGFja3MsIGxpa2Ugc286XG4gKiBBbGwgcHJlc2V0ZXJzKGRhdGEpIC0tPiBBbGwgYWNxdWlyZXJzKGRhdGEpIC0tPiBBbGwgdXBsb2FkZXJzKGRhdGEpIC0tPiBkb25lXG4gKi9cbiAgcnVuICgpIHtcbiAgICB0aGlzLmxvZygnQ29yZSBpcyBydW4sIGluaXRpYWxpemluZyBhY3Rpb25zLCBpbnN0YWxsaW5nIHBsdWdpbnMuLi4nKVxuXG4gICAgdGhpcy5hY3Rpb25zKClcblxuICAgIC8vIEZvcnNlIHNldCBgYXV0b1Byb2NlZWRgIG9wdGlvbiB0byBmYWxzZSBpZiB0aGVyZSBhcmUgbXVsdGlwbGUgc2VsZWN0b3IgUGx1Z2lucyBhY3RpdmVcbiAgICBpZiAodGhpcy5wbHVnaW5zLmFjcXVpcmVyICYmIHRoaXMucGx1Z2lucy5hY3F1aXJlci5sZW5ndGggPiAxKSB7XG4gICAgICB0aGlzLm9wdHMuYXV0b1Byb2NlZWQgPSBmYWxzZVxuICAgIH1cblxuICAgIC8vIEluc3RhbGwgYWxsIHBsdWdpbnNcbiAgICBPYmplY3Qua2V5cyh0aGlzLnBsdWdpbnMpLmZvckVhY2goKHBsdWdpblR5cGUpID0+IHtcbiAgICAgIHRoaXMucGx1Z2luc1twbHVnaW5UeXBlXS5mb3JFYWNoKChwbHVnaW4pID0+IHtcbiAgICAgICAgcGx1Z2luLmluc3RhbGwoKVxuICAgICAgfSlcbiAgICB9KVxuXG4gICAgcmV0dXJuXG5cbiAgICAvLyBFYWNoIFBsdWdpbiBjYW4gaGF2ZSBgcnVuYCBhbmQvb3IgYGluc3RhbGxgIG1ldGhvZHMuXG4gICAgLy8gYGluc3RhbGxgIGFkZHMgZXZlbnQgbGlzdGVuZXJzIGFuZCBkb2VzIHNvbWUgbm9uLWJsb2NraW5nIHdvcmssIHVzZWZ1bCBmb3IgYHByb2dyZXNzaW5kaWNhdG9yYCxcbiAgICAvLyBgcnVuYCB3YWl0cyBmb3IgdGhlIHByZXZpb3VzIHN0ZXAgdG8gZmluaXNoICh1c2VyIHNlbGVjdHMgZmlsZXMpIGJlZm9yZSBwcm9jZWVkaW5nXG4gICAgLy8gWydpbnN0YWxsJywgJ3J1biddLmZvckVhY2goKG1ldGhvZCkgPT4ge1xuICAgIC8vICAgLy8gRmlyc3Qgd2Ugc2VsZWN0IG9ubHkgcGx1Z2lucyBvZiBjdXJyZW50IHR5cGUsXG4gICAgLy8gICAvLyB0aGVuIGNyZWF0ZSBhbiBhcnJheSBvZiBydW5UeXBlIG1ldGhvZHMgb2YgdGhpcyBwbHVnaW5zXG4gICAgLy8gICBjb25zdCB0eXBlTWV0aG9kcyA9IHRoaXMudHlwZXMuZmlsdGVyKCh0eXBlKSA9PiB0aGlzLnBsdWdpbnNbdHlwZV0pXG4gICAgLy8gICAgIC5tYXAoKHR5cGUpID0+IHRoaXMucnVuVHlwZS5iaW5kKHRoaXMsIHR5cGUsIG1ldGhvZCkpXG4gICAgLy8gICAvLyBSdW4gd2F0ZXJmYWxsIG9mIHR5cGVNZXRob2RzXG4gICAgLy8gICByZXR1cm4gVXRpbHMucHJvbWlzZVdhdGVyZmFsbCh0eXBlTWV0aG9kcylcbiAgICAvLyAgICAgLnRoZW4oKHJlc3VsdCkgPT4ge1xuICAgIC8vICAgICAgIC8vIElmIHJlc3VsdHMgYXJlIGVtcHR5LCBkb24ndCBsb2cgdXBsb2FkIHJlc3VsdHMuIEhhc24ndCBydW4geWV0LlxuICAgIC8vICAgICAgIGlmIChyZXN1bHRbMF0gIT09IHVuZGVmaW5lZCkge1xuICAgIC8vICAgICAgICAgdGhpcy5sb2cocmVzdWx0KVxuICAgIC8vICAgICAgICAgdGhpcy5sb2coJ1VwbG9hZCByZXN1bHQgLT4gc3VjY2VzcyEnKVxuICAgIC8vICAgICAgICAgcmV0dXJuIHJlc3VsdFxuICAgIC8vICAgICAgIH1cbiAgICAvLyAgICAgfSlcbiAgICAvLyAgICAgLmNhdGNoKChlcnJvcikgPT4gdGhpcy5sb2coJ1VwbG9hZCByZXN1bHQgLT4gZmFpbGVkOicsIGVycm9yKSlcbiAgICAvLyB9KVxuICB9XG5cbiAgaW5pdFNvY2tldCAob3B0cykge1xuICAgIGlmICghdGhpcy5zb2NrZXQpIHtcbiAgICAgIHRoaXMuc29ja2V0ID0gbmV3IFVwcHlTb2NrZXQob3B0cylcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5zb2NrZXRcbiAgfVxufVxuIiwiLyoqXG4gKiBUcmFuc2xhdGVzIHN0cmluZ3Mgd2l0aCBpbnRlcnBvbGF0aW9uICYgcGx1cmFsaXphdGlvbiBzdXBwb3J0LkV4dGVuc2libGUgd2l0aCBjdXN0b20gZGljdGlvbmFyaWVzXG4gKiBhbmQgcGx1cmFsaXphdGlvbiBmdW5jdGlvbnMuXG4gKlxuICogQm9ycm93cyBoZWF2aWx5IGZyb20gYW5kIGluc3BpcmVkIGJ5IFBvbHlnbG90IGh0dHBzOi8vZ2l0aHViLmNvbS9haXJibmIvcG9seWdsb3QuanMsXG4gKiBiYXNpY2FsbHkgYSBzdHJpcHBlZC1kb3duIHZlcnNpb24gb2YgaXQuIERpZmZlcmVuY2VzOiBwbHVyYWxpemF0aW9uIGZ1bmN0aW9ucyBhcmUgbm90IGhhcmRjb2RlZFxuICogYW5kIGNhbiBiZSBlYXNpbHkgYWRkZWQgYW1vbmcgd2l0aCBkaWN0aW9uYXJpZXMsIG5lc3RlZCBvYmplY3RzIGFyZSB1c2VkIGZvciBwbHVyYWxpemF0aW9uXG4gKiBhcyBvcHBvc2VkIHRvIGB8fHx8YCBkZWxpbWV0ZXJcbiAqXG4gKiBVc2FnZSBleGFtcGxlOiBgdHJhbnNsYXRvci50cmFuc2xhdGUoJ2ZpbGVzX2Nob3NlbicsIHtzbWFydF9jb3VudDogM30pYFxuICpcbiAqIEBwYXJhbSB7b2JqZWN0fSBvcHRzXG4gKi9cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFRyYW5zbGF0b3Ige1xuICBjb25zdHJ1Y3RvciAob3B0cykge1xuICAgIGNvbnN0IGRlZmF1bHRPcHRpb25zID0ge31cbiAgICB0aGlzLm9wdHMgPSBPYmplY3QuYXNzaWduKHt9LCBkZWZhdWx0T3B0aW9ucywgb3B0cylcbiAgfVxuXG4vKipcbiAqIFRha2VzIGEgc3RyaW5nIHdpdGggcGxhY2Vob2xkZXIgdmFyaWFibGVzIGxpa2UgYCV7c21hcnRfY291bnR9IGZpbGUgc2VsZWN0ZWRgXG4gKiBhbmQgcmVwbGFjZXMgaXQgd2l0aCB2YWx1ZXMgZnJvbSBvcHRpb25zIGB7c21hcnRfY291bnQ6IDV9YFxuICpcbiAqIEBsaWNlbnNlIGh0dHBzOi8vZ2l0aHViLmNvbS9haXJibmIvcG9seWdsb3QuanMvYmxvYi9tYXN0ZXIvTElDRU5TRVxuICogdGFrZW4gZnJvbSBodHRwczovL2dpdGh1Yi5jb20vYWlyYm5iL3BvbHlnbG90LmpzL2Jsb2IvbWFzdGVyL2xpYi9wb2x5Z2xvdC5qcyNMMjk5XG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IHBocmFzZSB0aGF0IG5lZWRzIGludGVycG9sYXRpb24sIHdpdGggcGxhY2Vob2xkZXJzXG4gKiBAcGFyYW0ge29iamVjdH0gb3B0aW9ucyB3aXRoIHZhbHVlcyB0aGF0IHdpbGwgYmUgdXNlZCB0byByZXBsYWNlIHBsYWNlaG9sZGVyc1xuICogQHJldHVybiB7c3RyaW5nfSBpbnRlcnBvbGF0ZWRcbiAqL1xuICBpbnRlcnBvbGF0ZSAocGhyYXNlLCBvcHRpb25zKSB7XG4gICAgY29uc3QgcmVwbGFjZSA9IFN0cmluZy5wcm90b3R5cGUucmVwbGFjZVxuICAgIGNvbnN0IGRvbGxhclJlZ2V4ID0gL1xcJC9nXG4gICAgY29uc3QgZG9sbGFyQmlsbHNZYWxsID0gJyQkJCQnXG5cbiAgICBmb3IgKGxldCBhcmcgaW4gb3B0aW9ucykge1xuICAgICAgaWYgKGFyZyAhPT0gJ18nICYmIG9wdGlvbnMuaGFzT3duUHJvcGVydHkoYXJnKSkge1xuICAgICAgICAvLyBFbnN1cmUgcmVwbGFjZW1lbnQgdmFsdWUgaXMgZXNjYXBlZCB0byBwcmV2ZW50IHNwZWNpYWwgJC1wcmVmaXhlZFxuICAgICAgICAvLyByZWdleCByZXBsYWNlIHRva2Vucy4gdGhlIFwiJCQkJFwiIGlzIG5lZWRlZCBiZWNhdXNlIGVhY2ggXCIkXCIgbmVlZHMgdG9cbiAgICAgICAgLy8gYmUgZXNjYXBlZCB3aXRoIFwiJFwiIGl0c2VsZiwgYW5kIHdlIG5lZWQgdHdvIGluIHRoZSByZXN1bHRpbmcgb3V0cHV0LlxuICAgICAgICB2YXIgcmVwbGFjZW1lbnQgPSBvcHRpb25zW2FyZ11cbiAgICAgICAgaWYgKHR5cGVvZiByZXBsYWNlbWVudCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICByZXBsYWNlbWVudCA9IHJlcGxhY2UuY2FsbChvcHRpb25zW2FyZ10sIGRvbGxhclJlZ2V4LCBkb2xsYXJCaWxsc1lhbGwpXG4gICAgICAgIH1cbiAgICAgICAgLy8gV2UgY3JlYXRlIGEgbmV3IGBSZWdFeHBgIGVhY2ggdGltZSBpbnN0ZWFkIG9mIHVzaW5nIGEgbW9yZS1lZmZpY2llbnRcbiAgICAgICAgLy8gc3RyaW5nIHJlcGxhY2Ugc28gdGhhdCB0aGUgc2FtZSBhcmd1bWVudCBjYW4gYmUgcmVwbGFjZWQgbXVsdGlwbGUgdGltZXNcbiAgICAgICAgLy8gaW4gdGhlIHNhbWUgcGhyYXNlLlxuICAgICAgICBwaHJhc2UgPSByZXBsYWNlLmNhbGwocGhyYXNlLCBuZXcgUmVnRXhwKCclXFxcXHsnICsgYXJnICsgJ1xcXFx9JywgJ2cnKSwgcmVwbGFjZW1lbnQpXG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBwaHJhc2VcbiAgfVxuXG4vKipcbiAqIFB1YmxpYyB0cmFuc2xhdGUgbWV0aG9kXG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IGtleVxuICogQHBhcmFtIHtvYmplY3R9IG9wdGlvbnMgd2l0aCB2YWx1ZXMgdGhhdCB3aWxsIGJlIHVzZWQgbGF0ZXIgdG8gcmVwbGFjZSBwbGFjZWhvbGRlcnMgaW4gc3RyaW5nXG4gKiBAcmV0dXJuIHtzdHJpbmd9IHRyYW5zbGF0ZWQgKGFuZCBpbnRlcnBvbGF0ZWQpXG4gKi9cbiAgdHJhbnNsYXRlIChrZXksIG9wdGlvbnMpIHtcbiAgICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLnNtYXJ0X2NvdW50KSB7XG4gICAgICB2YXIgcGx1cmFsID0gdGhpcy5vcHRzLmxvY2FsZXMucGx1cmFsaXplKG9wdGlvbnMuc21hcnRfY291bnQpXG4gICAgICByZXR1cm4gdGhpcy5pbnRlcnBvbGF0ZSh0aGlzLm9wdHMubG9jYWxlcy5zdHJpbmdzW2tleV1bcGx1cmFsXSwgb3B0aW9ucylcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5pbnRlcnBvbGF0ZSh0aGlzLm9wdHMubG9jYWxlcy5zdHJpbmdzW2tleV0sIG9wdGlvbnMpXG4gIH1cbn1cbiIsImltcG9ydCBlZSBmcm9tICdldmVudHMnXG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFVwcHlTb2NrZXQge1xuICBjb25zdHJ1Y3RvciAob3B0cykge1xuICAgIHRoaXMucXVldWVkID0gW11cbiAgICB0aGlzLmlzT3BlbiA9IGZhbHNlXG4gICAgdGhpcy5zb2NrZXQgPSBuZXcgV2ViU29ja2V0KG9wdHMudGFyZ2V0KVxuICAgIHRoaXMuZW1pdHRlciA9IG5ldyBlZS5FdmVudEVtaXR0ZXIoKVxuXG4gICAgdGhpcy5zb2NrZXQub25vcGVuID0gKGUpID0+IHtcbiAgICAgIHRoaXMuaXNPcGVuID0gdHJ1ZVxuXG4gICAgICB3aGlsZSAodGhpcy5xdWV1ZWQubGVuZ3RoID4gMCAmJiB0aGlzLmlzT3Blbikge1xuICAgICAgICBjb25zdCBmaXJzdCA9IHRoaXMucXVldWVkWzBdXG4gICAgICAgIHRoaXMuc2VuZChmaXJzdC5hY3Rpb24sIGZpcnN0LnBheWxvYWQpXG4gICAgICAgIHRoaXMucXVldWVkID0gdGhpcy5xdWV1ZWQuc2xpY2UoMSlcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLnNvY2tldC5vbmNsb3NlID0gKGUpID0+IHtcbiAgICAgIHRoaXMuaXNPcGVuID0gZmFsc2VcbiAgICB9XG5cbiAgICB0aGlzLl9oYW5kbGVNZXNzYWdlID0gdGhpcy5faGFuZGxlTWVzc2FnZS5iaW5kKHRoaXMpXG5cbiAgICB0aGlzLnNvY2tldC5vbm1lc3NhZ2UgPSB0aGlzLl9oYW5kbGVNZXNzYWdlXG5cbiAgICB0aGlzLmVtaXQgPSB0aGlzLmVtaXQuYmluZCh0aGlzKVxuICAgIHRoaXMub24gPSB0aGlzLm9uLmJpbmQodGhpcylcbiAgICB0aGlzLm9uY2UgPSB0aGlzLm9uY2UuYmluZCh0aGlzKVxuICAgIHRoaXMuc2VuZCA9IHRoaXMuc2VuZC5iaW5kKHRoaXMpXG4gIH1cblxuICBzZW5kIChhY3Rpb24sIHBheWxvYWQpIHtcbiAgICAvLyBhdHRhY2ggdXVpZFxuXG4gICAgaWYgKCF0aGlzLmlzT3Blbikge1xuICAgICAgdGhpcy5xdWV1ZWQucHVzaCh7YWN0aW9uLCBwYXlsb2FkfSlcbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIHRoaXMuc29ja2V0LnNlbmQoSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgYWN0aW9uLFxuICAgICAgcGF5bG9hZFxuICAgIH0pKVxuICB9XG5cbiAgb24gKGFjdGlvbiwgaGFuZGxlcikge1xuICAgIHRoaXMuZW1pdHRlci5vbihhY3Rpb24sIGhhbmRsZXIpXG4gIH1cblxuICBlbWl0IChhY3Rpb24sIHBheWxvYWQpIHtcbiAgICB0aGlzLmVtaXR0ZXIuZW1pdChhY3Rpb24sIHBheWxvYWQpXG4gIH1cblxuICBvbmNlIChhY3Rpb24sIGhhbmRsZXIpIHtcbiAgICB0aGlzLmVtaXR0ZXIub25jZShhY3Rpb24sIGhhbmRsZXIpXG4gIH1cblxuICBfaGFuZGxlTWVzc2FnZSAoZSkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBtZXNzYWdlID0gSlNPTi5wYXJzZShlLmRhdGEpXG4gICAgICB0aGlzLmVtaXQobWVzc2FnZS5hY3Rpb24sIG1lc3NhZ2UucGF5bG9hZClcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGNvbnNvbGUubG9nKGVycilcbiAgICB9XG4gIH1cbn1cbiIsIi8qKlxuICogQSBjb2xsZWN0aW9uIG9mIHNtYWxsIHV0aWxpdHkgZnVuY3Rpb25zIHRoYXQgaGVscCB3aXRoIGRvbSBtYW5pcHVsYXRpb24sIGFkZGluZyBsaXN0ZW5lcnMsXG4gKiBwcm9taXNlcyBhbmQgb3RoZXIgZ29vZCB0aGluZ3MuXG4gKlxuICogQG1vZHVsZSBVdGlsc1xuICovXG5cbi8qKlxuICogUnVucyBhIHdhdGVyZmFsbCBvZiBwcm9taXNlczogY2FsbHMgZWFjaCB0YXNrLCBwYXNzaW5nIHRoZSByZXN1bHRcbiAqIGZyb20gdGhlIHByZXZpb3VzIG9uZSBhcyBhbiBhcmd1bWVudC4gVGhlIGZpcnN0IHRhc2sgaXMgcnVuIHdpdGggYW4gZW1wdHkgYXJyYXkuXG4gKlxuICogQG1lbWJlcm9mIFV0aWxzXG4gKiBAcGFyYW0ge2FycmF5fSBtZXRob2RzIG9mIFByb21pc2VzIHRvIHJ1biB3YXRlcmZhbGwgb25cbiAqIEByZXR1cm4ge1Byb21pc2V9IG9mIHRoZSBmaW5hbCB0YXNrXG4gKi9cbmZ1bmN0aW9uIHByb21pc2VXYXRlcmZhbGwgKG1ldGhvZHMpIHtcbiAgY29uc3QgW3Jlc29sdmVkUHJvbWlzZSwgLi4udGFza3NdID0gbWV0aG9kc1xuICBjb25zdCBmaW5hbFRhc2tQcm9taXNlID0gdGFza3MucmVkdWNlKChwcmV2VGFza1Byb21pc2UsIHRhc2spID0+IHtcbiAgICByZXR1cm4gcHJldlRhc2tQcm9taXNlLnRoZW4odGFzaylcbiAgfSwgcmVzb2x2ZWRQcm9taXNlKFtdKSkgLy8gaW5pdGlhbCB2YWx1ZVxuXG4gIHJldHVybiBmaW5hbFRhc2tQcm9taXNlXG59XG5cbi8qKlxuICogU2hhbGxvdyBmbGF0dGVuIG5lc3RlZCBhcnJheXMuXG4gKi9cbmZ1bmN0aW9uIGZsYXR0ZW4gKGFycikge1xuICByZXR1cm4gW10uY29uY2F0LmFwcGx5KFtdLCBhcnIpXG59XG5cbi8qKlxuICogYHF1ZXJ5U2VsZWN0b3JBbGxgIHRoYXQgcmV0dXJucyBhIG5vcm1hbCBhcnJheSBpbnN0ZWFkIG9mIGZpbGVMaXN0XG4gKi9cbmZ1bmN0aW9uIHFzYSAoc2VsZWN0b3IsIGNvbnRleHQpIHtcbiAgcmV0dXJuIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKChjb250ZXh0IHx8IGRvY3VtZW50KS5xdWVyeVNlbGVjdG9yQWxsKHNlbGVjdG9yKSB8fCBbXSlcbn1cblxuLyoqXG4gKiBQYXJ0aXRpb24gYXJyYXkgYnkgYSBncm91cGluZyBmdW5jdGlvbi5cbiAqIEBwYXJhbSAge1t0eXBlXX0gYXJyYXkgICAgICBJbnB1dCBhcnJheVxuICogQHBhcmFtICB7W3R5cGVdfSBncm91cGluZ0ZuIEdyb3VwaW5nIGZ1bmN0aW9uXG4gKiBAcmV0dXJuIHtbdHlwZV19ICAgICAgICAgICAgQXJyYXkgb2YgYXJyYXlzXG4gKi9cbmZ1bmN0aW9uIGdyb3VwQnkgKGFycmF5LCBncm91cGluZ0ZuKSB7XG4gIHJldHVybiBhcnJheS5yZWR1Y2UoKHJlc3VsdCwgaXRlbSkgPT4ge1xuICAgIGxldCBrZXkgPSBncm91cGluZ0ZuKGl0ZW0pXG4gICAgbGV0IHhzID0gcmVzdWx0LmdldChrZXkpIHx8IFtdXG4gICAgeHMucHVzaChpdGVtKVxuICAgIHJlc3VsdC5zZXQoa2V5LCB4cylcbiAgICByZXR1cm4gcmVzdWx0XG4gIH0sIG5ldyBNYXAoKSlcbn1cblxuLyoqXG4gKiBUZXN0cyBpZiBldmVyeSBhcnJheSBlbGVtZW50IHBhc3NlcyBwcmVkaWNhdGVcbiAqIEBwYXJhbSAge0FycmF5fSAgYXJyYXkgICAgICAgSW5wdXQgYXJyYXlcbiAqIEBwYXJhbSAge09iamVjdH0gcHJlZGljYXRlRm4gUHJlZGljYXRlXG4gKiBAcmV0dXJuIHtib29sfSAgICAgICAgICAgICAgIEV2ZXJ5IGVsZW1lbnQgcGFzc1xuICovXG5mdW5jdGlvbiBldmVyeSAoYXJyYXksIHByZWRpY2F0ZUZuKSB7XG4gIHJldHVybiBhcnJheS5yZWR1Y2UoKHJlc3VsdCwgaXRlbSkgPT4ge1xuICAgIGlmICghcmVzdWx0KSB7XG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9XG5cbiAgICByZXR1cm4gcHJlZGljYXRlRm4oaXRlbSlcbiAgfSwgdHJ1ZSlcbn1cblxuLyoqXG4gKiBDb252ZXJ0cyBsaXN0IGludG8gYXJyYXlcbiovXG5mdW5jdGlvbiB0b0FycmF5IChsaXN0KSB7XG4gIHJldHVybiBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChsaXN0IHx8IFtdLCAwKVxufVxuXG4vKipcbiAqIFRha2VzIGEgZmlsZU5hbWUgYW5kIHR1cm5zIGl0IGludG8gZmlsZUlELCBieSBjb252ZXJ0aW5nIHRvIGxvd2VyY2FzZSxcbiAqIHJlbW92aW5nIGV4dHJhIGNoYXJhY3RlcnMgYW5kIGFkZGluZyB1bml4IHRpbWVzdGFtcFxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBmaWxlTmFtZVxuICpcbiAqL1xuZnVuY3Rpb24gZ2VuZXJhdGVGaWxlSUQgKGZpbGVOYW1lKSB7XG4gIGxldCBmaWxlSUQgPSBmaWxlTmFtZS50b0xvd2VyQ2FzZSgpXG4gIGZpbGVJRCA9IGZpbGVJRC5yZXBsYWNlKC9bXkEtWjAtOV0vaWcsICcnKVxuICBmaWxlSUQgPSBmaWxlSUQgKyBEYXRlLm5vdygpXG4gIHJldHVybiBmaWxlSURcbn1cblxuZnVuY3Rpb24gZXh0ZW5kICguLi5vYmpzKSB7XG4gIHJldHVybiBPYmplY3QuYXNzaWduLmFwcGx5KHRoaXMsIFt7fV0uY29uY2F0KG9ianMpKVxufVxuXG4vKipcbiAqIFRha2VzIGZ1bmN0aW9uIG9yIGNsYXNzLCByZXR1cm5zIGl0cyBuYW1lLlxuICogQmVjYXVzZSBJRSBkb2VzbuKAmXQgc3VwcG9ydCBgY29uc3RydWN0b3IubmFtZWAuXG4gKiBodHRwczovL2dpc3QuZ2l0aHViLmNvbS9kZmtheWUvNjM4NDQzOSwgaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMTU3MTQ0NDVcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gZm4g4oCUIGZ1bmN0aW9uXG4gKlxuICovXG5mdW5jdGlvbiBnZXRGbk5hbWUgKGZuKSB7XG4gIHZhciBmID0gdHlwZW9mIGZuID09PSAnZnVuY3Rpb24nXG4gIHZhciBzID0gZiAmJiAoKGZuLm5hbWUgJiYgWycnLCBmbi5uYW1lXSkgfHwgZm4udG9TdHJpbmcoKS5tYXRjaCgvZnVuY3Rpb24gKFteXFwoXSspLykpXG4gIHJldHVybiAoIWYgJiYgJ25vdCBhIGZ1bmN0aW9uJykgfHwgKHMgJiYgc1sxXSB8fCAnYW5vbnltb3VzJylcbn1cblxuZXhwb3J0IGRlZmF1bHQge1xuICBwcm9taXNlV2F0ZXJmYWxsLFxuICBnZW5lcmF0ZUZpbGVJRCxcbiAgZ2V0Rm5OYW1lLFxuICB0b0FycmF5LFxuICBldmVyeSxcbiAgZmxhdHRlbixcbiAgZ3JvdXBCeSxcbiAgcXNhLFxuICBleHRlbmRcbn1cbiIsImNvbnN0IGVuX1VTID0ge31cblxuZW5fVVMuc3RyaW5ncyA9IHtcbiAgY2hvb3NlRmlsZTogJ0Nob29zZSBhIGZpbGUnLFxuICB5b3VIYXZlQ2hvc2VuOiAnWW91IGhhdmUgY2hvc2VuOiAle2ZpbGVOYW1lfScsXG4gIG9yRHJhZ0Ryb3A6ICdvciBkcmFnIGl0IGhlcmUnLFxuICBmaWxlc0Nob3Nlbjoge1xuICAgIDA6ICcle3NtYXJ0X2NvdW50fSBmaWxlIHNlbGVjdGVkJyxcbiAgICAxOiAnJXtzbWFydF9jb3VudH0gZmlsZXMgc2VsZWN0ZWQnXG4gIH0sXG4gIGZpbGVzVXBsb2FkZWQ6IHtcbiAgICAwOiAnJXtzbWFydF9jb3VudH0gZmlsZSB1cGxvYWRlZCcsXG4gICAgMTogJyV7c21hcnRfY291bnR9IGZpbGVzIHVwbG9hZGVkJ1xuICB9LFxuICBmaWxlczoge1xuICAgIDA6ICcle3NtYXJ0X2NvdW50fSBmaWxlJyxcbiAgICAxOiAnJXtzbWFydF9jb3VudH0gZmlsZXMnXG4gIH0sXG4gIHVwbG9hZEZpbGVzOiB7XG4gICAgMDogJ1VwbG9hZCAle3NtYXJ0X2NvdW50fSBmaWxlJyxcbiAgICAxOiAnVXBsb2FkICV7c21hcnRfY291bnR9IGZpbGVzJ1xuICB9LFxuICBzZWxlY3RUb1VwbG9hZDogJ1NlbGVjdCBmaWxlcyB0byB1cGxvYWQnLFxuICBjbG9zZU1vZGFsOiAnQ2xvc2UgTW9kYWwnLFxuICB1cGxvYWQ6ICdVcGxvYWQnXG59XG5cbmVuX1VTLnBsdXJhbGl6ZSA9IGZ1bmN0aW9uIChuKSB7XG4gIGlmIChuID09PSAxKSB7XG4gICAgcmV0dXJuIDBcbiAgfVxuICByZXR1cm4gMVxufVxuXG5pZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIHdpbmRvdy5VcHB5ICE9PSAndW5kZWZpbmVkJykge1xuICB3aW5kb3cuVXBweS5sb2NhbGVzLmVuX1VTID0gZW5fVVNcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBlbl9VU1xuIiwiY29uc3QgcnVfUlUgPSB7fVxuXG5ydV9SVS5zdHJpbmdzID0ge1xuICBjaG9vc2VGaWxlOiAn0JLRi9Cx0LXRgNC40YLQtSDRhNCw0LnQuycsXG4gIG9yRHJhZ0Ryb3A6ICfQuNC70Lgg0L/QtdGA0LXQvdC10YHQuNGC0LUg0LXQs9C+wqDRgdGO0LTQsCcsXG4gIHlvdUhhdmVDaG9zZW46ICfQktGLINCy0YvQsdGA0LDQu9C4OiAle2ZpbGVfbmFtZX0nLFxuICBmaWxlc0Nob3Nlbjoge1xuICAgIDA6ICfQktGL0LHRgNCw0L0gJXtzbWFydF9jb3VudH0g0YTQsNC50LsnLFxuICAgIDE6ICfQktGL0LHRgNCw0L3QviAle3NtYXJ0X2NvdW50fSDRhNCw0LnQu9CwJyxcbiAgICAyOiAn0JLRi9Cx0YDQsNC90L4gJXtzbWFydF9jb3VudH0g0YTQsNC50LvQvtCyJ1xuICB9LFxuICB1cGxvYWQ6ICfQl9Cw0LPRgNGD0LfQuNGC0YwnXG59XG5cbnJ1X1JVLnBsdXJhbGl6ZSA9IGZ1bmN0aW9uIChuKSB7XG4gIGlmIChuICUgMTAgPT09IDEgJiYgbiAlIDEwMCAhPT0gMTEpIHtcbiAgICByZXR1cm4gMFxuICB9XG5cbiAgaWYgKG4gJSAxMCA+PSAyICYmIG4gJSAxMCA8PSA0ICYmIChuICUgMTAwIDwgMTAgfHwgbiAlIDEwMCA+PSAyMCkpIHtcbiAgICByZXR1cm4gMVxuICB9XG5cbiAgcmV0dXJuIDJcbn1cblxuaWYgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiB3aW5kb3cuVXBweSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgd2luZG93LlVwcHkubG9jYWxlcy5ydV9SVSA9IHJ1X1JVXG59XG5cbm1vZHVsZS5leHBvcnRzID0gcnVfUlVcbiIsImltcG9ydCBQbHVnaW4gZnJvbSAnLi9QbHVnaW4nXG5pbXBvcnQgVXRpbHMgZnJvbSAnLi4vY29yZS9VdGlscydcbmltcG9ydCBkcmFnRHJvcCBmcm9tICdkcmFnLWRyb3AnXG5pbXBvcnQgeW8gZnJvbSAneW8teW8nXG5cbi8qKlxuICogRHJhZyAmIERyb3AgcGx1Z2luXG4gKlxuICovXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBEcmFnRHJvcCBleHRlbmRzIFBsdWdpbiB7XG4gIGNvbnN0cnVjdG9yIChjb3JlLCBvcHRzKSB7XG4gICAgc3VwZXIoY29yZSwgb3B0cylcbiAgICB0aGlzLnR5cGUgPSAnYWNxdWlyZXInXG4gICAgdGhpcy5pZCA9ICdEcmFnRHJvcCdcbiAgICB0aGlzLnRpdGxlID0gJ0RyYWcgJiBEcm9wJ1xuICAgIHRoaXMuaWNvbiA9IHlvYFxuICAgICAgPHN2ZyBjbGFzcz1cIlVwcHlNb2RhbFRhYi1pY29uXCIgd2lkdGg9XCIyOFwiIGhlaWdodD1cIjI4XCIgdmlld0JveD1cIjAgMCAxNiAxNlwiPlxuICAgICAgICA8cGF0aCBkPVwiTTE1Ljk4MiAyLjk3YzAtLjAyIDAtLjAyLS4wMTgtLjAzNyAwLS4wMTctLjAxNy0uMDM1LS4wMzUtLjA1MyAwIDAgMC0uMDE4LS4wMi0uMDE4LS4wMTctLjAxOC0uMDM0LS4wNTMtLjA1Mi0uMDdMMTMuMTkuMTIzYy0uMDE3LS4wMTctLjAzNC0uMDM1LS4wNy0uMDUzaC0uMDE4Yy0uMDE4LS4wMTctLjAzNS0uMDE3LS4wNTMtLjAzNGgtLjAyYy0uMDE3IDAtLjAzNC0uMDE4LS4wNTItLjAxOGgtNi4zMWEuNDE1LjQxNSAwIDAgMC0uNDQ2LjQyNlYxMS4xMWMwIC4yNS4xOTYuNDQ2LjQ0NS40NDZoOC44OUEuNDQuNDQgMCAwIDAgMTYgMTEuMTFWMy4wMjNjLS4wMTgtLjAxOC0uMDE4LS4wMzUtLjAxOC0uMDUzem0tMi42NS0xLjQ2bDEuMTU3IDEuMTU3aC0xLjE1N1YxLjUxem0xLjc4IDkuMTU3aC04Vi44OWg1LjMzMnYyLjIyYzAgLjI1LjE5Ni40NDYuNDQ1LjQ0NmgyLjIydjcuMTF6XCIvPlxuICAgICAgICA8cGF0aCBkPVwiTTkuNzc4IDEyLjg5SDRWMi42NjZhLjQ0LjQ0IDAgMCAwLS40NDQtLjQ0NS40NC40NCAwIDAgMC0uNDQ1LjQ0NXYxMC42NjZjMCAuMjUuMTk3LjQ0NS40NDYuNDQ1aDYuMjIyYS40NC40NCAwIDAgMCAuNDQ0LS40NDUuNDQuNDQgMCAwIDAtLjQ0NC0uNDQ0elwiLz5cbiAgICAgICAgPHBhdGggZD1cIk0uNDQ0IDE2aDYuMjIzYS40NC40NCAwIDAgMCAuNDQ0LS40NDQuNDQuNDQgMCAwIDAtLjQ0My0uNDQ1SC44OVY0Ljg5YS40NC40NCAwIDAgMC0uNDQ2LS40NDZBLjQ0LjQ0IDAgMCAwIDAgNC44OXYxMC42NjZjMCAuMjQ4LjE5Ni40NDQuNDQ0LjQ0NHpcIi8+XG4gICAgICA8L3N2Zz5cbiAgICBgXG5cbiAgICAvLyBEZWZhdWx0IG9wdGlvbnNcbiAgICBjb25zdCBkZWZhdWx0T3B0aW9ucyA9IHtcbiAgICAgIHRhcmdldDogJy5VcHB5RHJhZ0Ryb3AnXG4gICAgfVxuXG4gICAgLy8gTWVyZ2UgZGVmYXVsdCBvcHRpb25zIHdpdGggdGhlIG9uZXMgc2V0IGJ5IHVzZXJcbiAgICB0aGlzLm9wdHMgPSBPYmplY3QuYXNzaWduKHt9LCBkZWZhdWx0T3B0aW9ucywgb3B0cylcblxuICAgIC8vIENoZWNrIGZvciBicm93c2VyIGRyYWdEcm9wIHN1cHBvcnRcbiAgICB0aGlzLmlzRHJhZ0Ryb3BTdXBwb3J0ZWQgPSB0aGlzLmNoZWNrRHJhZ0Ryb3BTdXBwb3J0KClcblxuICAgIC8vIEJpbmQgYHRoaXNgIHRvIGNsYXNzIG1ldGhvZHNcbiAgICB0aGlzLmhhbmRsZURyb3AgPSB0aGlzLmhhbmRsZURyb3AuYmluZCh0aGlzKVxuICAgIHRoaXMuY2hlY2tEcmFnRHJvcFN1cHBvcnQgPSB0aGlzLmNoZWNrRHJhZ0Ryb3BTdXBwb3J0LmJpbmQodGhpcylcbiAgICB0aGlzLmhhbmRsZUlucHV0Q2hhbmdlID0gdGhpcy5oYW5kbGVJbnB1dENoYW5nZS5iaW5kKHRoaXMpXG4gICAgdGhpcy5yZW5kZXIgPSB0aGlzLnJlbmRlci5iaW5kKHRoaXMpXG4gIH1cblxuLyoqXG4gKiBDaGVja3MgaWYgdGhlIGJyb3dzZXIgc3VwcG9ydHMgRHJhZyAmIERyb3AgKG5vdCBzdXBwb3J0ZWQgb24gbW9iaWxlIGRldmljZXMsIGZvciBleGFtcGxlKS5cbiAqIEByZXR1cm4ge0Jvb2xlYW59IHRydWUgaWYgc3VwcG9ydGVkLCBmYWxzZSBvdGhlcndpc2VcbiAqL1xuICBjaGVja0RyYWdEcm9wU3VwcG9ydCAoKSB7XG4gICAgY29uc3QgZGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JylcblxuICAgIGlmICghKCdkcmFnZ2FibGUnIGluIGRpdikgfHwgISgnb25kcmFnc3RhcnQnIGluIGRpdiAmJiAnb25kcm9wJyBpbiBkaXYpKSB7XG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9XG5cbiAgICBpZiAoISgnRm9ybURhdGEnIGluIHdpbmRvdykpIHtcbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cblxuICAgIGlmICghKCdGaWxlUmVhZGVyJyBpbiB3aW5kb3cpKSB7XG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZVxuICB9XG5cbiAgaGFuZGxlRHJvcCAoZmlsZXMpIHtcbiAgICB0aGlzLmNvcmUubG9nKCdBbGwgcmlnaHQsIHNvbWVvbmUgZHJvcHBlZCBzb21ldGhpbmcuLi4nKVxuXG4gICAgLy8gdGhpcy5jb3JlLmVtaXR0ZXIuZW1pdCgnZmlsZS1hZGQnLCB7XG4gICAgLy8gICBwbHVnaW46IHRoaXMsXG4gICAgLy8gICBhY3F1aXJlZEZpbGVzOiBmaWxlc1xuICAgIC8vIH0pXG5cbiAgICBmaWxlcy5mb3JFYWNoKChmaWxlKSA9PiB7XG4gICAgICB0aGlzLmNvcmUuZW1pdHRlci5lbWl0KCdmaWxlLWFkZCcsIHtcbiAgICAgICAgc291cmNlOiB0aGlzLmlkLFxuICAgICAgICBuYW1lOiBmaWxlLm5hbWUsXG4gICAgICAgIHR5cGU6IGZpbGUudHlwZSxcbiAgICAgICAgZGF0YTogZmlsZVxuICAgICAgfSlcbiAgICB9KVxuXG4gICAgdGhpcy5jb3JlLmFkZE1ldGEoe2JsYTogJ2JsYSd9KVxuICB9XG5cbiAgaGFuZGxlSW5wdXRDaGFuZ2UgKGV2KSB7XG4gICAgdGhpcy5jb3JlLmxvZygnQWxsIHJpZ2h0LCBzb21ldGhpbmcgc2VsZWN0ZWQgdGhyb3VnaCBpbnB1dC4uLicpXG5cbiAgICBjb25zdCBmaWxlcyA9IFV0aWxzLnRvQXJyYXkoZXYudGFyZ2V0LmZpbGVzKVxuXG4gICAgZmlsZXMuZm9yRWFjaCgoZmlsZSkgPT4ge1xuICAgICAgY29uc29sZS5sb2coZmlsZSlcbiAgICAgIHRoaXMuY29yZS5lbWl0dGVyLmVtaXQoJ2ZpbGUtYWRkJywge1xuICAgICAgICBzb3VyY2U6IHRoaXMuaWQsXG4gICAgICAgIG5hbWU6IGZpbGUubmFtZSxcbiAgICAgICAgdHlwZTogZmlsZS50eXBlLFxuICAgICAgICBkYXRhOiBmaWxlXG4gICAgICB9KVxuICAgIH0pXG4gIH1cblxuICBmb2N1cyAoKSB7XG4gICAgY29uc3QgZmlyc3RJbnB1dCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoYCR7dGhpcy50YXJnZXR9IC5VcHB5RHJhZ0Ryb3AtZm9jdXNgKVxuXG4gICAgLy8gb25seSB3b3JrcyBmb3IgdGhlIGZpcnN0IHRpbWUgaWYgd3JhcHBlZCBpbiBzZXRUaW1lb3V0IGZvciBzb21lIHJlYXNvblxuICAgIC8vIGZpcnN0SW5wdXQuZm9jdXMoKVxuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgZmlyc3RJbnB1dC5mb2N1cygpXG4gICAgfSwgMTApXG4gIH1cblxuICByZW5kZXIgKHN0YXRlKSB7XG4gICAgLy8gQW5vdGhlciB3YXkgbm90IHRvIHJlbmRlciBuZXh0L3VwbG9hZCBidXR0b24g4oCUIGlmIE1vZGFsIGlzIHVzZWQgYXMgYSB0YXJnZXRcbiAgICBjb25zdCB0YXJnZXQgPSB0aGlzLm9wdHMudGFyZ2V0Lm5hbWVcblxuICAgIGNvbnN0IG9uU2VsZWN0ID0gKGV2KSA9PiB7XG4gICAgICBjb25zdCBpbnB1dCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoYCR7dGhpcy50YXJnZXR9IC5VcHB5RHJhZ0Ryb3AtaW5wdXRgKVxuICAgICAgaW5wdXQuY2xpY2soKVxuICAgIH1cblxuICAgIGNvbnN0IG5leHQgPSAoZXYpID0+IHtcbiAgICAgIGV2LnByZXZlbnREZWZhdWx0KClcbiAgICAgIGV2LnN0b3BQcm9wYWdhdGlvbigpXG4gICAgICB0aGlzLmNvcmUuZW1pdHRlci5lbWl0KCduZXh0JylcbiAgICB9XG5cbiAgICBjb25zdCBvblN1Ym1pdCA9IChldikgPT4ge1xuICAgICAgZXYucHJldmVudERlZmF1bHQoKVxuICAgIH1cblxuICAgIHJldHVybiB5b2BcbiAgICAgIDxkaXYgY2xhc3M9XCJVcHB5RHJhZ0Ryb3AtY29udGFpbmVyICR7dGhpcy5pc0RyYWdEcm9wU3VwcG9ydGVkID8gJ2lzLWRyYWdkcm9wLXN1cHBvcnRlZCcgOiAnJ31cIj5cbiAgICAgICAgPGZvcm0gY2xhc3M9XCJVcHB5RHJhZ0Ryb3AtaW5uZXJcIlxuICAgICAgICAgICAgICBvbnN1Ym1pdD0ke29uU3VibWl0fT5cbiAgICAgICAgICA8aW5wdXQgY2xhc3M9XCJVcHB5RHJhZ0Ryb3AtaW5wdXQgVXBweURyYWdEcm9wLWZvY3VzXCJcbiAgICAgICAgICAgICAgICAgdHlwZT1cImZpbGVcIlxuICAgICAgICAgICAgICAgICBuYW1lPVwiZmlsZXNbXVwiXG4gICAgICAgICAgICAgICAgIG11bHRpcGxlPVwidHJ1ZVwiXG4gICAgICAgICAgICAgICAgIHZhbHVlPVwiXCJcbiAgICAgICAgICAgICAgICAgb25jaGFuZ2U9JHt0aGlzLmhhbmRsZUlucHV0Q2hhbmdlLmJpbmQodGhpcyl9IC8+XG4gICAgICAgICAgPGxhYmVsIGNsYXNzPVwiVXBweURyYWdEcm9wLWxhYmVsXCIgb25jbGljaz0ke29uU2VsZWN0fT5cbiAgICAgICAgICAgIDxzdHJvbmc+JHt0aGlzLmNvcmUuaTE4bignY2hvb3NlRmlsZScpfTwvc3Ryb25nPlxuICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJVcHB5RHJhZ0Ryb3AtZHJhZ1RleHRcIj4ke3RoaXMuY29yZS5pMThuKCdvckRyYWdEcm9wJyl9PC9zcGFuPlxuICAgICAgICAgIDwvbGFiZWw+XG4gICAgICAgICAgJHshdGhpcy5jb3JlLm9wdHMuYXV0b1Byb2NlZWQgJiYgdGFyZ2V0ICE9PSAnTW9kYWwnXG4gICAgICAgICAgICA/IHlvYDxidXR0b24gY2xhc3M9XCJVcHB5RHJhZ0Ryb3AtdXBsb2FkQnRuIFVwcHlOZXh0QnRuXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlPVwic3VibWl0XCJcbiAgICAgICAgICAgICAgICAgICAgICAgICBvbmNsaWNrPSR7bmV4dH0+XG4gICAgICAgICAgICAgICAgICAgICR7dGhpcy5jb3JlLmkxOG4oJ3VwbG9hZCcpfVxuICAgICAgICAgICAgICA8L2J1dHRvbj5gXG4gICAgICAgICAgICA6ICcnfVxuICAgICAgICA8L2Zvcm0+XG4gICAgICA8L2Rpdj5cbiAgICBgXG4gIH1cblxuICBpbnN0YWxsICgpIHtcbiAgICBjb25zdCB0YXJnZXQgPSB0aGlzLm9wdHMudGFyZ2V0XG4gICAgY29uc3QgcGx1Z2luID0gdGhpc1xuICAgIHRoaXMudGFyZ2V0ID0gdGhpcy5tb3VudCh0YXJnZXQsIHBsdWdpbilcblxuICAgIGRyYWdEcm9wKGAke3RoaXMudGFyZ2V0fSAuVXBweURyYWdEcm9wLWNvbnRhaW5lcmAsIChmaWxlcykgPT4ge1xuICAgICAgdGhpcy5oYW5kbGVEcm9wKGZpbGVzKVxuICAgICAgdGhpcy5jb3JlLmxvZyhmaWxlcylcbiAgICB9KVxuICB9XG59XG4iLCJpbXBvcnQgUGx1Z2luIGZyb20gJy4vUGx1Z2luJ1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBEcm9wYm94IGV4dGVuZHMgUGx1Z2luIHtcbiAgY29uc3RydWN0b3IgKGNvcmUsIG9wdHMpIHtcbiAgICBzdXBlcihjb3JlLCBvcHRzKVxuICAgIHRoaXMudHlwZSA9ICdhY3F1aXJlcidcbiAgICB0aGlzLmlkID0gJ0Ryb3Bib3gnXG4gICAgdGhpcy50aXRsZSA9ICdEcm9wYm94J1xuXG4gICAgdGhpcy5hdXRoZW50aWNhdGUgPSB0aGlzLmF1dGhlbnRpY2F0ZS5iaW5kKHRoaXMpXG4gICAgdGhpcy5jb25uZWN0ID0gdGhpcy5jb25uZWN0LmJpbmQodGhpcylcbiAgICB0aGlzLnJlbmRlciA9IHRoaXMucmVuZGVyLmJpbmQodGhpcylcbiAgICB0aGlzLmZpbGVzID0gW11cbiAgICB0aGlzLmN1cnJlbnREaXJlY3RvcnkgPSAnLydcbiAgfVxuXG4gIGNvbm5lY3QgKHRhcmdldCkge1xuICAgIHRoaXMuZ2V0RGlyZWN0b3J5KClcbiAgfVxuXG4gIGF1dGhlbnRpY2F0ZSAoKSB7XG4gICAgLy8gcmVxdWVzdC5nZXQoJy8nKVxuICB9XG5cbiAgYWRkRmlsZSAoKSB7XG5cbiAgfVxuXG4gIGdldERpcmVjdG9yeSAoKSB7XG4gICAgLy8gcmVxdWVzdC5nZXQoJy8vbG9jYWxob3N0OjMwMjAvZHJvcGJveC9yZWFkZGlyJylcbiAgICAvLyAgIC5xdWVyeShvcHRzKVxuICAgIC8vICAgLnNldCgnQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL2pzb24nKVxuICAgIC8vICAgLmVuZCgoZXJyLCByZXMpID0+IHtcbiAgICAvLyAgICAgaWYgKGVycikgcmV0dXJuIG5ldyBFcnJvcihlcnIpXG4gICAgLy8gICAgIGNvbnNvbGUubG9nKHJlcylcbiAgICAvLyAgIH0pXG4gIH1cblxuICBydW4gKHJlc3VsdHMpIHtcblxuICB9XG5cbiAgcmVuZGVyIChmaWxlcykge1xuICAgIC8vIGZvciBlYWNoIGZpbGUgaW4gdGhlIGRpcmVjdG9yeSwgY3JlYXRlIGEgbGlzdCBpdGVtIGVsZW1lbnRcbiAgICBjb25zdCBlbGVtcyA9IGZpbGVzLm1hcCgoZmlsZSwgaSkgPT4ge1xuICAgICAgY29uc3QgaWNvbiA9IChmaWxlLmlzRm9sZGVyKSA/ICdmb2xkZXInIDogJ2ZpbGUnXG4gICAgICByZXR1cm4gYDxsaSBkYXRhLXR5cGU9XCIke2ljb259XCIgZGF0YS1uYW1lPVwiJHtmaWxlLm5hbWV9XCI+XG4gICAgICAgIDxzcGFuPiR7aWNvbn06IDwvc3Bhbj5cbiAgICAgICAgPHNwYW4+ICR7ZmlsZS5uYW1lfTwvc3Bhbj5cbiAgICAgIDwvbGk+YFxuICAgIH0pXG5cbiAgICAvLyBhcHBlbmRzIHRoZSBsaXN0IGl0ZW1zIHRvIHRoZSB0YXJnZXRcbiAgICB0aGlzLl90YXJnZXQuaW5uZXJIVE1MID0gZWxlbXMuc29ydCgpLmpvaW4oJycpXG5cbiAgICBpZiAodGhpcy5jdXJyZW50RGlyLmxlbmd0aCA+IDEpIHtcbiAgICAgIGNvbnN0IHBhcmVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ0xJJylcbiAgICAgIHBhcmVudC5zZXRBdHRyaWJ1dGUoJ2RhdGEtdHlwZScsICdwYXJlbnQnKVxuICAgICAgcGFyZW50LmlubmVySFRNTCA9ICc8c3Bhbj4uLi48L3NwYW4+J1xuICAgICAgdGhpcy5fdGFyZ2V0LmFwcGVuZENoaWxkKHBhcmVudClcbiAgICB9XG5cbiAgICAvLyBhZGQgYW4gb25DbGljayB0byBlYWNoIGxpc3QgaXRlbVxuICAgIGNvbnN0IGZpbGVFbGVtcyA9IHRoaXMuX3RhcmdldC5xdWVyeVNlbGVjdG9yQWxsKCdsaScpXG5cbiAgICBBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKGZpbGVFbGVtcywgKGVsZW1lbnQpID0+IHtcbiAgICAgIGNvbnN0IHR5cGUgPSBlbGVtZW50LmdldEF0dHJpYnV0ZSgnZGF0YS10eXBlJylcblxuICAgICAgaWYgKHR5cGUgPT09ICdmaWxlJykge1xuICAgICAgICBlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICAgIHRoaXMuZmlsZXMucHVzaChlbGVtZW50LmdldEF0dHJpYnV0ZSgnZGF0YS1uYW1lJykpXG4gICAgICAgICAgY29uc29sZS5sb2coYGZpbGVzOiAke3RoaXMuZmlsZXN9YClcbiAgICAgICAgfSlcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignZGJsY2xpY2snLCAoKSA9PiB7XG4gICAgICAgICAgY29uc3QgbGVuZ3RoID0gdGhpcy5jdXJyZW50RGlyLnNwbGl0KCcvJykubGVuZ3RoXG5cbiAgICAgICAgICBpZiAodHlwZSA9PT0gJ2ZvbGRlcicpIHtcbiAgICAgICAgICAgIHRoaXMuY3VycmVudERpciA9IGAke3RoaXMuY3VycmVudERpcn0ke2VsZW1lbnQuZ2V0QXR0cmlidXRlKCdkYXRhLW5hbWUnKX0vYFxuICAgICAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ3BhcmVudCcpIHtcbiAgICAgICAgICAgIHRoaXMuY3VycmVudERpciA9IGAke3RoaXMuY3VycmVudERpci5zcGxpdCgnLycpLnNsaWNlKDAsIGxlbmd0aCAtIDIpLmpvaW4oJy8nKX0vYFxuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zb2xlLmxvZyh0aGlzLmN1cnJlbnREaXIpXG4gICAgICAgICAgdGhpcy5nZXREaXJlY3RvcnkoKVxuICAgICAgICB9KVxuICAgICAgfVxuICAgIH0pXG4gIH1cbn1cbiIsImltcG9ydCBQbHVnaW4gZnJvbSAnLi9QbHVnaW4nXG5pbXBvcnQgeW8gZnJvbSAneW8teW8nXG5cbi8qKlxuICogRHVtbXlcbiAqXG4gKi9cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIER1bW15IGV4dGVuZHMgUGx1Z2luIHtcbiAgY29uc3RydWN0b3IgKGNvcmUsIG9wdHMpIHtcbiAgICBzdXBlcihjb3JlLCBvcHRzKVxuICAgIHRoaXMudHlwZSA9ICdhY3F1aXJlcidcbiAgICB0aGlzLmlkID0gJ0R1bW15J1xuICAgIHRoaXMudGl0bGUgPSAnRHVtbXknXG5cbiAgICAvLyBzZXQgZGVmYXVsdCBvcHRpb25zXG4gICAgY29uc3QgZGVmYXVsdE9wdGlvbnMgPSB7fVxuXG4gICAgLy8gbWVyZ2UgZGVmYXVsdCBvcHRpb25zIHdpdGggdGhlIG9uZXMgc2V0IGJ5IHVzZXJcbiAgICB0aGlzLm9wdHMgPSBPYmplY3QuYXNzaWduKHt9LCBkZWZhdWx0T3B0aW9ucywgb3B0cylcblxuICAgIHRoaXMuc3RyYW5nZSA9IHlvYDxoMT50aGlzIGlzIHN0cmFuZ2UgMTwvaDE+YFxuICAgIHRoaXMucmVuZGVyID0gdGhpcy5yZW5kZXIuYmluZCh0aGlzKVxuICAgIHRoaXMuaW5zdGFsbCA9IHRoaXMuaW5zdGFsbC5iaW5kKHRoaXMpXG4gIH1cblxuICByZW5kZXIgKCkge1xuICAgIGNvbnN0IGJsYSA9IHlvYDxoMj50aGlzIGlzIHN0cmFuZ2UgMjwvaDI+YFxuICAgIHJldHVybiB5b2BcbiAgICAgIDxkaXYgY2xhc3M9XCJ3b3ctdGhpcy13b3Jrc1wiPlxuICAgICAgICA8aW5wdXQgY2xhc3M9XCJVcHB5RHVtbXktZmlyc3RJbnB1dFwiIHR5cGU9XCJ0ZXh0XCIgdmFsdWU9XCJoZWxsb1wiPlxuICAgICAgICAke3RoaXMuc3RyYW5nZX1cbiAgICAgICAgJHtibGF9XG4gICAgICA8L2Rpdj5cbiAgICBgXG4gIH1cblxuICBmb2N1cyAoKSB7XG4gICAgY29uc3QgZmlyc3RJbnB1dCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoYCR7dGhpcy50YXJnZXR9IC5VcHB5RHVtbXktZmlyc3RJbnB1dGApXG5cbiAgICAvLyBvbmx5IHdvcmtzIGZvciB0aGUgZmlyc3QgdGltZSBpZiB3cmFwcGVkIGluIHNldFRpbWVvdXQgZm9yIHNvbWUgcmVhc29uXG4gICAgLy8gZmlyc3RJbnB1dC5mb2N1cygpXG4gICAgc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgICBmaXJzdElucHV0LmZvY3VzKClcbiAgICB9LCAxMClcbiAgfVxuXG4gIGluc3RhbGwgKCkge1xuICAgIGNvbnN0IHRhcmdldCA9IHRoaXMub3B0cy50YXJnZXRcbiAgICBjb25zdCBwbHVnaW4gPSB0aGlzXG4gICAgdGhpcy50YXJnZXQgPSB0aGlzLm1vdW50KHRhcmdldCwgcGx1Z2luKVxuICB9XG59XG4iLCJpbXBvcnQgUGx1Z2luIGZyb20gJy4vUGx1Z2luJ1xuaW1wb3J0IFV0aWxzIGZyb20gJy4uL2NvcmUvVXRpbHMnXG5pbXBvcnQgeW8gZnJvbSAneW8teW8nXG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEZvcm10YWcgZXh0ZW5kcyBQbHVnaW4ge1xuICBjb25zdHJ1Y3RvciAoY29yZSwgb3B0cykge1xuICAgIHN1cGVyKGNvcmUsIG9wdHMpXG4gICAgdGhpcy5pZCA9ICdGb3JtdGFnJ1xuICAgIHRoaXMudGl0bGUgPSAnRm9ybXRhZydcbiAgICB0aGlzLnR5cGUgPSAnYWNxdWlyZXInXG5cbiAgICAvLyBEZWZhdWx0IG9wdGlvbnNcbiAgICBjb25zdCBkZWZhdWx0T3B0aW9ucyA9IHtcbiAgICAgIHRhcmdldDogJy5VcHB5Rm9ybScsXG4gICAgICByZXBsYWNlVGFyZ2V0Q29udGVudDogdHJ1ZSxcbiAgICAgIG11bHRpcGxlRmlsZXM6IHRydWVcbiAgICB9XG5cbiAgICAvLyBNZXJnZSBkZWZhdWx0IG9wdGlvbnMgd2l0aCB0aGUgb25lcyBzZXQgYnkgdXNlclxuICAgIHRoaXMub3B0cyA9IE9iamVjdC5hc3NpZ24oe30sIGRlZmF1bHRPcHRpb25zLCBvcHRzKVxuXG4gICAgdGhpcy5yZW5kZXIgPSB0aGlzLnJlbmRlci5iaW5kKHRoaXMpXG4gIH1cblxuICBoYW5kbGVJbnB1dENoYW5nZSAoZXYpIHtcbiAgICB0aGlzLmNvcmUubG9nKCdBbGwgcmlnaHQsIHNvbWV0aGluZyBzZWxlY3RlZCB0aHJvdWdoIGlucHV0Li4uJylcblxuICAgIC8vIHRoaXMgYWRkZWQgcnViYmlzaCBrZXlzIGxpa2Ug4oCcbGVuZ3Ro4oCdIHRvIHRoZSByZXN1bHRpbmcgYXJyYXlcbiAgICAvLyBjb25zdCBmaWxlcyA9IE9iamVjdC5rZXlzKGV2LnRhcmdldC5maWxlcykubWFwKChrZXkpID0+IHtcbiAgICAvLyAgIHJldHVybiBldi50YXJnZXQuZmlsZXNba2V5XVxuICAgIC8vIH0pXG5cbiAgICBjb25zdCBmaWxlcyA9IFV0aWxzLnRvQXJyYXkoZXYudGFyZ2V0LmZpbGVzKVxuXG4gICAgZmlsZXMuZm9yRWFjaCgoZmlsZSkgPT4ge1xuICAgICAgdGhpcy5jb3JlLmVtaXR0ZXIuZW1pdCgnZmlsZS1hZGQnLCB7XG4gICAgICAgIHNvdXJjZTogdGhpcy5pZCxcbiAgICAgICAgbmFtZTogZmlsZS5uYW1lLFxuICAgICAgICB0eXBlOiBmaWxlLnR5cGUsXG4gICAgICAgIGRhdGE6IGZpbGVcbiAgICAgIH0pXG4gICAgfSlcbiAgfVxuXG4gIHJlbmRlciAoc3RhdGUpIHtcbiAgICBjb25zdCBuZXh0ID0gKGV2KSA9PiB7XG4gICAgICBldi5wcmV2ZW50RGVmYXVsdCgpXG4gICAgICBldi5zdG9wUHJvcGFnYXRpb24oKVxuICAgICAgdGhpcy5jb3JlLmVtaXR0ZXIuZW1pdCgnbmV4dCcpXG4gICAgfVxuXG4gICAgcmV0dXJuIHlvYDxmb3JtIGNsYXNzPVwiVXBweUZvcm1Db250YWluZXJcIj5cbiAgICAgIDxpbnB1dCBjbGFzcz1cIlVwcHlGb3JtLWlucHV0XCJcbiAgICAgICAgICAgICB0eXBlPVwiZmlsZVwiXG4gICAgICAgICAgICAgbmFtZT1cImZpbGVzW11cIlxuICAgICAgICAgICAgIG9uY2hhbmdlPSR7dGhpcy5oYW5kbGVJbnB1dENoYW5nZS5iaW5kKHRoaXMpfVxuICAgICAgICAgICAgIG11bHRpcGxlPVwiJHt0aGlzLm9wdHMubXVsdGlwbGVGaWxlcyA/ICd0cnVlJyA6ICdmYWxzZSd9XCJcbiAgICAgICAgICAgICB2YWx1ZT1cIlwiPlxuICAgICAgJHshdGhpcy5jb3JlLm9wdHMuYXV0b1Byb2NlZWQgJiYgdGhpcy5vcHRzLnRhcmdldC5uYW1lICE9PSAnTW9kYWwnXG4gICAgICAgID8geW9gPGJ1dHRvbiBjbGFzcz1cIlVwcHlGb3JtLXVwbG9hZEJ0biBVcHB5TmV4dEJ0blwiXG4gICAgICAgICAgICAgICAgICAgICB0eXBlPVwic3VibWl0XCJcbiAgICAgICAgICAgICAgICAgICAgIG9uY2xpY2s9JHtuZXh0fT5cbiAgICAgICAgICAgICAgJHt0aGlzLmNvcmUuaTE4bigndXBsb2FkJyl9XG4gICAgICAgICAgICA8L2J1dHRvbj5gXG4gICAgICAgIDogJyd9XG4gICAgPC9mb3JtPmBcbiAgfVxuXG4gIGluc3RhbGwgKCkge1xuICAgIGNvbnN0IHRhcmdldCA9IHRoaXMub3B0cy50YXJnZXRcbiAgICBjb25zdCBwbHVnaW4gPSB0aGlzXG4gICAgdGhpcy50YXJnZXQgPSB0aGlzLm1vdW50KHRhcmdldCwgcGx1Z2luKVxuICB9XG5cbiAgLy8gcnVuIChyZXN1bHRzKSB7XG4gIC8vICAgY29uc29sZS5sb2coe1xuICAvLyAgICAgY2xhc3M6ICdGb3JtdGFnJyxcbiAgLy8gICAgIG1ldGhvZDogJ3J1bicsXG4gIC8vICAgICByZXN1bHRzOiByZXN1bHRzXG4gIC8vICAgfSlcbiAgLy9cbiAgLy8gICBjb25zdCBidXR0b24gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKHRoaXMub3B0cy5kb25lQnV0dG9uU2VsZWN0b3IpXG4gIC8vICAgdmFyIHNlbGYgPSB0aGlzXG4gIC8vXG4gIC8vICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgLy8gICAgIGJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChlKSA9PiB7XG4gIC8vICAgICAgIHZhciBmaWVsZHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKHNlbGYub3B0cy5zZWxlY3RvcilcbiAgLy8gICAgICAgdmFyIHNlbGVjdGVkID0gW107XG4gIC8vXG4gIC8vICAgICAgIFtdLmZvckVhY2guY2FsbChmaWVsZHMsIChmaWVsZCwgaSkgPT4ge1xuICAvLyAgICAgICAgIHNlbGVjdGVkLnB1c2goe1xuICAvLyAgICAgICAgICAgZnJvbTogJ0Zvcm10YWcnLFxuICAvLyAgICAgICAgICAgZmlsZXM6IGZpZWxkLmZpbGVzXG4gIC8vICAgICAgICAgfSlcbiAgLy8gICAgICAgfSlcbiAgLy8gICAgICAgcmVzb2x2ZShzZWxlY3RlZClcbiAgLy8gICAgIH0pXG4gIC8vICAgfSlcbiAgLy8gfVxufVxuIiwiaW1wb3J0IFV0aWxzIGZyb20gJy4uL2NvcmUvVXRpbHMnXG5pbXBvcnQgUGx1Z2luIGZyb20gJy4vUGx1Z2luJ1xuaW1wb3J0ICd3aGF0d2ctZmV0Y2gnXG5pbXBvcnQgeW8gZnJvbSAneW8teW8nXG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEdvb2dsZSBleHRlbmRzIFBsdWdpbiB7XG4gIGNvbnN0cnVjdG9yIChjb3JlLCBvcHRzKSB7XG4gICAgc3VwZXIoY29yZSwgb3B0cylcbiAgICB0aGlzLnR5cGUgPSAnYWNxdWlyZXInXG4gICAgdGhpcy5pZCA9ICdHb29nbGVEcml2ZSdcbiAgICB0aGlzLnRpdGxlID0gJ0dvb2dsZSBEcml2ZSdcbiAgICB0aGlzLmljb24gPSB5b2BcbiAgICAgIDxzdmcgY2xhc3M9XCJVcHB5TW9kYWxUYWItaWNvblwiIHdpZHRoPVwiMjhcIiBoZWlnaHQ9XCIyOFwiIHZpZXdCb3g9XCIwIDAgMTYgMTZcIj5cbiAgICAgICAgPHBhdGggZD1cIk0yLjk1NSAxNC45M2wyLjY2Ny00LjYySDE2bC0yLjY2NyA0LjYySDIuOTU1em0yLjM3OC00LjYybC0yLjY2NiA0LjYyTDAgMTAuMzFsNS4xOS04Ljk5IDIuNjY2IDQuNjItMi41MjMgNC4zN3ptMTAuNTIzLS4yNWgtNS4zMzNsLTUuMTktOC45OWg1LjMzNGw1LjE5IDguOTl6XCIvPlxuICAgICAgPC9zdmc+XG4gICAgYFxuXG4gICAgdGhpcy5maWxlcyA9IFtdXG5cbiAgICAvLyBMb2dpY1xuICAgIHRoaXMuYWRkRmlsZSA9IHRoaXMuYWRkRmlsZS5iaW5kKHRoaXMpXG4gICAgdGhpcy5nZXRGb2xkZXIgPSB0aGlzLmdldEZvbGRlci5iaW5kKHRoaXMpXG4gICAgdGhpcy5oYW5kbGVDbGljayA9IHRoaXMuaGFuZGxlQ2xpY2suYmluZCh0aGlzKVxuICAgIHRoaXMubG9nb3V0ID0gdGhpcy5sb2dvdXQuYmluZCh0aGlzKVxuXG4gICAgLy8gVmlzdWFsXG4gICAgdGhpcy5yZW5kZXJCcm93c2VySXRlbSA9IHRoaXMucmVuZGVyQnJvd3Nlckl0ZW0uYmluZCh0aGlzKVxuICAgIHRoaXMuZmlsdGVySXRlbXMgPSB0aGlzLmZpbHRlckl0ZW1zLmJpbmQodGhpcylcbiAgICB0aGlzLmZpbHRlclF1ZXJ5ID0gdGhpcy5maWx0ZXJRdWVyeS5iaW5kKHRoaXMpXG4gICAgdGhpcy5yZW5kZXJBdXRoID0gdGhpcy5yZW5kZXJBdXRoLmJpbmQodGhpcylcbiAgICB0aGlzLnJlbmRlckJyb3dzZXIgPSB0aGlzLnJlbmRlckJyb3dzZXIuYmluZCh0aGlzKVxuICAgIHRoaXMuc29ydEJ5VGl0bGUgPSB0aGlzLnNvcnRCeVRpdGxlLmJpbmQodGhpcylcbiAgICB0aGlzLnNvcnRCeURhdGUgPSB0aGlzLnNvcnRCeURhdGUuYmluZCh0aGlzKVxuICAgIHRoaXMucmVuZGVyID0gdGhpcy5yZW5kZXIuYmluZCh0aGlzKVxuXG4gICAgLy8gc2V0IGRlZmF1bHQgb3B0aW9uc1xuICAgIGNvbnN0IGRlZmF1bHRPcHRpb25zID0ge31cblxuICAgIC8vIG1lcmdlIGRlZmF1bHQgb3B0aW9ucyB3aXRoIHRoZSBvbmVzIHNldCBieSB1c2VyXG4gICAgdGhpcy5vcHRzID0gT2JqZWN0LmFzc2lnbih7fSwgZGVmYXVsdE9wdGlvbnMsIG9wdHMpXG5cbiAgICBjb25zdCBob3N0ID0gdGhpcy5vcHRzLmhvc3QucmVwbGFjZSgvXmh0dHBzPzpcXC9cXC8vLCAnJylcblxuICAgIHRoaXMuc29ja2V0ID0gdGhpcy5jb3JlLmluaXRTb2NrZXQoe1xuICAgICAgdGFyZ2V0OiAnd3M6Ly8nICsgaG9zdCArICcvJ1xuICAgIH0pXG5cbiAgICB0aGlzLnNvY2tldC5vbignZ29vZ2xlLmF1dGgucGFzcycsICgpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKCdnb29nbGUuYXV0aC5wYXNzJylcbiAgICAgIHRoaXMuZ2V0Rm9sZGVyKHRoaXMuY29yZS5nZXRTdGF0ZSgpLmdvb2dsZURyaXZlLmRpcmVjdG9yeS5pZClcbiAgICB9KVxuXG4gICAgdGhpcy5zb2NrZXQub24oJ3VwcHkuZGVidWcnLCAocGF5bG9hZCkgPT4ge1xuICAgICAgY29uc29sZS5sb2coJ0dPT0dMRSBERUJVRzonKVxuICAgICAgY29uc29sZS5sb2cocGF5bG9hZClcbiAgICB9KVxuXG4gICAgdGhpcy5zb2NrZXQub24oJ2dvb2dsZS5saXN0Lm9rJywgKGRhdGEpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKCdnb29nbGUubGlzdC5vaycpXG4gICAgICBsZXQgZm9sZGVycyA9IFtdXG4gICAgICBsZXQgZmlsZXMgPSBbXVxuICAgICAgZGF0YS5pdGVtcy5mb3JFYWNoKChpdGVtKSA9PiB7XG4gICAgICAgIGlmIChpdGVtLm1pbWVUeXBlID09PSAnYXBwbGljYXRpb24vdm5kLmdvb2dsZS1hcHBzLmZvbGRlcicpIHtcbiAgICAgICAgICBmb2xkZXJzLnB1c2goaXRlbSlcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBmaWxlcy5wdXNoKGl0ZW0pXG4gICAgICAgIH1cbiAgICAgIH0pXG5cbiAgICAgIHRoaXMudXBkYXRlU3RhdGUoe1xuICAgICAgICBmb2xkZXJzLFxuICAgICAgICBmaWxlcyxcbiAgICAgICAgYXV0aGVudGljYXRlZDogdHJ1ZVxuICAgICAgfSlcbiAgICB9KVxuXG4gICAgdGhpcy5zb2NrZXQub24oJ2dvb2dsZS5saXN0LmZhaWwnLCAoZGF0YSkgPT4ge1xuICAgICAgY29uc29sZS5sb2coJ2dvb2dsZS5saXN0LmZhaWwnKVxuICAgICAgY29uc29sZS5sb2coZGF0YSlcbiAgICB9KVxuXG4gICAgdGhpcy5zb2NrZXQub24oJ2dvb2dsZS5hdXRoLmZhaWwnLCAoKSA9PiB7XG4gICAgICBjb25zb2xlLmxvZygnZ29vZ2xlLmF1dGguZmFpbCcpXG4gICAgICB0aGlzLnVwZGF0ZVN0YXRlKHtcbiAgICAgICAgYXV0aGVudGljYXRlZDogZmFsc2VcbiAgICAgIH0pXG4gICAgfSlcbiAgfVxuXG4gIGluc3RhbGwgKCkge1xuICAgIC8vIFNldCBkZWZhdWx0IHN0YXRlIGZvciBHb29nbGUgRHJpdmVcbiAgICB0aGlzLmNvcmUuc2V0U3RhdGUoe1xuICAgICAgZ29vZ2xlRHJpdmU6IHtcbiAgICAgICAgYXV0aGVudGljYXRlZDogZmFsc2UsXG4gICAgICAgIGZpbGVzOiBbXSxcbiAgICAgICAgZm9sZGVyczogW10sXG4gICAgICAgIGRpcmVjdG9yeTogW3tcbiAgICAgICAgICB0aXRsZTogJ015IERyaXZlJyxcbiAgICAgICAgICBpZDogJ3Jvb3QnXG4gICAgICAgIH1dLFxuICAgICAgICBhY3RpdmU6IHt9LFxuICAgICAgICBmaWx0ZXJJbnB1dDogJydcbiAgICAgIH1cbiAgICB9KVxuXG4gICAgY29uc3QgdGFyZ2V0ID0gdGhpcy5vcHRzLnRhcmdldFxuICAgIGNvbnN0IHBsdWdpbiA9IHRoaXNcbiAgICB0aGlzLnRhcmdldCA9IHRoaXMubW91bnQodGFyZ2V0LCBwbHVnaW4pXG5cbiAgICB0aGlzLmNoZWNrQXV0aGVudGljYXRpb24oKVxuXG4gICAgcmV0dXJuXG4gIH1cblxuICBmb2N1cyAoKSB7XG4gICAgY29uc3QgZmlyc3RJbnB1dCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoYCR7dGhpcy50YXJnZXR9IC5VcHB5R29vZ2xlRHJpdmUtZm9jdXNJbnB1dGApXG5cbiAgICAvLyBvbmx5IHdvcmtzIGZvciB0aGUgZmlyc3QgdGltZSBpZiB3cmFwcGVkIGluIHNldFRpbWVvdXQgZm9yIHNvbWUgcmVhc29uXG4gICAgLy8gZmlyc3RJbnB1dC5mb2N1cygpXG4gICAgc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgICBmaXJzdElucHV0LmZvY3VzKClcbiAgICB9LCAxMClcbiAgfVxuXG4gIC8qKlxuICAgKiBMaXR0bGUgc2hvcnRoYW5kIHRvIHVwZGF0ZSB0aGUgc3RhdGUgd2l0aCBteSBuZXcgc3RhdGVcbiAgICovXG4gIHVwZGF0ZVN0YXRlIChuZXdTdGF0ZSkge1xuICAgIGNvbnN0IHtzdGF0ZX0gPSB0aGlzLmNvcmVcbiAgICBjb25zdCBnb29nbGVEcml2ZSA9IE9iamVjdC5hc3NpZ24oe30sIHN0YXRlLmdvb2dsZURyaXZlLCBuZXdTdGF0ZSlcblxuICAgIHRoaXMuY29yZS5zZXRTdGF0ZSh7Z29vZ2xlRHJpdmV9KVxuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrIHRvIHNlZSBpZiB0aGUgdXNlciBpcyBhdXRoZW50aWNhdGVkLlxuICAgKiBAcmV0dXJuIHtQcm9taXNlfSBhdXRoZW50aWNhdGlvbiBzdGF0dXNcbiAgICovXG4gIGNoZWNrQXV0aGVudGljYXRpb24gKCkge1xuICAgIHRoaXMuc29ja2V0LnNlbmQoJ2dvb2dsZS5hdXRoJylcbiAgfVxuXG4gIC8qKlxuICAgKiBCYXNlZCBvbiBmb2xkZXIgSUQsIGZldGNoIGEgbmV3IGZvbGRlclxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IGlkIEZvbGRlciBpZFxuICAgKiBAcmV0dXJuIHtQcm9taXNlfSAgIEZvbGRlcnMvZmlsZXMgaW4gZm9sZGVyXG4gICAqL1xuICBnZXRGb2xkZXIgKGRpciA9ICdyb290Jykge1xuICAgIHRoaXMuc29ja2V0LnNlbmQoJ2dvb2dsZS5saXN0Jywge1xuICAgICAgZGlyXG4gICAgfSlcbiAgfVxuXG4gIC8qKlxuICAgKiBGZXRjaGVzIG5ldyBmb2xkZXIgYW5kIGFkZHMgdG8gYnJlYWRjcnVtYiBuYXZcbiAgICogQHBhcmFtICB7U3RyaW5nfSBpZCAgICBGb2xkZXIgaWRcbiAgICogQHBhcmFtICB7U3RyaW5nfSB0aXRsZSBGb2xkZXIgdGl0bGVcbiAgICovXG4gIGdldE5leHRGb2xkZXIgKGlkLCB0aXRsZSkge1xuICAgIHRoaXMuZ2V0Rm9sZGVyKGlkKVxuICAgICAgLnRoZW4oKGRhdGEpID0+IHtcbiAgICAgICAgY29uc3Qgc3RhdGUgPSB0aGlzLmNvcmUuZ2V0U3RhdGUoKS5nb29nbGVEcml2ZVxuXG4gICAgICAgIGNvbnN0IGluZGV4ID0gc3RhdGUuZGlyZWN0b3J5LmZpbmRJbmRleCgoZGlyKSA9PiBpZCA9PT0gZGlyLmlkKVxuICAgICAgICBsZXQgZGlyZWN0b3J5XG5cbiAgICAgICAgaWYgKGluZGV4ICE9PSAtMSkge1xuICAgICAgICAgIGRpcmVjdG9yeSA9IHN0YXRlLmRpcmVjdG9yeS5zbGljZSgwLCBpbmRleCArIDEpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZGlyZWN0b3J5ID0gc3RhdGUuZGlyZWN0b3J5LmNvbmNhdChbe1xuICAgICAgICAgICAgaWQsXG4gICAgICAgICAgICB0aXRsZVxuICAgICAgICAgIH1dKVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy51cGRhdGVTdGF0ZShVdGlscy5leHRlbmQoZGF0YSwge2RpcmVjdG9yeX0pKVxuICAgICAgfSlcbiAgfVxuXG4gIGFkZEZpbGUgKGZpbGUpIHtcbiAgICBjb25zdCB0YWdGaWxlID0ge1xuICAgICAgc291cmNlOiB0aGlzLFxuICAgICAgZGF0YTogZmlsZSxcbiAgICAgIG5hbWU6IGZpbGUudGl0bGUsXG4gICAgICB0eXBlOiB0aGlzLmdldEZpbGVUeXBlKGZpbGUpLFxuICAgICAgcmVtb3RlOiB7XG4gICAgICAgIGFjdGlvbjogJ2dvb2dsZS5nZXQnLFxuICAgICAgICBwYXlsb2FkOiB7XG4gICAgICAgICAgaWQ6IGZpbGUuaWRcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuY29yZS5lbWl0dGVyLmVtaXQoJ2ZpbGUtYWRkJywgdGFnRmlsZSlcbiAgfVxuXG4gIGhhbmRsZUVycm9yIChyZXNwb25zZSkge1xuICAgIC8vIHRoaXMuY2hlY2tBdXRoZW50aWNhdGlvbigpXG4gICAgLy8gICAudGhlbigoYXV0aGVudGljYXRlZCkgPT4ge1xuICAgIC8vICAgICB0aGlzLnVwZGF0ZVN0YXRlKHthdXRoZW50aWNhdGVkfSlcbiAgICAvLyAgIH0pXG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlcyBzZXNzaW9uIHRva2VuIG9uIGNsaWVudCBzaWRlLlxuICAgKi9cbiAgbG9nb3V0ICgpIHtcbiAgICBmZXRjaChgJHt0aGlzLm9wdHMuaG9zdH0vZ29vZ2xlL2xvZ291dD9yZWRpcmVjdD0ke2xvY2F0aW9uLmhyZWZ9YCwge1xuICAgICAgbWV0aG9kOiAnZ2V0JyxcbiAgICAgIGNyZWRlbnRpYWxzOiAnaW5jbHVkZScsXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgICdBY2NlcHQnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbidcbiAgICAgIH1cbiAgICB9KVxuICAgICAgLnRoZW4oKHJlcykgPT4gcmVzLmpzb24oKSlcbiAgICAgIC50aGVuKChyZXMpID0+IHtcbiAgICAgICAgaWYgKHJlcy5vaykge1xuICAgICAgICAgIGNvbnNvbGUubG9nKCdvaycpXG4gICAgICAgICAgY29uc3QgbmV3U3RhdGUgPSB7XG4gICAgICAgICAgICBhdXRoZW50aWNhdGVkOiBmYWxzZSxcbiAgICAgICAgICAgIGZpbGVzOiBbXSxcbiAgICAgICAgICAgIGZvbGRlcnM6IFtdLFxuICAgICAgICAgICAgZGlyZWN0b3J5OiBbe1xuICAgICAgICAgICAgICB0aXRsZTogJ015IERyaXZlJyxcbiAgICAgICAgICAgICAgaWQ6ICdyb290J1xuICAgICAgICAgICAgfV1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICB0aGlzLnVwZGF0ZVN0YXRlKG5ld1N0YXRlKVxuICAgICAgICB9XG4gICAgICB9KVxuICB9XG5cbiAgZ2V0RmlsZVR5cGUgKGZpbGUpIHtcbiAgICBjb25zdCBmaWxlVHlwZXMgPSB7XG4gICAgICAnYXBwbGljYXRpb24vdm5kLmdvb2dsZS1hcHBzLmZvbGRlcic6ICdGb2xkZXInLFxuICAgICAgJ2FwcGxpY2F0aW9uL3ZuZC5nb29nbGUtYXBwcy5kb2N1bWVudCc6ICdHb29nbGUgRG9jcycsXG4gICAgICAnYXBwbGljYXRpb24vdm5kLmdvb2dsZS1hcHBzLnNwcmVhZHNoZWV0JzogJ0dvb2dsZSBTaGVldHMnLFxuICAgICAgJ2FwcGxpY2F0aW9uL3ZuZC5nb29nbGUtYXBwcy5wcmVzZW50YXRpb24nOiAnR29vZ2xlIFNsaWRlcycsXG4gICAgICAnaW1hZ2UvanBlZyc6ICdKUEVHIEltYWdlJyxcbiAgICAgICdpbWFnZS9wbmcnOiAnUE5HIEltYWdlJ1xuICAgIH1cblxuICAgIHJldHVybiBmaWxlVHlwZXNbZmlsZS5taW1lVHlwZV0gPyBmaWxlVHlwZXNbZmlsZS5taW1lVHlwZV0gOiBmaWxlLmZpbGVFeHRlbnNpb24udG9VcHBlckNhc2UoKVxuICB9XG5cbiAgLyoqXG4gICAqIFVzZWQgdG8gc2V0IGFjdGl2ZSBmaWxlL2ZvbGRlci5cbiAgICogQHBhcmFtICB7T2JqZWN0fSBmaWxlICAgQWN0aXZlIGZpbGUvZm9sZGVyXG4gICAqL1xuICBoYW5kbGVDbGljayAoZmlsZSkge1xuICAgIGNvbnN0IHN0YXRlID0gdGhpcy5jb3JlLmdldFN0YXRlKCkuZ29vZ2xlRHJpdmVcbiAgICBjb25zdCBuZXdTdGF0ZSA9IE9iamVjdC5hc3NpZ24oe30sIHN0YXRlLCB7XG4gICAgICBhY3RpdmU6IGZpbGVcbiAgICB9KVxuXG4gICAgdGhpcy51cGRhdGVTdGF0ZShuZXdTdGF0ZSlcbiAgfVxuXG4gIGZpbHRlclF1ZXJ5IChlKSB7XG4gICAgY29uc3Qgc3RhdGUgPSB0aGlzLmNvcmUuZ2V0U3RhdGUoKS5nb29nbGVEcml2ZVxuICAgIHRoaXMudXBkYXRlU3RhdGUoT2JqZWN0LmFzc2lnbih7fSwgc3RhdGUsIHtcbiAgICAgIGZpbHRlcklucHV0OiBlLnRhcmdldC52YWx1ZVxuICAgIH0pKVxuICB9XG5cbiAgZmlsdGVySXRlbXMgKGl0ZW1zKSB7XG4gICAgY29uc3Qgc3RhdGUgPSB0aGlzLmNvcmUuZ2V0U3RhdGUoKS5nb29nbGVEcml2ZVxuICAgIHJldHVybiBpdGVtcy5maWx0ZXIoKGZvbGRlcikgPT4ge1xuICAgICAgcmV0dXJuIGZvbGRlci50aXRsZS50b0xvd2VyQ2FzZSgpLmluZGV4T2Yoc3RhdGUuZmlsdGVySW5wdXQudG9Mb3dlckNhc2UoKSkgIT09IC0xXG4gICAgfSlcbiAgfVxuXG4gIHNvcnRCeVRpdGxlICgpIHtcbiAgICBjb25zdCBzdGF0ZSA9IHRoaXMuY29yZS5nZXRTdGF0ZSgpLmdvb2dsZURyaXZlXG4gICAgY29uc3Qge2ZpbGVzLCBmb2xkZXJzLCBzb3J0aW5nfSA9IHN0YXRlXG5cbiAgICBsZXQgc29ydGVkRmlsZXMgPSBmaWxlcy5zb3J0KChmaWxlQSwgZmlsZUIpID0+IHtcbiAgICAgIGlmIChzb3J0aW5nID09PSAndGl0bGVEZXNjZW5kaW5nJykge1xuICAgICAgICByZXR1cm4gZmlsZUIudGl0bGUubG9jYWxlQ29tcGFyZShmaWxlQS50aXRsZSlcbiAgICAgIH1cbiAgICAgIHJldHVybiBmaWxlQS50aXRsZS5sb2NhbGVDb21wYXJlKGZpbGVCLnRpdGxlKVxuICAgIH0pXG5cbiAgICBsZXQgc29ydGVkRm9sZGVycyA9IGZvbGRlcnMuc29ydCgoZm9sZGVyQSwgZm9sZGVyQikgPT4ge1xuICAgICAgaWYgKHNvcnRpbmcgPT09ICd0aXRsZURlc2NlbmRpbmcnKSB7XG4gICAgICAgIHJldHVybiBmb2xkZXJCLnRpdGxlLmxvY2FsZUNvbXBhcmUoZm9sZGVyQS50aXRsZSlcbiAgICAgIH1cbiAgICAgIHJldHVybiBmb2xkZXJBLnRpdGxlLmxvY2FsZUNvbXBhcmUoZm9sZGVyQi50aXRsZSlcbiAgICB9KVxuXG4gICAgdGhpcy51cGRhdGVTdGF0ZShPYmplY3QuYXNzaWduKHt9LCBzdGF0ZSwge1xuICAgICAgZmlsZXM6IHNvcnRlZEZpbGVzLFxuICAgICAgZm9sZGVyczogc29ydGVkRm9sZGVycyxcbiAgICAgIHNvcnRpbmc6IChzb3J0aW5nID09PSAndGl0bGVEZXNjZW5kaW5nJykgPyAndGl0bGVBc2NlbmRpbmcnIDogJ3RpdGxlRGVzY2VuZGluZydcbiAgICB9KSlcbiAgfVxuXG4gIHNvcnRCeURhdGUgKCkge1xuICAgIGNvbnN0IHN0YXRlID0gdGhpcy5jb3JlLmdldFN0YXRlKCkuZ29vZ2xlRHJpdmVcbiAgICBjb25zdCB7ZmlsZXMsIGZvbGRlcnMsIHNvcnRpbmd9ID0gc3RhdGVcblxuICAgIGxldCBzb3J0ZWRGaWxlcyA9IGZpbGVzLnNvcnQoKGZpbGVBLCBmaWxlQikgPT4ge1xuICAgICAgbGV0IGEgPSBuZXcgRGF0ZShmaWxlQS5tb2RpZmllZEJ5TWVEYXRlKVxuICAgICAgbGV0IGIgPSBuZXcgRGF0ZShmaWxlQi5tb2RpZmllZEJ5TWVEYXRlKVxuXG4gICAgICBpZiAoc29ydGluZyA9PT0gJ2RhdGVEZXNjZW5kaW5nJykge1xuICAgICAgICByZXR1cm4gYSA+IGIgPyAtMSA6IGEgPCBiID8gMSA6IDBcbiAgICAgIH1cbiAgICAgIHJldHVybiBhID4gYiA/IDEgOiBhIDwgYiA/IC0xIDogMFxuICAgIH0pXG5cbiAgICBsZXQgc29ydGVkRm9sZGVycyA9IGZvbGRlcnMuc29ydCgoZm9sZGVyQSwgZm9sZGVyQikgPT4ge1xuICAgICAgbGV0IGEgPSBuZXcgRGF0ZShmb2xkZXJBLm1vZGlmaWVkQnlNZURhdGUpXG4gICAgICBsZXQgYiA9IG5ldyBEYXRlKGZvbGRlckIubW9kaWZpZWRCeU1lRGF0ZSlcblxuICAgICAgaWYgKHNvcnRpbmcgPT09ICdkYXRlRGVzY2VuZGluZycpIHtcbiAgICAgICAgcmV0dXJuIGEgPiBiID8gLTEgOiBhIDwgYiA/IDEgOiAwXG4gICAgICB9XG5cbiAgICAgIHJldHVybiBhID4gYiA/IDEgOiBhIDwgYiA/IC0xIDogMFxuICAgIH0pXG5cbiAgICB0aGlzLnVwZGF0ZVN0YXRlKE9iamVjdC5hc3NpZ24oe30sIHN0YXRlLCB7XG4gICAgICBmaWxlczogc29ydGVkRmlsZXMsXG4gICAgICBmb2xkZXJzOiBzb3J0ZWRGb2xkZXJzLFxuICAgICAgc29ydGluZzogKHNvcnRpbmcgPT09ICdkYXRlRGVzY2VuZGluZycpID8gJ2RhdGVBc2NlbmRpbmcnIDogJ2RhdGVEZXNjZW5kaW5nJ1xuICAgIH0pKVxuICB9XG5cbiAgLyoqXG4gICAqICBSZW5kZXIgdXNlciBhdXRoZW50aWNhdGlvbiB2aWV3XG4gICAqL1xuICByZW5kZXJBdXRoICgpIHtcbiAgICBjb25zdCBsaW5rID0gYCR7dGhpcy5vcHRzLmhvc3R9L2Nvbm5lY3QvZ29vZ2xlYFxuXG4gICAgY29uc3QgaGFuZGxlQXV0aCA9IChlKSA9PiB7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICAgIGNvbnN0IGF1dGhXaW5kb3cgPSB3aW5kb3cub3BlbihsaW5rKVxuICAgICAgdGhpcy5zb2NrZXQub25jZSgnZ29vZ2xlLmF1dGguY29tcGxldGUnLCAoKSA9PiB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdnb29nbGUuYXV0aC5jb21wbGV0ZScpXG4gICAgICAgIGF1dGhXaW5kb3cuY2xvc2UoKVxuICAgICAgfSlcbiAgICB9XG5cbiAgICByZXR1cm4geW9gXG4gICAgICA8ZGl2IGNsYXNzPVwiVXBweUdvb2dsZURyaXZlLWF1dGhlbnRpY2F0ZVwiPlxuICAgICAgICA8aDE+WW91IG5lZWQgdG8gYXV0aGVudGljYXRlIHdpdGggR29vZ2xlIGJlZm9yZSBzZWxlY3RpbmcgZmlsZXMuPC9oMT5cbiAgICAgICAgPGEgb25jbGljaz0ke2hhbmRsZUF1dGh9PkF1dGhlbnRpY2F0ZTwvYT5cbiAgICAgIDwvZGl2PlxuICAgIGBcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW5kZXIgZmlsZSBicm93c2VyXG4gICAqIEBwYXJhbSAge09iamVjdH0gc3RhdGUgR29vZ2xlIERyaXZlIHN0YXRlXG4gICAqL1xuICByZW5kZXJCcm93c2VyIChzdGF0ZSkge1xuICAgIGxldCBmb2xkZXJzID0gc3RhdGUuZm9sZGVyc1xuICAgIGxldCBmaWxlcyA9IHN0YXRlLmZpbGVzXG4gICAgbGV0IHByZXZpZXdFbGVtID0gJydcbiAgICBjb25zdCBpc0ZpbGVTZWxlY3RlZCA9IE9iamVjdC5rZXlzKHN0YXRlLmFjdGl2ZSkubGVuZ3RoICE9PSAwICYmIEpTT04uc3RyaW5naWZ5KHN0YXRlLmFjdGl2ZSkgIT09IEpTT04uc3RyaW5naWZ5KHt9KVxuXG4gICAgaWYgKHN0YXRlLmZpbHRlcklucHV0ICE9PSAnJykge1xuICAgICAgZm9sZGVycyA9IHRoaXMuZmlsdGVySXRlbXMoc3RhdGUuZm9sZGVycylcbiAgICAgIGZpbGVzID0gdGhpcy5maWx0ZXJJdGVtcyhzdGF0ZS5maWxlcylcbiAgICB9XG5cbiAgICBmb2xkZXJzID0gZm9sZGVycy5tYXAoKGZvbGRlcikgPT4gdGhpcy5yZW5kZXJCcm93c2VySXRlbShmb2xkZXIpKVxuICAgIGZpbGVzID0gZmlsZXMubWFwKChmaWxlKSA9PiB0aGlzLnJlbmRlckJyb3dzZXJJdGVtKGZpbGUpKVxuXG4gICAgY29uc3QgYnJlYWRjcnVtYnMgPSBzdGF0ZS5kaXJlY3RvcnkubWFwKChkaXIpID0+IHlvYDxsaT48YnV0dG9uIG9uY2xpY2s9JHt0aGlzLmdldE5leHRGb2xkZXIuYmluZCh0aGlzLCBkaXIuaWQsIGRpci50aXRsZSl9PiR7ZGlyLnRpdGxlfTwvYnV0dG9uPjwvbGk+IGApXG4gICAgaWYgKGlzRmlsZVNlbGVjdGVkKSB7XG4gICAgICBwcmV2aWV3RWxlbSA9IHlvYFxuICAgICAgICA8ZGl2PlxuICAgICAgICAgIDxoMT48c3BhbiBjbGFzcz1cIlVwcHlHb29nbGVEcml2ZS1maWxlSWNvblwiPjxpbWcgc3JjPSR7c3RhdGUuYWN0aXZlLmljb25MaW5rfS8+PC9zcGFuPiR7c3RhdGUuYWN0aXZlLnRpdGxlfTwvaDE+XG4gICAgICAgICAgPHVsPlxuICAgICAgICAgICAgPGxpPlR5cGU6ICR7dGhpcy5nZXRGaWxlVHlwZShzdGF0ZS5hY3RpdmUpfTwvbGk+XG4gICAgICAgICAgICA8bGk+TW9kaWZpZWQgQnkgTWU6ICR7c3RhdGUuYWN0aXZlLm1vZGlmaWVkQnlNZURhdGV9PC9saT5cbiAgICAgICAgICA8L3VsPlxuICAgICAgICAgICR7c3RhdGUuYWN0aXZlLnRodW1ibmFpbExpbmsgPyB5b2A8aW1nIHNyYz0ke3N0YXRlLmFjdGl2ZS50aHVtYm5haWxMaW5rfSBjbGFzcz1cIlVwcHlHb29nbGVEcml2ZS1maWxlVGh1bWJuYWlsXCIgLz5gIDogeW9gYH1cbiAgICAgICAgPC9kaXY+XG4gICAgICBgXG4gICAgfVxuXG4gICAgcmV0dXJuIHlvYFxuICAgICAgPGRpdj5cbiAgICAgICAgPGRpdiBjbGFzcz1cIlVwcHlHb29nbGVEcml2ZS1oZWFkZXJcIj5cbiAgICAgICAgICA8dWwgY2xhc3M9XCJVcHB5R29vZ2xlRHJpdmUtYnJlYWRjcnVtYnNcIj5cbiAgICAgICAgICAgICR7YnJlYWRjcnVtYnN9XG4gICAgICAgICAgPC91bD5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJjb250YWluZXItZmx1aWRcIj5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwicm93XCI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiaGlkZGVuLW1kLWRvd24gY29sLWxnLTMgY29sLXhsLTNcIj5cbiAgICAgICAgICAgICAgPHVsIGNsYXNzPVwiVXBweUdvb2dsZURyaXZlLXNpZGViYXJcIj5cbiAgICAgICAgICAgICAgICA8bGkgY2xhc3M9XCJVcHB5R29vZ2xlRHJpdmUtZmlsdGVyXCI+PGlucHV0IGNsYXNzPVwiVXBweUdvb2dsZURyaXZlLWZvY3VzSW5wdXRcIiB0eXBlPSd0ZXh0JyBvbmtleXVwPSR7dGhpcy5maWx0ZXJRdWVyeX0gcGxhY2Vob2xkZXI9XCJTZWFyY2guLlwiIHZhbHVlPSR7c3RhdGUuZmlsdGVySW5wdXR9Lz48L2xpPlxuICAgICAgICAgICAgICAgIDxsaT48YnV0dG9uIG9uY2xpY2s9JHt0aGlzLmdldE5leHRGb2xkZXIuYmluZCh0aGlzLCAncm9vdCcsICdNeSBEcml2ZScpfT48aW1nIHNyYz1cImh0dHBzOi8vc3NsLmdzdGF0aWMuY29tL2RvY3MvZG9jbGlzdC9pbWFnZXMvaWNvbl8xMV9jb2xsZWN0aW9uX2xpc3RfMy5wbmdcIi8+IE15IERyaXZlPC9idXR0b24+PC9saT5cbiAgICAgICAgICAgICAgICA8bGk+PGJ1dHRvbj48aW1nIHNyYz1cImh0dHBzOi8vc3NsLmdzdGF0aWMuY29tL2RvY3MvZG9jbGlzdC9pbWFnZXMvaWNvbl8xMV9zaGFyZWRfY29sbGVjdGlvbl9saXN0XzEucG5nXCIvPiBTaGFyZWQgd2l0aCBtZTwvYnV0dG9uPjwvbGk+XG4gICAgICAgICAgICAgICAgPGxpPjxidXR0b24gb25jbGljaz0ke3RoaXMubG9nb3V0fT5Mb2dvdXQ8L2J1dHRvbj48L2xpPlxuICAgICAgICAgICAgICA8L3VsPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY29sLW1kLTEyIGNvbC1sZy05IGNvbC14bC02XCI+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJVcHB5R29vZ2xlRHJpdmUtYnJvd3NlckNvbnRhaW5lclwiPlxuICAgICAgICAgICAgICAgIDx0YWJsZSBjbGFzcz1cIlVwcHlHb29nbGVEcml2ZS1icm93c2VyXCI+XG4gICAgICAgICAgICAgICAgICA8dGhlYWQ+XG4gICAgICAgICAgICAgICAgICAgIDx0cj5cbiAgICAgICAgICAgICAgICAgICAgICA8dGQgY2xhc3M9XCJVcHB5R29vZ2xlRHJpdmUtc29ydGFibGVIZWFkZXJcIiBvbmNsaWNrPSR7dGhpcy5zb3J0QnlUaXRsZX0+TmFtZTwvdGQ+XG4gICAgICAgICAgICAgICAgICAgICAgPHRkPk93bmVyPC90ZD5cbiAgICAgICAgICAgICAgICAgICAgICA8dGQgY2xhc3M9XCJVcHB5R29vZ2xlRHJpdmUtc29ydGFibGVIZWFkZXJcIiBvbmNsaWNrPSR7dGhpcy5zb3J0QnlEYXRlfT5MYXN0IE1vZGlmaWVkPC90ZD5cbiAgICAgICAgICAgICAgICAgICAgICA8dGQ+RmlsZXNpemU8L3RkPlxuICAgICAgICAgICAgICAgICAgICA8L3RyPlxuICAgICAgICAgICAgICAgICAgPC90aGVhZD5cbiAgICAgICAgICAgICAgICAgIDx0Ym9keT5cbiAgICAgICAgICAgICAgICAgICAgJHtmb2xkZXJzfVxuICAgICAgICAgICAgICAgICAgICAke2ZpbGVzfVxuICAgICAgICAgICAgICAgICAgPC90Ym9keT5cbiAgICAgICAgICAgICAgICA8L3RhYmxlPlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImhpZGRlbi1sZy1kb3duIGNvbC14bC0yXCI+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJVcHB5R29vZ2xlRHJpdmUtZmlsZUluZm9cIj5cbiAgICAgICAgICAgICAgICAke3ByZXZpZXdFbGVtfVxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIGBcbiAgfVxuXG4gIHJlbmRlckJyb3dzZXJJdGVtIChpdGVtKSB7XG4gICAgY29uc3Qgc3RhdGUgPSB0aGlzLmNvcmUuZ2V0U3RhdGUoKS5nb29nbGVEcml2ZVxuICAgIGNvbnN0IGlzQUZpbGVTZWxlY3RlZCA9IE9iamVjdC5rZXlzKHN0YXRlLmFjdGl2ZSkubGVuZ3RoICE9PSAwICYmIEpTT04uc3RyaW5naWZ5KHN0YXRlLmFjdGl2ZSkgIT09IEpTT04uc3RyaW5naWZ5KHt9KVxuICAgIGNvbnN0IGlzRm9sZGVyID0gaXRlbS5taW1lVHlwZSA9PT0gJ2FwcGxpY2F0aW9uL3ZuZC5nb29nbGUtYXBwcy5mb2xkZXInXG4gICAgcmV0dXJuIHlvYFxuICAgICAgPHRyIGNsYXNzPSR7KGlzQUZpbGVTZWxlY3RlZCAmJiBzdGF0ZS5hY3RpdmUuaWQgPT09IGl0ZW0uaWQpID8gJ2lzLWFjdGl2ZScgOiAnJ31cbiAgICAgICAgb25jbGljaz0ke3RoaXMuaGFuZGxlQ2xpY2suYmluZCh0aGlzLCBpdGVtKX1cbiAgICAgICAgb25kYmxjbGljaz0ke2lzRm9sZGVyID8gdGhpcy5nZXROZXh0Rm9sZGVyLmJpbmQodGhpcywgaXRlbS5pZCwgaXRlbS50aXRsZSkgOiB0aGlzLmFkZEZpbGUuYmluZCh0aGlzLCBpdGVtKX0+XG4gICAgICAgIDx0ZD48c3BhbiBjbGFzcz1cIlVwcHlHb29nbGVEcml2ZS1mb2xkZXJJY29uXCI+PGltZyBzcmM9JHtpdGVtLmljb25MaW5rfS8+PC9zcGFuPiAke2l0ZW0udGl0bGV9PC90ZD5cbiAgICAgICAgPHRkPk1lPC90ZD5cbiAgICAgICAgPHRkPiR7aXRlbS5tb2RpZmllZEJ5TWVEYXRlfTwvdGQ+XG4gICAgICAgIDx0ZD4tPC90ZD5cbiAgICAgIDwvdHI+XG4gICAgYFxuICB9XG5cbiAgcmVuZGVyRXJyb3IgKGVycikge1xuICAgIHJldHVybiB5b2BcbiAgICAgIDxkaXY+XG4gICAgICAgIDxzcGFuPlxuICAgICAgICAgIFNvbWV0aGluZyB3ZW50IHdyb25nLiAgUHJvYmFibHkgb3VyIGZhdWx0LiAke2Vycn1cbiAgICAgICAgPC9zcGFuPlxuICAgICAgPC9kaXY+XG4gICAgYFxuICB9XG5cbiAgcmVuZGVyIChzdGF0ZSkge1xuICAgIGlmIChzdGF0ZS5nb29nbGVEcml2ZS5lcnJvcikge1xuICAgICAgcmV0dXJuIHRoaXMucmVuZGVyRXJyb3IoKVxuICAgIH1cblxuICAgIGlmICghc3RhdGUuZ29vZ2xlRHJpdmUuYXV0aGVudGljYXRlZCkge1xuICAgICAgcmV0dXJuIHRoaXMucmVuZGVyQXV0aCgpXG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMucmVuZGVyQnJvd3NlcihzdGF0ZS5nb29nbGVEcml2ZSlcbiAgfVxufVxuIiwiaW1wb3J0IFBsdWdpbiBmcm9tICcuL1BsdWdpbidcbmltcG9ydCB5byBmcm9tICd5by15bydcblxuLyoqXG4gKiBNb2RhbFxuICpcbiAqL1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgTW9kYWwgZXh0ZW5kcyBQbHVnaW4ge1xuICBjb25zdHJ1Y3RvciAoY29yZSwgb3B0cykge1xuICAgIHN1cGVyKGNvcmUsIG9wdHMpXG4gICAgdGhpcy5pZCA9ICdNb2RhbCdcbiAgICB0aGlzLnRpdGxlID0gJ01vZGFsJ1xuICAgIHRoaXMudHlwZSA9ICdvcmNoZXN0cmF0b3InXG5cbiAgICAvLyBzZXQgZGVmYXVsdCBvcHRpb25zXG4gICAgY29uc3QgZGVmYXVsdE9wdGlvbnMgPSB7XG4gICAgICB0YXJnZXQ6ICcuVXBweU1vZGFsJyxcbiAgICAgIGRlZmF1bHRUYWJJY29uOiB5b2BcbiAgICAgICAgPHN2ZyBjbGFzcz1cIlVwcHlNb2RhbFRhYi1pY29uXCIgd2lkdGg9XCIyOFwiIGhlaWdodD1cIjI4XCIgdmlld0JveD1cIjAgMCAxMDEgNThcIj5cbiAgICAgICAgICA8cGF0aCBkPVwiTTE3LjU4Mi4zTC45MTUgNDEuNzEzbDMyLjk0IDEzLjI5NUwxNy41ODIuM3ptODMuMzMzIDQxLjQxNEw2Ny45NzUgNTUuMDEgODQuMjUuM2wxNi42NjUgNDEuNDE0em0tNDguOTk4IDUuNDAzTDYzLjQ0MyAzNS41OUgzOC4zODZsMTEuNTI3IDExLjUyNnY1LjkwNWwtMy4wNjMgMy4zMiAxLjQ3NCAxLjM2IDIuNTktMi44MDYgMi41OSAyLjgwNyAxLjQ3NS0xLjM1Ny0zLjA2NC0zLjMydi01LjkwNnptMTYuMDYtMjYuNzAyYy0zLjk3MyAwLTcuMTk0LTMuMjItNy4xOTQtNy4xOTMgMC0zLjk3MyAzLjIyMi03LjE5MyA3LjE5My03LjE5MyAzLjk3NCAwIDcuMTkzIDMuMjIgNy4xOTMgNy4xOSAwIDMuOTc0LTMuMjIgNy4xOTQtNy4xOTUgNy4xOTR6TTcwLjQ4IDguNjgyYy0uNzM3IDAtMS4zMzYuNi0xLjMzNiAxLjMzNyAwIC43MzYuNiAxLjMzNSAxLjMzNyAxLjMzNS43MzggMCAxLjMzOC0uNTk4IDEuMzM4LTEuMzM2IDAtLjc0LS42LTEuMzM4LTEuMzM4LTEuMzM4ek0zMy44NTUgMjAuNDE1Yy0zLjk3MyAwLTcuMTkzLTMuMjItNy4xOTMtNy4xOTMgMC0zLjk3MyAzLjIyLTcuMTkzIDcuMTk1LTcuMTkzIDMuOTczIDAgNy4xOTIgMy4yMiA3LjE5MiA3LjE5IDAgMy45NzQtMy4yMiA3LjE5NC03LjE5MiA3LjE5NHpNMzYuMzYgOC42ODJjLS43MzcgMC0xLjMzNi42LTEuMzM2IDEuMzM3IDAgLjczNi42IDEuMzM1IDEuMzM3IDEuMzM1LjczOCAwIDEuMzM4LS41OTggMS4zMzgtMS4zMzYgMC0uNzQtLjU5OC0xLjMzOC0xLjMzNy0xLjMzOHpcIi8+XG4gICAgICAgIDwvc3ZnPlxuICAgICAgYCxcbiAgICAgIHBhbmVsU2VsZWN0b3JQcmVmaXg6ICdVcHB5TW9kYWxDb250ZW50LXBhbmVsJ1xuICAgIH1cblxuICAgIC8vIG1lcmdlIGRlZmF1bHQgb3B0aW9ucyB3aXRoIHRoZSBvbmVzIHNldCBieSB1c2VyXG4gICAgdGhpcy5vcHRzID0gT2JqZWN0LmFzc2lnbih7fSwgZGVmYXVsdE9wdGlvbnMsIG9wdHMpXG5cbiAgICB0aGlzLmhpZGVNb2RhbCA9IHRoaXMuaGlkZU1vZGFsLmJpbmQodGhpcylcbiAgICB0aGlzLnNob3dNb2RhbCA9IHRoaXMuc2hvd01vZGFsLmJpbmQodGhpcylcblxuICAgIHRoaXMuYWRkVGFyZ2V0ID0gdGhpcy5hZGRUYXJnZXQuYmluZCh0aGlzKVxuICAgIHRoaXMuc2hvd1RhYlBhbmVsID0gdGhpcy5zaG93VGFiUGFuZWwuYmluZCh0aGlzKVxuICAgIHRoaXMuZXZlbnRzID0gdGhpcy5ldmVudHMuYmluZCh0aGlzKVxuICAgIHRoaXMucmVuZGVyID0gdGhpcy5yZW5kZXIuYmluZCh0aGlzKVxuICAgIHRoaXMuaW5zdGFsbCA9IHRoaXMuaW5zdGFsbC5iaW5kKHRoaXMpXG4gIH1cblxuICBhZGRUYXJnZXQgKHBsdWdpbikge1xuICAgIGNvbnN0IGNhbGxlclBsdWdpbklkID0gcGx1Z2luLmNvbnN0cnVjdG9yLm5hbWVcbiAgICBjb25zdCBjYWxsZXJQbHVnaW5OYW1lID0gcGx1Z2luLnRpdGxlIHx8IGNhbGxlclBsdWdpbklkXG4gICAgY29uc3QgY2FsbGVyUGx1Z2luSWNvbiA9IHBsdWdpbi5pY29uIHx8IHRoaXMub3B0cy5kZWZhdWx0VGFiSWNvblxuICAgIGNvbnN0IGNhbGxlclBsdWdpblR5cGUgPSBwbHVnaW4udHlwZVxuXG4gICAgaWYgKGNhbGxlclBsdWdpblR5cGUgIT09ICdhY3F1aXJlcicgJiZcbiAgICAgICAgY2FsbGVyUGx1Z2luVHlwZSAhPT0gJ3Byb2dyZXNzaW5kaWNhdG9yJyAmJlxuICAgICAgICBjYWxsZXJQbHVnaW5UeXBlICE9PSAncHJlc2VudGVyJykge1xuICAgICAgbGV0IG1zZyA9ICdFcnJvcjogTW9kYWwgY2FuIG9ubHkgYmUgdXNlZCBieSBwbHVnaW5zIG9mIHR5cGVzOiBhY3F1aXJlciwgcHJvZ3Jlc3NpbmRpY2F0b3IsIHByZXNlbnRlcidcbiAgICAgIHRoaXMuY29yZS5sb2cobXNnKVxuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgY29uc3QgdGFyZ2V0ID0ge1xuICAgICAgaWQ6IGNhbGxlclBsdWdpbklkLFxuICAgICAgbmFtZTogY2FsbGVyUGx1Z2luTmFtZSxcbiAgICAgIGljb246IGNhbGxlclBsdWdpbkljb24sXG4gICAgICB0eXBlOiBjYWxsZXJQbHVnaW5UeXBlLFxuICAgICAgZm9jdXM6IHBsdWdpbi5mb2N1cyxcbiAgICAgIHJlbmRlcjogcGx1Z2luLnJlbmRlcixcbiAgICAgIGlzSGlkZGVuOiB0cnVlXG4gICAgfVxuXG4gICAgY29uc3QgbW9kYWwgPSB0aGlzLmNvcmUuZ2V0U3RhdGUoKS5tb2RhbFxuXG4gICAgdGhpcy5jb3JlLnNldFN0YXRlKHtcbiAgICAgIG1vZGFsOiBPYmplY3QuYXNzaWduKHt9LCBtb2RhbCwge1xuICAgICAgICB0YXJnZXRzOiBtb2RhbC50YXJnZXRzLmNvbmNhdChbdGFyZ2V0XSlcbiAgICAgIH0pXG4gICAgfSlcblxuICAgIHJldHVybiB0aGlzLm9wdHMudGFyZ2V0XG4gIH1cblxuICBzaG93VGFiUGFuZWwgKGlkKSB7XG4gICAgY29uc3QgbW9kYWwgPSB0aGlzLmNvcmUuZ2V0U3RhdGUoKS5tb2RhbFxuXG4gICAgLy8gaGlkZSBhbGwgcGFuZWxzLCBleGNlcHQgdGhlIG9uZSB0aGF0IG1hdGNoZXMgY3VycmVudCBpZFxuICAgIGNvbnN0IG5ld1RhcmdldHMgPSBtb2RhbC50YXJnZXRzLm1hcCgodGFyZ2V0KSA9PiB7XG4gICAgICBpZiAodGFyZ2V0LnR5cGUgPT09ICdhY3F1aXJlcicpIHtcbiAgICAgICAgaWYgKHRhcmdldC5pZCA9PT0gaWQpIHtcbiAgICAgICAgICB0YXJnZXQuZm9jdXMoKVxuICAgICAgICAgIHJldHVybiBPYmplY3QuYXNzaWduKHt9LCB0YXJnZXQsIHtcbiAgICAgICAgICAgIGlzSGlkZGVuOiBmYWxzZVxuICAgICAgICAgIH0pXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIE9iamVjdC5hc3NpZ24oe30sIHRhcmdldCwge1xuICAgICAgICAgIGlzSGlkZGVuOiB0cnVlXG4gICAgICAgIH0pXG4gICAgICB9XG4gICAgICByZXR1cm4gdGFyZ2V0XG4gICAgfSlcblxuICAgIHRoaXMuY29yZS5zZXRTdGF0ZSh7bW9kYWw6IE9iamVjdC5hc3NpZ24oe30sIG1vZGFsLCB7XG4gICAgICB0YXJnZXRzOiBuZXdUYXJnZXRzXG4gICAgfSl9KVxuICB9XG5cbiAgaGlkZU1vZGFsICgpIHtcbiAgICAvLyBTdHJhaWdodGZvcndhcmQgc2ltcGxlIHdheVxuICAgIC8vIHRoaXMuY29yZS5zdGF0ZS5tb2RhbC5pc0hpZGRlbiA9IHRydWVcbiAgICAvLyB0aGlzLmNvcmUudXBkYXRlQWxsKClcblxuICAgIC8vIFRoZSDigJxyaWdodCB3YXnigJ1cbiAgICBjb25zdCBtb2RhbCA9IHRoaXMuY29yZS5nZXRTdGF0ZSgpLm1vZGFsXG5cbiAgICBjb25zdCBuZXdUYXJnZXRzID0gbW9kYWwudGFyZ2V0cy5tYXAoKHRhcmdldCkgPT4ge1xuICAgICAgdGFyZ2V0LmlzSGlkZGVuID0gdHJ1ZVxuICAgICAgcmV0dXJuIHRhcmdldFxuICAgIH0pXG5cbiAgICB0aGlzLmNvcmUuc2V0U3RhdGUoe1xuICAgICAgbW9kYWw6IE9iamVjdC5hc3NpZ24oe30sIG1vZGFsLCB7XG4gICAgICAgIGlzSGlkZGVuOiB0cnVlLFxuICAgICAgICB0YXJnZXRzOiBuZXdUYXJnZXRzXG4gICAgICB9KVxuICAgIH0pXG5cbiAgICBkb2N1bWVudC5ib2R5LmNsYXNzTGlzdC5yZW1vdmUoJ2lzLVVwcHlNb2RhbC1vcGVuJylcbiAgfVxuXG4gIHNob3dNb2RhbCAoKSB7XG4gICAgY29uc3QgbW9kYWwgPSB0aGlzLmNvcmUuZ2V0U3RhdGUoKS5tb2RhbFxuXG4gICAgLy8gU2hvdyBmaXJzdCBhY3F1aXJlciBwbHVnaW4gd2hlbiBtb2RhbCBpcyBvcGVuXG4gICAgbGV0IGZvdW5kID0gZmFsc2VcbiAgICBjb25zdCBuZXdUYXJnZXRzID0gbW9kYWwudGFyZ2V0cy5tYXAoKHRhcmdldCkgPT4ge1xuICAgICAgaWYgKHRhcmdldC50eXBlID09PSAnYWNxdWlyZXInICYmICFmb3VuZCkge1xuICAgICAgICBmb3VuZCA9IHRydWVcbiAgICAgICAgdGFyZ2V0LmZvY3VzKClcblxuICAgICAgICByZXR1cm4gT2JqZWN0LmFzc2lnbih7fSwgdGFyZ2V0LCB7XG4gICAgICAgICAgaXNIaWRkZW46IGZhbHNlXG4gICAgICAgIH0pXG4gICAgICB9XG4gICAgICByZXR1cm4gdGFyZ2V0XG4gICAgfSlcblxuICAgIHRoaXMuY29yZS5zZXRTdGF0ZSh7XG4gICAgICBtb2RhbDogT2JqZWN0LmFzc2lnbih7fSwgbW9kYWwsIHtcbiAgICAgICAgaXNIaWRkZW46IGZhbHNlLFxuICAgICAgICB0YXJnZXRzOiBuZXdUYXJnZXRzXG4gICAgICB9KVxuICAgIH0pXG5cbiAgICAvLyBhZGQgY2xhc3MgdG8gYm9keSB0aGF0IHNldHMgcG9zaXRpb24gZml4ZWRcbiAgICBkb2N1bWVudC5ib2R5LmNsYXNzTGlzdC5hZGQoJ2lzLVVwcHlNb2RhbC1vcGVuJylcbiAgICAvLyBmb2N1cyBvbiBtb2RhbCBpbm5lciBibG9ja1xuICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJypbdGFiaW5kZXg9XCIwXCJdJykuZm9jdXMoKVxuICB9XG5cbiAgZXZlbnRzICgpIHtcbiAgICAvLyBNb2RhbCBvcGVuIGJ1dHRvblxuICAgIGNvbnN0IHNob3dNb2RhbFRyaWdnZXIgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKHRoaXMub3B0cy50cmlnZ2VyKVxuICAgIHNob3dNb2RhbFRyaWdnZXIuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCB0aGlzLnNob3dNb2RhbClcblxuICAgIC8vIENsb3NlIHRoZSBNb2RhbCBvbiBlc2Mga2V5IHByZXNzXG4gICAgZG9jdW1lbnQuYm9keS5hZGRFdmVudExpc3RlbmVyKCdrZXl1cCcsIChldmVudCkgPT4ge1xuICAgICAgaWYgKGV2ZW50LmtleUNvZGUgPT09IDI3KSB7XG4gICAgICAgIHRoaXMuaGlkZU1vZGFsKClcbiAgICAgIH1cbiAgICB9KVxuXG4gICAgLy8gQ2xvc2Ugb24gY2xpY2sgb3V0c2lkZSBtb2RhbCBvciBjbG9zZSBidXR0b25zXG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZSkgPT4ge1xuICAgICAgaWYgKGUudGFyZ2V0LmNsYXNzTGlzdC5jb250YWlucygnanMtVXBweU1vZGFsLWNsb3NlJykpIHtcbiAgICAgICAgdGhpcy5oaWRlTW9kYWwoKVxuICAgICAgfVxuICAgIH0pXG4gIH1cblxuICByZW5kZXIgKHN0YXRlKSB7XG4gICAgLy8gaHR0cDovL2Rldi5lZGVuc3BpZWtlcm1hbm4uY29tLzIwMTYvMDIvMTEvaW50cm9kdWNpbmctYWNjZXNzaWJsZS1tb2RhbC1kaWFsb2dcblxuICAgIGNvbnN0IG1vZGFsVGFyZ2V0cyA9IHN0YXRlLm1vZGFsLnRhcmdldHNcblxuICAgIGNvbnN0IGFjcXVpcmVycyA9IG1vZGFsVGFyZ2V0cy5maWx0ZXIoKHRhcmdldCkgPT4ge1xuICAgICAgcmV0dXJuIHRhcmdldC50eXBlID09PSAnYWNxdWlyZXInXG4gICAgfSlcblxuICAgIGNvbnN0IHByb2dyZXNzaW5kaWNhdG9ycyA9IG1vZGFsVGFyZ2V0cy5maWx0ZXIoKHRhcmdldCkgPT4ge1xuICAgICAgcmV0dXJuIHRhcmdldC50eXBlID09PSAncHJvZ3Jlc3NpbmRpY2F0b3InXG4gICAgfSlcblxuICAgIGNvbnN0IHRhcmdldENsYXNzTmFtZSA9IHRoaXMub3B0cy50YXJnZXQuc3Vic3RyaW5nKDEpXG5cbiAgICByZXR1cm4geW9gPGRpdiBjbGFzcz1cIiR7dGFyZ2V0Q2xhc3NOYW1lfVwiXG4gICAgICAgICAgICAgICAgICAgYXJpYS1oaWRkZW49XCIke3N0YXRlLm1vZGFsLmlzSGlkZGVufVwiXG4gICAgICAgICAgICAgICAgICAgYXJpYS1sYWJlbD1cIlVwcHkgRGlhbG9nIFdpbmRvdyAoUHJlc3MgZXNjYXBlIHRvIGNsb3NlKVwiXG4gICAgICAgICAgICAgICAgICAgcm9sZT1cImRpYWxvZ1wiPlxuICAgICAgPGRpdiBjbGFzcz1cIlVwcHlNb2RhbC1vdmVybGF5XCJcbiAgICAgICAgICAgICAgICAgIG9uY2xpY2s9JHt0aGlzLmhpZGVNb2RhbH0+PC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJVcHB5TW9kYWwtaW5uZXJcIiB0YWJpbmRleD1cIjBcIj5cbiAgICAgICAgPHVsIGNsYXNzPVwiVXBweU1vZGFsVGFic1wiIHJvbGU9XCJ0YWJsaXN0XCI+XG4gICAgICAgICAgJHthY3F1aXJlcnMubWFwKCh0YXJnZXQpID0+IHtcbiAgICAgICAgICAgIHJldHVybiB5b2A8bGkgY2xhc3M9XCJVcHB5TW9kYWxUYWJcIj5cbiAgICAgICAgICAgICAgPGJ1dHRvbiBjbGFzcz1cIlVwcHlNb2RhbFRhYi1idG5cIlxuICAgICAgICAgICAgICAgICAgICAgIHJvbGU9XCJ0YWJcIlxuICAgICAgICAgICAgICAgICAgICAgIHRhYmluZGV4PVwiMFwiXG4gICAgICAgICAgICAgICAgICAgICAgYXJpYS1jb250cm9scz1cIiR7dGhpcy5vcHRzLnBhbmVsU2VsZWN0b3JQcmVmaXh9LS0ke3RhcmdldC5pZH1cIlxuICAgICAgICAgICAgICAgICAgICAgIGFyaWEtc2VsZWN0ZWQ9XCIke3RhcmdldC5pc0hpZGRlbiA/ICdmYWxzZScgOiAndHJ1ZSd9XCJcbiAgICAgICAgICAgICAgICAgICAgICBvbmNsaWNrPSR7dGhpcy5zaG93VGFiUGFuZWwuYmluZCh0aGlzLCB0YXJnZXQuaWQpfT5cbiAgICAgICAgICAgICAgICAke3RhcmdldC5pY29ufVxuICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiVXBweU1vZGFsVGFiLW5hbWVcIj4ke3RhcmdldC5uYW1lfTwvc3Bhbj5cbiAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICA8L2xpPmBcbiAgICAgICAgICB9KX1cbiAgICAgICAgPC91bD5cblxuICAgICAgICA8ZGl2IGNsYXNzPVwiVXBweU1vZGFsQ29udGVudFwiPlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJVcHB5TW9kYWwtcHJlc2VudGVyXCI+PC9kaXY+XG4gICAgICAgICAgJHthY3F1aXJlcnMubWFwKCh0YXJnZXQpID0+IHtcbiAgICAgICAgICAgIHJldHVybiB5b2A8ZGl2IGNsYXNzPVwiVXBweU1vZGFsQ29udGVudC1wYW5lbFwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICBpZD1cIiR7dGhpcy5vcHRzLnBhbmVsU2VsZWN0b3JQcmVmaXh9LS0ke3RhcmdldC5pZH1cIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgcm9sZT1cInRhYnBhbmVsXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIGFyaWEtaGlkZGVuPVwiJHt0YXJnZXQuaXNIaWRkZW59XCI+XG4gICAgICAgICAgICAgICR7dGFyZ2V0LnJlbmRlcihzdGF0ZSl9XG4gICAgICAgICAgICA8L2Rpdj5gXG4gICAgICAgICAgfSl9XG4gICAgICAgIDwvZGl2PlxuICAgICAgICA8ZGl2IGNsYXNzPVwiVXBweU1vZGFsLXByb2dyZXNzaW5kaWNhdG9yc1wiPlxuICAgICAgICAgICR7cHJvZ3Jlc3NpbmRpY2F0b3JzLm1hcCgodGFyZ2V0KSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gdGFyZ2V0LnJlbmRlcihzdGF0ZSlcbiAgICAgICAgICB9KX1cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxidXR0b24gY2xhc3M9XCJVcHB5TW9kYWwtY2xvc2VcIlxuICAgICAgICAgICAgICAgIHRpdGxlPVwiQ2xvc2UgVXBweSBtb2RhbFwiXG4gICAgICAgICAgICAgICAgb25jbGljaz0ke3RoaXMuaGlkZU1vZGFsfT7DlzwvYnV0dG9uPlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+YFxuICB9XG5cbiAgaW5zdGFsbCAoKSB7XG4gICAgLy8gU2V0IGRlZmF1bHQgc3RhdGUgZm9yIE1vZGFsXG4gICAgdGhpcy5jb3JlLnNldFN0YXRlKHttb2RhbDoge1xuICAgICAgaXNIaWRkZW46IHRydWUsXG4gICAgICB0YXJnZXRzOiBbXVxuICAgIH19KVxuXG4gICAgdGhpcy5lbCA9IHRoaXMucmVuZGVyKHRoaXMuY29yZS5zdGF0ZSlcbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHRoaXMuZWwpXG5cbiAgICB0aGlzLmV2ZW50cygpXG4gIH1cbn1cbiIsImltcG9ydCBQbHVnaW4gZnJvbSAnLi9QbHVnaW4nXG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIE11bHRpcGFydCBleHRlbmRzIFBsdWdpbiB7XG4gIGNvbnN0cnVjdG9yIChjb3JlLCBvcHRzKSB7XG4gICAgc3VwZXIoY29yZSwgb3B0cylcbiAgICB0aGlzLnR5cGUgPSAndXBsb2FkZXInXG4gICAgdGhpcy5pZCA9ICdNdWx0aXBhcnQnXG4gICAgdGhpcy50aXRsZSA9ICdNdWx0aXBhcnQnXG5cbiAgICAvLyBEZWZhdWx0IG9wdGlvbnNcbiAgICBjb25zdCBkZWZhdWx0T3B0aW9ucyA9IHtcbiAgICAgIGZpZWxkTmFtZTogJ2ZpbGVzW10nLFxuICAgICAgcmVzcG9uc2VVcmxGaWVsZE5hbWU6ICd1cmwnLFxuICAgICAgYnVuZGxlOiB0cnVlXG4gICAgfVxuXG4gICAgLy8gTWVyZ2UgZGVmYXVsdCBvcHRpb25zIHdpdGggdGhlIG9uZXMgc2V0IGJ5IHVzZXJcbiAgICB0aGlzLm9wdHMgPSBPYmplY3QuYXNzaWduKHt9LCBkZWZhdWx0T3B0aW9ucywgb3B0cylcbiAgfVxuXG4gIHVwbG9hZCAoZmlsZSwgY3VycmVudCwgdG90YWwpIHtcbiAgICB0aGlzLmNvcmUubG9nKGB1cGxvYWRpbmcgJHtjdXJyZW50fSBvZiAke3RvdGFsfWApXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIC8vIHR1cm4gZmlsZSBpbnRvIGFuIGFycmF5IHNvIHdlIGNhbiB1c2UgYnVuZGxlXG4gICAgICAvLyBpZiAoIXRoaXMub3B0cy5idW5kbGUpIHtcbiAgICAgIC8vICAgZmlsZXMgPSBbZmlsZXNbY3VycmVudF1dXG4gICAgICAvLyB9XG5cbiAgICAgIC8vIGZvciAobGV0IGkgaW4gZmlsZXMpIHtcbiAgICAgIC8vICAgZm9ybVBvc3QuYXBwZW5kKHRoaXMub3B0cy5maWVsZE5hbWUsIGZpbGVzW2ldKVxuICAgICAgLy8gfVxuXG4gICAgICBjb25zdCBmb3JtUG9zdCA9IG5ldyBGb3JtRGF0YSgpXG4gICAgICBmb3JtUG9zdC5hcHBlbmQodGhpcy5vcHRzLmZpZWxkTmFtZSwgZmlsZS5kYXRhKVxuXG4gICAgICBjb25zdCB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKVxuXG4gICAgICB4aHIudXBsb2FkLmFkZEV2ZW50TGlzdGVuZXIoJ3Byb2dyZXNzJywgKGV2KSA9PiB7XG4gICAgICAgIGlmIChldi5sZW5ndGhDb21wdXRhYmxlKSB7XG4gICAgICAgICAgbGV0IHBlcmNlbnRhZ2UgPSAoZXYubG9hZGVkIC8gZXYudG90YWwgKiAxMDApLnRvRml4ZWQoMilcbiAgICAgICAgICBwZXJjZW50YWdlID0gTWF0aC5yb3VuZChwZXJjZW50YWdlKVxuICAgICAgICAgIHRoaXMuY29yZS5sb2cocGVyY2VudGFnZSlcblxuICAgICAgICAgIC8vIERpc3BhdGNoIHByb2dyZXNzIGV2ZW50XG4gICAgICAgICAgdGhpcy5jb3JlLmVtaXR0ZXIuZW1pdCgndXBsb2FkLXByb2dyZXNzJywge1xuICAgICAgICAgICAgdXBsb2FkZXI6IHRoaXMsXG4gICAgICAgICAgICBpZDogZmlsZS5pZCxcbiAgICAgICAgICAgIHBlcmNlbnRhZ2U6IHBlcmNlbnRhZ2VcbiAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgICB9KVxuXG4gICAgICB4aHIuYWRkRXZlbnRMaXN0ZW5lcignbG9hZCcsIChldikgPT4ge1xuICAgICAgICBpZiAoZXYudGFyZ2V0LnN0YXR1cyA9PT0gMjAwKSB7XG4gICAgICAgICAgY29uc3QgcmVzcCA9IEpTT04ucGFyc2UoeGhyLnJlc3BvbnNlKVxuICAgICAgICAgIGZpbGUudXBsb2FkVVJMID0gcmVzcFt0aGlzLm9wdHMucmVzcG9uc2VVcmxGaWVsZE5hbWVdXG5cbiAgICAgICAgICB0aGlzLmNvcmUubG9nKGBEb3dubG9hZCAke2ZpbGUubmFtZX0gZnJvbSAke2ZpbGUudXBsb2FkVVJMfWApXG4gICAgICAgICAgcmV0dXJuIHJlc29sdmUoZmlsZSlcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHZhciB1cGxvYWQgPSB7fVxuICAgICAgICAvL1xuICAgICAgICAvLyBpZiAodGhpcy5vcHRzLmJ1bmRsZSkge1xuICAgICAgICAvLyAgIHVwbG9hZCA9IHtmaWxlczogZmlsZXN9XG4gICAgICAgIC8vIH0gZWxzZSB7XG4gICAgICAgIC8vICAgdXBsb2FkID0ge2ZpbGU6IGZpbGVzW2N1cnJlbnRdfVxuICAgICAgICAvLyB9XG5cbiAgICAgICAgLy8gcmV0dXJuIHJlc29sdmUodXBsb2FkKVxuICAgICAgfSlcblxuICAgICAgeGhyLmFkZEV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgKGV2KSA9PiB7XG4gICAgICAgIHJldHVybiByZWplY3QoJ2Z1Y2tpbmcgZXJyb3IhJylcbiAgICAgIH0pXG5cbiAgICAgIHhoci5vcGVuKCdQT1NUJywgdGhpcy5vcHRzLmVuZHBvaW50LCB0cnVlKVxuICAgICAgeGhyLnNlbmQoZm9ybVBvc3QpXG4gICAgfSlcbiAgfVxuXG4gIHJ1biAoKSB7XG4gICAgY29uc3QgZmlsZXMgPSB0aGlzLmNvcmUuc3RhdGUuZmlsZXNcblxuICAgIGNvbnN0IGZpbGVzRm9yVXBsb2FkID0gW11cbiAgICBPYmplY3Qua2V5cyhmaWxlcykuZm9yRWFjaCgoZmlsZSkgPT4ge1xuICAgICAgaWYgKGZpbGVzW2ZpbGVdLnByb2dyZXNzID09PSAwKSB7XG4gICAgICAgIGZpbGVzRm9yVXBsb2FkLnB1c2goZmlsZXNbZmlsZV0pXG4gICAgICB9XG4gICAgfSlcblxuICAgIGNvbnN0IHVwbG9hZGVycyA9IFtdXG4gICAgZmlsZXNGb3JVcGxvYWQuZm9yRWFjaCgoZmlsZSwgaSkgPT4ge1xuICAgICAgY29uc3QgY3VycmVudCA9IHBhcnNlSW50KGksIDEwKSArIDFcbiAgICAgIGNvbnN0IHRvdGFsID0gZmlsZXNGb3JVcGxvYWQubGVuZ3RoXG4gICAgICB1cGxvYWRlcnMucHVzaCh0aGlzLnVwbG9hZChmaWxlLCBjdXJyZW50LCB0b3RhbCkpXG4gICAgfSlcblxuICAgIFByb21pc2UuYWxsKHVwbG9hZGVycykudGhlbigocmVzdWx0KSA9PiB7XG4gICAgICB0aGlzLmNvcmUubG9nKCdNdWx0aXBhcnQgaGFzIGZpbmlzaGVkIHVwbG9hZGluZyEnKVxuICAgIH0pXG5cbiAgICAvLyAgIGNvbnNvbGUubG9nKHtcbiAgICAvLyAgICAgY2xhc3M6ICdNdWx0aXBhcnQnLFxuICAgIC8vICAgICBtZXRob2Q6ICdydW4nLFxuICAgIC8vICAgICByZXN1bHRzOiByZXN1bHRzXG4gICAgLy8gICB9KVxuICAgIC8vXG4gICAgLy8gICBjb25zdCBmaWxlcyA9IHJlc3VsdHNcbiAgICAvL1xuICAgIC8vICAgdmFyIHVwbG9hZGVycyA9IFtdXG4gICAgLy9cbiAgICAvLyAgIGlmICh0aGlzLm9wdHMuYnVuZGxlKSB7XG4gICAgLy8gICAgIHVwbG9hZGVycy5wdXNoKHRoaXMudXBsb2FkKGZpbGVzLCAwLCBmaWxlcy5sZW5ndGgpKVxuICAgIC8vICAgfSBlbHNlIHtcbiAgICAvLyAgICAgZm9yIChsZXQgaSBpbiBmaWxlcykge1xuICAgIC8vICAgICAgIHVwbG9hZGVycy5wdXNoKHRoaXMudXBsb2FkKGZpbGVzLCBpLCBmaWxlcy5sZW5ndGgpKVxuICAgIC8vICAgICB9XG4gICAgLy8gICB9XG4gICAgLy9cbiAgICAvLyAgIHJldHVybiBQcm9taXNlLmFsbCh1cGxvYWRlcnMpXG4gIH1cblxuICBpbnN0YWxsICgpIHtcbiAgICB0aGlzLmNvcmUuZW1pdHRlci5vbignbmV4dCcsICgpID0+IHtcbiAgICAgIHRoaXMuY29yZS5sb2coJ011bHRpcGFydCBpcyB1cGxvYWRpbmcuLi4nKVxuICAgICAgdGhpcy5ydW4oKVxuICAgIH0pXG4gIH1cbn1cbiIsImltcG9ydCB5byBmcm9tICd5by15bydcblxuLyoqXG4gKiBCb2lsZXJwbGF0ZSB0aGF0IGFsbCBQbHVnaW5zIHNoYXJlIC0gYW5kIHNob3VsZCBub3QgYmUgdXNlZFxuICogZGlyZWN0bHkuIEl0IGFsc28gc2hvd3Mgd2hpY2ggbWV0aG9kcyBmaW5hbCBwbHVnaW5zIHNob3VsZCBpbXBsZW1lbnQvb3ZlcnJpZGUsXG4gKiB0aGlzIGRlY2lkaW5nIG9uIHN0cnVjdHVyZS5cbiAqXG4gKiBAcGFyYW0ge29iamVjdH0gbWFpbiBVcHB5IGNvcmUgb2JqZWN0XG4gKiBAcGFyYW0ge29iamVjdH0gb2JqZWN0IHdpdGggcGx1Z2luIG9wdGlvbnNcbiAqIEByZXR1cm4ge2FycmF5IHwgc3RyaW5nfSBmaWxlcyBvciBzdWNjZXNzL2ZhaWwgbWVzc2FnZVxuICovXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBQbHVnaW4ge1xuXG4gIGNvbnN0cnVjdG9yIChjb3JlLCBvcHRzKSB7XG4gICAgdGhpcy5jb3JlID0gY29yZVxuICAgIHRoaXMub3B0cyA9IG9wdHNcbiAgICB0aGlzLnR5cGUgPSAnbm9uZSdcblxuICAgIHRoaXMudXBkYXRlID0gdGhpcy51cGRhdGUuYmluZCh0aGlzKVxuICAgIHRoaXMubW91bnQgPSB0aGlzLm1vdW50LmJpbmQodGhpcylcbiAgICB0aGlzLmZvY3VzID0gdGhpcy5mb2N1cy5iaW5kKHRoaXMpXG4gICAgdGhpcy5pbnN0YWxsID0gdGhpcy5pbnN0YWxsLmJpbmQodGhpcylcbiAgfVxuXG4gIHVwZGF0ZSAoKSB7XG4gICAgaWYgKHR5cGVvZiB0aGlzLmVsID09PSAndW5kZWZpbmVkJykge1xuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgY29uc3QgbmV3RWwgPSB0aGlzLnJlbmRlcih0aGlzLmNvcmUuc3RhdGUpXG4gICAgeW8udXBkYXRlKHRoaXMuZWwsIG5ld0VsKVxuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrIGlmIHN1cHBsaWVkIGB0YXJnZXRgIGlzIGEgYHN0cmluZ2Agb3IgYW4gYG9iamVjdGAuXG4gICAqIElmIGl04oCZcyBhbiBvYmplY3Qg4oCUIHRhcmdldCBpcyBhIHBsdWdpbiwgYW5kIHdlIHNlYXJjaCBgcGx1Z2luc2BcbiAgICogZm9yIGEgcGx1Z2luIHdpdGggc2FtZSBuYW1lIGFuZCByZXR1cm4gaXRzIHRhcmdldC5cbiAgICpcbiAgICogQHBhcmFtIHtTdHJpbmd8T2JqZWN0fSB0YXJnZXRcbiAgICpcbiAgICovXG4gIG1vdW50ICh0YXJnZXQsIHBsdWdpbikge1xuICAgIGNvbnN0IGNhbGxlclBsdWdpbk5hbWUgPSBwbHVnaW4uaWRcblxuICAgIGlmICh0eXBlb2YgdGFyZ2V0ID09PSAnc3RyaW5nJykge1xuICAgICAgdGhpcy5jb3JlLmxvZyhgSW5zdGFsbGluZyAke2NhbGxlclBsdWdpbk5hbWV9IHRvICR7dGFyZ2V0fWApXG5cbiAgICAgIC8vIGNsZWFyIGV2ZXJ5dGhpbmcgaW5zaWRlIHRoZSB0YXJnZXQgc2VsZWN0b3JcbiAgICAgIC8vIGlmIChyZXBsYWNlVGFyZ2V0Q29udGVudCkge1xuICAgICAgLy8gICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKHRhcmdldCkuaW5uZXJIVE1MID0gJydcbiAgICAgIC8vIH1cbiAgICAgIHRoaXMuZWwgPSBwbHVnaW4ucmVuZGVyKHRoaXMuY29yZS5zdGF0ZSlcbiAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IodGFyZ2V0KS5hcHBlbmRDaGlsZCh0aGlzLmVsKVxuXG4gICAgICByZXR1cm4gdGFyZ2V0XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFRPRE86IGlzIGluc3RhbnRpYXRpbmcgdGhlIHBsdWdpbiByZWFsbHkgdGhlIHdheSB0byByb2xsXG4gICAgICAvLyBqdXN0IHRvIGdldCB0aGUgcGx1Z2luIG5hbWU/XG4gICAgICBjb25zdCBUYXJnZXQgPSB0YXJnZXRcbiAgICAgIGNvbnN0IHRhcmdldFBsdWdpbk5hbWUgPSBuZXcgVGFyZ2V0KCkuaWRcblxuICAgICAgdGhpcy5jb3JlLmxvZyhgSW5zdGFsbGluZyAke2NhbGxlclBsdWdpbk5hbWV9IHRvICR7dGFyZ2V0UGx1Z2luTmFtZX1gKVxuXG4gICAgICBjb25zdCB0YXJnZXRQbHVnaW4gPSB0aGlzLmNvcmUuZ2V0UGx1Z2luKHRhcmdldFBsdWdpbk5hbWUpXG4gICAgICBjb25zdCBzZWxlY3RvclRhcmdldCA9IHRhcmdldFBsdWdpbi5hZGRUYXJnZXQocGx1Z2luKVxuXG4gICAgICByZXR1cm4gc2VsZWN0b3JUYXJnZXRcbiAgICB9XG4gIH1cblxuICBmb2N1cyAoKSB7XG4gICAgcmV0dXJuXG4gIH1cblxuICBpbnN0YWxsICgpIHtcbiAgICByZXR1cm5cbiAgfVxuXG4gIHJ1biAoKSB7XG4gICAgcmV0dXJuXG4gIH1cbn1cbiIsImltcG9ydCBQbHVnaW4gZnJvbSAnLi9QbHVnaW4nXG5cbi8qKlxuICogUHJlc2VudFxuICpcbiAqL1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgUHJlc2VudCBleHRlbmRzIFBsdWdpbiB7XG4gIGNvbnN0cnVjdG9yIChjb3JlLCBvcHRzKSB7XG4gICAgc3VwZXIoY29yZSwgb3B0cylcbiAgICB0aGlzLmlkID0gJ1ByZXNlbnQnXG4gICAgdGhpcy50aXRsZSA9ICdQcmVzZW50J1xuICAgIHRoaXMudHlwZSA9ICdwcmVzZW50ZXInXG5cbiAgICAvLyBzZXQgZGVmYXVsdCBvcHRpb25zXG4gICAgY29uc3QgZGVmYXVsdE9wdGlvbnMgPSB7XG4gICAgICB0YXJnZXQ6ICcuVXBweVByZXNlbnRlci1jb250YWluZXInXG4gICAgfVxuXG4gICAgLy8gbWVyZ2UgZGVmYXVsdCBvcHRpb25zIHdpdGggdGhlIG9uZXMgc2V0IGJ5IHVzZXJcbiAgICB0aGlzLm9wdHMgPSBPYmplY3QuYXNzaWduKHt9LCBkZWZhdWx0T3B0aW9ucywgb3B0cylcbiAgfVxuXG4gIHJlbmRlciAoKSB7XG4gICAgcmV0dXJuIGBcbiAgICAgIDxkaXYgY2xhc3M9XCJVcHB5UHJlc2VudGVyXCI+PC9kaXY+XG4gICAgYFxuICB9XG5cbiAgaGlkZVByZXNlbnRlciAoKSB7XG4gICAgdGhpcy5wcmVzZW50ZXIuY2xhc3NMaXN0LnJlbW92ZSgnaXMtdmlzaWJsZScpXG4gIH1cblxuICBzaG93UHJlc2VudGVyICh0YXJnZXQsIHVwbG9hZGVkQ291bnQpIHtcbiAgICB0aGlzLnByZXNlbnRlci5jbGFzc0xpc3QuYWRkKCdpcy12aXNpYmxlJylcbiAgICB0aGlzLnByZXNlbnRlci5pbm5lckhUTUwgPSBgXG4gICAgICA8cD5Zb3UgaGF2ZSBzdWNjZXNzZnVsbHkgdXBsb2FkZWRcbiAgICAgICAgPHN0cm9uZz4ke3RoaXMuY29yZS5pMThuKCdmaWxlcycsIHsnc21hcnRfY291bnQnOiB1cGxvYWRlZENvdW50fSl9PC9zdHJvbmc+XG4gICAgICA8L3A+XG4gICAgICAke3RhcmdldCA9PT0gJ01vZGFsJ1xuICAgICAgICA/IGA8YnV0dG9uIGNsYXNzPVwiVXBweVByZXNlbnRlci1tb2RhbENsb3NlIGpzLVVwcHlNb2RhbC1jbG9zZVwiIHR5cGU9XCJidXR0b25cIj4ke3RoaXMuY29yZS5pMThuKCdjbG9zZU1vZGFsJyl9PC9idXR0b24+YFxuICAgICAgICA6ICcnfVxuICAgIGBcbiAgfVxuXG4gIGluaXRFdmVudHMgKCkge1xuICAgIHRoaXMuY29yZS5lbWl0dGVyLm9uKCdyZXNldCcsIChkYXRhKSA9PiB7XG4gICAgICB0aGlzLmhpZGVQcmVzZW50ZXIoKVxuICAgIH0pXG4gIH1cblxuICBydW4gKHJlc3VsdHMpIHtcbiAgICAvLyBFbWl0IGFsbERvbmUgZXZlbnQgc28gdGhhdCwgZm9yIGV4YW1wbGUsIE1vZGFsIGNhbiBoaWRlIGFsbCB0YWJzXG4gICAgdGhpcy5jb3JlLmVtaXR0ZXIuZW1pdCgnYWxsRG9uZScpXG5cbiAgICBjb25zdCB1cGxvYWRlZENvdW50ID0gcmVzdWx0c1swXS51cGxvYWRlZENvdW50XG4gICAgY29uc3QgdGFyZ2V0ID0gdGhpcy5vcHRzLnRhcmdldC5uYW1lXG4gICAgdGhpcy5zaG93UHJlc2VudGVyKHRhcmdldCwgdXBsb2FkZWRDb3VudClcbiAgfVxuXG4gIGluc3RhbGwgKCkge1xuICAgIGNvbnN0IGNhbGxlciA9IHRoaXNcbiAgICB0aGlzLnRhcmdldCA9IHRoaXMuZ2V0VGFyZ2V0KHRoaXMub3B0cy50YXJnZXQsIGNhbGxlcilcbiAgICB0aGlzLnRhcmdldEVsID0gZG9jdW1lbnQucXVlcnlTZWxlY3Rvcih0aGlzLnRhcmdldClcbiAgICB0aGlzLnRhcmdldEVsLmlubmVySFRNTCA9IHRoaXMucmVuZGVyKClcbiAgICB0aGlzLmluaXRFdmVudHMoKVxuICAgIHRoaXMucHJlc2VudGVyID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLlVwcHlQcmVzZW50ZXInKVxuXG4gICAgcmV0dXJuXG4gIH1cbn1cbiIsImltcG9ydCBQbHVnaW4gZnJvbSAnLi9QbHVnaW4nXG5pbXBvcnQgeW8gZnJvbSAneW8teW8nXG5cbi8qKlxuICogUHJvZ3Jlc3MgYmFyXG4gKlxuICovXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBQcm9ncmVzc0JhciBleHRlbmRzIFBsdWdpbiB7XG4gIGNvbnN0cnVjdG9yIChjb3JlLCBvcHRzKSB7XG4gICAgc3VwZXIoY29yZSwgb3B0cylcbiAgICB0aGlzLmlkID0gJ1Byb2dyZXNzQmFyJ1xuICAgIHRoaXMudGl0bGUgPSAnUHJvZ3Jlc3MgQmFyJ1xuICAgIHRoaXMudHlwZSA9ICdwcm9ncmVzc2luZGljYXRvcidcblxuICAgIC8vIHNldCBkZWZhdWx0IG9wdGlvbnNcbiAgICBjb25zdCBkZWZhdWx0T3B0aW9ucyA9IHtcbiAgICAgIHJlcGxhY2VUYXJnZXRDb250ZW50OiBmYWxzZVxuICAgIH1cblxuICAgIC8vIG1lcmdlIGRlZmF1bHQgb3B0aW9ucyB3aXRoIHRoZSBvbmVzIHNldCBieSB1c2VyXG4gICAgdGhpcy5vcHRzID0gT2JqZWN0LmFzc2lnbih7fSwgZGVmYXVsdE9wdGlvbnMsIG9wdHMpXG5cbiAgICB0aGlzLnJlbmRlciA9IHRoaXMucmVuZGVyLmJpbmQodGhpcylcbiAgfVxuXG4gIHJlbmRlciAoc3RhdGUpIHtcbiAgICBjb25zdCBwcm9ncmVzcyA9IHN0YXRlLnRvdGFsUHJvZ3Jlc3MgfHwgMFxuXG4gICAgcmV0dXJuIHlvYDxkaXYgY2xhc3M9XCJVcHB5UHJvZ3Jlc3NCYXJcIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJVcHB5UHJvZ3Jlc3NCYXItaW5uZXJcIiBzdHlsZT1cIndpZHRoOiAke3Byb2dyZXNzfSVcIj48L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJVcHB5UHJvZ3Jlc3NCYXItcGVyY2VudGFnZVwiPiR7cHJvZ3Jlc3N9PC9kaXY+XG4gICAgPC9kaXY+YFxuICB9XG5cbiAgaW5zdGFsbCAoKSB7XG4gICAgY29uc3QgdGFyZ2V0ID0gdGhpcy5vcHRzLnRhcmdldFxuICAgIGNvbnN0IHBsdWdpbiA9IHRoaXNcbiAgICB0aGlzLnRhcmdldCA9IHRoaXMubW91bnQodGFyZ2V0LCBwbHVnaW4pXG4gIH1cbn1cbiIsImltcG9ydCBQbHVnaW4gZnJvbSAnLi9QbHVnaW4nXG5pbXBvcnQgeW8gZnJvbSAneW8teW8nXG5cbi8qKlxuICogUHJvZ3Jlc3MgZHJhd2VyXG4gKlxuICovXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBQcm9ncmVzc0RyYXdlciBleHRlbmRzIFBsdWdpbiB7XG4gIGNvbnN0cnVjdG9yIChjb3JlLCBvcHRzKSB7XG4gICAgc3VwZXIoY29yZSwgb3B0cylcbiAgICB0aGlzLmlkID0gJ1Byb2dyZXNzRHJhd2VyJ1xuICAgIHRoaXMudGl0bGUgPSAnUHJvZ3Jlc3MgRHJhd2VyJ1xuICAgIHRoaXMudHlwZSA9ICdwcm9ncmVzc2luZGljYXRvcidcblxuICAgIC8vIHNldCBkZWZhdWx0IG9wdGlvbnNcbiAgICBjb25zdCBkZWZhdWx0T3B0aW9ucyA9IHt9XG5cbiAgICAvLyBtZXJnZSBkZWZhdWx0IG9wdGlvbnMgd2l0aCB0aGUgb25lcyBzZXQgYnkgdXNlclxuICAgIHRoaXMub3B0cyA9IE9iamVjdC5hc3NpZ24oe30sIGRlZmF1bHRPcHRpb25zLCBvcHRzKVxuXG4gICAgdGhpcy5yZW5kZXIgPSB0aGlzLnJlbmRlci5iaW5kKHRoaXMpXG4gIH1cblxuICBkcmF3ZXJJdGVtIChmaWxlKSB7XG4gICAgY29uc3QgaXNVcGxvYWRlZCA9IGZpbGUucHJvZ3Jlc3MgPT09IDEwMFxuXG4gICAgY29uc3QgcmVtb3ZlID0gKGV2KSA9PiB7XG4gICAgICB0aGlzLmNvcmUuZW1pdHRlci5lbWl0KCdmaWxlLXJlbW92ZScsIGZpbGUuaWQpXG4gICAgfVxuXG4gICAgY29uc3QgY2hlY2tJY29uID0geW9gPHN2ZyBjbGFzcz1cIlVwcHlQcm9ncmVzc0RyYXdlci1pdGVtQ2hlY2tcIiB3aWR0aD1cIjE2XCIgaGVpZ2h0PVwiMTZcIiB2aWV3Qm94PVwiMCAwIDMyIDMyXCIgZW5hYmxlLWJhY2tncm91bmQ9XCJuZXcgMCAwIDMyIDMyXCI+XG4gICAgICAgIDxwb2x5Z29uIHBvaW50cz1cIjIuODM2LDE0LjcwOCA1LjY2NSwxMS44NzggMTMuNDE1LDE5LjYyOCAyNi4zMzQsNi43MTIgMjkuMTY0LDkuNTQgMTMuNDE1LDI1LjI4OCBcIj48L3BvbHlnb24+XG4gICAgICA8L3N2Zz5gXG5cbiAgICBjb25zdCBmaWxlSWNvbiA9IHlvYFxuICAgICAgPHN2ZyB3aWR0aD1cIjM0XCIgaGVpZ2h0PVwiNDRcIiB2aWV3Qm94PVwiMCAwIDIxIDI5XCI+XG4gICAgICAgIDxwYXRoIGQ9XCJNMi40NzMuMzFDMS40NC4zMS41OSAxLjIxLjU5IDIuMzA3VjI2LjMxYzAgMS4wOTcuODUgMiAxLjg4MyAySDE4LjcxYzEuMDMgMCAxLjg4LS45MDMgMS44OC0yVjcuNzQ2YS41MjUuNTI1IDAgMCAwLS4wMTQtLjEwOHYtLjAxNWEuNTEuNTEgMCAwIDAtLjAxNC0uMDN2LS4wMTdhLjUxLjUxIDAgMCAwLS4wMTUtLjAzLjQ4Mi40ODIgMCAwIDAtLjAxNC0uMDE2di0uMDE1YS40ODIuNDgyIDAgMCAwLS4wMTUtLjAxNS41MS41MSAwIDAgMC0uMDE0LS4wMy40ODIuNDgyIDAgMCAwLS4wMTQtLjAxNy41MS41MSAwIDAgMC0uMDE1LS4wMy40ODMuNDgzIDAgMCAwLS4wMy0uMDNMMTMuNjM2LjQ1YS40Ny40NyAwIDAgMC0uMTE4LS4wOTMuNDQ4LjQ0OCAwIDAgMC0uMDQ0LS4wMTUuNDQ4LjQ0OCAwIDAgMC0uMDQ0LS4wMTYuNDQ4LjQ0OCAwIDAgMC0uMDQ1LS4wMTUuNDQuNDQgMCAwIDAtLjA3MyAwSDIuNDc0em0wIC45OWgxMC4zNzJ2NC45NDNjMCAxLjA5Ny44NSAyIDEuODggMmg0LjkzMlYyNi4zMWMwIC41Ni0uNDIgMS4wMDctLjk0OCAxLjAwN0gyLjQ3MmMtLjUyNyAwLS45NS0uNDQ2LS45NS0xLjAwN1YyLjMwOGMwLS41Ni40MjMtMS4wMDguOTUtMS4wMDh6bTExLjMwNS42NjdsNC44NDMgNC45MjcuMzUyLjM1N2gtNC4yNDZjLS41MjcgMC0uOTQ4LS40NDYtLjk0OC0xLjAwN1YxLjk2N3pcIlxuICAgICAgICAgICAgICBmaWxsPVwiI0Y2QTYyM1wiXG4gICAgICAgICAgICAgIGZpbGwtcnVsZT1cImV2ZW5vZGRcIiAvPlxuICAgICAgICA8dGV4dCBmb250LWZhbWlseT1cIkFyaWFsTVQsIEFyaWFsXCJcbiAgICAgICAgICAgICAgZm9udC1zaXplPVwiNVwiXG4gICAgICAgICAgICAgIGZvbnQtd2VpZ2h0PVwiYm9sZFwiXG4gICAgICAgICAgICAgIGZpbGw9XCIjRjZBNjIzXCJcbiAgICAgICAgICAgICAgdGV4dC1hbmNob3I9XCJtaWRkbGVcIlxuICAgICAgICAgICAgICB4PVwiMTFcIlxuICAgICAgICAgICAgICB5PVwiMjJcIj5cbiAgICAgICAgICAke2ZpbGUudHlwZS5zcGVjaWZpYyA/IGZpbGUudHlwZS5zcGVjaWZpYy50b1VwcGVyQ2FzZSgpIDogJz8nfVxuICAgICAgICA8L3RleHQ+XG4gICAgICA8L3N2Zz5cbiAgICBgXG5cbiAgICByZXR1cm4geW9gPGxpIGlkPVwiJHtmaWxlLmlkfVwiIGNsYXNzPVwiVXBweVByb2dyZXNzRHJhd2VyLWl0ZW1cIlxuICAgICAgICAgICAgICAgICAgdGl0bGU9XCIke2ZpbGUubmFtZX1cIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJVcHB5UHJvZ3Jlc3NEcmF3ZXItaXRlbUluZm9cIj5cbiAgICAgICAgICAke2ZpbGUudHlwZS5nZW5lcmFsID09PSAnaW1hZ2UnID8gZmlsZS5wcmV2aWV3RWwgOiBmaWxlSWNvbn1cbiAgICAgIDwvZGl2PlxuICAgICAgPGRpdiBjbGFzcz1cIlVwcHlQcm9ncmVzc0RyYXdlci1pdGVtSW5uZXJcIj5cbiAgICAgICAgPGg0IGNsYXNzPVwiVXBweVByb2dyZXNzRHJhd2VyLWl0ZW1OYW1lXCI+XG4gICAgICAgICAgJHtmaWxlLnVwbG9hZFVSTFxuICAgICAgICAgICAgPyB5b2A8YSBocmVmPVwiJHtmaWxlLnVwbG9hZFVSTH1cIiB0YXJnZXQ9XCJfYmxhbmtcIj4ke2ZpbGUubmFtZX08L2E+YFxuICAgICAgICAgICAgOiB5b2A8c3Bhbj4ke2ZpbGUubmFtZX08L3NwYW4+YFxuICAgICAgICAgIH1cbiAgICAgICAgICA8YnI+XG4gICAgICAgIDwvaDQ+XG4gICAgICAgIDxoNSBjbGFzcz1cIlVwcHlQcm9ncmVzc0RyYXdlci1pdGVtU3RhdHVzXCI+XG4gICAgICAgICAgJHtmaWxlLnByb2dyZXNzID4gMCAmJiBmaWxlLnByb2dyZXNzIDwgMTAwID8gJ1VwbG9hZGluZ+KApiAnICsgZmlsZS5wcm9ncmVzcyArICclJyA6ICcnfVxuICAgICAgICAgICR7ZmlsZS5wcm9ncmVzcyA9PT0gMTAwID8gJ0NvbXBsZXRlZCcgOiAnJ31cbiAgICAgICAgPC9oNT5cbiAgICAgICAgICAke2lzVXBsb2FkZWQgPyBjaGVja0ljb24gOiAnJ31cbiAgICAgICAgICAke2lzVXBsb2FkZWRcbiAgICAgICAgICAgID8gJydcbiAgICAgICAgICAgIDogeW9gPGJ1dHRvbiBjbGFzcz1cIlVwcHlQcm9ncmVzc0RyYXdlci1pdGVtUmVtb3ZlXCIgb25jbGljaz0ke3JlbW92ZX0+w5c8L2J1dHRvbj5gXG4gICAgICAgICAgfVxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJVcHB5UHJvZ3Jlc3NEcmF3ZXItaXRlbVByb2dyZXNzXCJcbiAgICAgICAgICAgICAgIHN0eWxlPVwid2lkdGg6ICR7ZmlsZS5wcm9ncmVzc30lXCI+PC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICA8L2xpPmBcbiAgfVxuXG4gIHJlbmRlciAoc3RhdGUpIHtcbiAgICBjb25zdCBmaWxlcyA9IHN0YXRlLmZpbGVzXG5cbiAgICBjb25zdCBzZWxlY3RlZEZpbGVzID0gT2JqZWN0LmtleXMoZmlsZXMpLmZpbHRlcigoZmlsZSkgPT4ge1xuICAgICAgcmV0dXJuIGZpbGVzW2ZpbGVdLnByb2dyZXNzICE9PSAxMDBcbiAgICB9KVxuXG4gICAgY29uc3QgdXBsb2FkZWRGaWxlcyA9IE9iamVjdC5rZXlzKGZpbGVzKS5maWx0ZXIoKGZpbGUpID0+IHtcbiAgICAgIHJldHVybiBmaWxlc1tmaWxlXS5wcm9ncmVzcyA9PT0gMTAwXG4gICAgfSlcblxuICAgIGNvbnN0IHNlbGVjdGVkRmlsZUNvdW50ID0gT2JqZWN0LmtleXMoc2VsZWN0ZWRGaWxlcykubGVuZ3RoXG4gICAgY29uc3QgdXBsb2FkZWRGaWxlQ291bnQgPSBPYmplY3Qua2V5cyh1cGxvYWRlZEZpbGVzKS5sZW5ndGhcblxuICAgIGNvbnN0IGlzU29tZXRoaW5nU2VsZWN0ZWQgPSBzZWxlY3RlZEZpbGVDb3VudCA+IDBcbiAgICBjb25zdCBpc1NvbWV0aGluZ1VwbG9hZGVkID0gdXBsb2FkZWRGaWxlQ291bnQgPiAwXG4gICAgY29uc3QgaXNTb21ldGhpbmdTZWxlY3RlZE9yVXBsb2FkZWQgPSBpc1NvbWV0aGluZ1NlbGVjdGVkIHx8IGlzU29tZXRoaW5nVXBsb2FkZWRcblxuICAgIGNvbnN0IGF1dG9Qcm9jZWVkID0gdGhpcy5jb3JlLm9wdHMuYXV0b1Byb2NlZWRcblxuICAgIGNvbnN0IG5leHQgPSAoZXYpID0+IHtcbiAgICAgIHRoaXMuY29yZS5lbWl0dGVyLmVtaXQoJ25leHQnKVxuICAgIH1cblxuICAgIHJldHVybiB5b2A8ZGl2IGNsYXNzPVwiVXBweVByb2dyZXNzRHJhd2VyICR7aXNTb21ldGhpbmdTZWxlY3RlZE9yVXBsb2FkZWQgPyAnaXMtdmlzaWJsZScgOiAnJ31cIj5cbiAgICAgIDx1bCBjbGFzcz1cIlVwcHlQcm9ncmVzc0RyYXdlci1saXN0XCI+XG4gICAgICAgICR7T2JqZWN0LmtleXMoZmlsZXMpLm1hcCgoZmlsZUlEKSA9PiB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMuZHJhd2VySXRlbShmaWxlc1tmaWxlSURdKVxuICAgICAgICB9KX1cbiAgICAgIDwvdWw+XG4gICAgICAke2F1dG9Qcm9jZWVkXG4gICAgICAgID8gJydcbiAgICAgICAgOiB5b2A8YnV0dG9uIGNsYXNzPVwiVXBweVByb2dyZXNzRHJhd2VyLXVwbG9hZCAke2lzU29tZXRoaW5nU2VsZWN0ZWQgPyAnaXMtYWN0aXZlJyA6ICcnfVwiXG4gICAgICAgICAgICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcbiAgICAgICAgICAgICAgICAgICAgIG9uY2xpY2s9JHtuZXh0fT5cbiAgICAgICAgICAke2lzU29tZXRoaW5nU2VsZWN0ZWRcbiAgICAgICAgICAgID8gdGhpcy5jb3JlLmkxOG4oJ3VwbG9hZEZpbGVzJywgeydzbWFydF9jb3VudCc6IHNlbGVjdGVkRmlsZUNvdW50fSlcbiAgICAgICAgICAgIDogdGhpcy5jb3JlLmkxOG4oJ3NlbGVjdFRvVXBsb2FkJylcbiAgICAgICAgICB9XG4gICAgICAgIDwvYnV0dG9uPmBcbiAgICAgIH1cbiAgICA8L2Rpdj5gXG5cbiAgICAvLyBUT0RPOiBhZGQgdGhpcyBpbmZvIHRvIHRoZSB1cGxvYWQgYnV0dG9uP1xuICAgIC8vICAgIDxkaXYgY2xhc3M9XCJVcHB5UHJvZ3Jlc3NEcmF3ZXItc3RhdHVzXCI+XG4gICAgLy8gICAgICAke2lzU29tZXRoaW5nU2VsZWN0ZWQgPyB0aGlzLmNvcmUuaTE4bignZmlsZXNDaG9zZW4nLCB7J3NtYXJ0X2NvdW50Jzogc2VsZWN0ZWRGaWxlQ291bnR9KSA6ICcnfVxuICAgIC8vICAgICAgJHtpc1NvbWV0aGluZ1NlbGVjdGVkICYmIGlzU29tZXRoaW5nVXBsb2FkZWQgPyAnLCAnIDogJyd9XG4gICAgLy8gICAgICAke2lzU29tZXRoaW5nVXBsb2FkZWQgPyB0aGlzLmNvcmUuaTE4bignZmlsZXNVcGxvYWRlZCcsIHsnc21hcnRfY291bnQnOiB1cGxvYWRlZEZpbGVDb3VudH0pIDogJyd9XG4gICAgLy8gICAgPC9kaXY+XG4gIH1cblxuICBpbnN0YWxsICgpIHtcbiAgICBjb25zdCB0YXJnZXQgPSB0aGlzLm9wdHMudGFyZ2V0XG4gICAgY29uc3QgcGx1Z2luID0gdGhpc1xuICAgIHRoaXMudGFyZ2V0ID0gdGhpcy5tb3VudCh0YXJnZXQsIHBsdWdpbilcbiAgfVxufVxuIiwiaW1wb3J0IFBsdWdpbiBmcm9tICcuL1BsdWdpbidcblxuLyoqXG4gKiBTcGlubmVyXG4gKlxuICovXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBTcGlubmVyIGV4dGVuZHMgUGx1Z2luIHtcbiAgY29uc3RydWN0b3IgKGNvcmUsIG9wdHMpIHtcbiAgICBzdXBlcihjb3JlLCBvcHRzKVxuICAgIHRoaXMudHlwZSA9ICdwcm9ncmVzc2luZGljYXRvcidcbiAgICB0aGlzLmlkID0gJ1NwaW5uZXInXG4gICAgdGhpcy50aXRsZSA9ICdTcGlubmVyJ1xuXG4gICAgLy8gc2V0IGRlZmF1bHQgb3B0aW9uc1xuICAgIGNvbnN0IGRlZmF1bHRPcHRpb25zID0ge31cblxuICAgIC8vIG1lcmdlIGRlZmF1bHQgb3B0aW9ucyB3aXRoIHRoZSBvbmVzIHNldCBieSB1c2VyXG4gICAgdGhpcy5vcHRzID0gT2JqZWN0LmFzc2lnbih7fSwgZGVmYXVsdE9wdGlvbnMsIG9wdHMpXG4gIH1cblxuICBzZXRQcm9ncmVzcyAocGVyY2VudGFnZSkge1xuICAgIGlmIChwZXJjZW50YWdlICE9PSAxMDApIHtcbiAgICAgIHRoaXMuc3Bpbm5lckVsLmNsYXNzTGlzdC5hZGQoJ2lzLXNwaW5uaW5nJylcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5zcGlubmVyRWwuY2xhc3NMaXN0LnJlbW92ZSgnaXMtc3Bpbm5pbmcnKVxuICAgIH1cbiAgfVxuXG4gIGluaXRTcGlubmVyICgpIHtcbiAgICBjb25zdCBzcGlubmVyQ29udGFpbmVyID0gZG9jdW1lbnQucXVlcnlTZWxlY3Rvcih0aGlzLnRhcmdldClcbiAgICBzcGlubmVyQ29udGFpbmVyLmlubmVySFRNTCA9ICc8ZGl2IGNsYXNzPVwiVXBweVNwaW5uZXJcIj48L2Rpdj4nXG4gICAgdGhpcy5zcGlubmVyRWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGAke3RoaXMudGFyZ2V0fSAuVXBweVNwaW5uZXJgKVxuICB9XG5cbiAgaW5pdEV2ZW50cyAoKSB7XG4gICAgdGhpcy5jb3JlLmVtaXR0ZXIub24oJ3VwbG9hZC1wcm9ncmVzcycsIChkYXRhKSA9PiB7XG4gICAgICBjb25zdCBwZXJjZW50YWdlID0gZGF0YS5wZXJjZW50YWdlXG4gICAgICBjb25zdCBwbHVnaW4gPSBkYXRhLnBsdWdpblxuICAgICAgdGhpcy5jb3JlLmxvZyhcbiAgICAgICAgYHByb2dyZXNzIGlzOiAke3BlcmNlbnRhZ2V9LCBzZXQgYnkgJHtwbHVnaW4uY29uc3RydWN0b3IubmFtZX1gXG4gICAgICApXG4gICAgICB0aGlzLnNldFByb2dyZXNzKHBlcmNlbnRhZ2UpXG4gICAgfSlcbiAgfVxuXG4gIGluc3RhbGwgKCkge1xuICAgIGNvbnN0IGNhbGxlciA9IHRoaXNcbiAgICB0aGlzLnRhcmdldCA9IHRoaXMuZ2V0VGFyZ2V0KHRoaXMub3B0cy50YXJnZXQsIGNhbGxlcilcblxuICAgIHRoaXMuaW5pdFNwaW5uZXIoKVxuICAgIHRoaXMuaW5pdEV2ZW50cygpXG4gICAgcmV0dXJuXG4gIH1cbn1cbiIsImltcG9ydCBQbHVnaW4gZnJvbSAnLi9QbHVnaW4nXG5pbXBvcnQgRHJhZ0Ryb3AgZnJvbSAnLi9EcmFnRHJvcCdcbmltcG9ydCBUdXMxMCBmcm9tICcuL1R1czEwJ1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBUcmFuc2xvYWRpdEJhc2ljIGV4dGVuZHMgUGx1Z2luIHtcbiAgY29uc3RydWN0b3IgKGNvcmUsIG9wdHMpIHtcbiAgICBzdXBlcihjb3JlLCBvcHRzKVxuICAgIHRoaXMudHlwZSA9ICdwcmVzZXR0ZXInXG4gICAgdGhpcy5pZCA9ICdUcmFuc2xvYWRpdEJhc2ljJ1xuICAgIHRoaXMudGl0bGUgPSAnVHJhbnNsb2FkaXQgQmFzaWMnXG4gICAgdGhpcy5jb3JlXG4gICAgICAudXNlKERyYWdEcm9wLCB7bW9kYWw6IHRydWUsIHdhaXQ6IHRydWV9KVxuICAgICAgLnVzZShUdXMxMCwge2VuZHBvaW50OiAnaHR0cDovL21hc3Rlci50dXMuaW86ODA4MCd9KVxuICB9XG59XG4iLCJpbXBvcnQgUGx1Z2luIGZyb20gJy4vUGx1Z2luJ1xuaW1wb3J0IHR1cyBmcm9tICd0dXMtanMtY2xpZW50J1xuXG4vKipcbiAqIFR1cyByZXN1bWFibGUgZmlsZSB1cGxvYWRlclxuICpcbiAqL1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgVHVzMTAgZXh0ZW5kcyBQbHVnaW4ge1xuICBjb25zdHJ1Y3RvciAoY29yZSwgb3B0cykge1xuICAgIHN1cGVyKGNvcmUsIG9wdHMpXG4gICAgdGhpcy50eXBlID0gJ3VwbG9hZGVyJ1xuICAgIHRoaXMuaWQgPSAnVHVzJ1xuICAgIHRoaXMudGl0bGUgPSAnVHVzJ1xuXG4gICAgLy8gc2V0IGRlZmF1bHQgb3B0aW9uc1xuICAgIGNvbnN0IGRlZmF1bHRPcHRpb25zID0ge31cblxuICAgIC8vIG1lcmdlIGRlZmF1bHQgb3B0aW9ucyB3aXRoIHRoZSBvbmVzIHNldCBieSB1c2VyXG4gICAgdGhpcy5vcHRzID0gT2JqZWN0LmFzc2lnbih7fSwgZGVmYXVsdE9wdGlvbnMsIG9wdHMpXG4gIH1cblxuLyoqXG4gKiBDcmVhdGUgYSBuZXcgVHVzIHVwbG9hZFxuICpcbiAqIEBwYXJhbSB7b2JqZWN0fSBmaWxlIGZvciB1c2Ugd2l0aCB1cGxvYWRcbiAqIEBwYXJhbSB7aW50ZWdlcn0gY3VycmVudCBmaWxlIGluIGEgcXVldWVcbiAqIEBwYXJhbSB7aW50ZWdlcn0gdG90YWwgbnVtYmVyIG9mIGZpbGVzIGluIGEgcXVldWVcbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICovXG4gIHVwbG9hZCAoZmlsZSwgY3VycmVudCwgdG90YWwpIHtcbiAgICB0aGlzLmNvcmUubG9nKGB1cGxvYWRpbmcgJHtjdXJyZW50fSBvZiAke3RvdGFsfWApXG5cbiAgICAvLyBDcmVhdGUgYSBuZXcgdHVzIHVwbG9hZFxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBjb25zdCB1cGxvYWQgPSBuZXcgdHVzLlVwbG9hZChmaWxlLmRhdGEsIHtcblxuICAgICAgICAvLyBUT0RPIG1lcmdlIHRoaXMub3B0cyBvciB0aGlzLm9wdHMudHVzIGhlcmVcbiAgICAgICAgcmVzdW1lOiBmYWxzZSxcbiAgICAgICAgZW5kcG9pbnQ6IHRoaXMub3B0cy5lbmRwb2ludCxcbiAgICAgICAgb25FcnJvcjogKGVycm9yKSA9PiB7XG4gICAgICAgICAgcmVqZWN0KCdGYWlsZWQgYmVjYXVzZTogJyArIGVycm9yKVxuICAgICAgICB9LFxuICAgICAgICBvblByb2dyZXNzOiAoYnl0ZXNVcGxvYWRlZCwgYnl0ZXNUb3RhbCkgPT4ge1xuICAgICAgICAgIGxldCBwZXJjZW50YWdlID0gKGJ5dGVzVXBsb2FkZWQgLyBieXRlc1RvdGFsICogMTAwKS50b0ZpeGVkKDIpXG4gICAgICAgICAgcGVyY2VudGFnZSA9IE1hdGgucm91bmQocGVyY2VudGFnZSlcblxuICAgICAgICAgIC8vIERpc3BhdGNoIHByb2dyZXNzIGV2ZW50XG4gICAgICAgICAgdGhpcy5jb3JlLmVtaXR0ZXIuZW1pdCgndXBsb2FkLXByb2dyZXNzJywge1xuICAgICAgICAgICAgdXBsb2FkZXI6IHRoaXMsXG4gICAgICAgICAgICBpZDogZmlsZS5pZCxcbiAgICAgICAgICAgIHBlcmNlbnRhZ2U6IHBlcmNlbnRhZ2VcbiAgICAgICAgICB9KVxuICAgICAgICB9LFxuICAgICAgICBvblN1Y2Nlc3M6ICgpID0+IHtcbiAgICAgICAgICBmaWxlLnVwbG9hZFVSTCA9IHVwbG9hZC51cmxcbiAgICAgICAgICB0aGlzLmNvcmUuZW1pdHRlci5lbWl0KCd1cGxvYWQtc3VjY2VzcycsIGZpbGUpXG5cbiAgICAgICAgICB0aGlzLmNvcmUubG9nKGBEb3dubG9hZCAke3VwbG9hZC5maWxlLm5hbWV9IGZyb20gJHt1cGxvYWQudXJsfWApXG4gICAgICAgICAgcmVzb2x2ZSh1cGxvYWQpXG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgICB1cGxvYWQuc3RhcnQoKVxuICAgIH0pXG4gIH1cblxuICBpbnN0YWxsICgpIHtcbiAgICB0aGlzLmNvcmUuZW1pdHRlci5vbignbmV4dCcsICgpID0+IHtcbiAgICAgIHRoaXMuY29yZS5sb2coJ1R1cyBpcyB1cGxvYWRpbmcuLicpXG4gICAgICBjb25zdCBmaWxlcyA9IHRoaXMuY29yZS5zdGF0ZS5maWxlc1xuXG4gICAgICBjb25zdCBmaWxlc0ZvclVwbG9hZCA9IHt9XG4gICAgICBPYmplY3Qua2V5cyhmaWxlcykuZm9yRWFjaCgoZmlsZSkgPT4ge1xuICAgICAgICBpZiAoZmlsZXNbZmlsZV0ucHJvZ3Jlc3MgPT09IDAgfHwgZmlsZXNbZmlsZV0ucmVtb3RlKSB7XG4gICAgICAgICAgZmlsZXNGb3JVcGxvYWRbZmlsZV0gPSBmaWxlc1tmaWxlXVxuICAgICAgICB9XG4gICAgICB9KVxuXG4gICAgICB0aGlzLnVwbG9hZEZpbGVzKGZpbGVzRm9yVXBsb2FkKVxuICAgIH0pXG4gIH1cblxuICB1cGxvYWRGaWxlcyAoZmlsZXMpIHtcbiAgICBjb25zdCB1cGxvYWRlcnMgPSBbXVxuICAgIGZvciAobGV0IGkgaW4gZmlsZXMpIHtcbiAgICAgIGNvbnN0IGZpbGUgPSBmaWxlc1tpXVxuICAgICAgY29uc3QgY3VycmVudCA9IHBhcnNlSW50KGksIDEwKSArIDFcbiAgICAgIGNvbnN0IHRvdGFsID0gZmlsZXMubGVuZ3RoXG5cbiAgICAgIGlmIChmaWxlc1tpXS5yZW1vdGUpIHtcbiAgICAgICAgdXBsb2FkZXJzLnB1c2godGhpcy51cGxvYWRSZW1vdGUoZmlsZSwgY3VycmVudCwgdG90YWwpKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdXBsb2FkZXJzLnB1c2godGhpcy51cGxvYWQoZmlsZSwgY3VycmVudCwgdG90YWwpKVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBQcm9taXNlLmFsbCh1cGxvYWRlcnMpLnRoZW4oKCkgPT4ge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdXBsb2FkZWRDb3VudDogZmlsZXMubGVuZ3RoXG4gICAgICB9XG4gICAgfSlcbiAgfVxuXG4gIHVwbG9hZFJlbW90ZSAoZmlsZSwgY3VycmVudCwgdG90YWwpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgY29uc3QgcGF5bG9hZCA9IE9iamVjdC5hc3NpZ24oe30sIGZpbGUucmVtb3RlLnBheWxvYWQsIHtcbiAgICAgICAgdGFyZ2V0OiB0aGlzLm9wdHMuZW5kcG9pbnQsXG4gICAgICAgIHByb3RvY29sOiAndHVzJ1xuICAgICAgfSlcbiAgICAgIHRoaXMuY29yZS5zb2NrZXQuc2VuZChmaWxlLnJlbW90ZS5hY3Rpb24sIHBheWxvYWQpXG4gICAgICB0aGlzLmNvcmUuc29ja2V0Lm9uY2UoJ3VwbG9hZC1zdWNjZXNzJywgKCkgPT4ge1xuICAgICAgICBjb25zb2xlLmxvZygnc3VjY2VzcycpXG4gICAgICAgIHRoaXMuY29yZS5lbWl0dGVyLmVtaXQoJ3VwbG9hZC1zdWNjZXNzJywgZmlsZSlcblxuICAgICAgICB0aGlzLmNvcmUuZW1pdHRlci5lbWl0KCd1cGxvYWQtcHJvZ3Jlc3MnLCB7XG4gICAgICAgICAgaWQ6IGZpbGUuaWQsXG4gICAgICAgICAgcGVyY2VudGFnZTogMTAwXG4gICAgICAgIH0pXG5cbiAgICAgICAgcmVzb2x2ZSgpXG4gICAgICB9KVxuICAgIH0pXG4gIH1cblxuLyoqXG4gKiBBZGQgZmlsZXMgdG8gYW4gYXJyYXkgb2YgYHVwbG9hZCgpYCBjYWxsZXMsIHBhc3NpbmcgdGhlIGN1cnJlbnQgYW5kIHRvdGFsIGZpbGUgY291bnQgbnVtYmVyc1xuICpcbiAqIEBwYXJhbSB7QXJyYXkgfCBPYmplY3R9IHJlc3VsdHNcbiAqIEByZXR1cm5zIHtQcm9taXNlfSBvZiBwYXJhbGxlbCB1cGxvYWRzIGBQcm9taXNlLmFsbCh1cGxvYWRlcnMpYFxuICovXG4gIHJ1biAocmVzdWx0cykge1xuICAgIHRoaXMuY29yZS5sb2coe1xuICAgICAgY2xhc3M6IHRoaXMuY29uc3RydWN0b3IubmFtZSxcbiAgICAgIG1ldGhvZDogJ3J1bicsXG4gICAgICByZXN1bHRzOiByZXN1bHRzXG4gICAgfSlcblxuICAgIHJldHVybiB0aGlzLnVwbG9hZEZpbGVzKHJlc3VsdHMpXG4gIH1cbn1cbiIsIiIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG5mdW5jdGlvbiBFdmVudEVtaXR0ZXIoKSB7XG4gIHRoaXMuX2V2ZW50cyA9IHRoaXMuX2V2ZW50cyB8fCB7fTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gdGhpcy5fbWF4TGlzdGVuZXJzIHx8IHVuZGVmaW5lZDtcbn1cbm1vZHVsZS5leHBvcnRzID0gRXZlbnRFbWl0dGVyO1xuXG4vLyBCYWNrd2FyZHMtY29tcGF0IHdpdGggbm9kZSAwLjEwLnhcbkV2ZW50RW1pdHRlci5FdmVudEVtaXR0ZXIgPSBFdmVudEVtaXR0ZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX2V2ZW50cyA9IHVuZGVmaW5lZDtcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX21heExpc3RlbmVycyA9IHVuZGVmaW5lZDtcblxuLy8gQnkgZGVmYXVsdCBFdmVudEVtaXR0ZXJzIHdpbGwgcHJpbnQgYSB3YXJuaW5nIGlmIG1vcmUgdGhhbiAxMCBsaXN0ZW5lcnMgYXJlXG4vLyBhZGRlZCB0byBpdC4gVGhpcyBpcyBhIHVzZWZ1bCBkZWZhdWx0IHdoaWNoIGhlbHBzIGZpbmRpbmcgbWVtb3J5IGxlYWtzLlxuRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnMgPSAxMDtcblxuLy8gT2J2aW91c2x5IG5vdCBhbGwgRW1pdHRlcnMgc2hvdWxkIGJlIGxpbWl0ZWQgdG8gMTAuIFRoaXMgZnVuY3Rpb24gYWxsb3dzXG4vLyB0aGF0IHRvIGJlIGluY3JlYXNlZC4gU2V0IHRvIHplcm8gZm9yIHVubGltaXRlZC5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuc2V0TWF4TGlzdGVuZXJzID0gZnVuY3Rpb24obikge1xuICBpZiAoIWlzTnVtYmVyKG4pIHx8IG4gPCAwIHx8IGlzTmFOKG4pKVxuICAgIHRocm93IFR5cGVFcnJvcignbiBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyJyk7XG4gIHRoaXMuX21heExpc3RlbmVycyA9IG47XG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgZXIsIGhhbmRsZXIsIGxlbiwgYXJncywgaSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIElmIHRoZXJlIGlzIG5vICdlcnJvcicgZXZlbnQgbGlzdGVuZXIgdGhlbiB0aHJvdy5cbiAgaWYgKHR5cGUgPT09ICdlcnJvcicpIHtcbiAgICBpZiAoIXRoaXMuX2V2ZW50cy5lcnJvciB8fFxuICAgICAgICAoaXNPYmplY3QodGhpcy5fZXZlbnRzLmVycm9yKSAmJiAhdGhpcy5fZXZlbnRzLmVycm9yLmxlbmd0aCkpIHtcbiAgICAgIGVyID0gYXJndW1lbnRzWzFdO1xuICAgICAgaWYgKGVyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgdGhyb3cgZXI7IC8vIFVuaGFuZGxlZCAnZXJyb3InIGV2ZW50XG4gICAgICB9XG4gICAgICB0aHJvdyBUeXBlRXJyb3IoJ1VuY2F1Z2h0LCB1bnNwZWNpZmllZCBcImVycm9yXCIgZXZlbnQuJyk7XG4gICAgfVxuICB9XG5cbiAgaGFuZGxlciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNVbmRlZmluZWQoaGFuZGxlcikpXG4gICAgcmV0dXJuIGZhbHNlO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGhhbmRsZXIpKSB7XG4gICAgc3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAvLyBmYXN0IGNhc2VzXG4gICAgICBjYXNlIDE6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDI6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0pO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMzpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAvLyBzbG93ZXJcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgICAgICBoYW5kbGVyLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChpc09iamVjdChoYW5kbGVyKSkge1xuICAgIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgIGxpc3RlbmVycyA9IGhhbmRsZXIuc2xpY2UoKTtcbiAgICBsZW4gPSBsaXN0ZW5lcnMubGVuZ3RoO1xuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKylcbiAgICAgIGxpc3RlbmVyc1tpXS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgfVxuXG4gIHJldHVybiB0cnVlO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBtO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBUbyBhdm9pZCByZWN1cnNpb24gaW4gdGhlIGNhc2UgdGhhdCB0eXBlID09PSBcIm5ld0xpc3RlbmVyXCIhIEJlZm9yZVxuICAvLyBhZGRpbmcgaXQgdG8gdGhlIGxpc3RlbmVycywgZmlyc3QgZW1pdCBcIm5ld0xpc3RlbmVyXCIuXG4gIGlmICh0aGlzLl9ldmVudHMubmV3TGlzdGVuZXIpXG4gICAgdGhpcy5lbWl0KCduZXdMaXN0ZW5lcicsIHR5cGUsXG4gICAgICAgICAgICAgIGlzRnVuY3Rpb24obGlzdGVuZXIubGlzdGVuZXIpID9cbiAgICAgICAgICAgICAgbGlzdGVuZXIubGlzdGVuZXIgOiBsaXN0ZW5lcik7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgLy8gT3B0aW1pemUgdGhlIGNhc2Ugb2Ygb25lIGxpc3RlbmVyLiBEb24ndCBuZWVkIHRoZSBleHRyYSBhcnJheSBvYmplY3QuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gbGlzdGVuZXI7XG4gIGVsc2UgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgLy8gSWYgd2UndmUgYWxyZWFkeSBnb3QgYW4gYXJyYXksIGp1c3QgYXBwZW5kLlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5wdXNoKGxpc3RlbmVyKTtcbiAgZWxzZVxuICAgIC8vIEFkZGluZyB0aGUgc2Vjb25kIGVsZW1lbnQsIG5lZWQgdG8gY2hhbmdlIHRvIGFycmF5LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IFt0aGlzLl9ldmVudHNbdHlwZV0sIGxpc3RlbmVyXTtcblxuICAvLyBDaGVjayBmb3IgbGlzdGVuZXIgbGVha1xuICBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSAmJiAhdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCkge1xuICAgIGlmICghaXNVbmRlZmluZWQodGhpcy5fbWF4TGlzdGVuZXJzKSkge1xuICAgICAgbSA9IHRoaXMuX21heExpc3RlbmVycztcbiAgICB9IGVsc2Uge1xuICAgICAgbSA9IEV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzO1xuICAgIH1cblxuICAgIGlmIChtICYmIG0gPiAwICYmIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGggPiBtKSB7XG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkID0gdHJ1ZTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJyhub2RlKSB3YXJuaW5nOiBwb3NzaWJsZSBFdmVudEVtaXR0ZXIgbWVtb3J5ICcgK1xuICAgICAgICAgICAgICAgICAgICAnbGVhayBkZXRlY3RlZC4gJWQgbGlzdGVuZXJzIGFkZGVkLiAnICtcbiAgICAgICAgICAgICAgICAgICAgJ1VzZSBlbWl0dGVyLnNldE1heExpc3RlbmVycygpIHRvIGluY3JlYXNlIGxpbWl0LicsXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGgpO1xuICAgICAgaWYgKHR5cGVvZiBjb25zb2xlLnRyYWNlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIC8vIG5vdCBzdXBwb3J0ZWQgaW4gSUUgMTBcbiAgICAgICAgY29uc29sZS50cmFjZSgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbiA9IEV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub25jZSA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICB2YXIgZmlyZWQgPSBmYWxzZTtcblxuICBmdW5jdGlvbiBnKCkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgZyk7XG5cbiAgICBpZiAoIWZpcmVkKSB7XG4gICAgICBmaXJlZCA9IHRydWU7XG4gICAgICBsaXN0ZW5lci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cbiAgfVxuXG4gIGcubGlzdGVuZXIgPSBsaXN0ZW5lcjtcbiAgdGhpcy5vbih0eXBlLCBnKTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbi8vIGVtaXRzIGEgJ3JlbW92ZUxpc3RlbmVyJyBldmVudCBpZmYgdGhlIGxpc3RlbmVyIHdhcyByZW1vdmVkXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIGxpc3QsIHBvc2l0aW9uLCBsZW5ndGgsIGk7XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgbGlzdCA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgbGVuZ3RoID0gbGlzdC5sZW5ndGg7XG4gIHBvc2l0aW9uID0gLTE7XG5cbiAgaWYgKGxpc3QgPT09IGxpc3RlbmVyIHx8XG4gICAgICAoaXNGdW5jdGlvbihsaXN0Lmxpc3RlbmVyKSAmJiBsaXN0Lmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuXG4gIH0gZWxzZSBpZiAoaXNPYmplY3QobGlzdCkpIHtcbiAgICBmb3IgKGkgPSBsZW5ndGg7IGktLSA+IDA7KSB7XG4gICAgICBpZiAobGlzdFtpXSA9PT0gbGlzdGVuZXIgfHxcbiAgICAgICAgICAobGlzdFtpXS5saXN0ZW5lciAmJiBsaXN0W2ldLmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICAgICAgcG9zaXRpb24gPSBpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocG9zaXRpb24gPCAwKVxuICAgICAgcmV0dXJuIHRoaXM7XG5cbiAgICBpZiAobGlzdC5sZW5ndGggPT09IDEpIHtcbiAgICAgIGxpc3QubGVuZ3RoID0gMDtcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpc3Quc3BsaWNlKHBvc2l0aW9uLCAxKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBrZXksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICByZXR1cm4gdGhpcztcblxuICAvLyBub3QgbGlzdGVuaW5nIGZvciByZW1vdmVMaXN0ZW5lciwgbm8gbmVlZCB0byBlbWl0XG4gIGlmICghdGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApXG4gICAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICBlbHNlIGlmICh0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLy8gZW1pdCByZW1vdmVMaXN0ZW5lciBmb3IgYWxsIGxpc3RlbmVycyBvbiBhbGwgZXZlbnRzXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgZm9yIChrZXkgaW4gdGhpcy5fZXZlbnRzKSB7XG4gICAgICBpZiAoa2V5ID09PSAncmVtb3ZlTGlzdGVuZXInKSBjb250aW51ZTtcbiAgICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKGtleSk7XG4gICAgfVxuICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCdyZW1vdmVMaXN0ZW5lcicpO1xuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgbGlzdGVuZXJzID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGxpc3RlbmVycykpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVycyk7XG4gIH0gZWxzZSBpZiAobGlzdGVuZXJzKSB7XG4gICAgLy8gTElGTyBvcmRlclxuICAgIHdoaWxlIChsaXN0ZW5lcnMubGVuZ3RoKVxuICAgICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnNbbGlzdGVuZXJzLmxlbmd0aCAtIDFdKTtcbiAgfVxuICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gW107XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24odGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSBbdGhpcy5fZXZlbnRzW3R5cGVdXTtcbiAgZWxzZVxuICAgIHJldCA9IHRoaXMuX2V2ZW50c1t0eXBlXS5zbGljZSgpO1xuICByZXR1cm4gcmV0O1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24odHlwZSkge1xuICBpZiAodGhpcy5fZXZlbnRzKSB7XG4gICAgdmFyIGV2bGlzdGVuZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgICBpZiAoaXNGdW5jdGlvbihldmxpc3RlbmVyKSlcbiAgICAgIHJldHVybiAxO1xuICAgIGVsc2UgaWYgKGV2bGlzdGVuZXIpXG4gICAgICByZXR1cm4gZXZsaXN0ZW5lci5sZW5ndGg7XG4gIH1cbiAgcmV0dXJuIDA7XG59O1xuXG5FdmVudEVtaXR0ZXIubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKGVtaXR0ZXIsIHR5cGUpIHtcbiAgcmV0dXJuIGVtaXR0ZXIubGlzdGVuZXJDb3VudCh0eXBlKTtcbn07XG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nO1xufVxuXG5mdW5jdGlvbiBpc051bWJlcihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdudW1iZXInO1xufVxuXG5mdW5jdGlvbiBpc09iamVjdChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZyAhPT0gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IHZvaWQgMDtcbn1cbiIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxuXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG52YXIgcXVldWUgPSBbXTtcbnZhciBkcmFpbmluZyA9IGZhbHNlO1xudmFyIGN1cnJlbnRRdWV1ZTtcbnZhciBxdWV1ZUluZGV4ID0gLTE7XG5cbmZ1bmN0aW9uIGNsZWFuVXBOZXh0VGljaygpIHtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGlmIChjdXJyZW50UXVldWUubGVuZ3RoKSB7XG4gICAgICAgIHF1ZXVlID0gY3VycmVudFF1ZXVlLmNvbmNhdChxdWV1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgIH1cbiAgICBpZiAocXVldWUubGVuZ3RoKSB7XG4gICAgICAgIGRyYWluUXVldWUoKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRyYWluUXVldWUoKSB7XG4gICAgaWYgKGRyYWluaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIHRpbWVvdXQgPSBzZXRUaW1lb3V0KGNsZWFuVXBOZXh0VGljayk7XG4gICAgZHJhaW5pbmcgPSB0cnVlO1xuXG4gICAgdmFyIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB3aGlsZShsZW4pIHtcbiAgICAgICAgY3VycmVudFF1ZXVlID0gcXVldWU7XG4gICAgICAgIHF1ZXVlID0gW107XG4gICAgICAgIHdoaWxlICgrK3F1ZXVlSW5kZXggPCBsZW4pIHtcbiAgICAgICAgICAgIGlmIChjdXJyZW50UXVldWUpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UXVldWVbcXVldWVJbmRleF0ucnVuKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgICAgICBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgfVxuICAgIGN1cnJlbnRRdWV1ZSA9IG51bGw7XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG59XG5cbnByb2Nlc3MubmV4dFRpY2sgPSBmdW5jdGlvbiAoZnVuKSB7XG4gICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aCAtIDEpO1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcXVldWUucHVzaChuZXcgSXRlbShmdW4sIGFyZ3MpKTtcbiAgICBpZiAocXVldWUubGVuZ3RoID09PSAxICYmICFkcmFpbmluZykge1xuICAgICAgICBzZXRUaW1lb3V0KGRyYWluUXVldWUsIDApO1xuICAgIH1cbn07XG5cbi8vIHY4IGxpa2VzIHByZWRpY3RpYmxlIG9iamVjdHNcbmZ1bmN0aW9uIEl0ZW0oZnVuLCBhcnJheSkge1xuICAgIHRoaXMuZnVuID0gZnVuO1xuICAgIHRoaXMuYXJyYXkgPSBhcnJheTtcbn1cbkl0ZW0ucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmZ1bi5hcHBseShudWxsLCB0aGlzLmFycmF5KTtcbn07XG5wcm9jZXNzLnRpdGxlID0gJ2Jyb3dzZXInO1xucHJvY2Vzcy5icm93c2VyID0gdHJ1ZTtcbnByb2Nlc3MuZW52ID0ge307XG5wcm9jZXNzLmFyZ3YgPSBbXTtcbnByb2Nlc3MudmVyc2lvbiA9ICcnOyAvLyBlbXB0eSBzdHJpbmcgdG8gYXZvaWQgcmVnZXhwIGlzc3Vlc1xucHJvY2Vzcy52ZXJzaW9ucyA9IHt9O1xuXG5mdW5jdGlvbiBub29wKCkge31cblxucHJvY2Vzcy5vbiA9IG5vb3A7XG5wcm9jZXNzLmFkZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3Mub25jZSA9IG5vb3A7XG5wcm9jZXNzLm9mZiA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUxpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlQWxsTGlzdGVuZXJzID0gbm9vcDtcbnByb2Nlc3MuZW1pdCA9IG5vb3A7XG5cbnByb2Nlc3MuYmluZGluZyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmJpbmRpbmcgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcblxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5wcm9jZXNzLnVtYXNrID0gZnVuY3Rpb24oKSB7IHJldHVybiAwOyB9O1xuIiwibGV0IHVwcHlTZXJ2ZXJFbmRwb2ludCA9ICdodHRwOi8vbG9jYWxob3N0OjMwMjAnXG5cbmlmIChsb2NhdGlvbi5ob3N0bmFtZSA9PT0gJ3VwcHkuaW8nKSB7XG4gIHVwcHlTZXJ2ZXJFbmRwb2ludCA9ICdodHRwOi8vc2VydmVyLnVwcHkuaW86MzAyMCdcbn1cblxuLy8gdXBweVNlcnZlckVuZHBvaW50ID0gJ2h0dHA6Ly9zZXJ2ZXIudXBweS5pbzozMDIwJ1xuZXhwb3J0IGNvbnN0IFVQUFlfU0VSVkVSID0gdXBweVNlcnZlckVuZHBvaW50XG4iLCJpbXBvcnQgVXBweSBmcm9tICcuLi8uLi8uLi8uLi9zcmMvY29yZS9Db3JlLmpzJ1xuaW1wb3J0IER1bW15IGZyb20gJy4uLy4uLy4uLy4uL3NyYy9wbHVnaW5zL0R1bW15LmpzJ1xuaW1wb3J0IFR1czEwIGZyb20gJy4uLy4uLy4uLy4uL3NyYy9wbHVnaW5zL1R1czEwLmpzJ1xuaW1wb3J0IE1vZGFsIGZyb20gJy4uLy4uLy4uLy4uL3NyYy9wbHVnaW5zL01vZGFsLmpzJ1xuaW1wb3J0IERyYWdEcm9wIGZyb20gJy4uLy4uLy4uLy4uL3NyYy9wbHVnaW5zL0RyYWdEcm9wLmpzJ1xuaW1wb3J0IEdvb2dsZURyaXZlIGZyb20gJy4uLy4uLy4uLy4uL3NyYy9wbHVnaW5zL0dvb2dsZURyaXZlLmpzJ1xuaW1wb3J0IFByb2dyZXNzQmFyIGZyb20gJy4uLy4uLy4uLy4uL3NyYy9wbHVnaW5zL1Byb2dyZXNzQmFyLmpzJ1xuaW1wb3J0IFByb2dyZXNzRHJhd2VyIGZyb20gJy4uLy4uLy4uLy4uL3NyYy9wbHVnaW5zL1Byb2dyZXNzRHJhd2VyLmpzJ1xuXG5pbXBvcnQgeyBVUFBZX1NFUlZFUiB9IGZyb20gJy4uL2VudidcblxuY29uc3QgdXBweSA9IG5ldyBVcHB5KHtkZWJ1ZzogdHJ1ZSwgYXV0b1Byb2NlZWQ6IGZhbHNlfSlcbnVwcHlcbiAgLnVzZShNb2RhbCwge3RyaWdnZXI6ICcjdXBweU1vZGFsT3BlbmVyJ30pXG4gIC51c2UoUHJvZ3Jlc3NCYXIsIHt0YXJnZXQ6ICdib2R5J30pXG4gIC51c2UoRHJhZ0Ryb3AsIHt0YXJnZXQ6IE1vZGFsfSlcbiAgLnVzZShHb29nbGVEcml2ZSwge3RhcmdldDogTW9kYWwsIGhvc3Q6IFVQUFlfU0VSVkVSfSlcbiAgLnVzZShEdW1teSwge3RhcmdldDogTW9kYWx9KVxuICAudXNlKFR1czEwLCB7ZW5kcG9pbnQ6ICdodHRwOi8vbWFzdGVyLnR1cy5pbzo4MDgwL2ZpbGVzLyd9KVxuICAudXNlKFByb2dyZXNzRHJhd2VyLCB7dGFyZ2V0OiBNb2RhbH0pXG4gIC5ydW4oKVxuIiwiaW1wb3J0IENvcmUgZnJvbSAnLi9Db3JlJ1xuZXhwb3J0IGRlZmF1bHQgQ29yZVxuIiwiLy8gUGFyZW50XG5pbXBvcnQgZW5fVVMgZnJvbSAnLi9lbl9VUydcbmltcG9ydCBydV9SVSBmcm9tICcuL3J1X1JVJ1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgZW5fVVMsXG4gIHJ1X1JVXG59XG4iLCIvLyBQYXJlbnRcbmltcG9ydCBQbHVnaW4gZnJvbSAnLi9QbHVnaW4nXG5cbi8vIE9yY2hlc3RyYXRvcnNcbmltcG9ydCBNb2RhbCBmcm9tICcuL01vZGFsJ1xuXG4vLyBBY3F1aXJlcnNcbmltcG9ydCBEdW1teSBmcm9tICcuL0R1bW15J1xuaW1wb3J0IERyYWdEcm9wIGZyb20gJy4vRHJhZ0Ryb3AnXG5pbXBvcnQgRHJvcGJveCBmcm9tICcuL0Ryb3Bib3gnXG5pbXBvcnQgRm9ybXRhZyBmcm9tICcuL0Zvcm10YWcnXG5pbXBvcnQgR29vZ2xlRHJpdmUgZnJvbSAnLi9Hb29nbGVEcml2ZSdcblxuLy8gUHJvZ3Jlc3NpbmRpY2F0b3JzXG5pbXBvcnQgUHJvZ3Jlc3NCYXIgZnJvbSAnLi9Qcm9ncmVzc0JhcidcbmltcG9ydCBTcGlubmVyIGZyb20gJy4vU3Bpbm5lcidcblxuLy8gVXBsb2FkZXJzXG5pbXBvcnQgVHVzMTAgZnJvbSAnLi9UdXMxMCdcbmltcG9ydCBNdWx0aXBhcnQgZnJvbSAnLi9NdWx0aXBhcnQnXG5cbi8vIFByZXNlbnRlcnNcbmltcG9ydCBQcmVzZW50IGZyb20gJy4vUHJlc2VudCdcblxuLy8gUHJlc2V0dGVyc1xuaW1wb3J0IFRyYW5zbG9hZGl0QmFzaWMgZnJvbSAnLi9UcmFuc2xvYWRpdEJhc2ljJ1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgUGx1Z2luLFxuICBEdW1teSxcbiAgUHJvZ3Jlc3NCYXIsXG4gIFNwaW5uZXIsXG4gIFByZXNlbnQsXG4gIERyYWdEcm9wLFxuICBEcm9wYm94LFxuICBHb29nbGVEcml2ZSxcbiAgRm9ybXRhZyxcbiAgVHVzMTAsXG4gIE11bHRpcGFydCxcbiAgVHJhbnNsb2FkaXRCYXNpYyxcbiAgTW9kYWxcbn1cbiIsImltcG9ydCBDb3JlIGZyb20gJy4vY29yZS9pbmRleCdcbmltcG9ydCBwbHVnaW5zIGZyb20gJy4vcGx1Z2lucy9pbmRleCdcblxuY29uc3QgbG9jYWxlcyA9IHt9XG5cbmV4cG9ydCB7XG4gIENvcmUsXG4gIHBsdWdpbnMsXG4gIGxvY2FsZXNcbn1cbiJdfQ==
