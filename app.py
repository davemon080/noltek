from flask import Flask, request, jsonify, send_file, after_this_request
from flask_cors import CORS
from yt_dlp import YoutubeDL
import os
import uuid

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "https://noltek.netlify.app"}})

DOWNLOAD_FOLDER = "downloads"
COOKIE_FILE = "cookies.txt"
os.makedirs(DOWNLOAD_FOLDER, exist_ok=True)

def find_format_id(url, format_ext, resolution):
    try:
        with YoutubeDL({
            'quiet': True,
            'no_warnings': True,
            'cookiefile': COOKIE_FILE
        }) as ydl:
            info = ydl.extract_info(url, download=False)
            for f in info.get('formats', []):
                height = f.get('height', 0)
                vcodec = f.get('vcodec')
                acodec = f.get('acodec')
                ext = f.get('ext')
                current_res = 'audio only' if vcodec == 'none' and acodec != 'none' else f"{height}p" if height else ''
                if ext == format_ext and current_res == resolution:
                    return f.get('format_id'), ext
    except Exception:
        return None, None
    return None, None

@app.route('/download', methods=['POST'])
def download_video():
    data = request.get_json()
    url = data.get("url")
    format_id = data.get("format_id")  # optional
    format_ext = data.get("format")    # required if format_id is missing
    resolution = data.get("resolution")

    if not url or not format_ext or not resolution:
        return jsonify({"error": "Missing required parameters"}), 400

    if not format_id:
        format_id, resolved_ext = find_format_id(url, format_ext, resolution)
        if not format_id:
            return jsonify({"error": "Could not determine format ID"}), 400
    else:
        resolved_ext = format_ext

    file_id = str(uuid.uuid4())
    output_template = os.path.join(DOWNLOAD_FOLDER, f"{file_id}.%(ext)s")

    ydl_opts = {
        'format': format_id,
        'outtmpl': output_template,
        'quiet': True,
        'no_warnings': True,
        'cookiefile': COOKIE_FILE,
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
        }] if format_ext == 'mp3' and resolution == 'audio only' else []
    }

    try:
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            ext = 'mp3' if format_ext == 'mp3' and resolution == 'audio only' else info.get('ext', 'mp4')
            return jsonify({
                "file_id": file_id,
                "ext": ext
            })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/metadata', methods=['POST'])
def get_metadata():
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
            return jsonify({
                "title": info.get("title"),
                "thumbnail": info.get("thumbnail"),
                "duration": info.get("duration_string", "unknown"),
                "uploader": info.get("uploader", "")
            })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/download/<file_id>', methods=['GET'])
def serve_file(file_id):
    for f in os.listdir(DOWNLOAD_FOLDER):
        if f.startswith(file_id):
            file_path = os.path.join(DOWNLOAD_FOLDER, f)

            @after_this_request
            def cleanup(response):
                try:
                    os.remove(file_path)
                except Exception as e:
                    app.logger.error(f"File cleanup error: {e}")
                return response

            return send_file(file_path, as_attachment=True)

    return jsonify({"error": "File not found"}), 404

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok"})

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
