/**
 * Run: node get-my-ip.js
 * Shows your current public IP - add THIS exact IP in Atlas Network Access
 */
const https = require('https');
https.get('https://api.ipify.org?format=json', (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const ip = JSON.parse(data).ip;
    console.log('\nYour current public IP:', ip);
    console.log('\nAdd this in MongoDB Atlas:');
    console.log('  1. https://cloud.mongodb.com → Network Access');
    console.log('  2. Add IP Address');
    console.log('  3. Add Current IP Address (or type: ' + ip + ')');
    console.log('  4. Confirm\n');
  });
}).on('error', () => console.log('Could not fetch IP. Go to https://whatismyip.com manually.'));
