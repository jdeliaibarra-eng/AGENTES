import os
here=os.path.dirname(os.path.abspath(__file__))
r=lambda p: open(os.path.join(here,p),encoding='utf-8').read()
t=r('template.html'); datos=r('datos_min.json').strip()
assert '</script' not in datos.lower()
for k,v in [('/*CSS*/',r('style.css')),('/*DATOS*/',datos),('/*API*/',r('cliente_api.js')),('/*UI*/',r('ui.js'))]:
    assert k in t; t=t.replace(k, v if k=='/*DATOS*/' else v.replace('</script','<\\/script'))
out=os.path.join(here,'..','public'); os.makedirs(out,exist_ok=True)
open(os.path.join(out,'index.html'),'w',encoding='utf-8').write(t); print(len(t))
