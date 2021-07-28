# loadmon
Import-based change watcher: restarts nodejs or python process on change of a used file

Inspired by https://github.com/remy/nodemon
Problems:
- if I'm debugging within a dependency I want it to auto-restart
- I don't want it to watch every file in node_modules
- I might want to use python instead of node

Solution: language-independent parent process watching the runtime dependency tree - which is passed back by the child processes in whatever language you like.
