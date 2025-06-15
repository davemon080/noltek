# gunicorn.conf.py
bind = "0.0.0.0:8000"
workers = 4
timeout = 360
keepalive = 10
graceful_timeout = 20
worker_class = "sync"
