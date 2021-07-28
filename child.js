#!/usr/bin/env node

'use strict';

var Module = require('module'),
    path = require('path'),
    fs = require('fs'),
    net = require('net');

// connect to the parent process at the socket address passed in

const socketPath = process.argv[2];

const socket = new net.Socket();

socket.connect(socketPath, () => {

    // tap into Module._load and various fs methods to
    // notify the parent whenever a file is required,
    // imported, or read in to the process

    var load = Module._load;
    Module._load = function (p, mod) {
        var fullPath = Module._resolveFilename(p, mod, false);
        if (fullPath)
            socket.write(fullPath + '\n', 'utf8');

        return load.apply(this, arguments);
    };

    // The following will be used to watch other static
    // files used by the process - like .html files.
    // It should only send back paths the process does
    // not change itself - temp files should not be watched.
    // TODO: this is quite complex to work out, so for
    // now provide 'and watch this directory' functionality

    // [
    //     'readFileSync',
    //     'readFile',
    //     'statSync',
    //     'stat'
    // ].forEach(function (method) {
    //     var m = fs[method];
    //     fs[method] = function (p) {
    //         process.send(path.resolve(p));
    //         return m.apply(this, arguments);
    //     };
    // });

    // remove this file and the socket address from the arguments
    // so it appears that the js file has been called directly

    process.argv.splice(1, 2);

    // require the first argument directly to run it with
    // modified require() and import

    require(path.resolve(process.argv[1]));
});
