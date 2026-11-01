import { encodeCanvasImage, validatePhotoFile } from './image-upload';

/** A small group avatar fits in the club document without a public image URL. */
export async function prepareGroupPhoto(file: File): Promise<string> {
  validatePhotoFile(file);
  const bitmap=await createImageBitmap(file).catch(()=>{throw new Error('사진을 읽을 수 없어요. 다른 사진을 선택해 주세요.');});
  try {
    const canvas=document.createElement('canvas');const edge=Math.min(bitmap.width,bitmap.height);canvas.width=320;canvas.height=320;
    const context=canvas.getContext('2d');if(!context)throw new Error('사진을 처리할 수 없어요.');
    context.fillStyle='white';context.fillRect(0,0,320,320);
    context.drawImage(bitmap,(bitmap.width-edge)/2,(bitmap.height-edge)/2,edge,edge,0,0,320,320);
    let quality=.85;let blob:Blob|null=null;
    for(let attempt=0;attempt<5;attempt++){blob=await encodeCanvasImage(canvas,quality);if(blob.size<=90*1024)break;quality-=.15;}
    if(!blob||blob.size>90*1024)throw new Error('사진 크기를 줄이지 못했어요. 다른 사진을 선택해 주세요.');
    return await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('사진을 읽지 못했어요.'));reader.readAsDataURL(blob!);});
  }finally{bitmap.close();}
}
