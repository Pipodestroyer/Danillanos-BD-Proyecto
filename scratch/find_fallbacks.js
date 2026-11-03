const fs = require('fs');
const lines = fs.readFileSync('backend/routes/api.js', 'utf8').split('\n');
let currentEndpoint = '';
lines.forEach((line, idx) => {
  const m = line.match(/router\.(get|post|put|patch|delete)\(['"]([^'"]+)/i);
  if (m) currentEndpoint = m[0];
  if (/Fallback|source:\s*'fallback'/.test(line)) {
    console.log(`${idx + 1}: [${currentEndpoint}] ${line.trim().substring(0, 80)}`);
  }
});
