import os, sys

# Include project root in path so server.py can be imported
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server import wsgi_app

def handler(environ, start_response):
    path = environ.get("PATH_INFO", "")
    if not path.startswith("/api/"):
        environ["PATH_INFO"] = "/api" + path
    return wsgi_app(environ, start_response)

app = handler
