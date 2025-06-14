from flask import Flask, request, send_file, jsonify
from downloader import VideoDownloaderBot
import os
from werkzeug.utils import secure_filename

app = Flask(__name__)
bot = VideoDownloaderBot()

@app.route('/download', methods=['POST'])
def download():
    try:
        data = request.get_json()
        url = data.get('url')
        format_choice = data.get('format', 'mp4')
        resolution = data.get('resolution', 'best')

        # Download video
        raw_title, file_path = bot.download(url, format=format_choice, resolution=resolution)

        if not file_path or not os.path.exists(file_path):
            return jsonify({"error": "Download failed"}), 500

        # Sanitize filename
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
