import play from 'play-dl';

async function test() {
  try {
    const info = await play.video_info('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    console.log(info.video_details.title);
    
    const stream = await play.stream('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    console.log("STREAM URL:", stream.url);
  } catch (e) {
    console.error(e);
  }
}
test();
