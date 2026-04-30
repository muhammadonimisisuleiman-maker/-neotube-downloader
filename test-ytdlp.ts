import youtubedl from 'youtube-dl-exec';

async function test() {
  try {
    const info = await youtubedl('https://www.youtube.com/watch?v=dQw4w9WgXcQ', {
      dumpJson: true,
      noWarnings: true,
      noCheckCertificate: true,
    });
    console.log(info.title);
  } catch (e) {
    console.error(e);
  }
}
test();
