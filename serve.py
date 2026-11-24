#!/usr/bin/env python3
"""Static server with caching turned off.

`python3 -m http.server` sends no Cache-Control header, so a browser may keep
an old app.js and its modules and silently run stale code. This server sends
no-store, so a reload always means a reload.

    python3 serve.py            # http://127.0.0.1:8123
    python3 serve.py 9000
"""

import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.send_header("Pragma", "no-cache")
        super().end_headers()

    def log_message(self, *args):  # quiet
        pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
    print(f"Serving on http://127.0.0.1:{port} (no caching)")
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
