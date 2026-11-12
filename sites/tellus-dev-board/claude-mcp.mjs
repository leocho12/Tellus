import { execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline';

const endpoint = 'https://tellus-dev-board.equaljive2.chatgpt.site/agent-mcp';
const versions = ['2025-11-25','2025-06-18','2025-03-26','2024-11-05'];
const send = message => process.stdout.write(JSON.stringify(message) + '\n');

function boardKey() {
  if (process.env.TELLUS_BOARD_ACCESS) return process.env.TELLUS_BOARD_ACCESS;
  if (process.platform === 'win32') {
    const env = {...process.env};
    for (const name of Object.keys(env)) {
      if (name.toLowerCase() === 'psmodulepath') delete env[name];
    }
    return execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',
      "$ErrorActionPreference = 'Stop'; $stored = [Environment]::GetEnvironmentVariable('TELLUS_BOARD_ACCESS_DPAPI','User'); if ($stored) { (New-Object System.Net.NetworkCredential('', (ConvertTo-SecureString $stored))).Password }"],
      {encoding:'utf8',windowsHide:true,env}).trim();
  }
}

const input = createInterface({input:process.stdin,crlfDelay:Infinity});
input.on('line', async line => {
  let message;
  try { message = JSON.parse(line); } catch {
    send({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Invalid JSON'}});
    return;
  }
  const {id,method,params} = message ?? {};
  if (id === undefined) return;
  const base = {jsonrpc:'2.0',id};
  try {
    if (method === 'initialize') {
      const requested = params?.protocolVersion;
      send({...base,result:{protocolVersion:versions.includes(requested) ? requested : versions[0],serverInfo:{name:'tellus-board',version:'1.0.0'},capabilities:{tools:{}}}});
    } else if (method === 'ping') {
      send({...base,result:{}});
    } else if (method === 'tools/list' || method === 'tools/call') {
      const key = boardKey();
      if (!key) throw Error('TELLUS_BOARD_ACCESS is missing on this PC.');
      const response = await fetch(endpoint,{
        method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),
        headers:{'Content-Type':'application/json','OAI-Sites-Authorization':'Bearer ' + key,'X-Tellus-Board-Key':key},
        body:JSON.stringify(message)
      });
      if (!response.ok) throw Error('Tellus board returned HTTP ' + response.status + '.');
      send(await response.json());
    } else {
      send({...base,error:{code:-32601,message:'Method not found'}});
    }
  } catch (error) {
    send({...base,error:{code:-32000,message:error.message}});
  }
});
