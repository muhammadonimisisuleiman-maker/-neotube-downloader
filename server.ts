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
      res.status(500).json({ error: error.message || "Failed to fetch info" });
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
      const { url, mode = 'video', cookies } = req.body;
      
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

      const format = mode === 'audio' ? 'bestaudio' : 'b'; // 'b' for best pre-merged format

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
        res.status(500).send(error.message);
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
