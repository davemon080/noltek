from flask import Flask, request, jsonify, send_file, after_this_request
from flask_cors import CORS
from yt_dlp import YoutubeDL
import os
import uuid

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "https://noltek.netlify.app"}})

DOWNLOAD_FOLDER = "downloads"
os.makedirs(DOWNLOAD_FOLDER, exist_ok=True)

@app.route('/formats', methods=['POST'])
def get_formats():
    data = request.get_json()
    url = data.get("url")

    if not url:
        return jsonify({"error": "No URL provided"}), 400

    try:
        with YoutubeDL({'quiet': True, 'no_warnings': True}) as ydl:
            info = ydl.extract_info(url, download=False)
            formats = info.get('formats', [])
            filtered = []

            for f in formats:
                format_id = f.get('format_id')
                ext = f.get('ext')
                height = f.get('height', 0)
                acodec = f.get('acodec')
                vcodec = f.get('vcodec')

                # Detect audio only
                if vcodec == 'none' and acodec != 'none':
                    resolution = 'audio only'
                    display_ext = 'mp3'  # Will convert to mp3
                # Detect video with audio
                elif vcodec != 'none':
                    resolution = f"{height}p" if height else 'unknown'
                    display_ext = ext
                else:
                    continue  # skip unknown types

                if resolution in ['audio only', '480p', '720p', '1080p', '1440p', '2160p'] and display_ext in ['mp4', 'mp3']:
                    filtered.append({
                        'format_id': format_id,
                        'ext': display_ext,
                        'resolution': resolution
                    })

            return jsonify({"formats": filtered})
    except Exception as e:
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

    # Detect if it's audio-only (user chose "mp3")
    audio_only = format_id == 'mp3' or format_id.startswith("audio")

    ydl_opts = {
        'format': format_id,
        'outtmpl': output_template,
        'quiet': True,
        'no_warnings': True,
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
        }] if audio_only else []
    }

    try:
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            ext = 'mp3' if audio_only else info.get('ext')
            return jsonify({
                "file_id": file_id,
                "ext": ext
            })
    except Exception as e:
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
    app.run(host='0.0.0.0', port=port)
