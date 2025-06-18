from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from pytube import YouTube
from io import BytesIO
import re
import os

app = Flask(__name__)

# Configure CORS: Allow specific origin (Netlify frontend) or use '*' for development
frontend_url = os.environ.get('FRONTEND_URL', '*')
CORS(app, origins=frontend_url)

def sanitize_filename(name):
    """Remove invalid characters from filename"""
    return re.sub(r'[\\/*?:"<>|]', "", name)

@app.route('/backend/metadata', methods=['POST'])
def get_metadata():
    data = request.json
    url = data.get('url')
    
    if not url:
        return jsonify({'error': 'Missing URL parameter'}), 400
        
    try:
        yt = YouTube(url)
        return jsonify({
            'title': yt.title,
            'thumbnail': yt.thumbnail_url,
            'duration': f"{yt.length // 60}:{str(yt.length % 60).zfill(2)}",
            'channel': yt.author
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/backend/download', methods=['POST'])
def download_video():
    data = request.json
    url = data.get('url')
    quality = data.get('quality')
    
    if not url or not quality:
        return jsonify({'error': 'Missing parameters'}), 400
        
    try:
        yt = YouTube(url)
        
        if quality == 'audio':
            stream = yt.streams.filter(only_audio=True).order_by('abr').desc().first()
        elif quality == 'highest':
            stream = yt.streams.get_highest_resolution()
        elif quality == '720p':
            stream = yt.streams.filter(res="720p", progressive=True).first()
        elif quality == '360p':
            stream = yt.streams.filter(res="360p", progressive=True).first()
        else:
            stream = yt.streams.get_highest_resolution()
        
        if not stream:
            return jsonify({'error': 'No stream found for selected quality'}), 400

        buffer = BytesIO()
        stream.stream_to_buffer(buffer)
        buffer.seek(0)
        
        filename = sanitize_filename(yt.title)
        extension = 'mp3' if quality == 'audio' else stream.subtype
        
        return send_file(
            buffer,
            as_attachment=True,
            download_name=f'{filename}.{extension}',
            mimetype=stream.mime_type
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
