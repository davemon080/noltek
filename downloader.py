import yt_dlp
import os
import sys
from werkzeug.utils import secure_filename

class VideoDownloaderBot:
    def __init__(self):
        print("✅ Video Downloader Bot initialized.")

    def download_single_video(self, url: str, output_path: str = "downloads/", format_choice: str = 'mp4', resolution_choice: str = None):
        if not url:
            print("❌ No URL provided.")
            return None, None

        if not os.path.exists(output_path):
            os.makedirs(output_path)
            print(f"📁 Created download directory: {output_path}")

        ydl_opts = {
            'outtmpl': os.path.join(output_path, '%(title)s.%(ext)s'),
            'noplaylist': True,
            'retries': 5,
            'progress_hooks': [self.download_progress_hook],
            'cookiefile': 'cookies.txt'
        }

        if format_choice == 'mp3':
            ydl_opts.update({
                'format': 'bestaudio/best',
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': '192',
                }],
                'outtmpl': os.path.join(output_path, '%(title)s.%(ext)s'),
            })
            print("🎵 Downloading audio as MP3.")
        else:
            if resolution_choice:
                resolution_map = {'480p': 480, '720p': 720, '1080p': 1080, '2k': 1440, '4k': 2160}
                height = resolution_map.get(resolution_choice.lower())
                if height:
                    ydl_opts['format'] = f'bestvideo[height<={height}]+bestaudio/best'
                else:
                    ydl_opts['format'] = 'bestvideo+bestaudio/best'
                ydl_opts['merge_output_format'] = 'mp4'
                print(f"📹 Downloading MP4 at resolution: {resolution_choice}")
            else:
                ydl_opts.update({
                    'format': 'bestvideo+bestaudio/best',
                    'merge_output_format': 'mp4',
                })
                print("📹 Downloading MP4 in best available quality.")

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info_dict = ydl.extract_info(url, download=True)

                # Get the real saved file path from yt_dlp
                file_path = ydl.prepare_filename(info_dict)
                if format_choice == 'mp3':
                    file_path = file_path.rsplit('.', 1)[0] + '.mp3'  # Adjust for post-processing

                # Sanitize title only for safe return
                title = secure_filename(info_dict.get('title', 'video'))

                print(f"✅ Successfully downloaded: {file_path}")
                return title, os.path.abspath(file_path)

        except Exception as e:
            print(f"❌ Download failed: {str(e)}")
            return None, None

    def download_progress_hook(self, d):
        if d['status'] == 'downloading':
            if 'total_bytes' in d and 'downloaded_bytes' in d:
                percent = (d['downloaded_bytes'] / d['total_bytes']) * 100
                print(f"⏬ Downloading: {d['filename']} - {percent:.2f}% complete", end='\r')
            elif 'total_bytes_estimate' in d and 'downloaded_bytes' in d:
                percent = (d['downloaded_bytes'] / d['total_bytes_estimate']) * 100
                print(f"⏬ Downloading: {d['filename']} - {percent:.2f}% estimated", end='\r')
            sys.stdout.flush()
        elif d['status'] == 'finished':
            print(f"\n✅ Finished: {d['filename']}")
        elif d['status'] == 'error':
            print(f"\n❌ Error: {d.get('filename')} - {d.get('error', 'Unknown error')}")
