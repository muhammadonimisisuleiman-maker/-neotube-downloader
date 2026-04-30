import ytdl from "@distube/ytdl-core";
ytdl.getInfo("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
  .then(info => console.log(info.videoDetails.title))
  .catch(err => console.error("YT_ERR:", err.message));
