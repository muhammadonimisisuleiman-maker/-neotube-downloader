import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import youtubedl from "youtube-dl-exec";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());

  // API endpoint to fetch video metadata
  app.get("/api/info", async (req, res) => {
    try {
      const url = req.query.url as string;
      if (!url) {
        return res.status(400).json({ error: "Invalid YouTube URL" });
      }
      // Check if cookies.txt exists to help bypass bot protection
      const cookiePath = path.join(process.cwd(), 'cookies.txt');
      const hasCookies = fs.existsSync(cookiePath);

      const info = await youtubedl(url, {
        dumpJson: true,
        noWarnings: true,
        noCheckCertificate: true,
        ...(hasCookies ? { cookies: cookiePath } : {})
      });
      res.json({ title: info.title, lengthSeconds: info.duration });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message || "Failed to fetch info" });
    }
  });

  // API endpoint for downloading the stream directly
  app.get("/api/stream", async (req, res) => {
    try {
      const url = req.query.url as string;
      const mode = req.query.mode as string || 'video';
      
      if (!url) {
        return res.status(400).send("Invalid YouTube URL");
      }

      // Check if cookies.txt exists
      const cookiePath = path.join(process.cwd(), 'cookies.txt');
      const hasCookies = fs.existsSync(cookiePath);

      // First get info to determine the title and length
      const info = await youtubedl(url, { 
        dumpJson: true, 
        noWarnings: true,
        ...(hasCookies ? { cookies: cookiePath } : {})
      });
      const title = info.title.replace(/[^\w\s]/gi, '_');

      const format = mode === 'audio' ? 'bestaudio' : 'b'; // 'b' for best pre-merged format

      res.setHeader('Content-Disposition', `attachment; filename="${title}.${mode === 'audio' ? 'mp3' : 'mp4'}"`);
      if (mode === 'audio') {
        res.setHeader('Content-Type', 'audio/mpeg');
      } else {
        res.setHeader('Content-Type', 'video/mp4');
      }

      const subprocess = youtubedl.exec(url, {
        o: '-',
        f: format,
        noWarnings: true,
        ...(hasCookies ? { cookies: cookiePath } : {})
      });

      if (subprocess.stdout) {
        subprocess.stdout.pipe(res);
      }
      
      subprocess.catch(err => {
        console.error("Stream error:", err);
        if (!res.headersSent) res.status(500).end();
      });

    } catch (error: any) {
      console.error(error);
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
