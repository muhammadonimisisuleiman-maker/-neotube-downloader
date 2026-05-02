import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import os from "os";
import youtubedl from "youtube-dl-exec";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json());

  // API endpoint to fetch video metadata
  app.post("/api/info", async (req, res) => {
    let tempCookiePath: string | null = null;
    try {
      const { url, cookies } = req.body;
      if (!url) {
        return res.status(400).json({ error: "Invalid YouTube URL" });
      }
      
      const options: any = {
        dumpJson: true,
        noWarnings: true,
        noCheckCertificates: true,
        jsRuntimes: 'node',
      };

      if (cookies) {
        tempCookiePath = path.join(os.tmpdir(), `yt-cookies-${Date.now()}-${Math.random().toString(36).substring(7)}.txt`);
        fs.writeFileSync(tempCookiePath, cookies, 'utf8');
        options.cookies = tempCookiePath;
      }

      const info = await youtubedl(url, options, { cwd: os.tmpdir() }) as any;
      res.json({ title: info.title, lengthSeconds: info.duration });
    } catch (error: any) {
      console.error(error);
      let errorMsg = error.message || "Failed to fetch info";
      if (errorMsg.includes("Sign in to confirm you’re not a bot")) {
        errorMsg = "YouTube blocked this request (bot check). ⚠️ Please add your YouTube Netscape Cookies in Settings.";
      }
      res.status(500).json({ error: errorMsg });
    } finally {
      if (tempCookiePath && fs.existsSync(tempCookiePath)) {
        fs.unlinkSync(tempCookiePath);
      }
    }
  });

  // API endpoint for downloading the stream directly
  app.post("/api/stream", async (req, res) => {
    let tempCookiePath: string | null = null;
    try {
      const { url, mode = 'video', quality = '1080p', cookies } = req.body;
      
      if (!url) {
        return res.status(400).send("Invalid YouTube URL");
      }

      const options: any = { 
        dumpJson: true, 
        noWarnings: true,
        jsRuntimes: 'node',
      };

      if (cookies) {
        tempCookiePath = path.join(os.tmpdir(), `yt-cookies-${Date.now()}-${Math.random().toString(36).substring(7)}.txt`);
        fs.writeFileSync(tempCookiePath, cookies, 'utf8');
        options.cookies = tempCookiePath;
      }

      // First get info to determine the title and length
      const info = await youtubedl(url, options, { cwd: os.tmpdir() }) as any;
      const title = info.title.replace(/[^\w\s]/gi, '_');

      let format = 'b';
      if (mode === 'audio') {
        format = 'bestaudio';
      } else {
         if (quality === '4k') format = 'b[height<=2160]/b';
         else if (quality === '2k') format = 'b[height<=1440]/b';
         else if (quality === '1080p') format = 'b[height<=1080]/b';
         else if (quality === '720p') format = 'b[height<=720]/b';
         else if (quality === '480p') format = 'b[height<=480]/b';
         else if (quality === '360p') format = 'b[height<=360]/b';
      }

      res.setHeader('Content-Disposition', `attachment; filename="${title}.${mode === 'audio' ? 'mp3' : 'mp4'}"`);
      if (mode === 'audio') {
        res.setHeader('Content-Type', 'audio/mpeg');
      } else {
        res.setHeader('Content-Type', 'video/mp4');
      }

      const execOptions: any = {
        output: '-',
        format: format,
        noWarnings: true,
        jsRuntimes: 'node',
      };
      if (tempCookiePath) {
        execOptions.cookies = tempCookiePath;
      }

      const subprocess = youtubedl.exec(url, execOptions, { cwd: os.tmpdir() });

      if (subprocess.stdout) {
        subprocess.stdout.pipe(res);
      }
      
      subprocess.catch(err => {
        console.error("Stream error:", err);
        if (!res.headersSent) res.status(500).end();
      });

      if (subprocess.stdout) {
        subprocess.stdout.on('end', () => {
          if (tempCookiePath && fs.existsSync(tempCookiePath)) {
            fs.unlinkSync(tempCookiePath);
          }
        });
        subprocess.stdout.on('error', () => {
          if (tempCookiePath && fs.existsSync(tempCookiePath)) {
            fs.unlinkSync(tempCookiePath);
          }
        });
      } else {
         if (tempCookiePath && fs.existsSync(tempCookiePath)) {
            fs.unlinkSync(tempCookiePath);
         }
      }

    } catch (error: any) {
      console.error(error);
      if (tempCookiePath && fs.existsSync(tempCookiePath)) {
        fs.unlinkSync(tempCookiePath);
      }
      if (!res.headersSent) {
        let errorMsg = error.message || "Failed to stream";
        if (errorMsg.includes("Sign in to confirm you’re not a bot")) {
          errorMsg = "YouTube blocked this request (bot check). ⚠️ Please add your YouTube Netscape Cookies in Settings.";
        }
        res.status(500).send(errorMsg);
      }
    }
  });

  // API endpoint to fetch playlist entries
  app.post("/api/playlist-info", async (req, res) => {
    let tempCookiePath: string | null = null;
    try {
      const { url, cookies } = req.body;
      if (!url) {
        return res.status(400).json({ error: "Invalid YouTube URL" });
      }
      
      const options: any = {
        dumpSingleJson: true,
        flatPlaylist: true,
        noWarnings: true,
        noCheckCertificates: true,
        jsRuntimes: 'node',
      };

      if (cookies) {
        tempCookiePath = path.join(os.tmpdir(), `yt-cookies-${Date.now()}-${Math.random().toString(36).substring(7)}.txt`);
        fs.writeFileSync(tempCookiePath, cookies, 'utf8');
        options.cookies = tempCookiePath;
      }

      const info = await youtubedl(url, options, { cwd: os.tmpdir() }) as any;
      
      if (!info.entries) {
         return res.json({ entries: [] });
      }

      const entries = info.entries.map((e: any) => ({
        id: e.id,
        title: e.title,
        url: e.url || (e.id ? `https://www.youtube.com/watch?v=${e.id}` : null),
        duration: e.duration
      })).filter((e: any) => e.url);

      res.json({ title: info.title, entries });
    } catch (error: any) {
      console.error(error);
      let errorMsg = error.message || "Failed to fetch playlist info";
      if (errorMsg.includes("Sign in to confirm you’re not a bot")) {
        errorMsg = "YouTube blocked this request (bot check). ⚠️ Please add your YouTube Netscape Cookies in Settings.";
      }
      res.status(500).json({ error: errorMsg });
    } finally {
      if (tempCookiePath && fs.existsSync(tempCookiePath)) {
        fs.unlinkSync(tempCookiePath);
      }
    }
  });

  // Health endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[system] Express Backend running on http://localhost:${PORT}`);
  });
}

startServer();
