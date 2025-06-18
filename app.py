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
            filtered = {}

            for f in formats:
                format_id = f.get('format_id')
                ext = f.get('ext')
                height = f.get('height')

                if ext == 'mp4' and height:
                    resolution = f"{height}p"
                    if resolution not in filtered:
                        filtered[resolution] = {
                            'format_id': format_id,
                            'ext': ext,
                            'resolution': resolution
                        }

            if not filtered:
                return jsonify({"error": "No valid MP4 formats found."}), 400

            return jsonify({
                "formats": sorted(filtered.values(), key=lambda x: int(x['resolution'].replace('p', '')))
            })
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
    output_template = os.path.join(DOWNLOAD_FOLDER, f"{file_id}.mp4")

    ydl_opts = {
        'format': f"{format_id}+bestaudio/best",
        'outtmpl': output_template,
        'quiet': True,
        'no_warnings': True,
        'cookiefile': COOKIE_FILE,
        'merge_output_format': 'mp4',
        'postprocessors': [{
            'key': 'FFmpegVideoConvertor',
            'preferedformat': 'mp4'
        }]
    }

    try:
        with YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
            return jsonify({
                "file_id": file_id,
                "ext": 'mp4'
            })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/download/<file_id>', methods=['GET'])
def serve_file(file_id):
    for f in os.listdir(DOWNLOAD_FOLDER):
        if f.startswith(file_id) and f.endswith('.mp4'):
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
