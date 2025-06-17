from flask import Flask, request, jsonify, send_file, after_this_request
from flask_cors import CORS
from yt_dlp import YoutubeDL
import os
import uuid
from datetime import timedelta

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5000",
    "http://127.0.0.1:5500",
    "https://noltek.netlify.app"
]}}, methods=["GET", "POST", "OPTIONS"], supports_credentials=True)

DOWNLOAD_FOLDER = "downloads"
COOKIE_FILE = "cookies.txt"
os.makedirs(DOWNLOAD_FOLDER, exist_ok=True)

@app.route('/formats', methods=['POST'])
def get_formats():
    data = request.get_json()
    url = data.get("url")

    if not url:
        return jsonify({"error": "No URL provided"}), 400

    try:
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'cookiefile': COOKIE_FILE
        }
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            formats = info.get('formats', [])
            filtered = []

            for f in formats:
                format_id = f.get('format_id')
                ext = f.get('ext')
                height = f.get('height', 0)
                acodec = f.get('acodec')
                vcodec = f.get('vcodec')

                if vcodec == 'none' and acodec != 'none':
                    resolution = 'audio only'
                elif vcodec != 'none':
                    resolution = f"{height}p" if height else 'unknown'
                else:
                    continue

                if resolution in ['audio only', '480p', '720p', '1080p', '1440p', '2160p']:
                    filtered.append({
                        'format_id': format_id,
                        'ext': ext,
                        'resolution': resolution
                    })

            return jsonify({"formats": filtered})
    except Exception as e:
        print(f"❌ /formats error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/download', methods=['POST'])
def download_video():
    data = request.get_json()
    url = data.get("url")
    format_id = data.get("format_id")

    if not url or not format_id:
        return jsonify({"error": "Missing URL or format ID"}), 400

    file_id = str(uuid.uuid4())
    output_template = os.path.join(DOWNLOAD_FOLDER, f"{file_id}.%(ext)s")

    ydl_opts = {
        'format': format_id,
        'outtmpl': output_template,
        'quiet': True,
        'no_warnings': True,
        'cookiefile': COOKIE_FILE
    }

    try:
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            ext = info.get('ext') or 'mp4'
            return jsonify({
                "file_id": file_id,
                "ext": ext
            })
    except Exception as e:
        print(f"❌ /download error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/metadata', methods=['POST'])
def get_metadata():
    data = request.get_json()
    url = data.get("url")

    if not url:
        return jsonify({"error": "No URL provided"}), 400

    try:
        print("🔍 Incoming /metadata request")
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'cookiefile': COOKIE_FILE
        }
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            print(f"✅ Metadata fetched for: {info.get('title')}")
            return jsonify({
                "title": info.get("title"),
                "thumbnail": info.get("thumbnail"),
                "duration": info.get("duration_string", "unknown"),
                "uploader": info.get("uploader", "")
            })
    except Exception as e:
        print(f"❌ /metadata error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/download/<file_id>', methods=['GET'])
def serve_file(file_id):
    for f in os.listdir(DOWNLOAD_FOLDER):
        if f.startswith(file_id):
            file_path = os.path.join(DOWNLOAD_FOLDER, f)

            @after_this_request
            def delete_file(response):
                try:
                    os.remove(file_path)
                except Exception as e:
                    app.logger.error(f"Cleanup error: {e}")
                return response

            return send_file(file_path, as_attachment=True)

    return jsonify({"error": "File not found"}), 404

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok"})

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
