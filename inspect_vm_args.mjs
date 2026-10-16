import fs from 'fs';

const text = fs.readFileSync('./worker.tmp.js', 'utf8');

// Replace the call to log the arguments
const patched = text.replace(
  'var _=$.join(""),ll=new Function(_)()(f,e,R,T,U,F,m,H,c,D,t,S,g,z);ll(d)',
  `var _=$.join("");
   const args = {f,e,R,T,U,F,m,H,c,D,t,S,g,z,d};
   console.log('Arg types and sample values:');
   for (const [k, v] of Object.entries(args)) {
     if (Array.isArray(v)) {
       console.log(k, 'Array len:', v.length, 'sample:', typeof v[0] === 'string' ? v.slice(0, 10) : v.slice(0, 5));
     } else if (typeof v === 'object' && v) {
       console.log(k, 'Object keys:', Object.keys(v).slice(0, 10));
     } else {
       console.log(k, typeof v, v);
     }
   }
  `
);

eval(patched);
