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


@app.route('/download', methods=['POST'])
def download_video():
    data = request.get_json()
    url = data.get("url")
    resolution = data.get("resolution", "720p").replace("p", "")

    if not url or not resolution.isdigit():
        return jsonify({"error": "Missing or invalid URL/resolution"}), 400

    file_id = str(uuid.uuid4())
    output_template = os.path.join(DOWNLOAD_FOLDER, f"{file_id}.%(ext)s")

    ydl_opts = {
        'format': f'bestvideo[height={resolution}]+bestaudio/best',
        'outtmpl': output_template,
        'quiet': True,
        'no_warnings': True,
        'cookiefile': COOKIE_FILE,
        'merge_output_format': 'mp4',
        'postprocessors': [{
            'key': 'FFmpegVideoConvertor',
            'preferedformat': 'mp4'  # Correct spelling (yt-dlp uses 'preferedformat')
        }]
    }

    try:
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url)
            filename = ydl.prepare_filename(info)

        final_file = os.path.splitext(filename)[0] + ".mp4"
        if not os.path.exists(final_file):
            return jsonify({"error": "Download failed. File not found."}), 500

        return jsonify({
            "file_id": os.path.splitext(os.path.basename(final_file))[0],
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
