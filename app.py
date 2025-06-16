import os
import uuid
import requests
import redis
from rq import Queue
from flask import Flask, request, jsonify, send_file, after_this_request
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from pytube import YouTube
from yt_dlp import YoutubeDL
from dotenv import load_dotenv
import tempfile
import logging
from downloader import download_video  # Ensure this module exists

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "https://noltek.netlify.app"}})  # Enable CORS for cross-origin requests

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize the rate limiter with the key function and limits, then attach the app
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["10 per minute"]
)
limiter.init_app(app)

# Configuration
app.config.update({
    'DOWNLOAD_FOLDER': 'temp_downloads',
    'MAX_CONTENT_LENGTH': 100 * 1024 * 1024,  # 100MB limit
    'SECRET_KEY': os.getenv('SECRET_KEY', 'default-secret-key'),
    'REDIS_URL': os.getenv('REDIS_URL', 'redis://localhost:6379/0')
})

# Create download directory
os.makedirs(app.config['DOWNLOAD_FOLDER'], exist_ok=True)

# Initialize rate limiter
limiter = Limiter(
    app,
    key_func=get_remote_address,
    default_limits=["10 per minute"]
)

# Initialize Redis Queue
try:
    r = redis.from_url(app.config['REDIS_URL'])
    q = Queue(connection=r, default_timeout=3600)
    redis_available = True
except:
    redis_available = False

def detect_platform(url):
    """Detect video platform from URL"""
    if 'youtube.com' in url or 'youtu.be' in url:
        return 'youtube'
    elif 'tiktok.com' in url:
        return 'tiktok'
    elif 'instagram.com' in url:
        return 'instagram'
    elif 'facebook.com' in url or 'fb.watch' in url:
        return 'facebook'
    return None

def download_youtube(url, file_id):
    """Download YouTube video using pytube"""
    try:
        yt = YouTube(url)
        stream = yt.streams.filter(progressive=True, file_extension='mp4').order_by('resolution').desc().first()
        if not stream:
            return None
        return stream.download(output_path=app.config['DOWNLOAD_FOLDER'], filename=f"{file_id}.mp4")
    except Exception as e:
        print(f"YouTube download error: {str(e)}")
        return None

def download_generic(url, file_id):
    """Download videos using yt-dlp (supports TikTok, Instagram, Facebook)"""
    try:
        ydl_opts = {
            'format': 'best',
            'outtmpl': f"{app.config['DOWNLOAD_FOLDER']}/{file_id}.%(ext)s",
            'quiet': True,
            'no_warnings': True,
        }
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            return f"{app.config['DOWNLOAD_FOLDER']}/{file_id}.{info['ext']}"
    except Exception as e:
        print(f"Generic download error: {str(e)}")
        return None

def download_task(url, file_id, platform):
    """Background download task"""
    if platform == 'youtube':
        return download_youtube(url, file_id)
    else:
        return download_generic(url, file_id)

@app.route('/download', methods=['POST'])
@limiter.limit("5 per minute")
def handle_download():
    """Endpoint to handle download requests"""
    data = request.json
    video_url = data.get('url')
    
    if not video_url:
        return jsonify({'error': 'No URL provided'}), 400
    
    platform = detect_platform(video_url)
    if not platform:
        return jsonify({'error': 'Unsupported platform'}), 400
    
    file_id = str(uuid.uuid4())
    
    # Process immediately if Redis not available
    if not redis_available:
        file_path = download_task(video_url, file_id, platform)
        if not file_path or not os.path.exists(file_path):
            return jsonify({'error': 'Failed to download video'}), 500
        
        return jsonify({
            'file_id': file_id,
            'filename': os.path.basename(file_path),
            'platform': platform,
            'status': 'completed'
        })
    
    # Queue background job if Redis available
    job = q.enqueue(download_task, video_url, file_id, platform)
    return jsonify({
        'job_id': job.get_id(),
        'file_id': file_id,
        'status': 'queued',
        'platform': platform
    })

@app.route('/download/<file_id>', methods=['GET'])
def download_file(file_id):
    """Endpoint to download processed files"""
    file_path = None
    for file in os.listdir(app.config['DOWNLOAD_FOLDER']):
        if file.startswith(file_id):
            file_path = os.path.join(app.config['DOWNLOAD_FOLDER'], file)
            break
    
    if not file_path or not os.path.exists(file_path):
        return jsonify({'error': 'File not found'}), 404
    
    # Schedule file cleanup after download
    @after_this_request
    def cleanup(response):
        try:
            os.remove(file_path)
        except Exception as e:
            app.logger.error(f"Error deleting file: {str(e)}")
        return response
    
    return send_file(file_path, as_attachment=True)

@app.route('/status/<job_id>', methods=['GET'])
def job_status(job_id):
    """Check job status"""
    if not redis_available:
        return jsonify({'error': 'Redis not available'}), 503
    
    job = q.fetch_job(job_id)
    if not job:
        return jsonify({'error': 'Job not found'}), 404
    
    return jsonify({
        'job_id': job_id,
        'status': job.get_status(),
        'result': job.result
    })

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'message': 'Downloader service is running',
        'redis': 'available' if redis_available else 'unavailable'
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
