const http = require('http');

http.get('http://localhost:3021/api/db', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    try {
      const db = JSON.parse(data);
      console.log(`GET /api/db returned successfully.`);
      console.log(`Persons count: ${db.persons ? db.persons.length : 'undefined'}`);
      console.log(`Shifts count: ${db.shifts ? db.shifts.length : 'undefined'}`);
      console.log(`Areas:`, db.areas);
      if (db.persons && db.persons.length > 0) {
        console.log("First 5 persons sample:");
        console.log(db.persons.slice(0, 5));
      } else {
        console.log("No persons found in the response!");
      }
    } catch (e) {
      console.error("Failed to parse response:", e);
    }
  });
}).on('error', (err) => {
  console.error("HTTP Request Error:", err);
});
