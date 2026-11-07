"""Independent moving face crop. Detection at 5 Hz; no background removal or identity claim."""
import cv2, json, sys, math, os
source, target, manifest = sys.argv[1:]
cap=cv2.VideoCapture(source); fps=cap.get(cv2.CAP_PROP_FPS); width=cap.get(3); height=cap.get(4)
if not fps or not width or not height: raise ValueError('Invalid presenter source')
writer=cv2.VideoWriter(target,cv2.VideoWriter_fourcc(*'mp4v'),fps,(512,512))
cascade_dir=getattr(getattr(cv2,'data',None),'haarcascades','/usr/share/opencv4/haarcascades/')
detector=cv2.CascadeClassifier(os.path.join(cascade_dir,'haarcascade_frontalface_default.xml'))
if detector.empty(): raise ValueError('Face detector unavailable')
step=max(1,round(fps/5)); frames=[]; crop=None; index=0; lastgray=None
while True:
 ok,frame=cap.read()
 if not ok: break
 if index%step==0:
  small=cv2.resize(frame,(int(width*min(1,640/width)),int(height*min(1,640/width))))
  gray=cv2.cvtColor(small,cv2.COLOR_BGR2GRAY); factor=width/small.shape[1]
  cut=lastgray is not None and cv2.absdiff(gray,lastgray).mean()>35
  faces=detector.detectMultiScale(gray,1.1,5,minSize=(24,24))
  # Ambiguous people: hide PiP instead of switching identities.
  if len(faces)==1:
   x,y,w,h=[v*factor for v in faces[0]]; side=min(width,height,max(w,h)*2.3)
   current=[max(0,min(width-side,x+w/2-side/2)),max(0,min(height-side,y+h*.65-side/2)),side]
   crop=current if crop is None or cut else [a*.55+b*.45 for a,b in zip(crop,current)]
   valid=True
  else: crop=None;valid=False
  frames.append({'time':round(index/fps,3),'visible':valid,'crop':crop,'shotCut':bool(cut)})
  lastgray=gray
 if crop:
  x,y,s=map(round,crop);tile=cv2.resize(frame[y:y+s,x:x+s],(512,512))
 else: tile=frame.copy();tile=cv2.resize(tile,(512,512));tile[:]=0
 writer.write(tile);index+=1
cap.release();writer.release()
with open(manifest,'w') as f: json.dump({'method':'opencv-haar-5hz','limitations':'Single frontal face only; hide on missing/ambiguous detections; crop retains background; not segmentation','frames':frames},f)
