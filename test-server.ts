import fetch from "node-fetch";

async function test() {
  try {
    const res = await fetch("http://localhost:3000/api/info?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    console.log("INFO STATUS:", res.status);
    console.log("INFO BODY:", await res.text());
    
    const res2 = await fetch("http://localhost:3000/api/stream?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    console.log("STREAM STATUS:", res2.status);
    console.log("STREAM HEADERS:", res2.headers.raw());
  } catch(e) {
    console.error(e);
  }
}
test();
