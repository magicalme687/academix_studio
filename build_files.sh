#!/usr/bin/env bash
# Vercel build script — installs dependencies and collects static files

# Install Python dependencies
pip install -r requirements.txt

# Run collectstatic so WhiteNoise can serve fingerprinted static files
python manage.py collectstatic --noinput
