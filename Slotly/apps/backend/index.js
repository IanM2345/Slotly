// apps/backend/index.js
import next from 'next';
import http from 'http';

const dev = false;
const app = next({ dev });
const handle = app.getRequestHandler();
const port = process.env.PORT || 8080;

app.prepare().then(() => {
  http.createServer((req, res) => handle(req, res))
      .listen(port, '0.0.0.0', () => {
        console.log(`Ready on ${port}`);
      });
});
