/* Fixed-source lookup and bounded persistent PNG cache. No playlist/stream URLs accepted. */
'use strict';
var fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process'),matcher=require('./channel-logo-match');
var folder='/var/lib/webosbrew/custom-home/channel-logos', runtime=path.join(__dirname,'runtime-channel-logos');
function mkdir(p){if(!fs.existsSync(p)){fs.mkdirSync(p);}if(!fs.lstatSync(p).isDirectory()||fs.lstatSync(p).isSymbolicLink()){throw new Error('unsafe-directory');}}
function cachedFiles(){
 var out={};try{mkdir(runtime);var index=JSON.parse(fs.readFileSync(path.join(folder,'index.json'),'utf8'));Object.keys(index).slice(0,128).forEach(function(id){var key=index[id];if(!/^[a-f0-9]{64}\.png$/.test(key)){return;}var file=path.join(folder,key),stat=fs.lstatSync(file);if(stat.isSymbolicLink()||!stat.isFile()||stat.size>512*1024){return;}fs.writeFileSync(path.join(runtime,key),fs.readFileSync(file));out[id]='runtime-channel-logos/'+key;});}catch(e){}return out;
}
function download(url,limit,done){
 cp.execFile('/usr/bin/curl',['--fail','--silent','--location','--proto','=https','--proto-redir','=https','--max-time','20','--cacert',path.join(__dirname,'aerial-ca.crt'),url],{encoding:null,maxBuffer:limit},function(e,data){done(e,data);});
}
function resolve(input,done){
 try{mkdir(folder);mkdir(runtime);}catch(e){done(null);return;}
 var treeFile=path.join(folder,'catalog.json');
 function use(paths){
  var selected=matcher.match(paths,input.id,input.name);if(!selected){done(null);return;}
  var key=crypto.createHash('sha256').update(selected).digest('hex')+'.png',file=path.join(folder,key);
  function finish(data){
   if(!data||data.length<24||data.toString('hex',0,8)!=='89504e470d0a1a0a'||data.readUInt32BE(16)>4096||data.readUInt32BE(20)>4096){done(null);return;}
   try{fs.writeFileSync(path.join(runtime,key),data);var index={};try{index=JSON.parse(fs.readFileSync(path.join(folder,'index.json'),'utf8'));}catch(ignored){}index[input.id+'|'+input.name]=key;fs.writeFileSync(path.join(folder,'index.json.tmp'),JSON.stringify(index));fs.renameSync(path.join(folder,'index.json.tmp'),path.join(folder,'index.json'));done('runtime-channel-logos/'+key);}catch(e){done(null);}
  }
  try{if(fs.lstatSync(file).isFile()&&!fs.lstatSync(file).isSymbolicLink()){finish(fs.readFileSync(file));return;}}catch(e){}
  var cacheSize=fs.readdirSync(folder).filter(function(n){return /\.png$/.test(n);}).length;if(cacheSize>=128){done(null);return;}
  download('https://raw.githubusercontent.com/tv-logo/tv-logos/main/'+selected,512*1024,function(e,data){
   if(e||!data||data.toString('hex',0,8)!=='89504e470d0a1a0a'){done(null);return;}
   try{fs.writeFileSync(file+'.tmp',data);fs.renameSync(file+'.tmp',file);}catch(x){done(null);return;}finish(data);
  });
 }
 var cached=null;try{cached=JSON.parse(fs.readFileSync(treeFile,'utf8'));if(!Array.isArray(cached.paths)){cached=null;}}catch(e){}
 if(cached&&Date.now()-cached.time<7*86400000){use(cached.paths);return;}
 download('https://api.github.com/repos/tv-logo/tv-logos/git/trees/main?recursive=1',16*1024*1024,function(e,data){
  try{if(e){throw e;}var tree=JSON.parse(data.toString('utf8'));if(tree.truncated||!Array.isArray(tree.tree)){throw new Error('invalid-tree');}var paths=tree.tree.filter(function(n){return n.type==='blob'&&/^countries\/.+\.png$/.test(n.path);}).map(function(n){return n.path;});fs.writeFileSync(treeFile+'.tmp',JSON.stringify({time:Date.now(),paths:paths}));fs.renameSync(treeFile+'.tmp',treeFile);use(paths);}catch(x){if(cached){use(cached.paths);}else{done(null);}}
 });
}
if(require.main===module && process.argv[2]==='--cached'){console.log(JSON.stringify({files:cachedFiles()}));}
else if(require.main===module){try{var input=JSON.parse(new Buffer(process.argv[2]||'','base64').toString('utf8'));if(typeof input.id!=='string'||typeof input.name!=='string'||input.id.length>200||input.name.length>200){throw new Error('invalid');}resolve(input,function(file){console.log(JSON.stringify({file:file}));});}catch(e){console.log(JSON.stringify({file:null}));}}
else{module.exports=resolve;}
