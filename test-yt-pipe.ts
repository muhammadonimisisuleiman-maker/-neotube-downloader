import ytdl from "@distube/ytdl-core";
import fs from "fs";

console.log("Starting stream...");
const stream = ytdl("https://www.youtube.com/watch?v=dQw4w9WgXcQ", { filter: 'audioandvideo' });
stream.on("info", (info, format) => console.log("Info event:", format.url.substring(0, 50)));
stream.on("error", (err) => console.error("Stream Error:", err));
stream.pipe(fs.createWriteStream("video.mp4")).on("finish", () => {
  console.log("File downloaded correctly", fs.statSync("video.mp4").size);
});
