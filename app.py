from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
from downloader import VideoDownloaderBot
from werkzeug.utils import secure_filename
import os

app = Flask(__name__)
CORS(app, resources={r"/download": {"origins": "https://noltek.netlify.app"}})

bot = VideoDownloaderBot()

@app.route('/download', methods=['POST'])
def download():
    try:
        data = request.get_json()
        url = data.get('url')
        format_choice = data.get('format', 'mp4')
        resolution = data.get('resolution', 'best')

        raw_title, file_path = bot.download_single_video(
            url, format_choice=format_choice, resolution_choice=resolution
        )

        if not file_path or not os.path.isfile(file_path):
            return jsonify({"error": "Download failed"}), 500

        # Sanitize filename
        safe_name = secure_filename(os.path.basename(file_path))
        safe_path = os.path.join(os.path.dirname(file_path), safe_name)
        if safe_path != file_path:
            os.rename(file_path, safe_path)
            file_path = safe_path

        return send_file(
            file_path,
            as_attachment=True,
            download_name=os.path.basename(file_path),
            mimetype='application/octet-stream'
        )

    except Exception as e:
        print(f"Download error: {e}")  # Log the exact issue
        return jsonify({'error': str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True)
