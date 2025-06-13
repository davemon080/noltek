from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from downloader import VideoDownloaderBot
import uuid
import os

app = Flask(__name__)
CORS(app)

bot = VideoDownloaderBot()

@app.route("/")
def home():
    return jsonify({"status": "Video Downloader API is live 🎉"})

@app.route("/download", methods=["POST"])
def download_video():
    data = request.get_json()
    url = data.get("url")
    format_choice = data.get("format", "mp4")
    resolution_choice = data.get("resolution")

    if not url:
        return jsonify({"error": "No URL provided"}), 400

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
    return jsonify({"error": "Download failed or login is required to access this video"}), 400


    # Send the file back to browser as download
    return send_file(
        file_path,
        as_attachment=True,
        download_name=os.path.basename(file_path),
        mimetype='video/mp4'
    )

if __name__ == "__main__":
    app.run()
