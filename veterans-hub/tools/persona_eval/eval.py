import json,subprocess,sys,os
D=os.path.dirname(os.path.abspath(__file__))
subprocess.run(['node',D+'/run.js',D+'/cur.json'],check=True,capture_output=True)
o=json.load(open(D+'/cur.json'))
tot=0
for per in ['police','veteran','tbi']:
    g=json.load(open(f'{D}/gold_{per}.json'))
    C=set(g['C'])-{'atalef-com-61908c'}; A=set(g['A']); AB=A|set(g['B'])
    for v in ['full','minimal']:
        r=o[f'{per}_{v}']; ids=[x['id'] for x in r['list']]; st=[x['id'] for x in r['stations']]
        a_st=len(A&set(st)); ab10=len(AB&set(ids[:10])); ab_all=len(AB&set(ids)); c=len(C&set(ids)); c_st=len(C&set(st))
        # score: stations A (x2), AB top10, AB recall, penalties
        sc=2*a_st+ab10+0.5*ab_all-1.5*c-3*c_st-max(0,len(ids)-25)*0.1
        tot+=sc
        print(f"{per:8}{v:8} A@st {a_st}/3  AB@10 {ab10:2}/{len(AB)}  AB@all {ab_all:2}  C {c:2} (st {c_st})  len {len(ids):3}  st: {' | '.join(x['name'][:28] for x in r['stations'])}")
print('TOTAL',round(tot,1))
