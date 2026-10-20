# Original "angle step" tick for Brasa: synthesized from scratch (no sample of the reference), shaped after
# what the DDTank Sound006 reference sounds like: ~10 ms attack, peak at ~20 ms, bright 2-3.5 kHz click
# that settles into a short ~1 kHz body, gone by ~120 ms.
import math,random,struct,wave
sr=44100;n=int(sr*.12);random.seed(6)
out=[]
lp=0.0;hp_prev=0.0;hp=0.0
for i in range(n):
    t=i/sr
    attack=min(1,t/.008)
    # bright metallic click: two inharmonic partials sweeping down a little
    f1=3300-900*min(1,t/.03);f2=2350-500*min(1,t/.04)
    click=(.55*math.sin(2*math.pi*f1*t)+.35*math.sin(2*math.pi*f2*t+.7))*math.exp(-max(0,t-.012)/.014)
    # wooden/plastic body
    body=.45*math.sin(2*math.pi*(980-180*min(1,t/.06))*t)*math.exp(-max(0,t-.015)/.03)
    # noise transient, high-passed
    x=random.uniform(-1,1);hp=.85*(hp+x-hp_prev);hp_prev=x
    noise=.35*hp*math.exp(-t/.006)
    s=attack*(click+body)+noise
    out.append(s)
peak=max(abs(s) for s in out);fade=int(sr*.015)
for i in range(fade):out[-1-i]*=i/fade
data=b''.join(struct.pack('<h',int(max(-1,min(1,s/peak*.62))*32767)) for s in out)
w=wave.open('angle-change.wav','wb');w.setnchannels(1);w.setsampwidth(2);w.setframerate(sr);w.writeframes(data);w.close()
