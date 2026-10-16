import fs from 'fs';

try {
  let text = fs.readFileSync('./worker.tmp.js', 'utf8');
  // In the file:
  // var _=$.join(""),ll=new Function(_)()(f,e,R,T,U,F,m,H,c,D,t,S,g,z);ll(d)})();
  text = text.replace(
    'var _=$.join(""),ll=new Function(_)()(f,e,R,T,U,F,m,H,c,D,t,S,g,z);ll(d)',
    'var _=$.join(""); fs.writeFileSync("./worker_decoded.js", _); console.log("SUCCESS Decoded length:", _.length);'
  );
  // Need to provide fs to the scope
  const runner = new Function('fs', text);
  runner(fs);
} catch (e) {
  console.error('Error running:', e);
}
