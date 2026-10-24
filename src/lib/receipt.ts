export const prepareReceipt=(file:File)=>prepareCompressedImage(file,false);
export const preparePostPhoto=(file:File)=>prepareCompressedImage(file,true);
async function prepareCompressedImage(file:File,post:boolean):Promise<{fileName:string;imageURL:string}>{
 if(!(post?['image/jpeg','image/png','image/webp','image/gif']:['image/jpeg','image/png','image/webp']).includes(file.type))throw new Error(post?'JPG, PNG, WebP, GIF 사진을 선택해 주세요.':'JPG, PNG, WebP 영수증 사진을 선택해 주세요.');
 if(file.size>5*1024*1024)throw new Error('영수증 사진은 5MB 이하로 선택해 주세요.');
 const image=await createImageBitmap(file).catch(()=>{throw new Error('사진을 읽지 못했어요. 다른 사진을 선택해 주세요.');});
 try{let scale=Math.min(1,1200/image.width,2400/image.height);let blob:Blob|null=null;
  for(let attempt=0;attempt<8;attempt++){const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));const context=canvas.getContext('2d');if(!context)throw new Error('사진을 처리하지 못했어요.');context.fillStyle='white';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/webp',Math.max(.48,.86-attempt*.06)));if(blob&&blob.size<=450*1024)break;if(attempt>=3)scale*=.87;}
  if(!blob||blob.size>450*1024)throw new Error('영수증 사진 용량을 줄이지 못했어요. 다른 사진을 선택해 주세요.');
  const imageURL=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('사진을 읽지 못했어요.'));reader.readAsDataURL(blob!);});
  return {fileName:file.name.slice(0,200),imageURL};
 }finally{image.close();}
}
