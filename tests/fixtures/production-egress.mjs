// Node preload used ONLY by the isolated release harness. There is no app flag,
// endpoint, alternate provider URL or authentication bypass in shipped code.
const realFetch=globalThis.fetch;
globalThis.fetch=(input,options)=>{
 const url=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url);
 if(url.href==="https://api.groq.com/openai/v1/chat/completions")
  return realFetch(process.env.ISOLATED_PROVIDER_URL,options);
 if(url.hostname!=="127.0.0.1" && url.hostname!=="localhost")
  throw new Error("External egress blocked by isolated release harness");
 return realFetch(input,options);
};
