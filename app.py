from flask import Flask, request, send_file, jsonify, send_from_directory
from flask_cors import CORS
from downloader import VideoDownloaderBot
from werkzeug.utils import secure_filename
import os, threading, uuid

app = Flask(__name__)
CORS(app, resources={r"/download": {"origins": "https://noltek.netlify.app"}})

bot = VideoDownloaderBot()
DOWNLOAD_FOLDER = 'downloads'
os.makedirs(DOWNLOAD_FOLDER, exist_ok=True)
download_status = {}

@app.route('/start-download', methods=['POST'])
def start_download():
    try:
        data = request.get_json()
        url = data.get('url')
        format_choice = data.get('format', 'mp4')
        resolution = data.get('resolution', 'best')

        download_id = str(uuid.uuid4())
        download_status[download_id] = {'status': 'processing', 'file': None}

        def background_download():
            try:
                _, file_path = bot.download_single_video(
                    url, format_choice=format_choice, resolution_choice=resolution
                )
                if not file_path or not os.path.isfile(file_path):
                    download_status[download_id] = {'status': 'error', 'error': 'Download failed'}
                    return

                safe_name = secure_filename(os.path.basename(file_path))
                safe_path = os.path.join(os.path.dirname(file_path), safe_name)
                if safe_path != file_path:
                    os.rename(file_path, safe_path)
                    file_path = safe_path

                download_status[download_id] = {'status': 'done', 'file': safe_name}
            except Exception as e:
                print(f"Download error in thread: {e}")
                download_status[download_id] = {'status': 'error', 'error': str(e)}

        threading.Thread(target=background_download).start()
        return jsonify({'download_id': download_id})

    except Exception as e:
        print(f"Start download error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/status/<download_id>', methods=['GET'])
def check_status(download_id):
    status = download_status.get(download_id)
    if not status:
        return jsonify({'error': 'Invalid download ID'}), 404
    return jsonify(status)

@app.route('/download/<download_id>', methods=['GET'])
def serve_file(download_id):
    status = download_status.get(download_id)
    if not status or status['status'] != 'done':
        return jsonify({'error': 'File not ready'}), 404
    return send_from_directory(DOWNLOAD_FOLDER, status['file'], as_attachment=True)

if __name__ == "__main__":
    app.run(debug=True)
