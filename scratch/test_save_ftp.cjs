const http = require('http');

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

function post(url, payload) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function testSave() {
  try {
    console.log("Fetching current DB state...");
    const db = await get('http://localhost:3021/api/db');
    console.log(`Fetched DB successfully. Persons count: ${db.persons.length}, Shifts count: ${db.shifts.length}`);

    if (db.persons.length === 0) {
      console.log("No persons in DB to modify. Test aborted.");
      return;
    }

    // Toggle color of the first person to verify save works
    const targetPerson = db.persons[0];
    const originalColor = targetPerson.color;
    const newColor = originalColor === 'violet' ? 'orange' : 'violet';
    console.log(`Modifying person "${targetPerson.name}" color from "${originalColor}" to "${newColor}"`);
    targetPerson.color = newColor;

    console.log("Sending POST /api/db to update color...");
    const postResult = await post('http://localhost:3021/api/db', db);
    console.log("POST Result:", postResult);

    console.log("Fetching DB state again to verify cache and FTP sync...");
    const verifiedDb = await get('http://localhost:3021/api/db');
    const verifiedPerson = verifiedDb.persons.find(p => p.id === targetPerson.id);
    
    if (verifiedPerson && verifiedPerson.color === newColor) {
      console.log("SUCCESS: Color update successfully verified in subsequent GET /api/db!");
    } else {
      console.error("FAILURE: Color update was not verified!", verifiedPerson);
    }

    // Restore color to avoid dirtying data permanently
    console.log(`Restoring original color "${originalColor}"...`);
    targetPerson.color = originalColor;
    await post('http://localhost:3021/api/db', verifiedDb);
    console.log("Restored successfully!");

  } catch (err) {
    console.error("Test failed with error:", err);
  }
}

testSave();
