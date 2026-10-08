const fs=require('fs');const H=require('path').resolve(__dirname,'../..')+'/';
global.window={};require(H+'data/taxonomy.js');require(H+'data/towns.js');require(H+'data/services.js');
const src=fs.readFileSync(H+'app.js','utf8');
const a=src.indexOf('  // אזורים שכנים')>0?Math.min(src.indexOf('  const openToAll'),src.indexOf('  // אזורים שכנים')):src.indexOf('  const openToAll'), b=src.indexOf('  // ---------- components');
const T=window.TAXONOMY, SERVICES=window.SERVICES, arr=x=>Array.isArray(x)?x:[];
const starred=s=>(s.community_recs||0)>=3;
const AREAS=window.AREAS; const areaOf=c=>Object.keys(AREAS).find(k=>AREAS[k].cats.includes(c))||'soul';
const F=eval('(()=>{'+src.slice(a,b)+';return {match,pickStations}})()');const M=F.match;
const stations=F.pickStations;
const P=JSON.parse(fs.readFileSync(__dirname+'/personas.json','utf8'));
const out={};
for(const [k,per] of Object.entries(P)) for(const v of ['full','minimal']){
  const p=per[v]; const res=M(p); const st=stations(p,M(p,{all:true})); st.forEach(f=>{if(!res.some(r=>r.s.id===f.s.id))res.push(f)});
  out[k+'_'+v]={answers:p,stations:st.map(r=>({id:r.s.id,name:r.s.name,why:r.why[0]})),total:res.length,
    list:res.map((r,i)=>({rank:i+1,id:r.s.id,name:r.s.name,area:areaOf(r.s.category),score:+r.sc.toFixed(1)}))};
}
fs.writeFileSync(process.argv[2]||__dirname+'/app_output.json',JSON.stringify(out,null,1));
for(const [k,o] of Object.entries(out)) console.log(k,o.total,'|',o.stations.map(s=>s.name.slice(0,40)).join(' || '));
