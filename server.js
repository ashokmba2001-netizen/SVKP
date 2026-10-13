const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 5000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DB_FILE = path.join(__dirname, 'database', 'donors.json');
const BACKUP_DIR = path.join(__dirname, 'backups');

// Ensure database and backup dirs exist
if (!fs.existsSync(path.dirname(DB_FILE))) {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
}
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, '[]', 'utf8');
}

function getDonors() {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (e) {
    return [];
  }
}

function saveDonors(data) {
  try {
    const jsonStr = JSON.stringify(data, null, 2);
    fs.writeFileSync(DB_FILE, jsonStr, 'utf8');

    // Auto backup
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    fs.writeFileSync(path.join(BACKUP_DIR, `donors_backup_${ts}.json`), jsonStr, 'utf8');
    return true;
  } catch (e) {
    console.error('Error saving donors:', e);
    return false;
  }
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  // API Routes
  if (pathname.startsWith('/api/')) {
    if (pathname === '/api/donors' && req.method === 'GET') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify(getDonors()));
    }

    if (pathname === '/api/donors' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const newDonor = JSON.parse(body);
          const donors = getDonors();

          if (!newDonor.receiptNo || newDonor.receiptNo <= 0) {
            const maxNo = donors.reduce((m, d) => Math.max(m, parseInt(d.receiptNo || 0)), 26241);
            newDonor.receiptNo = maxNo + 1;
          }
          if (!newDonor.id) {
            newDonor.id = 'rec-' + newDonor.receiptNo;
          }
          if (!newDonor.createdAt) {
            newDonor.createdAt = new Date().toISOString();
          }

          donors.push(newDonor);
          saveDonors(donors);

          res.statusCode = 201;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(newDonor));
        } catch (err) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    if (pathname.startsWith('/api/donors/') && req.method === 'PUT') {
      const id = pathname.replace('/api/donors/', '');
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const updated = JSON.parse(body);
          const donors = getDonors();
          const idx = donors.findIndex(d => d.id === id || String(d.receiptNo) === id);

          if (idx !== -1) {
            donors[idx] = updated;
            saveDonors(donors);
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            return res.end(JSON.stringify(updated));
          } else {
            res.statusCode = 404;
            return res.end(JSON.stringify({ error: 'Donor not found' }));
          }
        } catch (err) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    if (pathname.startsWith('/api/donors/') && req.method === 'DELETE') {
      const id = pathname.replace('/api/donors/', '');
      let donors = getDonors();
      const initialLen = donors.length;
      donors = donors.filter(d => d.id !== id && String(d.receiptNo) !== id);

      if (donors.length < initialLen) {
        saveDonors(donors);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({ success: true }));
      } else {
        res.statusCode = 404;
        return res.end(JSON.stringify({ error: 'Donor not found' }));
      }
    }

    if (pathname === '/api/export/csv' && req.method === 'GET') {
      const donors = getDonors();
      let csv = '\uFEFF"రసీదు నెం","తేది","భక్తుని పేరు","ఫోన్ నెంబరు","గోత్రము","చిరునామా","మొత్తం రూ.","అక్షరములు","చెల్లింపు విధానం","సంతకం","గమనిక"\r\n';
      donors.forEach(d => {
        csv += `"${d.receiptNo || ''}","${d.displayDate || d.date || ''}","${(d.name || '').replace(/"/g, '""')}","${d.phone || ''}","${d.gotram || ''}","${(d.area || '').replace(/"/g, '""')}","${d.amount || ''}","${(d.amountInWords || '').replace(/"/g, '""')}","${d.paymentMode || ''}","${d.signature || ''}","${(d.notes || '').replace(/"/g, '""')}"\r\n`;
      });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=Vasavi_Temple_Donations_${new Date().toISOString().split('T')[0]}.csv`);
      return res.end(csv);
    }
  }

  // Static file serving
  let relPath = pathname.slice(1) || 'index.html';
  const filePath = path.join(PUBLIC_DIR, relPath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.statusCode = 403;
    return res.end('Forbidden');
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
    return fs.createReadStream(filePath).pipe(res);
  }

  res.statusCode = 404;
  res.end('File Not Found');
});

server.listen(PORT, () => {
  console.log(`Temple Receipt Server running at http://localhost:${PORT}/`);
});
