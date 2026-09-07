import http from "node:http";
import {execFile} from "node:child_process";
const [container,fn,accountConcurrency,globalConcurrency,reservation,budget,accountPool="25"]=process.argv.slice(2);
const server=http.createServer((req,res)=>{
 const n=Number(new URL(req.url,"http://local").pathname.slice(1));
 if(!Number.isInteger(n)||n<1||n>1000){res.writeHead(400).end();return;}
 const account=String(n%Number(accountPool)+1).padStart(12,"0");
 const sql=`select public.${fn}('00000000-0000-0000-0000-${account}'::uuid,'00000000-0000-0000-0000-${account}'::uuid,'integration-key-${String(n).padStart(5,"0")}',repeat('a',64),'groq-openai-gpt-oss-20b-2026-09-07',${reservation},25,10,5,3,${accountConcurrency},10,${globalConcurrency},${budget},${budget},${budget});`;
 execFile("docker",["exec",container,"psql","-U","postgres","-Atq","-v","ON_ERROR_STOP=1","-c",sql],{maxBuffer:32768,timeout:90000},(error,stdout)=>{
  if(error){res.writeHead(500).end('{"error":"database"}');return;}
  res.setHeader("content-type","application/json");res.end(stdout.trim());
 });
});
server.listen(0,"127.0.0.1",()=>process.send?.(server.address().port));
