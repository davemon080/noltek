

from flask import Flask, request, send_file, jsonify
from downloader import VideoDownloaderBot
import os
from werkzeug.utils import secure_filename

app = Flask(__name__)
CORS(app, resources={r"/download": {"origins": "https://noltek.netlify.app"}})  # Enable CORS
# Or for development/testing: CORS(app)
bot = VideoDownloaderBot()

@app.route('/download', methods=['POST'])
def download():
    try:
        data = request.get_json()
        url = data.get('url')
        format_choice = data.get('format', 'mp4')
        resolution = data.get('resolution', 'best')

        # CORRECTED: Use the correct method name
        raw_title, file_path = bot.download_single_video(
            url,
            format_choice=format_choice,
            resolution_choice=resolution
        )

        if not file_path or not os.path.exists(file_path):
            return jsonify({"error": "Download failed"}), 500

        safe_filename = secure_filename(os.path.basename(file_path))
        safe_path = os.path.join(os.path.dirname(file_path), safe_filename)

        if safe_path != file_path:
            os.rename(file_path, safe_path)

        return send_file(
            safe_path,
            as_attachment=True,
            download_name=safe_filename,
            mimetype='application/octet-stream'
        )

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True)

