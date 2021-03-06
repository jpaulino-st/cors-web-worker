(function () {
    "use strict";
    //TODO; ADD support for more VERBS
    var http = {
        get: request('get')
    };

    window.http = http;

    function request(verb) {
        return function (url) {
            var promise = new Promise(function (resolve, reject) {
                var request = new XMLHttpRequest();
                request.open(verb, url);
                request.send();

                request.onload = function () {
                    if (this.status >= 200 && this.status < 305) {
                        resolve(this.responseText);
                    } else {
                        reject(this.statusText);
                    }
                };

                request.onerror = function () {
                    reject(this.statusText);
                };
            });

            return promise;
        }
    }
})();

(function () {
    "use strict";

    function CORSWorker(url, dontFetchImmediately) {
        var self = this;
        this.url = url;
        this.__msgQueue = [];
        this.__eventsQueue = [];

        if (!dontFetchImmediately) self.fetch();
    }

    /**
     * Method fetches js file from its url and create and in memory copy of the file.
     * Once in memory (as a Blob) the file can be run as a WebWorker. The method returns a
     * promise.
     *
     * @method fetch
     * @return {Boolean} Promise
     */
    CORSWorker.prototype.fetch = function fetch() {
        var self = this;
        return (
            http.get(this.url).then(function (resText) {
                var  blob = new Blob([resText], {type: 'application/javascript'});

                self.worker = new Worker(window.URL.createObjectURL(blob));

                processQueues(self);

                return self.worker;
            })
        );
    };

    /**
     * Wrapper around Worker.postMessage. While the Worker's js file is being retrieved,
     * any calls to postMessage will be queued to be processed once the worker is ready.
     *
     * @method postMessage
     */
    CORSWorker.prototype.postMessage = function postMessage() {
        if (this.worker) {
            this.worker.postMessage.apply(this.worker, arguments);
        } else {
            this.__msgQueue.push(arguments);
        }
    };

    /**
     * Wrapper around Worker.addEventListener. While the Worker's js file is being retrieved,
     * any calls to addEventListener will be queued to be processed once the worker is ready.
     *
     * @method addEventListener
     */
    CORSWorker.prototype.addEventListener = function addEventListener() {
        if (this.worker) {
            this.worker.addEventListener.apply(this.worker, arguments);
        } else {
            this.__eventsQueue.push(arguments);
        }
    };

    /**
     * Wrapper around Worker.terminate. While the Worker's js file is being retrieved,
     * calls to terminate will be queued to be processed once the worker is ready.
     *
     * @method terminate
     */
    CORSWorker.prototype.terminate = function terminate() {
        if (this.worker) {
            this.worker.terminate();
        } else {
            this.__msgQueue.push('__terminate__');
        }
    };

    //Insure the eventListeners and eventHandlers get setup properly
    function processQueues(foreignWorker) {
        var msgArgs, i,
            msgQueueLen = foreignWorker.__msgQueue.length,
            worker = foreignWorker.worker;

        if (typeof foreignWorker.onmessage === 'function') {
            worker.onmessage = foreignWorker.onmessage;
        }

        if (typeof foreignWorker.onerror === 'function') {
            worker.onerror = foreignWorker.onerror;
        }

        foreignWorker.__eventsQueue.forEach(function (eventArgs) {
            worker.addEventListener.apply(foreignWorker.worker, eventArgs);
        });

        for (i = 0; i < msgQueueLen; i++) {
            msgArgs = foreignWorker.__msgQueue[i];
            //TODO: Change this...
            if (msgArgs === '__terminate__') {
                worker.terminate();
                break;
            }

            worker.postMessage.apply(foreignWorker.worker, msgArgs);
        }

        foreignWorker.__msgQueue = null;
        foreignWorker.__eventsQueue = null;
    }

    window.CORSWorker = CORSWorker;
})();

