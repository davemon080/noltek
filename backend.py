from flask import Flask, request, jsonify
from flask_cors import CORS
from downloader import VideoDownloaderBot
import uuid
import threading
import os

app = Flask(__name__)
CORS(app)

bot = VideoDownloaderBot()

@app.route("/download", methods=["POST"])
def download_video():
    data = request.get_json()
    url = data.get("url")
    format_choice = data.get("format", "mp4")
    resolution_choice = data.get("resolution")

    if not url:
        return jsonify({"error": "No URL provided"}), 400

    folder = f"downloads/{uuid.uuid4()}/"
    os.makedirs(folder, exist_ok=True)

    thread = threading.Thread(target=bot.download_single_video, kwargs={
        "url": url,
        "output_path": folder,
        "format_choice": format_choice,
        "resolution_choice": resolution_choice
    })
    thread.start()

    return jsonify({"message": "Download started", "folder": folder})

if __name__ == "__main__":
    app.run()

