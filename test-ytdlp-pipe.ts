import youtubedl from 'youtube-dl-exec';
import fs from 'fs';

console.log("Starting yt-dlp...");
const subprocess = youtubedl.exec('https://www.youtube.com/watch?v=dQw4w9WgXcQ', {
  o: '-',
  f: 'best',
});

if (subprocess.stdout) {
  subprocess.stdout.pipe(fs.createWriteStream('video2.mp4'));
  subprocess.stdout.on('end', () => console.log("Done", fs.statSync('video2.mp4').size));
  subprocess.stderr?.on('data', d => console.log('ERR:', d.toString()));
}
