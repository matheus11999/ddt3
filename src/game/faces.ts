/** All facial items reuse this registration; expressions never resize the skull. */
export const FACE_REGISTRATION={
 atlasSize:1254,
 sourceRect:[375,218,531,514] as const,
 headRect:[425,180,420,416] as const,
 neckPivot:[650,610] as const,
 sockets:{leftEye:[650,444],rightEye:[798,466],nose:[760,502],mouth:[716,542]}
} as const;

/** Keep the base's silhouette, ears, neck and shading. Only the facial interior changes. */
export function composeUniversalHead(base:HTMLImageElement,expression:HTMLImageElement):HTMLCanvasElement {
 const {atlasSize,sourceRect,headRect}=FACE_REGISTRATION;
 const head=document.createElement('canvas');head.width=head.height=atlasSize;
 const c=head.getContext('2d')!;
 c.drawImage(base,0,0,atlasSize,atlasSize);c.clearRect(0,631,atlasSize,atlasSize-631);
 const features=document.createElement('canvas');features.width=features.height=atlasSize;
 const f=features.getContext('2d')!;f.drawImage(expression,...sourceRect,...headRect);
 // Feather the skin transition, preserving the original contour and ear exactly.
 f.globalCompositeOperation='destination-in';f.save();f.translate(704,460);f.scale(1,.95);
 const blend=f.createRadialGradient(0,0,120,0,0,169);blend.addColorStop(0,'#fff');blend.addColorStop(1,'#fff0');
 f.fillStyle=blend;f.fillRect(-atlasSize,-atlasSize,atlasSize*2,atlasSize*2);f.restore();
 // source-atop retains the universal alpha even at anti-aliased boundary pixels.
 c.globalCompositeOperation='source-atop';c.drawImage(features,0,0);c.globalCompositeOperation='source-over';
 return head;
}
