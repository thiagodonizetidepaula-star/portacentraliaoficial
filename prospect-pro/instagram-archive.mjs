import { unzipSync } from '/vendor/fflate.mjs';

// Read only the owner's post media folders. Direct messages, contacts and account files stay in the ZIP.
export async function postImages(file){
 if(file.size>64*1024*1024)throw Error('Exporte um período menor do Instagram ou escolha até três imagens individuais. O limite do ZIP é 64 MB.');
 const bytes=new Uint8Array(await file.arrayBuffer());
 let picked=0,total=0;
 const files=unzipSync(bytes,{filter(entry){
  if(!/(?:^|\/)(?:media|content)\/(?:posts|feed)(?:_[\d]+)?\/(?:[^/]+\/)*[^/]+\.(?:jpe?g|png|webp)$/i.test(entry.name) ||
    /(?:^|\/)(?:messages|inbox|direct|chats|__MACOSX)(?:\/|$)/i.test(entry.name) ||
    !entry.originalSize || entry.originalSize>8*1024*1024 || picked>=12 || total+entry.originalSize>24*1024*1024)return false;
  picked++; total+=entry.originalSize; return true;
 }});
 return Object.entries(files).map(([name,body])=>{
  const ext=name.split('.').pop().toLowerCase();
  return new File([body],name.split('/').pop(),{type:ext==='webp'?'image/webp':ext==='png'?'image/png':'image/jpeg'});
 });
}
