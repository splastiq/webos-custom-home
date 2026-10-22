/* Fixed-directory, atomic persistence for Home-owned settings only. */
'use strict';
var fs=require('fs'),path=require('path');
function create(folder){
 function dir(){if(!fs.existsSync(folder)){fs.mkdirSync(folder);}var s=fs.lstatSync(folder);if(!s.isDirectory()||s.isSymbolicLink()){throw new Error('unsafe-folder');}}
 function safe(file){if(fs.existsSync(file)&&fs.lstatSync(file).isSymbolicLink()){throw new Error('unsafe-file');}}
 function run(args){
  dir();var file=path.join(folder,'settings.json');safe(file);
  if(args[0]==='read'){var text=fs.existsSync(file)?fs.readFileSync(file).toString('base64'):'',offset=Number(args[1])||0;if(offset<0||offset%1){throw new Error('offset');}return {chunk:text.slice(offset,offset+8192),total:text.length,next:Math.min(text.length,offset+8192)};}
  if(!/^[a-z0-9]{1,40}$/.test(args[1]||'')){throw new Error('token');}
  var stage=path.join(folder,'settings-'+args[1]+'.part');safe(stage);
  if(args[0]==='write'){var at=Number(args[2]),chunk=args[3]||'';if(!/^[A-Za-z0-9+/=]{1,8192}$/.test(chunk)||at<0||at+chunk.length>12*1024*1024){throw new Error('size');}if(at===0){fs.writeFileSync(stage,chunk,{mode:384});}else{if(fs.statSync(stage).size!==at){throw new Error('offset');}fs.appendFileSync(stage,chunk);}return {ok:true};}
  if(args[0]==='commit'){var raw=new Buffer(fs.readFileSync(stage,'utf8'),'base64'),data=JSON.parse(raw.toString('utf8'));if(raw.length>8*1024*1024||data.version!==1||!data.values||Array.isArray(data.values)){throw new Error('invalid');}Object.keys(data.values).forEach(function(k){if(k.indexOf('home.')!==0||typeof data.values[k]!=='string'){throw new Error('invalid-key');}});if(data.merge&&fs.existsSync(file)){var previous=JSON.parse(fs.readFileSync(file,'utf8'));Object.keys(data.values).forEach(function(k){previous.values[k]=data.values[k];});data=previous;raw=new Buffer(JSON.stringify(data),'utf8');if(raw.length>8*1024*1024){throw new Error('size');}}var tmp=file+'.tmp';safe(tmp);fs.writeFileSync(tmp,raw,{mode:384});fs.renameSync(tmp,file);fs.unlinkSync(stage);return {ok:true};}
  throw new Error('action');
 }
 return run;
}
if(require.main===module){try{console.log(JSON.stringify(create('/var/lib/webosbrew/custom-home')(process.argv.slice(2))));}catch(e){console.log(JSON.stringify({error:'storage-failed'}));process.exitCode=1;}}
else{module.exports=create;}
