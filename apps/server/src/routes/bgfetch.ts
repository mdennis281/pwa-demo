import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
  const mb = Math.min(Math.max(parseInt(req.query.mb as string) || 5, 1), 100);
  const bytes = mb * 1024 * 1024;

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Length', bytes);
  res.setHeader('Content-Disposition', `attachment; filename="demo-${mb}mb.bin"`);

  const chunkSize = 64 * 1024;
  const chunks = Math.ceil(bytes / chunkSize);
  let sent = 0;

  for (let i = 0; i < chunks; i++) {
    const size = Math.min(chunkSize, bytes - sent);
    res.write(Buffer.alloc(size, i % 256));
    sent += size;
  }

  res.end();
});

export default router;
