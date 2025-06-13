from flask import Flask, request, send_file, jsonify
from downloader import VideoDownloaderBot
import os
import uuid
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

        # Generate a unique filename and sanitize it
        raw_title, file_path = bot.download(url, format=format_choice, resolution=resolution)
        safe_filename = secure_filename(os.path.basename(file_path))

        # Optional: rename file to safe version
        safe_path = os.path.join(os.path.dirname(file_path), safe_filename)
        if safe_path != file_path:
            os.rename(file_path, safe_path)

        return send_file(safe_path, as_attachment=True)

    except Exception as e:
        return jsonify({'error': str(e)}), 500


    # Create a unique folder
    folder = f"downloads/{uuid.uuid4()}/"
    os.makedirs(folder, exist_ok=True)

    # Download video now (synchronously)
    file_path = bot.download_single_video(
        url=url,
        output_path=folder,
        format_choice=format_choice,
        resolution_choice=resolution_choice
    )
    if not file_path or not os.path.exists(file_path):
        return jsonify({"error": "Download failed"}), 500

    # Send the file back to browser as download
    return send_file(
        file_path,
        as_attachment=True,
        download_name=os.path.basename(file_path),
        mimetype='video/mp4'
    )

if __name__ == "__main__":
    app.run()
