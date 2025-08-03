# Deployment Guide - Heroku & Render

## Quick Setup

### 1. Use Optimized Requirements

- Rename `requirements-deploy.txt` to `requirements.txt`
- This reduces size from ~800MB to ~200MB

### 2. Deploy to Heroku

```bash
git add .
git commit -m "Optimized for deployment"
git push heroku main
```

### 3. Deploy to Render

- Use `requirements-deploy.txt` as requirements file
- Start command: `gunicorn app:app`

## What Was Optimized

- ✅ TensorFlow CPU instead of full TensorFlow (~600MB saved)
- ✅ Removed TensorBoard and Matplotlib (~80MB saved)
- ✅ Dynamic port detection (works on both platforms)
- ✅ Production-ready settings

## Files Ready for Deployment

- `app.py` - Port configuration fixed
- `requirements-deploy.txt` - Minimal dependencies
- `Procfile` - Already correct
- `runtime.txt` - Already correct

Your app will work exactly the same, just smaller and faster to deploy!
