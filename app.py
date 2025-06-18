from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from pytube import YouTube
import re
import datetime

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "https://noltek.netlify.app"}})

@app.route('/metadata', methods=['POST'])
def get_metadata():
    try:
        data = request.json
        url = data.get('url')
        
        if not url:
            return jsonify({'error': 'URL is required'}), 400
            
        yt = YouTube(url)
        
        # Format duration
        duration = str(datetime.timedelta(seconds=yt.length))
        if duration.startswith('0:'):
            duration = duration[2:]
        
        return jsonify({
            'title': yt.title,
            'channel': yt.author,
            'duration': duration,
            'thumbnail': yt.thumbnail_url
        })
        
    except Exception as e:
        print(f'Metadata error: {str(e)}')
        return jsonify({'error': 'Failed to fetch video metadata'}), 500

@app.route('/download', methods=['POST'])
def download_video():
    try:
        data = request.json
        url = data.get('url')
        format_type = data.get('format', 'video')
        quality = data.get('quality', 'highest')
        
        if not url:
            return jsonify({'error': 'URL is required'}), 400
            
        yt = YouTube(url)
        title = re.sub(r'[^\w\s]', '', yt.title)  # Sanitize filename
        
        # Get appropriate stream
        if format_type == 'audio':
            stream = yt.streams.filter(only_audio=True).order_by('abr').last()
            filename = f'{title}.mp3'
            content_type = 'audio/mpeg'
        else:
            if quality == 'highest':
                stream = yt.streams.filter(progressive=True, file_extension='mp4').order_by('resolution').desc().first()
            else:
                stream = yt.streams.filter(progressive=True, res=quality, file_extension='mp4').first()
                if not stream:
                    stream = yt.streams.filter(progressive=True, file_extension='mp4').order_by('resolution').desc().first()
            filename = f'{title}.mp4'
            content_type = 'video/mp4'

        if not stream:
            return jsonify({'error': 'No suitable stream found'}), 400

        # Stream directly to user
        headers = {
            'Content-Disposition': f'attachment; filename="{filename}"',
            'Content-Type': content_type,
            'Content-Length': str(stream.filesize)
        }
        
        # Create streaming response
        def generate():
            for chunk in stream.stream():
                yield chunk
                
        return Response(generate(), headers=headers)
        
    except Exception as e:
        print(f'Download error: {str(e)}')
        return jsonify({'error': 'Failed to download video'}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
