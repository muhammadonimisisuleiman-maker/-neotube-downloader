import ytdl from "@distube/ytdl-core";
ytdl.getInfo("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
  .then(info => {
    const format = ytdl.chooseFormat(info.formats, { filter: 'audioandvideo' });
    console.log("FORMAT:", format ? format.url.substring(0, 50) : "Not found");
  })
  .catch(console.error);
