import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // SSE endpoint for downloading
  app.get("/api/download", (req, res) => {
    const url = req.query.url as string;
    const mode = req.query.mode as string || 'video';
    const quality = req.query.quality as string || '1080p';

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send initial status
    res.write(`data: ${JSON.stringify({ status: 'fetching_info', progress: 0, speed: '0 MB/s', eta: '--:--' })}\n\n`);

    let progress = 0;
    
    // Simulate real download process
    const interval = setInterval(() => {
      progress += Math.random() * 5 + 2; // Add 2-7% per tick
      
      if (progress >= 100) {
        progress = 100;
        res.write(`data: ${JSON.stringify({ 
          status: 'completed', 
          progress: 100, 
          speed: '0 MB/s', 
          eta: '00:00' 
        })}\n\n`);
        clearInterval(interval);
        res.end();
      } else {
        const speedNum = (Math.random() * 10 + 5).toFixed(1);
        const etaNum = Math.ceil((100 - progress) / 5);
        res.write(`data: ${JSON.stringify({ 
          status: 'downloading', 
          progress: Math.floor(progress), 
          speed: `${speedNum} MB/s`, 
          eta: `00:${etaNum.toString().padStart(2, '0')}` 
        })}\n\n`);
      }
    }, 800);

    req.on('close', () => {
      clearInterval(interval);
    });
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
