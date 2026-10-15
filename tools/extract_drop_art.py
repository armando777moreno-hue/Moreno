"""Cut the Drop 001 artwork out of the flat front/back photos (assets/originals/drop-001).

Usage: python3 -I tools/extract_drop_art.py assets/originals/drop-001 assets/img/drop-001
Keys out the shirt colour of the big back print and writes art-<design>-<colour>.png (RGBA).
"""
import sys, numpy as np
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
BOX = {'perro-que-ladra':(581,918,1032,1457),'ojo-por-ojo':(597,912,1018,1464),'cria-cuervos':(586,895,1033,1474)}
for name,(x0,y0,x1,y1) in BOX.items():
  for col in ['black','cream']:
    im = np.asarray(Image.open(f'{src}/{name}-{col}-front-back.jpg').convert('RGB')).astype(float)
    shirt = np.median(im[1250:1350, 250:350].reshape(-1,3),axis=0)
    pad=14
    reg = im[y0-pad:y1+pad, x0-pad:x1+pad]
    d = np.sqrt(((reg-shirt)**2).sum(-1))
    a = np.clip((d-28)/(110-28),0,1)
    a3 = a[...,None]
    col_rgb = np.where(a3>0.02, (reg-(1-a3)*shirt)/np.maximum(a3,1e-3), 0)
    col_rgb = np.clip(col_rgb,0,255)
    rgba = np.dstack([col_rgb, a*255]).astype(np.uint8)
    Image.fromarray(rgba,'RGBA').save(f'{out}/art-{name}-{col}.png')
    print(name,col,rgba.shape)
