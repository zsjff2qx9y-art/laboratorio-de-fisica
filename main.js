/* =========================================================================
   HELPERS
========================================================================= */
function $(sel,root){return (root||document).querySelector(sel);}
function fmt(n,d){
  d = d===undefined?2:d;
  if(n===undefined||n===null||!isFinite(n)) n=0;
  if(Object.is(n,-0)) n=0;
  return n.toFixed(d).replace('.',',');
}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function el(tag,props,children){
  const e=document.createElement(tag);
  props=props||{};
  Object.keys(props).forEach(function(k){
    const v=props[k];
    if(k==='class') e.className=v;
    else if(k==='html') e.innerHTML=v;
    else if(k.indexOf('on')===0 && typeof v==='function') e.addEventListener(k.slice(2).toLowerCase(),v);
    else e.setAttribute(k,v);
  });
  (children||[]).forEach(function(c){
    if(c===null||c===undefined) return;
    if(typeof c==='string') e.appendChild(document.createTextNode(c));
    else e.appendChild(c);
  });
  return e;
}
function cssVar(name){ return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
function drawArrow(ctx,x1,y1,x2,y2,color,width){
  width = width||3;
  ctx.strokeStyle=color; ctx.fillStyle=color; ctx.lineWidth=width;
  ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  const angle=Math.atan2(y2-y1,x2-x1);
  const hl=8+width;
  ctx.beginPath();
  ctx.moveTo(x2,y2);
  ctx.lineTo(x2-hl*Math.cos(angle-Math.PI/6), y2-hl*Math.sin(angle-Math.PI/6));
  ctx.lineTo(x2-hl*Math.cos(angle+Math.PI/6), y2-hl*Math.sin(angle+Math.PI/6));
  ctx.closePath(); ctx.fill();
}
function setupCanvas(canvas,w,h){
  canvas.width=w; canvas.height=h;
  return canvas.getContext('2d');
}

/* Mini rolling graph */
function createMiniGraph(canvas,color,label,unit){
  const ctx=setupCanvas(canvas,400,120);
  let buf=[];
  return {
    push:function(t,y){
      buf.push({t:t,y:y});
      const tMin=t-12;
      while(buf.length && buf[0].t<tMin) buf.shift();
    },
    clear:function(){ buf=[]; },
    draw:function(){
      const w=canvas.width,h=canvas.height;
      ctx.clearRect(0,0,w,h);
      ctx.strokeStyle='rgba(255,255,255,0.055)'; ctx.lineWidth=1;
      for(let i=1;i<4;i++){ const y=Math.round(h*i/4)+0.5; ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); }
      if(buf.length<2){
        ctx.fillStyle=color; ctx.font='11px "IBM Plex Mono",monospace';
        ctx.fillText(label+' : --- '+unit, 8, 16);
        return;
      }
      const tMax=buf[buf.length-1].t, tMin=Math.max(0,tMax-12);
      let yMin=Infinity,yMax=-Infinity;
      buf.forEach(function(p){ if(p.y<yMin)yMin=p.y; if(p.y>yMax)yMax=p.y; });
      if(yMax-yMin<0.0001){ yMax+=1; yMin-=1; }
      const pad=(yMax-yMin)*0.15; yMin-=pad; yMax+=pad;
      ctx.strokeStyle=color; ctx.lineWidth=2; ctx.beginPath();
      buf.forEach(function(p,i){
        const x=((p.t-tMin)/((tMax-tMin)||1))*w;
        const y=h-((p.y-yMin)/((yMax-yMin)||1))*h;
        if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      });
      ctx.stroke();
      if(yMin<0 && yMax>0){
        const y0=h-((0-yMin)/(yMax-yMin))*h;
        ctx.strokeStyle='rgba(255,255,255,0.18)'; ctx.setLineDash([3,3]);
        ctx.beginPath(); ctx.moveTo(0,y0); ctx.lineTo(w,y0); ctx.stroke(); ctx.setLineDash([]);
      }
      const last=buf[buf.length-1];
      ctx.fillStyle=color; ctx.font='11px "IBM Plex Mono",monospace';
      ctx.fillText(label+' : '+fmt(last.y)+' '+unit, 8, 16);
    }
  };
}

/* Simple animation runner */
function createRunner(onStep){
  let running=false, last=null, raf=null;
  function loop(now){
    if(!running) return;
    let dt=(now-last)/1000; last=now;
    dt=Math.min(dt,0.05);
    onStep(dt);
    raf=requestAnimationFrame(loop);
  }
  return {
    start:function(){ if(running) return; running=true; last=performance.now(); raf=requestAnimationFrame(loop); },
    pause:function(){ running=false; if(raf) cancelAnimationFrame(raf); },
    get running(){ return running; }
  };
}

/* =========================================================================
   CATEGORIES
========================================================================= */
const CATEGORIES=[
  {id:'cinematica', icon:'📐', name:'Cinemática', desc:'Como os objetos se movem: posição, velocidade e aceleração ao longo do tempo.', topics:['velocidade','aceleracao-media','muv']},
  {id:'dinamica', icon:'⚙️', name:'Dinâmica', desc:'Por que os objetos se movem: forças, massa e suas consequências.', topics:['newton']},
  {id:'gravitacao', icon:'🌎', name:'Gravitação', desc:'A força que puxa tudo em direção ao chão.', topics:['queda-livre']},
  {id:'eletricidade', icon:'⚡', name:'Eletricidade', desc:'Tensão, corrente e resistência em um circuito simples.', topics:['ohm']},
  {id:'energia', icon:'🔋', name:'Energia', desc:'O que se conserva enquanto tudo muda de forma.', topics:['energia-cinetica','energia-potencial']},
  {id:'circular', icon:'🔄', name:'Movimento Circular', desc:'Objetos girando em torno de um centro fixo.', topics:['centripeta']}
];

/* =========================================================================
   TOPICS — each has: id, category, icon, title, explain, formulaHTML, vars,
   controls[], relations{}, graphs[], examples[], challenge,
   reset(state), step(state,dt), draw(ctx,w,h,state), readouts(state),
   graphValues(state)
========================================================================= */
const TOPICS={};

/* ---- 1. QUEDA LIVRE ---- */
TOPICS['queda-livre']={
  id:'queda-livre', category:'gravitacao', icon:'🌎', title:'Queda Livre',
  explain:'Sob ação apenas da gravidade, a altura de um objeto varia com o quadrado do tempo, enquanto sua velocidade cresce linearmente. A aceleração permanece praticamente constante.',
  formulaHTML:'<span data-var="h">h(t)</span> = h<sub>0</sub> + <span data-var="v0">v</span><sub>0</sub>t − ½<span data-var="g">g</span>t²',
  vars:[['h₀','Altura inicial (m)'],['v₀','Velocidade inicial (m/s)'],['g','Aceleração da gravidade (m/s²)'],['t','Tempo decorrido (s)']],
  controls:[
    {key:'h0', label:'Altura inicial (h₀)', min:5, max:100, step:1, def:20, unit:'m'},
    {key:'v0', label:'Velocidade inicial (v₀)', min:-15, max:15, step:0.5, def:0, unit:'m/s'},
    {key:'g', label:'Gravidade (g)', min:1, max:25, step:0.1, def:9.8, unit:'m/s²'},
    {key:'drag', label:'Resistência do ar (k)', min:0, max:1, step:0.05, def:0, unit:''}
  ],
  relations:{v0:{result:'h',dir:1}, g:{result:'h',dir:-1}},
  graphs:[{key:'pos',label:'h',unit:'m',color:'--cyan'},{key:'vel',label:'v',unit:'m/s',color:'--violet'},{key:'acc',label:'a',unit:'m/s²',color:'--amber'}],
  reset:function(s){ s.t=0; s.h=s.h0; s.scaleH=Math.max(s.h0,1); s.v=s.v0; s.a=-s.g; s.landed=false; },
  step:function(s,dt){
    if(s.landed) return;
    const dragA=-Math.sign(s.v||0)*s.drag*s.v*s.v*0.05;
    s.a=-s.g+dragA;
    s.v+=s.a*dt;
    s.h+=s.v*dt;
    s.t+=dt;
    if(s.h<=0){ s.h=0; s.landed=true; }
  },
  draw:function(ctx,w,h,s){
    const topY=40, groundY=h-40, midX=w/2;
    ctx.strokeStyle='rgba(255,255,255,.08)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(midX,topY); ctx.lineTo(midX,groundY); ctx.setLineDash([4,5]); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle='#1a2129'; ctx.fillRect(0,groundY,w,h-groundY);
    ctx.strokeStyle=cssVar('--border'); ctx.beginPath(); ctx.moveTo(0,groundY); ctx.lineTo(w,groundY); ctx.stroke();
    const ballY=groundY-(s.h/s.scaleH)*(groundY-topY);
    drawArrow(ctx, midX+50, ballY-10, midX+50, ballY+34, cssVar('--amber'), 3);
    ctx.fillStyle=cssVar('--amber'); ctx.font='12px "IBM Plex Mono",monospace'; ctx.fillText('g', midX+58, ballY+20);
    const grad=ctx.createRadialGradient(midX,ballY,2,midX,ballY,18);
    grad.addColorStop(0,'#bffbf3'); grad.addColorStop(1,cssVar('--cyan'));
    ctx.fillStyle=grad; ctx.beginPath(); ctx.arc(midX,ballY,13,0,7); ctx.fill();
    ctx.strokeStyle='rgba(76,224,210,.4)'; ctx.lineWidth=1;
    for(let i=1;i<=4;i++){ ctx.beginPath(); ctx.moveTo(midX-6,topY+(groundY-topY)*i/4); ctx.lineTo(midX+6,topY+(groundY-topY)*i/4); ctx.stroke(); }
  },
  readouts:function(s){ return [['Altura',fmt(s.h),'m'],['Velocidade',fmt(s.v),'m/s'],['Tempo',fmt(s.t),'s']]; },
  graphValues:function(s){ return {t:s.t,pos:s.h,vel:s.v,acc:s.a}; },
  examples:['Uma bolinha solta de 20 m leva cerca de 2 s até tocar o chão, sem resistência do ar.','Todos os objetos caem com a mesma aceleração se o atrito com o ar for desprezado — uma pena e uma bola de ferro chegam juntas.'],
  challenge:'Defina v₀ negativa (lançamento para baixo) e compare o tempo de queda com v₀ = 0. Depois ative a resistência do ar e observe a velocidade parar de crescer.'
};

/* ---- 2. ACELERAÇÃO MÉDIA ---- */
TOPICS['aceleracao-media']={
  id:'aceleracao-media', category:'cinematica', icon:'📐', title:'Aceleração Média',
  explain:'A aceleração média mede o quanto a velocidade mudou em um intervalo de tempo. Quanto maior essa variação em menos tempo, mais intensa é a aceleração.',
  formulaHTML:'<span data-var="a">a<sub>m</sub></span> = Δv / Δt',
  vars:[['vᵢ','Velocidade inicial (m/s)'],['v_f','Velocidade final (m/s)'],['Δt','Intervalo de tempo (s)']],
  controls:[
    {key:'vi', label:'Velocidade inicial (vᵢ)', min:-10, max:20, step:0.5, def:0, unit:'m/s'},
    {key:'vf', label:'Velocidade final (v_f)', min:-10, max:30, step:0.5, def:20, unit:'m/s'},
    {key:'deltaT', label:'Intervalo de tempo (Δt)', min:1, max:10, step:0.5, def:4, unit:'s'}
  ],
  relations:{vf:{result:'a',dir:1}, vi:{result:'a',dir:-1}, deltaT:{result:'a',dir:-1}},
  graphs:[{key:'pos',label:'s',unit:'m',color:'--cyan'},{key:'vel',label:'v',unit:'m/s',color:'--violet'},{key:'acc',label:'a',unit:'m/s²',color:'--amber'}],
  reset:function(s){ s.t=0; s.pos=0; s.v=s.vi; s.a=(s.vf-s.vi)/s.deltaT; s.landed=false; s.maxDist=Math.abs(s.vi*s.deltaT+0.5*s.a*s.deltaT*s.deltaT)||1; },
  step:function(s,dt){
    if(s.landed) return;
    s.t+=dt;
    if(s.t>=s.deltaT){ s.t=s.deltaT; s.landed=true; }
    s.a=(s.vf-s.vi)/s.deltaT;
    s.v=s.vi+s.a*s.t;
    s.pos=s.vi*s.t+0.5*s.a*s.t*s.t;
  },
  draw:function(ctx,w,h,s){
    const y=h/2, x0=40, x1=w-40;
    ctx.strokeStyle=cssVar('--border'); ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(x0,y); ctx.lineTo(x1,y); ctx.stroke();
    const frac=clamp(s.pos/(s.maxDist||1),-1,1);
    const carX=x0+((frac+1)/2)*(x1-x0);
    const speedFrac=clamp(Math.abs(s.v)/Math.max(Math.abs(s.vf),Math.abs(s.vi),1),0,1);
    for(let i=1;i<=4;i++){
      ctx.strokeStyle='rgba(179,146,240,'+(0.35-i*0.07)*speedFrac+')'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.moveTo(carX-14*i*Math.sign(s.v||1),y); ctx.lineTo(carX-14*i*Math.sign(s.v||1)-8,y); ctx.stroke();
    }
    ctx.fillStyle=cssVar('--violet');
    ctx.beginPath(); ctx.moveTo(carX-16,y+10); ctx.lineTo(carX+16,y+10); ctx.lineTo(carX+10,y-10); ctx.lineTo(carX-10,y-10); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#070a0e'; ctx.beginPath(); ctx.arc(carX-8,y+10,4,0,7); ctx.arc(carX+8,y+10,4,0,7); ctx.fill();
    ctx.fillStyle=cssVar('--text-faint'); ctx.font='11px "IBM Plex Mono",monospace';
    ctx.fillText('a = '+fmt(s.a)+' m/s²', x0, 26);
  },
  readouts:function(s){ return [['Velocidade',fmt(s.v),'m/s'],['Aceleração',fmt(s.a),'m/s²'],['Distância',fmt(s.pos),'m'],['Tempo',fmt(s.t),'s']]; },
  graphValues:function(s){ return {t:s.t,pos:s.pos,vel:s.v,acc:s.a}; },
  examples:['Um carro que vai de 0 a 20 m/s em 4 s tem aceleração média de 5 m/s².','Quanto menor o Δt para a mesma variação de velocidade, maior a aceleração — é o que sentimos como "arrancada".'],
  challenge:'Deixe v_f menor que vᵢ: o objeto está freando. Observe o sinal negativo da aceleração no gráfico.'
};

/* ---- 3. VELOCIDADE ---- */
TOPICS['velocidade']={
  id:'velocidade', category:'cinematica', icon:'📐', title:'Velocidade Média',
  explain:'A velocidade relaciona a distância percorrida com o tempo gasto para percorrê-la. Quanto maior a velocidade, mais rápido o objeto cruza a mesma distância.',
  formulaHTML:'<span data-var="v">v</span> = Δs / Δt',
  vars:[['s','Distância percorrida (m)'],['t','Tempo gasto (s)']],
  controls:[
    {key:'s', label:'Distância (s)', min:5, max:200, step:5, def:50, unit:'m'},
    {key:'t', label:'Tempo (t)', min:1, max:20, step:0.5, def:5, unit:'s'}
  ],
  relations:{s:{result:'v',dir:1}, t:{result:'v',dir:-1}},
  graphs:[{key:'pos',label:'s',unit:'m',color:'--cyan'},{key:'vel',label:'v',unit:'m/s',color:'--violet'},{key:'acc',label:'a',unit:'m/s²',color:'--amber'}],
  reset:function(s){ s.simT=0; s.pos=0; s.v=s.s/s.t; s.landed=false; },
  step:function(s,dt){
    if(s.landed) return;
    s.simT+=dt;
    if(s.simT>=s.t){ s.simT=s.t; s.landed=true; }
    s.v=s.s/s.t;
    s.pos=s.v*s.simT;
  },
  draw:function(ctx,w,h,s){
    const y=h/2, x0=40, x1=w-40;
    ctx.strokeStyle=cssVar('--border'); ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(x0,y); ctx.lineTo(x1,y); ctx.stroke();
    for(let i=0;i<=10;i++){
      const x=x0+(x1-x0)*i/10;
      ctx.strokeStyle='rgba(255,255,255,.15)'; ctx.beginPath(); ctx.moveTo(x,y-6); ctx.lineTo(x,y+6); ctx.stroke();
      if(i%2===0){ ctx.fillStyle=cssVar('--text-faint'); ctx.font='9px "IBM Plex Mono",monospace'; ctx.fillText(fmt(s.s*i/10,0), x-8, y+20); }
    }
    const frac=clamp(s.pos/s.s,0,1);
    const carX=x0+(x1-x0)*frac;
    ctx.fillStyle=cssVar('--cyan');
    ctx.beginPath(); ctx.arc(carX,y-16,9,0,7); ctx.fill();
    ctx.strokeStyle='rgba(76,224,210,.35)'; ctx.lineWidth=4;
    ctx.beginPath(); ctx.moveTo(x0,y-16); ctx.lineTo(carX,y-16); ctx.stroke();
  },
  readouts:function(s){ return [['Velocidade',fmt(s.v),'m/s'],['Distância',fmt(s.pos),'m'],['Tempo',fmt(s.simT),'s']]; },
  graphValues:function(s){ return {t:s.simT,pos:s.pos,vel:s.v,acc:0}; },
  examples:['Percorrer 50 m em 5 s equivale a uma velocidade de 10 m/s (36 km/h).','A aceleração é zero aqui: a velocidade é constante durante todo o percurso (MRU).'],
  challenge:'Fixe a distância e reduza o tempo gradualmente — veja a velocidade crescer no gráfico e o objeto atravessar a régua cada vez mais rápido.'
};

/* ---- 4. MUV ---- */
TOPICS['muv']={
  id:'muv', category:'cinematica', icon:'📐', title:'Movimento Uniformemente Variado',
  explain:'No MUV a aceleração é constante: a velocidade cresce (ou decresce) de forma linear e a posição, de forma quadrática no tempo.',
  formulaHTML:'<span data-var="v">v</span> = v<sub>0</sub> + <span data-var="a">a</span>t &nbsp;·&nbsp; Δs = v<sub>0</sub>t + ½at²',
  vars:[['v₀','Velocidade inicial (m/s)'],['a','Aceleração (m/s²)'],['t','Tempo (s)']],
  controls:[
    {key:'v0', label:'Velocidade inicial (v₀)', min:-10, max:10, step:0.5, def:2, unit:'m/s'},
    {key:'a', label:'Aceleração (a)', min:-5, max:5, step:0.5, def:1.5, unit:'m/s²'},
    {key:'duration', label:'Duração da simulação', min:1, max:15, step:1, def:8, unit:'s'}
  ],
  relations:{v0:{result:'v',dir:1}, a:{result:'v',dir:1}},
  graphs:[{key:'pos',label:'s',unit:'m',color:'--cyan'},{key:'vel',label:'v',unit:'m/s',color:'--violet'},{key:'acc',label:'a',unit:'m/s²',color:'--amber'}],
  reset:function(s){ s.t=0; s.pos=0; s.v=s.v0; s.landed=false; const tEnd=s.duration; s.maxDist=Math.abs(s.v0*tEnd+0.5*s.a*tEnd*tEnd)||1; },
  step:function(s,dt){
    if(s.landed) return;
    s.t+=dt;
    if(s.t>=s.duration){ s.t=s.duration; s.landed=true; }
    s.v=s.v0+s.a*s.t;
    s.pos=s.v0*s.t+0.5*s.a*s.t*s.t;
  },
  draw:function(ctx,w,h,s){
    const y=h/2, x0=40, x1=w-40;
    ctx.strokeStyle=cssVar('--border'); ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(x0,y); ctx.lineTo(x1,y); ctx.stroke();
    const frac=clamp(s.pos/(s.maxDist||1),-1,1);
    const carX=x0+((frac+1)/2)*(x1-x0);
    ctx.fillStyle=cssVar('--amber');
    ctx.beginPath(); ctx.moveTo(carX-14,y+10); ctx.lineTo(carX+14,y+10); ctx.lineTo(carX+8,y-12); ctx.lineTo(carX-8,y-12); ctx.closePath(); ctx.fill();
    drawArrow(ctx, carX, y-24, carX+Math.sign(s.a||1)*24, y-24, cssVar('--red'), 2.5);
    ctx.fillStyle=cssVar('--text-faint'); ctx.font='10px "IBM Plex Mono",monospace'; ctx.fillText('a', carX-4, y-30);
  },
  readouts:function(s){ return [['Velocidade',fmt(s.v),'m/s'],['Posição',fmt(s.pos),'m'],['Tempo',fmt(s.t),'s']]; },
  graphValues:function(s){ return {t:s.t,pos:s.pos,vel:s.v,acc:s.a}; },
  examples:['Um trem que parte a 2 m/s e acelera 1,5 m/s² atinge quase 14 m/s após 8 s.','Se a for negativo, o objeto desacelera — a velocidade pode até inverter de sinal.'],
  challenge:'Zere a e observe o MUV virar um MRU (reta no gráfico de posição). Depois torne a negativo e veja a curva de posição inverter a concavidade.'
};

/* ---- 5. NEWTON ---- */
TOPICS['newton']={
  id:'newton', category:'dinamica', icon:'⚙️', title:'2ª Lei de Newton',
  explain:'A força resultante sobre um corpo determina sua aceleração. Quanto maior a força aplicada, maior a aceleração; quanto maior a massa, menor a aceleração para a mesma força.',
  formulaHTML:'<span data-var="F">F</span> = <span data-var="m">m</span><span data-var="a">a</span>',
  vars:[['m','Massa do corpo (kg)'],['F','Força aplicada (N)'],['μ','Coeficiente de atrito']],
  controls:[
    {key:'m', label:'Massa (m)', min:1, max:20, step:0.5, def:5, unit:'kg'},
    {key:'F', label:'Força aplicada (F)', min:0, max:100, step:1, def:20, unit:'N'},
    {key:'mu', label:'Atrito (μ)', min:0, max:1, step:0.05, def:0.2, unit:''}
  ],
  relations:{F:{result:'a',dir:1}, m:{result:'a',dir:-1}},
  graphs:[{key:'pos',label:'s',unit:'m',color:'--cyan'},{key:'vel',label:'v',unit:'m/s',color:'--violet'},{key:'acc',label:'a',unit:'m/s²',color:'--amber'}],
  computeForces:function(s){
    const G=9.8;
    const frictionMax=s.mu*s.m*G;
    const fric=Math.min(s.F, frictionMax);
    const net=s.F-fric;
    s.frictionMax=frictionMax; s.fric=fric; s.net=net;
    s.a=(s.v<=0 && net<=0)?0:net/s.m;
  },
  reset:function(s){ s.t=0; s.pos=0; s.v=0; s.a=0; TOPICS['newton'].computeForces(s); },
  step:function(s,dt){
    TOPICS['newton'].computeForces(s);
    const net=s.net;
    if(s.v<=0 && net<=0){ s.v=0; s.a=0; }
    else { s.v+=s.a*dt; if(s.v<0) s.v=0; }
    s.pos+=s.v*dt;
    s.t+=dt;
    if(s.pos>34){ s.pos=0; }
  },
  draw:function(ctx,w,h,s){
    const groundY=h-60, x0=40, x1=w-40;
    ctx.fillStyle='#1a2129'; ctx.fillRect(0,groundY,w,h-groundY);
    ctx.strokeStyle=cssVar('--border'); ctx.beginPath(); ctx.moveTo(0,groundY); ctx.lineTo(w,groundY); ctx.stroke();
    const frac=clamp((s.pos||0)/34,0,1);
    const bx=x0+(x1-x0)*frac;
    const by=groundY-24;
    ctx.fillStyle=cssVar('--cyan'); ctx.fillRect(bx-22,by-22,44,44);
    ctx.strokeStyle='#06110f'; ctx.lineWidth=2; ctx.strokeRect(bx-22,by-22,44,44);
    const G=9.8;
    const frictionMax=s.mu*s.m*G, fric=Math.min(s.F,frictionMax), net=s.F-fric;
    const fScale=0.6;
    if(s.F>0) drawArrow(ctx, bx+22, by, bx+22+Math.min(s.F*fScale,120), by, cssVar('--amber'), 3);
    if(fric>0) drawArrow(ctx, bx-22, by, bx-22-Math.min(fric*fScale,120), by, cssVar('--red'), 3);
    drawArrow(ctx, bx, by+40, bx+Math.sign(net||1)*Math.min(Math.abs(net)*fScale,60), by+40, cssVar('--green'), 3);
    ctx.font='11px "IBM Plex Mono",monospace';
    ctx.fillStyle=cssVar('--amber'); ctx.fillText('F', bx+22+Math.min(s.F*fScale,120)+6, by+4);
    ctx.fillStyle=cssVar('--red'); if(fric>0) ctx.fillText('atrito', bx-22-Math.min(fric*fScale,120)-38, by+4);
    ctx.fillStyle=cssVar('--green'); ctx.fillText('resultante', bx-24, by+56);
  },
  readouts:function(s){ return [['Aceleração',fmt(s.a),'m/s²'],['Velocidade',fmt(s.v),'m/s'],['F. atrito',fmt(s.fric||0),'N'],['F. resultante',fmt(s.net||0),'N']]; },
  graphValues:function(s){ return {t:s.t,pos:s.pos,vel:s.v,acc:s.a}; },
  examples:['Com F = 20 N e m = 5 kg (sem atrito), a = 4 m/s².','Se a força aplicada for menor que a força de atrito máxima, o bloco permanece parado (a = 0).'],
  challenge:'Aumente a massa mantendo a força fixa e observe a aceleração cair. Depois aumente o atrito até o bloco parar de se mover.'
};

/* ---- 6. CENTRÍPETA ---- */
TOPICS['centripeta']={
  id:'centripeta', category:'circular', icon:'🔄', title:'Força Centrípeta',
  explain:'Um objeto em movimento circular precisa de uma força apontando sempre para o centro da trajetória. Ela cresce com o quadrado da velocidade e diminui com o raio.',
  formulaHTML:'<span data-var="F">F</span><sub>c</sub> = <span data-var="m">m</span><span data-var="v">v</span>² / <span data-var="r">r</span>',
  vars:[['m','Massa (kg)'],['v','Velocidade tangencial (m/s)'],['r','Raio da trajetória (m)']],
  controls:[
    {key:'m', label:'Massa (m)', min:0.5, max:10, step:0.5, def:2, unit:'kg'},
    {key:'v', label:'Velocidade tangencial (v)', min:1, max:15, step:0.5, def:5, unit:'m/s'},
    {key:'r', label:'Raio (r)', min:0.5, max:10, step:0.5, def:3, unit:'m'}
  ],
  relations:{v:{result:'F',dir:1}, r:{result:'F',dir:-1}, m:{result:'F',dir:1}},
  graphs:[{key:'x',label:'x',unit:'m',color:'--cyan'},{key:'y',label:'y',unit:'m',color:'--violet'},{key:'fc',label:'Fc',unit:'N',color:'--amber'}],
  reset:function(s){ s.theta=0; s.t=0; },
  step:function(s,dt){
    const omega=s.v/s.r;
    s.theta+=omega*dt;
    s.t+=dt;
  },
  draw:function(ctx,w,h,s){
    const cx=w/2, cy=h/2;
    const rPix=clamp(s.r*14,40,150);
    ctx.strokeStyle='rgba(255,255,255,.12)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.arc(cx,cy,rPix,0,7); ctx.stroke();
    ctx.fillStyle=cssVar('--text-faint'); ctx.beginPath(); ctx.arc(cx,cy,3,0,7); ctx.fill();
    const ox=cx+rPix*Math.cos(s.theta), oy=cy+rPix*Math.sin(s.theta);
    drawArrow(ctx, ox, oy, cx+(ox-cx)*0.35, cy+(oy-cy)*0.35, cssVar('--amber'), 3);
    const tx=-Math.sin(s.theta), ty=Math.cos(s.theta);
    drawArrow(ctx, ox, oy, ox+tx*30, oy+ty*30, cssVar('--violet'), 2.5);
    ctx.fillStyle=cssVar('--cyan'); ctx.beginPath(); ctx.arc(ox,oy,10,0,7); ctx.fill();
    ctx.font='11px "IBM Plex Mono",monospace';
    ctx.fillStyle=cssVar('--amber'); ctx.fillText('Fc', cx+(ox-cx)*0.6+6, cy+(oy-cy)*0.6);
    ctx.fillStyle=cssVar('--violet'); ctx.fillText('v', ox+tx*36, oy+ty*36);
  },
  readouts:function(s){
    const fc=s.m*s.v*s.v/s.r;
    return [['Fc',fmt(fc),'N'],['ω',fmt(s.v/s.r),'rad/s'],['θ',fmt((s.theta%(2*Math.PI))*180/Math.PI,0),'°']];
  },
  graphValues:function(s){
    const rPix=clamp(s.r*14,40,150);
    return {t:s.t, x:(rPix*Math.cos(s.theta))/14, y:(rPix*Math.sin(s.theta))/14, fc:s.m*s.v*s.v/s.r};
  },
  examples:['Um carro fazendo uma curva fechada (r pequeno) precisa de mais força centrípeta que numa curva aberta, para a mesma velocidade.','Dobrar a velocidade quadruplica a força centrípeta necessária — por isso curvas em alta velocidade são tão mais perigosas.'],
  challenge:'Dobre a velocidade v e compare a nova Fc com o dobro da anterior — note que ela mais que dobra (relação quadrática).'
};

/* ---- 7. ENERGIA CINÉTICA ---- */
TOPICS['energia-cinetica']={
  id:'energia-cinetica', category:'energia', icon:'🔋', title:'Energia Cinética',
  explain:'A energia cinética cresce com o quadrado da velocidade: dobrar a velocidade quadruplica a energia, mesmo mantendo a massa constante.',
  formulaHTML:'<span data-var="Ec">E<sub>c</sub></span> = ½<span data-var="m">m</span><span data-var="v">v</span>²',
  vars:[['m','Massa (kg)'],['v','Velocidade (m/s)']],
  controls:[
    {key:'m', label:'Massa (m)', min:1, max:20, step:0.5, def:5, unit:'kg'},
    {key:'v', label:'Velocidade (v)', min:0, max:30, step:0.5, def:10, unit:'m/s'}
  ],
  relations:{v:{result:'Ec',dir:1}, m:{result:'Ec',dir:1}},
  graphs:[{key:'ec',label:'Ec',unit:'J',color:'--amber'},{key:'pos',label:'s',unit:'m',color:'--cyan'},{key:'vel',label:'v',unit:'m/s',color:'--violet'}],
  reset:function(s){ s.pos=0; s.t=0; },
  step:function(s,dt){ s.pos+=s.v*dt; if(s.pos>34) s.pos=0; s.t+=dt; },
  draw:function(ctx,w,h,s){
    const y=h*0.55, x0=40, x1=w-120;
    ctx.strokeStyle=cssVar('--border'); ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(x0,y); ctx.lineTo(x1,y); ctx.stroke();
    const frac=(s.pos%34)/34;
    const bx=x0+(x1-x0)*frac;
    const ec=0.5*s.m*s.v*s.v;
    const ecMax=0.5*20*30*30;
    const glow=clamp(ec/ecMax,0,1);
    const grad=ctx.createRadialGradient(bx,y,2,bx,y,14+glow*26);
    grad.addColorStop(0,'rgba(255,184,107,'+(0.9)+')');
    grad.addColorStop(1,'rgba(255,184,107,0)');
    ctx.fillStyle=grad; ctx.beginPath(); ctx.arc(bx,y,14+glow*26,0,7); ctx.fill();
    ctx.fillStyle=cssVar('--amber'); ctx.beginPath(); ctx.arc(bx,y,10,0,7); ctx.fill();
    const barX=w-70, barW=30, barBottom=h-30, barTop=30;
    ctx.strokeStyle=cssVar('--border'); ctx.strokeRect(barX,barTop,barW,barBottom-barTop);
    const barH=(barBottom-barTop)*glow;
    ctx.fillStyle=cssVar('--amber'); ctx.fillRect(barX,barBottom-barH,barW,barH);
    ctx.fillStyle=cssVar('--text-faint'); ctx.font='10px "IBM Plex Mono",monospace';
    ctx.fillText('Ec', barX+6, barTop-8);
  },
  readouts:function(s){ return [['Energia cinética',fmt(0.5*s.m*s.v*s.v),'J'],['Velocidade',fmt(s.v),'m/s']]; },
  graphValues:function(s){ return {t:s.t, ec:0.5*s.m*s.v*s.v, pos:s.pos%34, vel:s.v}; },
  examples:['Um carro de 1000 kg a 20 m/s tem 200.000 J de energia cinética.','Ao frear, essa energia precisa ser dissipada — é por isso que dobrar a velocidade multiplica por 4 a distância de frenagem.'],
  challenge:'Dobre a velocidade e veja no gráfico o salto da energia: ela não dobra, ela quadruplica.'
};

/* ---- 8. ENERGIA POTENCIAL ---- */
TOPICS['energia-potencial']={
  id:'energia-potencial', category:'energia', icon:'🔋', title:'Energia Potencial Gravitacional',
  explain:'Um objeto elevado acumula energia potencial proporcional à sua altura. Ao ser solto, essa energia se transforma em energia cinética durante a queda — o total se conserva.',
  formulaHTML:'<span data-var="Ep">E</span><sub>p</sub> = <span data-var="m">m</span><span data-var="g">g</span><span data-var="h">h</span>',
  vars:[['m','Massa (kg)'],['h','Altura (m)'],['g','Gravidade (m/s²)']],
  controls:[
    {key:'m', label:'Massa (m)', min:1, max:20, step:0.5, def:5, unit:'kg'},
    {key:'h', label:'Altura (h)', min:1, max:50, step:1, def:10, unit:'m'},
    {key:'g', label:'Gravidade (g)', min:1, max:20, step:0.1, def:9.8, unit:'m/s²'}
  ],
  relations:{m:{result:'Ep',dir:1}, h:{result:'Ep',dir:1}, g:{result:'Ep',dir:1}},
  graphs:[{key:'ep',label:'Ep',unit:'J',color:'--cyan'},{key:'ec',label:'Ec',unit:'J',color:'--amber'},{key:'total',label:'Total',unit:'J',color:'--green'}],
  extraButtons:[{key:'soltar', label:'↓ Soltar'}],
  reset:function(s){ s.y=s.h; s.v=0; s.t=0; s.falling=false; s.maxE=s.m*s.g*s.h; },
  onExtra:function(key,s,runner){
    if(key==='soltar' && !s.falling){ s.falling=true; runner.start(); }
  },
  step:function(s,dt){
    if(!s.falling) return;
    s.v+=s.g*dt;
    s.y-=s.v*dt;
    s.t+=dt;
    if(s.y<=0){ s.y=0; s.falling=false; }
  },
  draw:function(ctx,w,h,s){
    const topY=40, groundY=h-40, trackX=w/2-60;
    ctx.strokeStyle='rgba(255,255,255,.08)'; ctx.lineWidth=1; ctx.setLineDash([4,5]);
    ctx.beginPath(); ctx.moveTo(trackX,topY); ctx.lineTo(trackX,groundY); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle='#1a2129'; ctx.fillRect(0,groundY,w,h-groundY);
    ctx.strokeStyle=cssVar('--border'); ctx.beginPath(); ctx.moveTo(0,groundY); ctx.lineTo(w,groundY); ctx.stroke();
    const scaleH=Math.max(s.h,1);
    const objY=groundY-(clamp(s.y,0,scaleH)/scaleH)*(groundY-topY);
    ctx.fillStyle=cssVar('--cyan'); ctx.beginPath(); ctx.arc(trackX,objY,12,0,7); ctx.fill();
    const ep=s.m*s.g*Math.max(s.y,0), ec=0.5*s.m*s.v*s.v;
    const maxE=s.maxE||1;
    const barBottom=groundY, barTop=topY, barH=barBottom-barTop;
    const epX=w/2+30, ecX=w/2+80;
    ctx.strokeStyle=cssVar('--border');
    ctx.strokeRect(epX,barTop,26,barH); ctx.strokeRect(ecX,barTop,26,barH);
    ctx.fillStyle=cssVar('--cyan'); ctx.fillRect(epX,barBottom-barH*clamp(ep/maxE,0,1),26,barH*clamp(ep/maxE,0,1));
    ctx.fillStyle=cssVar('--amber'); ctx.fillRect(ecX,barBottom-barH*clamp(ec/maxE,0,1),26,barH*clamp(ec/maxE,0,1));
    ctx.fillStyle=cssVar('--text-faint'); ctx.font='10px "IBM Plex Mono",monospace';
    ctx.fillText('Ep', epX+2, barTop-8); ctx.fillText('Ec', ecX+2, barTop-8);
  },
  readouts:function(s){
    const ep=s.m*s.g*Math.max(s.y,0), ec=0.5*s.m*s.v*s.v;
    return [['Ep',fmt(ep),'J'],['Ec',fmt(ec),'J'],['Altura',fmt(s.y),'m'],['Velocidade',fmt(s.v),'m/s']];
  },
  graphValues:function(s){
    const ep=s.m*s.g*Math.max(s.y,0), ec=0.5*s.m*s.v*s.v;
    return {t:s.t, ep:ep, ec:ec, total:ep+ec};
  },
  examples:['Um objeto de 5 kg a 10 m de altura tem cerca de 490 J de energia potencial.','Durante a queda, Ep diminui exatamente na medida em que Ec aumenta — a soma permanece constante.'],
  challenge:'Clique em "Soltar" e observe as barras Ep e Ec trocarem de tamanho enquanto a linha "Total" permanece praticamente reta no gráfico.'
};

/* ---- 9. LEI DE OHM ---- */
TOPICS['ohm']={
  id:'ohm', category:'eletricidade', icon:'⚡', title:'Lei de Ohm',
  explain:'Em um circuito resistivo, a tensão é o produto da resistência pela corrente. Fixando duas grandezas, a terceira fica determinada.',
  formulaHTML:'<span data-var="V">V</span> = <span data-var="R">R</span><span data-var="I">I</span>',
  vars:[['V','Tensão (volts)'],['R','Resistência (ohms)'],['I','Corrente (ampères)']],
  controls:[
    {key:'target', type:'select', label:'Calcular automaticamente', options:[['V','Tensão (V)'],['R','Resistência (R)'],['I','Corrente (I)']], def:'V'},
    {key:'R', label:'Resistência (R)', min:1, max:100, step:1, def:10, unit:'Ω'},
    {key:'I', label:'Corrente (I)', min:0.1, max:5, step:0.1, def:2, unit:'A'},
    {key:'V', label:'Tensão (V)', min:1, max:24, step:0.5, def:20, unit:'V'}
  ],
  relations:{R:{result:'V',dir:1}, I:{result:'V',dir:1}},
  graphs:[{key:'v',label:'V',unit:'V',color:'--cyan'},{key:'r',label:'R',unit:'Ω',color:'--amber'},{key:'i',label:'I',unit:'A',color:'--violet'}],
  reset:function(s){ s.t=0; TOPICS['ohm'].recompute(s); },
  recompute:function(s){
    if(s.target==='V') s.V=s.R*s.I;
    else if(s.target==='R') s.R=s.I>0?s.V/s.I:0;
    else s.I=s.R>0?s.V/s.R:0;
  },
  step:function(s,dt){ TOPICS['ohm'].recompute(s); s.t+=dt; },
  afterChange:function(s,controlsEls){
    Object.keys(controlsEls).forEach(function(k){
      if(k==='target') return;
      const c=controlsEls[k];
      const isTarget=(k===s.target);
      c.input.disabled=isTarget;
      if(isTarget){
        c.input.value=s[k];
        c.valSpan.textContent=fmt(s[k],2);
      }
    });
  },
  draw:function(ctx,w,h,s){
    const left=90, right=w-90, top=60, bottom=h-60;
    ctx.strokeStyle=cssVar('--border'); ctx.lineWidth=3;
    ctx.strokeRect(left,top,right-left,bottom-top);
    ctx.clearRect(left-2,top+((bottom-top)/2)-16, 4, 32);
    ctx.fillStyle='#070a0e'; ctx.fillRect(left-3,(top+bottom)/2-16,6,32);
    ctx.strokeStyle=cssVar('--cyan'); ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(left,(top+bottom)/2-16); ctx.lineTo(left,(top+bottom)/2-6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(left-8,(top+bottom)/2-6); ctx.lineTo(left+8,(top+bottom)/2-6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(left-14,(top+bottom)/2+6); ctx.lineTo(left+14,(top+bottom)/2+6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(left,(top+bottom)/2+6); ctx.lineTo(left,(top+bottom)/2+16); ctx.stroke();
    ctx.fillStyle=cssVar('--cyan'); ctx.font='11px "IBM Plex Mono",monospace'; ctx.fillText('V='+fmt(s.V,1)+'V', left-34, (top+bottom)/2+34);
    const zigY=top, zigX0=w/2-50, zigX1=w/2+50, n=7;
    ctx.strokeStyle=cssVar('--amber'); ctx.lineWidth=3; ctx.beginPath();
    ctx.moveTo(zigX0,zigY);
    for(let i=0;i<n;i++){ const x=zigX0+(zigX1-zigX0)*(i+1)/n; const y=zigY+(i%2===0?14:-14); ctx.lineTo(x,y); }
    ctx.stroke();
    ctx.fillStyle=cssVar('--amber'); ctx.fillText('R='+fmt(s.R,1)+'Ω', zigX0, zigY-24);
    const speed=clamp(s.I,0,5);
    const perim=2*((right-left)+(bottom-top));
    const dashLen=10, gapLen=14;
    ctx.setLineDash([dashLen,gapLen]);
    ctx.lineDashOffset=-(s.t*speed*40)%(dashLen+gapLen);
    ctx.strokeStyle=cssVar('--violet'); ctx.lineWidth=2;
    ctx.strokeRect(left,top,right-left,bottom-top);
    ctx.setLineDash([]);
    ctx.fillStyle=cssVar('--violet'); ctx.font='11px "IBM Plex Mono",monospace'; ctx.fillText('I='+fmt(s.I,2)+'A', right-70, bottom+34);
  },
  readouts:function(s){ return [['V',fmt(s.V,2),'V'],['R',fmt(s.R,2),'Ω'],['I',fmt(s.I,2),'A']]; },
  graphValues:function(s){ return {t:s.t, v:s.V, r:s.R, i:s.I}; },
  examples:['Com R = 10 Ω e I = 2 A, a tensão é V = 20 V.','Se a tensão da fonte for fixa, aumentar a resistência do circuito reduz a corrente.'],
  challenge:'Selecione "Calcular corrente", fixe a tensão e aumente a resistência — observe a corrente cair no gráfico.'
};

/* =========================================================================
   NAVIGATION / RENDERING
========================================================================= */
let currentRunner=null;
let currentTopicState=null;

function teardownTopic(){
  if(currentRunner){ currentRunner.pause(); currentRunner=null; }
  currentTopicState=null;
}

function showHome(){
  teardownTopic();
  document.getElementById('crumb').textContent='';
  setActive('screen-home');
}
function showCategory(catId){
  teardownTopic();
  const cat=CATEGORIES.find(function(c){return c.id===catId;});
  if(!cat) return showHome();
  document.getElementById('cat-title').innerHTML=cat.icon+' '+cat.name;
  document.getElementById('cat-desc').textContent=cat.desc;
  document.getElementById('crumb').innerHTML=cat.name;
  const list=document.getElementById('topic-list');
  list.innerHTML='';
  cat.topics.forEach(function(tid){
    const t=TOPICS[tid];
    if(!t) return;
    const card=el('button',{class:'topic-card', onclick:function(){ showTopic(tid); }},[
      el('h4',{},[t.icon+' '+t.title]),
      el('div',{class:'f'},[stripTags(t.formulaHTML)]),
      el('p',{},[t.explain])
    ]);
    list.appendChild(card);
  });
  setActive('screen-category');
}
function stripTags(html){ const d=document.createElement('div'); d.innerHTML=html; return d.textContent; }

function setActive(id){
  document.querySelectorAll('.screen').forEach(function(s){ s.classList.remove('active'); });
  document.getElementById(id).classList.add('active');
  window.scrollTo(0,0);
}

function showTopic(topicId){
  teardownTopic();
  const topic=TOPICS[topicId];
  if(!topic) return showHome();
  const cat=CATEGORIES.find(function(c){return c.id===topic.category;});
  document.getElementById('crumb').innerHTML=cat.name+' <span style="color:var(--text-faint)">/</span> <b>'+topic.title+'</b>';

  const state={};
  topic.controls.forEach(function(c){ state[c.key]=c.def; });
  topic.reset(state);
  currentTopicState=state;

  const root=document.getElementById('topic-root');
  root.innerHTML='';

  let formulaMode=false;

  // header
  const header=el('div',{class:'topic-header'},[
    el('button',{class:'btn-back', onclick:function(){ showCategory(topic.category); }},['← Voltar']),
    el('div',{class:'topic-kicker'},[cat.name]),
    el('h2',{},[topic.icon+' '+topic.title])
  ]);
  root.appendChild(header);

  // top grid: info panel + scene panel
  const infoPanel=el('div',{class:'panel'},[
    el('p',{class:'panel-title'},['O que a fórmula diz']),
    el('p',{class:'explain'},[topic.explain]),
    el('div',{class:'formula-box', html:topic.formulaHTML}),
    el('ul',{class:'var-list'}, topic.vars.map(function(v){ return el('li',{},[el('b',{},[v[0]]), el('span',{},[v[1]])]); }))
  ]);

  const scene=el('canvas',{});
  const sceneWrap=el('div',{class:'scene-wrap'},[scene]);
  const readoutsBox=el('div',{class:'readouts'});
  sceneWrap.appendChild(readoutsBox);
  const playbar=el('div',{class:'playbar'});
  const btnPlay=el('button',{class:'pbtn primary'},['▶ Iniciar']);
  const btnPause=el('button',{class:'pbtn'},['⏸ Pausar']);
  const btnReset=el('button',{class:'pbtn'},['↻ Reiniciar']);
  const btnFormula=el('button',{class:'formula-toggle'},['✦ Veja a fórmula acontecer']);
  playbar.appendChild(btnPlay); playbar.appendChild(btnPause); playbar.appendChild(btnReset);
  (topic.extraButtons||[]).forEach(function(eb){
    const b=el('button',{class:'pbtn extra'},[eb.label]);
    b.addEventListener('click',function(){ topic.onExtra(eb.key,state,runner); });
    playbar.appendChild(b);
  });
  playbar.appendChild(btnFormula);

  const scenePanel=el('div',{class:'panel'},[
    el('p',{class:'panel-title'},['Simulação']),
    sceneWrap,
    playbar
  ]);

  const topGrid=el('div',{class:'topic-grid'},[infoPanel,scenePanel]);
  root.appendChild(topGrid);

  // controls panel
  const controlsGrid=el('div',{class:'controls-grid'});
  const controlsEls={};
  topic.controls.forEach(function(c){
    if(c.type==='select'){
      const sel=el('select',{});
      c.options.forEach(function(opt){
        const o=document.createElement('option'); o.value=opt[0]; o.textContent=opt[1];
        if(opt[0]===c.def) o.selected=true;
        sel.appendChild(o);
      });
      sel.addEventListener('change',function(e){
        state[c.key]=e.target.value;
        handleChange(c.key,state[c.key],null);
      });
      const wrap=el('div',{class:'ctrl'},[el('label',{},[el('b',{},[c.label])]), sel]);
      controlsGrid.appendChild(wrap);
      controlsEls[c.key]={input:sel, valSpan:null};
    } else {
      const valSpan=el('span',{class:'val'},[fmt(c.def,2)+' '+c.unit]);
      const label=el('label',{},[el('b',{},[c.label]), valSpan]);
      const input=el('input',{type:'range', min:c.min, max:c.max, step:c.step, value:c.def});
      input.addEventListener('input',function(e){
        const old=state[c.key];
        const val=parseFloat(e.target.value);
        state[c.key]=val;
        valSpan.textContent=fmt(val,2)+' '+c.unit;
        handleChange(c.key,val,old);
      });
      const wrap=el('div',{class:'ctrl'},[label,input]);
      controlsGrid.appendChild(wrap);
      controlsEls[c.key]={input:input, valSpan:valSpan};
    }
  });
  const controlsPanel=el('div',{class:'panel controls-panel'},[
    el('p',{class:'panel-title'},['Controles']),
    controlsGrid
  ]);
  root.appendChild(controlsPanel);

  // graphs panel
  const graphsGrid=el('div',{class:'graphs-grid'});
  const miniGraphs={};
  topic.graphs.forEach(function(g){
    const c=el('canvas',{});
    const box=el('div',{class:'graph-box'},[c]);
    graphsGrid.appendChild(box);
    miniGraphs[g.key]=createMiniGraph(c, cssVar(g.color), g.label, g.unit);
  });
  const graphsPanel=el('div',{class:'panel graphs-panel'},[
    el('p',{class:'panel-title'},['Gráficos em tempo real']),
    graphsGrid
  ]);
  root.appendChild(graphsPanel);

  // bottom: examples + challenge
  const bottomGrid=el('div',{class:'bottom-grid'},[
    el('div',{class:'panel'},[
      el('p',{class:'panel-title'},['Exemplos práticos']),
      el('ul',{class:'ex-list'}, topic.examples.map(function(x){ return el('li',{},[x]); }))
    ]),
    el('div',{class:'panel challenge-box'},[
      el('span',{class:'lbl'},['Desafio']),
      el('p',{},[topic.challenge])
    ])
  ]);
  root.appendChild(bottomGrid);

  // sizing
  function fitCanvas(){
    const cssW=sceneWrap.clientWidth;
    const cssH=Math.round(cssW*0.5);
    if(scene.width!==cssW*2 || scene.height!==cssH*2){
      scene.width=cssW; scene.height=cssH;
      scene.style.height=cssH+'px';
    }
  }
  setTimeout(fitCanvas,0);
  window.addEventListener('resize', fitCanvas);

  const ctx=scene.getContext('2d');

  function renderReadouts(){
    readoutsBox.innerHTML='';
    topic.readouts(state).forEach(function(r){
      readoutsBox.appendChild(el('div',{},[el('span',{},[r[0]]), el('b',{},[r[1]+' '+r[2]])]));
    });
  }
  function renderScene(){
    fitCanvas();
    ctx.clearRect(0,0,scene.width,scene.height);
    topic.draw(ctx,scene.width,scene.height,state);
    renderReadouts();
  }
  function renderGraphs(){
    const vals=topic.graphValues(state);
    Object.keys(miniGraphs).forEach(function(k){
      miniGraphs[k].push(vals.t, vals[k]);
      miniGraphs[k].draw();
    });
  }
  function clearGraphs(){
    Object.keys(miniGraphs).forEach(function(k){ miniGraphs[k].clear(); miniGraphs[k].draw(); });
  }

  const runner=createRunner(function(dt){
    topic.step(state,dt);
    renderScene();
    renderGraphs();
  });
  currentRunner=runner;

  btnPlay.addEventListener('click',function(){ runner.start(); });
  btnPause.addEventListener('click',function(){ runner.pause(); });
  btnReset.addEventListener('click',function(){
    runner.pause();
    topic.reset(state);
    clearGraphs();
    renderScene();
  });
  btnFormula.addEventListener('click',function(){
    formulaMode=!formulaMode;
    btnFormula.classList.toggle('on',formulaMode);
  });

  function flashVar(sym,dir){
    if(!dir) return;
    const span=infoPanel.querySelector('[data-var="'+sym+'"]');
    if(!span) return;
    span.classList.remove('flash-up','flash-down');
    void span.offsetWidth;
    span.classList.add(dir>0?'flash-up':'flash-down');
    clearTimeout(span._t);
    span._t=setTimeout(function(){ span.classList.remove('flash-up','flash-down'); },900);
  }

  function handleChange(key,val,old){
    if(topic.id==='ohm'){
      topic.afterChange(state,controlsEls);
    }
    if(formulaMode && old!==null && old!==undefined && key!=='target'){
      const userDir = val>old?1:(val<old?-1:0);
      flashVar(key,userDir);
      if(topic.id==='ohm'){
        if(userDir!==0 && key!==state.target){
          const ohmDir=(state.target==='V')?1:(state.target==='R'?(key==='V'?1:-1):(key==='V'?1:-1));
          flashVar(state.target, userDir*ohmDir);
        }
      } else {
        const rel=topic.relations && topic.relations[key];
        if(rel && userDir!==0) flashVar(rel.result, userDir*rel.dir);
      }
    }
    if(!runner.running){
      topic.reset(state);
      clearGraphs();
      renderScene();
    }
  }

  if(topic.id==='ohm') topic.afterChange(state,controlsEls);
  renderScene();
  setActive('screen-topic');
}

/* =========================================================================
   HOME SCREEN BUILD + HERO DEMO
========================================================================= */
function buildHome(){
  const grid=document.getElementById('cat-grid');
  CATEGORIES.forEach(function(cat){
    const card=el('button',{class:'cat-card', onclick:function(){ showCategory(cat.id); }},[
      el('div',{class:'icon'},[cat.icon]),
      el('h3',{},[cat.name]),
      el('p',{},[cat.desc]),
      el('div',{class:'count'},[cat.topics.length+' simulaç'+(cat.topics.length>1?'ões':'ão')])
    ]);
    grid.appendChild(card);
  });
}
buildHome();

/* hero decorative demo: small free-fall bounce */
(function(){
  const canvas=document.getElementById('hero-canvas');
  function size(){ canvas.width=canvas.clientWidth; canvas.height=canvas.clientHeight; }
  size(); window.addEventListener('resize',size);
  const ctx=canvas.getContext('2d');
  let h0=1, y=h0, v=0, g=9.8;
  let last=null;
  function frame(now){
    if(!last) last=now;
    let dt=(now-last)/1000; last=now; dt=Math.min(dt,0.05);
    v+=g*dt; y-=v*dt;
    if(y<=0){ y=0; v=-v*0.62; if(Math.abs(v)<0.6){ y=h0; v=0; } }
    const w=canvas.width,hh=canvas.height;
    ctx.clearRect(0,0,w,hh);
    const topY=30, groundY=hh-24;
    ctx.strokeStyle='rgba(255,255,255,.08)'; ctx.setLineDash([3,5]); ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(w/2,topY); ctx.lineTo(w/2,groundY); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle='#223040'; ctx.beginPath(); ctx.moveTo(0,groundY); ctx.lineTo(w,groundY); ctx.stroke();
    const by=groundY-(y/h0)*(groundY-topY);
    const grad=ctx.createRadialGradient(w/2,by,2,w/2,by,16);
    grad.addColorStop(0,'#bffbf3'); grad.addColorStop(1,'#4ce0d2');
    ctx.fillStyle=grad; ctx.beginPath(); ctx.arc(w/2,by,11,0,7); ctx.fill();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
