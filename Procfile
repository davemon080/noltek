# Procfile
web: gunicorn app:app --bind=0.0.0.0:$PORT --workers=${WEB_CONCURRENCY:-4} --timeout=360 --keep-alive=10 --worker-class=sync
