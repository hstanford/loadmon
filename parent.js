#!/usr/bin/env node

'use strict';

const fs = require('fs'),
    chokidar = require('chokidar'),
    chalk = require('chalk'),
    childProcess = require('child_process'),
    path = require('path'),
    program = require('commander'),
    crypto = require('crypto'),
    net = require('net');

// use commander to provide a better CLI and allow
// the user to specify other paths to watch

program
  .option(
      '-i, --include [value]',
      'Add a file or directory to be watched',
      (val, agg) => agg.concat([val]),
      []
  )
  .parse(process.argv);

// watch any other specified files (e.g. configs)

program.args.forEach(arg => program.include.push(arg));

// determine which language we're running in

var filename = program.args[0];
var mode = 'js';
if (filename.slice(-3) === '.py')
    mode = 'py';

var proc = {js: 'node', py: 'python'}[mode];

// use a hash to create a unique path for a UNIX socket

const hash = crypto.createHash('sha256');
hash.update(process.cwd() + ':' + program.args.toString());
const socketPath = '/tmp/' + hash.digest('hex') + '.sock';

var watcher;

// create a server to communicate with child processes

const server = net.createServer((c) => {
    c.setEncoding('utf8');

    // when the child process sends back a path,
    // add it to be watched for changes
    c.on('data', p => {
        watcher.add(p.split('\n').slice(0, -1))
    });
});

// handle interrupt

process.once('SIGINT', () => {
    server.close();
    process.exit();
});

process.once('SIGTERM', () => {
    server.close();
    process.exit();
});

// listen on the UNIX socket

server.listen(socketPath, () => {
    setup();
});

function setup () {
    var paths = [].concat(program.include);

    // use chokidar as file watcher

    watcher = chokidar.watch(paths);

    // fork a child process as a tiny wrapper
    // around the intended target js file,
    // passing through the remaining arguments

    console.log(chalk.green('Starting: ' + proc + ' ' + program.args.join(' ')));

    const child = childProcess.spawn(
        proc,
        [path.join(path.dirname(process.argv[1]), 'loadchild' + mode), socketPath].concat(program.args)
    );

    console.log(chalk.magenta('Started! PID: ' + child.pid));

    const stdinForwarder = data => child.stdin.write(data);
    process.stdin.on('data', stdinForwarder);
    child.stdout.on('data', data => process.stdout.write(data));
    child.stderr.on('data', data => process.stderr.write(data));

    child.on('exit', (code, signal) => {
        process.stdin.removeListener('data', stdinForwarder);
        if (signal === 'SIGTERM') {
            watcher.close();
            watcher.removeAllListeners();
            return setup();
        }
        if (code > 0 && code <= 128) {
            watcher.close();
            setTimeout(setup, 1000);
        }
        if (code > 128 || !!signal) {
            server.close();
            process.exit();
        }
    });
    // when watched files change, stop watching,
    // kill the child process, and start again

    watcher.on('change', p => {
        console.log(chalk.green('Restarting due to changes...'));
        console.log(chalk.green('(') + chalk.red(p) + chalk.green(' changed)'));
        child.kill('SIGTERM');
    });

    // when the process exits, we must be sure to
    // clean up the child process

    process.on('uncaughtException', err => {
        child.kill();
        fs.writeSync(1, `${err}\n`);
        server.close();
        process.exit();
    });

    process.on('exit', () => child.kill());
};
