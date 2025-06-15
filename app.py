from flask import Flask, request, send_file, jsonify, send_from_directory
from flask_cors import CORS
from downloader import VideoDownloaderBot
from werkzeug.utils import secure_filename
import os, threading, uuid, time  # Added time module
from threading import Lock  # Added for thread safety

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "https://noltek.netlify.app"}})  # Broader CORS

bot = VideoDownloaderBot()
DOWNLOAD_FOLDER = 'downloads'
os.makedirs(DOWNLOAD_FOLDER, exist_ok=True)
download_status = {}
status_lock = Lock()  # Thread safety lock

# ===== NEW: Memory Cleanup System =====
def clean_expired_entries(max_age=3600):  # 1 hour expiration
    """Automatically remove old download entries"""
    now = time.time()
    with status_lock:
        expired_ids = [
            d_id for d_id, entry in download_status.items()
            if now - entry['created'] > max_age
        ]
        for d_id in expired_ids:
            del download_status[d_id]

# ===== NEW: File Info Endpoint =====
@app.route('/file-info', methods=['GET'])
def get_file_info():
    """Get video metadata before download"""
    try:
        url = request.args.get('url')
        if not url:
            return jsonify({'error': 'Missing URL'}), 400
        
        # Extract metadata without downloading
        with yt_dlp.YoutubeDL({'quiet': True}) as ydl:
            info = ydl.extract_info(url, download=False)
            
            # Calculate size in MB
            size_bytes = info.get('filesize_approx') or info.get('filesize')
            size_mb = round(size_bytes / (1024 * 1024), 2) if size_bytes else None
            
            # Format duration (seconds to MM:SS)
            duration_sec = info.get('duration')
            duration_fmt = f"{int(duration_sec//60)}:{int(duration_sec%60):02d}" if duration_sec else None
            
            return jsonify({
                'sizeMB': size_mb,
                'duration': duration_fmt,
                'title': info.get('title'),
                'thumbnail': info.get('thumbnail')
            })
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ===== Modified Download Endpoints =====
@app.route('/start-download', methods=['POST'])
def start_download():
    try:
        data = request.get_json()
        url = data.get('url')
        format_choice = data.get('format', 'mp4')
        resolution = data.get('resolution', 'best')

        download_id = str(uuid.uuid4())
        
        # Add creation timestamp with thread lock
        with status_lock:
            download_status[download_id] = {
                'status': 'processing', 
                'file': None,
                'created': time.time()  # NEW: Timestamp for cleanup
            }

        def background_download():
            try:
                _, file_path = bot.download_single_video(
                    url, format_choice=format_choice, resolution_choice=resolution
                )
                
                # Security fix: Enforce download folder
                safe_name = secure_filename(os.path.basename(file_path))
                safe_path = os.path.join(DOWNLOAD_FOLDER, safe_name)
                
                # Validate path is within download folder
                if not os.path.abspath(safe_path).startswith(os.path.abspath(DOWNLOAD_FOLDER)):
                    raise SecurityError("Invalid path attempt")
                
                # Rename if needed
                if safe_path != file_path:
                    os.rename(file_path, safe_path)
                    file_path = safe_path

                # Update status with lock
                with status_lock:
                    download_status[download_id] = {
                        'status': 'done', 
                        'file': safe_name,
                        'created': time.time()  # Update timestamp
                    }
                    
            except Exception as e:
                print(f"Download error: {e}")
                with status_lock:
                    download_status[download_id] = {
                        'status': 'error', 
                        'error': str(e),
                        'created': time.time()
                    }

        threading.Thread(target=background_download).start()
        return jsonify({'download_id': download_id})

    except Exception as e:
        print(f"Start download error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/status/<download_id>', methods=['GET'])
def check_status(download_id):
    clean_expired_entries()  # NEW: Auto-clean before status check
    with status_lock:
        status = download_status.get(download_id)
    if not status:
        return jsonify({'error': 'Invalid download ID'}), 404
    return jsonify(status)

@app.route('/download/<download_id>', methods=['GET'])
def serve_file(download_id):
    clean_expired_entries()  # NEW: Clean before serving
    with status_lock:
        status = download_status.get(download_id)
    if not status or status['status'] != 'done':
        return jsonify({'error': 'File not ready'}), 404
    return send_from_directory(DOWNLOAD_FOLDER, status['file'], as_attachment=True)

if __name__ == "__main__":
    app.run(debug=True)
