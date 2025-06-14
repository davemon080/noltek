from flask import Flask, request, send_file, jsonify, after_this_request
from flask_cors import CORS
from downloader import VideoDownloaderBot
import os
import logging

# Setup basic logging
logging.basicConfig(level=logging.INFO)

app = Flask(__name__)
CORS(app, resources={r"/download": {"origins": "https://noltek.netlify.app"}})

# Initialize your bot
bot = VideoDownloaderBot()

@app.route('/download', methods=['POST'])
def download():
    try:
        data = request.get_json()
        url = data.get('url')
        format_choice = data.get('format', 'mp4')
        resolution = data.get('resolution', 'best')

        logging.info(f"Download requested: URL={url}, Format={format_choice}, Resolution={resolution}")

        # Call the downloader
        raw_title, file_path = bot.download_single_video(
            url, format_choice=format_choice, resolution_choice=resolution
        )

        if not file_path or not os.path.isfile(file_path):
            logging.error("Download failed or file not found.")
            return jsonify({"error": "Download failed"}), 500

        @after_this_request
        def cleanup(response):
            try:
                os.remove(file_path)
                logging.info(f"File deleted after sending: {file_path}")
            except Exception as delete_error:
                logging.warning(f"Failed to delete file: {file_path} - {delete_error}")
            return response

        logging.info(f"Sending file: {file_path}")
        return send_file(
            file_path,
            as_attachment=True,
            download_name=os.path.basename(file_path),
            mimetype='application/octet-stream'
        )

    except Exception as e:
        logging.exception("Unexpected error during download.")
        return jsonify({'error': str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True)
