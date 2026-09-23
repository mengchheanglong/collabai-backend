import http from 'node:http';

const messages = [];
const server = http.createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString();
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'POST' && req.url === '/v3/mail/send') {
    try {
      messages.push(JSON.parse(body));
      res.writeHead(202).end('{}');
    } catch {
      res.writeHead(400).end('{"errors":[{"message":"invalid JSON"}]}');
    }
  } else if (req.method === 'GET' && req.url === '/__mock/messages') {
    res.writeHead(200).end(JSON.stringify(messages));
  } else if (req.method === 'DELETE' && req.url === '/__mock/messages') {
    messages.length = 0;
    res.writeHead(200).end('{}');
  } else {
    res.writeHead(404).end('{"errors":[{"message":"not found"}]}');
  }
});
server.listen(8025, '0.0.0.0');
