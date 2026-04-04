#!/bin/bash
set -e
python manage.py migrate --noinput
python manage.py collectstatic --noinput
set +e
python manage.py seed_codes
python manage.py create_ors_admin
python manage.py seed_test_users
python manage.py generate_embeddings
set -e
exec gunicorn config.wsgi --bind 0.0.0.0:$PORT --workers 2 --threads 2
