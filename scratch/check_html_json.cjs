const fs = require('fs');
const path = require('path');
const htmlPath = path.join(__dirname, '../public/analisis_turnos.html');
const content = fs.readFileSync(htmlPath, 'utf8');

const startTag = '<script type="application/json" id="turnosData">';
const endTag = '</script>';

const startIndex = content.indexOf(startTag);
if (startIndex === -1) {
  console.log("No start tag found");
  process.exit(1);
}

const rest = content.slice(startIndex + startTag.length);
const endIndex = rest.indexOf(endTag);
if (endIndex === -1) {
  console.log("No end tag found");
  process.exit(1);
}

const jsonText = rest.slice(0, endIndex).trim();
console.log("JSON length:", jsonText.length);

try {
  const data = JSON.parse(jsonText);
  console.log("JSON successfully parsed! Item count:", data.length);
} catch (e) {
  console.error("JSON parsing error:", e);
}
