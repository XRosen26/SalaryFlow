from pathlib import Path
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parents[1]/'assets'/'images'
GREEN='#176B55'; PALE='#EAF3EE'; WHITE='#FFFFFF'
def wallet(draw,box,color,width):
 x0,y0,x1,y1=box; r=(y1-y0)*.12
 draw.rounded_rectangle(box,radius=r,outline=color,width=width)
 flap_y=y0+(y1-y0)*.42; flap_x=x0+(x1-x0)*.58
 draw.rounded_rectangle((flap_x,flap_y,x1+(x1-x0)*.03,flap_y+(y1-y0)*.32),radius=r*.7,fill=color)
 dot=(y1-y0)*.045; cx=flap_x+(x1-flap_x)*.45; cy=flap_y+(y1-y0)*.16
 draw.ellipse((cx-dot,cy-dot,cx+dot,cy+dot),fill=GREEN)
def make_icon(path,size=1024):
 im=Image.new('RGBA',(size,size),(0,0,0,0));d=ImageDraw.Draw(im)
 d.rounded_rectangle((64,64,960,960),radius=220,fill=GREEN)
 wallet(d,(250,300,760,700),WHITE,44);im.save(path)
def make_foreground(path):
 im=Image.new('RGBA',(1024,1024),(0,0,0,0));d=ImageDraw.Draw(im)
 d.rounded_rectangle((220,220,804,804),radius=150,fill=GREEN)
 wallet(d,(345,385,675,645),WHITE,30);im.save(path)
def make_mark(path,size=1024,color=WHITE):
 im=Image.new('RGBA',(size,size),(0,0,0,0));d=ImageDraw.Draw(im);wallet(d,(245,315,755,715),color,44);im.save(path)
ROOT.mkdir(parents=True,exist_ok=True)
make_icon(ROOT/'icon.png');make_foreground(ROOT/'android-icon-foreground.png')
Image.new('RGBA',(1024,1024),PALE).save(ROOT/'android-icon-background.png')
make_mark(ROOT/'android-icon-monochrome.png');make_mark(ROOT/'splash-icon.png',1024)
make_icon(ROOT/'favicon.png',1024)
print('Generated SalaryFlow Android icons')