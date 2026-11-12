import { mkdir, readFile, writeFile } from 'node:fs/promises';

const paths = {'/':['index.html','text/html'], '/style.css':['style.css','text/css'], '/initial.js':['initial.js','text/javascript'], '/board.js':['board.js','text/javascript']};
const assets = {};
for (const [path,[file,type]] of Object.entries(paths)) {
  assets[path] = {type, body: await readFile(new URL('./assets/' + file, import.meta.url), 'utf8')};
}
const worker = await readFile(new URL('./worker/index.js', import.meta.url), 'utf8');
const mcp = await readFile(new URL('./worker/mcp.js', import.meta.url), 'utf8');
const output = new URL('./dist/server/', import.meta.url);
await mkdir(output, {recursive:true});
await writeFile(new URL('index.js', output), 'const assets = ' + JSON.stringify(assets) + ';\n' + assets['/initial.js'].body + '\n' + mcp + '\n' + worker);
