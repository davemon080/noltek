from flask import Flask, request, send_file, after_this_request, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from pytube import YouTube
from yt_dlp import YoutubeDL
import os
import uuid

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "https://noltek.netlify.app"}})

# Configuration
app.config.update({
    'DOWNLOAD_FOLDER': 'temp_downloads',
    'MAX_CONTENT_LENGTH': 100 * 1024 * 1024,  # 100MB limit
})

# Create download directory
os.makedirs(app.config['DOWNLOAD_FOLDER'], exist_ok=True)

# Rate limiter
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["10 per minute"],
    app=app
)

def detect_platform(url):
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
    if platform == 'youtube':
        return download_youtube(url, file_id)
    else:
        return download_generic(url, file_id)

@app.route('/download', methods=['POST'])
@limiter.limit("5 per minute")
def handle_download():
    data = request.get_json()
    video_url = data.get('url')

    if not video_url:
        return jsonify({'error': 'No URL provided'}), 400

    platform = detect_platform(video_url)
    if not platform:
        return jsonify({'error': 'Unsupported platform'}), 400

    file_id = str(uuid.uuid4())
    file_path = download_task(video_url, file_id, platform)

    if not file_path or not os.path.exists(file_path):
        return jsonify({'error': 'Failed to download video'}), 500

    return jsonify({
        'file_id': file_id,
        'filename': os.path.basename(file_path),
        'platform': platform,
        'status': 'completed'
    })

@app.route('/download/<file_id>', methods=['GET'])
def download_file(file_id):
    file_path = None
    for file in os.listdir(app.config['DOWNLOAD_FOLDER']):
        if file.startswith(file_id):
            file_path = os.path.join(app.config['DOWNLOAD_FOLDER'], file)
            break

    if not file_path or not os.path.exists(file_path):
        return jsonify({'error': 'File not found'}), 404

    @after_this_request
    def cleanup(response):
        try:
            os.remove(file_path)
        except Exception as e:
            app.logger.error(f"Error deleting file: {str(e)}")
        return response

    return send_file(file_path, as_attachment=True)

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'ok',
        'message': 'Downloader service is running',
        'redis': 'not used'
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
