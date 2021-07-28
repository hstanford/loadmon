#!/usr/bin/env python

import sys
import socket
import __builtin__
import re

# connect to the parent process using the socket address passed in

socket_file = sys.argv[1]

s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)

s.connect(socket_file)

# cache files that are already required in a dictionary

sent = {}

# override __import__, sending the paths of
# newly required modules to the parent

_import = __builtin__.__import__

def importOverride(*args, **kwargs):
    mod = _import(*args, **kwargs)
    if hasattr(mod, '__file__') and mod.__file__ not in sent:
        # mark as processed
        sent[mod.__file__] = True
        s.send(re.sub(r'\.pyc$', '.py', mod.__file__) + '\n');
    return mod

__builtin__.__import__ = importOverride

# remove this file and the socket address from the arguments,
# and execute the underlying file

sys.argv = sys.argv[2:]
execfile(sys.argv[0])
