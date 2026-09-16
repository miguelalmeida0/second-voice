import test from "node:test";
import assert from "node:assert/strict";
import {authRedirectOrigin,callbackOrigin,localAuthPageRedirect} from "../src/server/auth-origin.ts";
import {readAuthCookie} from "../src/server/auth-session.ts";

test("OAuth keeps the browser's canonical cookie host despite Next's internal loopback URL",()=>{
 const saved={NODE_ENV:process.env.NODE_ENV,NEXT_PUBLIC_SITE_URL:process.env.NEXT_PUBLIC_SITE_URL};
 try {
  Object.assign(process.env,{NODE_ENV:"development",NEXT_PUBLIC_SITE_URL:"http://127.0.0.1:4003"});
  const req=(url:string,host="127.0.0.1:4003")=>new Request(url,{headers:{host}});
  assert.equal(callbackOrigin(req("http://localhost:4003/api/ghostwriter/auth/callback")),"http://127.0.0.1:4003");
  assert.equal(callbackOrigin(req("http://127.0.0.1:4003/api/ghostwriter/auth/callback")),"http://127.0.0.1:4003");
  for(const url of ["http://evil.test:4003", "http://localhost:4004", "https://localhost:4003"]) assert.throws(()=>callbackOrigin(req(url)));
  assert.throws(()=>callbackOrigin(req("http://localhost:4003","localhost:4003")));
  assert.equal(localAuthPageRedirect(req("http://localhost:4003/second-voice","localhost:4003")),"http://127.0.0.1:4003/second-voice");
  assert.equal(localAuthPageRedirect(req("http://localhost:4003/second-voice")),null,"Internal Next URL must not cause redirect loop");
  for(const host of ["evil.test:4003","localhost:4004","localhost:4003@evil.test"]) assert.equal(localAuthPageRedirect(req("http://localhost:4003/second-voice",host)),null);
  Object.assign(process.env,{NODE_ENV:"production",NEXT_PUBLIC_SITE_URL:"https://demo.example.org"});
  assert.equal(callbackOrigin(req("https://demo.example.org/api/ghostwriter/auth/callback","demo.example.org")),"https://demo.example.org");
  for(const url of ["http://demo.example.org","https://localhost","https://127.0.0.1","https://evil.test"])assert.throws(()=>callbackOrigin(req(url,"demo.example.org")));
  assert.equal(localAuthPageRedirect(req("http://localhost:4003/second-voice","localhost:4003")),null);
  process.env.NEXT_PUBLIC_SITE_URL="http://127.0.0.1:4003";assert.throws(authRedirectOrigin);
 } finally {for(const [k,v] of Object.entries(saved)){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
});

test("auth cookie parsing decodes once and rejects malformed or ambiguous cookies",()=>{
 const name=process.env.NODE_ENV==="production"?"__Host-gw-pkce":"gw-pkce";
 const parse=(value:string)=>readAuthCookie(new Request("https://local",{headers:{cookie:value}}),"pkce");
 assert.equal(parse(name+"=synthetic%2Fverifier"),"synthetic/verifier");
 assert.equal(parse(name+"=synthetic%252Fverifier"),"synthetic%2Fverifier");
 for(const value of [name+"=%XX",name+"=",name+"=a; "+name+"=b",name+"="+"a".repeat(8193)])assert.equal(parse(value),null);
});
