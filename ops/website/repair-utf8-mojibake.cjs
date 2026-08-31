const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const targets = [
  'website/wordpress-overlay/wp-content/themes/radiotedu/assets/js/app.js',
  'website/wordpress-overlay/wp-content/plugins/radiotedu-core/includes/class-radiotedu-rest.php',
];

const replacements = new Map([
  ['\u00c3\u2021', '\u00c7'],
  ['\u00c3\u2013', '\u00d6'],
  ['\u00c3\u0153', '\u00dc'],
  ['\u00c3\u00a7', '\u00e7'],
  ['\u00c3\u00b6', '\u00f6'],
  ['\u00c3\u00bc', '\u00fc'],
  ['\u00c4\u00b1', '\u0131'],
  ['\u00c4\u00b0', '\u0130'],
  ['\u00c4\u0178', '\u011f'],
  ['\u00c4\u017d', '\u011e'],
  ['\u00c5\u0178', '\u015f'],
  ['\u00c5\u017e', '\u015e'],
  ['\u00e2\u20ac\u00a6', '\u2026'],
  ['\u00e2\u20ac\u2122', '\u2019'],
  ['\u00e2\u20ac\u02dc', '\u2018'],
  ['\u00e2\u20ac\u0153', '\u201c'],
  ['\u00e2\u20ac\u009d', '\u201d'],
  ['\u00e2\u20ac\u201c', '\u2013'],
  ['\u00e2\u20ac\u201d', '\u2014'],
  ['\u00e2\u2020\u2019', '\u2192'],
  ['\u00c2\u00b7', '\u00b7'],
]);

let replacementCount = 0;
for (const relativePath of targets) {
  const filePath = path.join(repositoryRoot, relativePath);
  let source = fs.readFileSync(filePath, 'utf8');
  for (const [broken, repaired] of replacements) {
    const occurrences = source.split(broken).length - 1;
    if (occurrences > 0) {
      source = source.split(broken).join(repaired);
      replacementCount += occurrences;
    }
  }
  fs.writeFileSync(filePath, source, 'utf8');
}

console.log(JSON.stringify({ files: targets.length, replacements: replacementCount }));
