import fs from 'fs';

const text = fs.readFileSync('./worker.tmp.js', 'utf8');

// Let's print the variables defined right before `var ll=new Function(_)`
const idx = text.indexOf('var ll=new Function(_)');
console.log(text.substring(Math.max(0, idx - 1000), idx));
