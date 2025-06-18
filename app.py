from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from pytube import YouTube
from io import BytesIO
import os
import re

app = Flask(__name__)

# Configure CORS to allow your frontend domain
CORS(app, resources={r"/*": {"origins": "https://noltek.netlify.app"}})

def format_duration(seconds):
    """Format duration in seconds to HH:MM:SS"""
    minutes, seconds = divmod(seconds, 60)
    hours, minutes = divmod(minutes, 60)
    if hours > 0:
        return f"{int(hours)}:{int(minutes):02d}:{int(seconds):02d}"
    return f"{int(minutes)}:{int(seconds):02d}"

def sanitize_filename(filename):
    """Remove invalid characters from filename"""
    return re.sub(r'[\\/*?:"<>|]', '', filename)

@app.route('/metadata', methods=['POST'])
def metadata():
    """Endpoint to fetch video metadata"""
    try:
        data = request.json
        url = data.get('url')
        if not url:
            return jsonify({'error': 'URL is required'}), 400
        
        yt = YouTube(url)
        return jsonify({
            'title': yt.title,
            'channel': yt.author,
            'duration': format_duration(yt.length),
            'thumbnail': yt.thumbnail_url
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/download', methods=['POST'])
def download():
    """Endpoint to download video/audio"""
    try:
        data = request.json
        url = data.get('url')
        format = data.get('format', 'video')
        quality = data.get('quality', 'highest')
        
        if not url:
            return jsonify({'error': 'URL is required'}), 400
        
        yt = YouTube(url)
        buffer = BytesIO()
        
        if format == 'video':
            # Handle video download
            streams = yt.streams.filter(progressive=True, file_extension='mp4')
            
            if quality == 'highest':
                stream = streams.get_highest_resolution()
            elif quality == '720p':
                stream = streams.filter(res='720p').first()
            elif quality == '360p':
                stream = streams.filter(res='360p').first()
            else:  # Fallback to highest quality
                stream = streams.get_highest_resolution()
                
            stream.stream_to_buffer(buffer)
            filename = sanitize_filename(f"{yt.title}.mp4")
            mimetype = 'video/mp4'
            
        else:  # Audio format
            stream = yt.streams.filter(only_audio=True).first()
            stream.stream_to_buffer(buffer)
            filename = sanitize_filename(f"{yt.title}.mp3")
            mimetype = 'audio/mpeg'
        
        buffer.seek(0)
        return send_file(
            buffer,
            as_attachment=True,
            download_name=filename,
            mimetype=mimetype
        )
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
