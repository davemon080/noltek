# app.py
from flask import Flask, request, send_file, jsonify
from flask_cors import CORS  # Added for Netlify frontend support
from pytube import YouTube
from io import BytesIO
import os
import re
import logging

app = Flask(__name__)

# Configure CORS for Netlify frontend
CORS(app, resources={
    r"/download": {
        "origins": os.environ.get('ALLOWED_ORIGINS', 'https://noltek.netlify.app/')
    }
})

# Configure logging
logging.basicConfig(level=logging.INFO)

@app.route('/download', methods=['POST', 'OPTIONS'])  # Added OPTIONS for preflight
def download_video():
    if request.method == 'OPTIONS':
        # Handle CORS preflight request
        response = jsonify({'status': 'preflight'})
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST')
        return response
        
    try:
        data = request.get_json()
        url = data.get('url')
        quality = data.get('quality', 'highest')
        
        if not url:
            return jsonify({"error": "Missing URL parameter"}), 400
        
        # Sanitize filename
        yt = YouTube(url)
        title = re.sub(r'[^\w\s-]', '', yt.title)[:50]
        
        # Select stream based on quality preference
        if quality == 'highest':
            stream = yt.streams.get_highest_resolution()
        elif quality == 'audio':
            stream = yt.streams.get_audio_only()
        else:
            stream = yt.streams.filter(res=quality).first()
        
        if not stream:
            return jsonify({"error": "Requested quality not available"}), 400
        
        # Stream video to memory buffer
        buffer = BytesIO()
        stream.stream_to_buffer(buffer)
        buffer.seek(0)
        
        # Send file directly to client
        return send_file(
            buffer,
            as_attachment=True,
            download_name=f"{title}.mp4",
            mimetype='video/mp4'
        )
        
    except Exception as e:
        logging.error(f"Download failed: {str(e)}")
        return jsonify({"error": "Download failed", "details": str(e)}), 500

@app.route('/')
def health_check():
    return "Video Download Backend is running"

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
