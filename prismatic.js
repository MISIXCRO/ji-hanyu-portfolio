/* PrismaticBurst shader adapted from the React Bits source supplied by the user.
 * Copyright (c) 2026 David Haz. MIT + Commons Clause; see THIRD_PARTY_NOTICES.txt.
 * One native WebGL2 renderer is shared by the page and its native modal dialogs.
 */
(() => {
  'use strict';
  const host = document.querySelector('.prismatic-background');
  if (!host) return;
  const canvas = document.createElement('canvas');
  let gl;
  try { gl = canvas.getContext('webgl2', { alpha:false, antialias:false, depth:false, stencil:false, powerPreference:'low-power', preserveDrawingBuffer:false }); } catch { /* CSS still background remains. */ }
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const listeners = new AbortController();
  const vertex = `#version 300 es
in vec2 position;
in vec2 uv;
out vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
}
`;
  const fragment = `#version 300 es
precision highp float;
precision highp int;

out vec4 fragColor;

uniform vec2  uResolution;
uniform float uTime;

uniform float uIntensity;
uniform float uSpeed;
uniform int   uAnimType;
uniform vec2  uMouse;
uniform int   uColorCount;
uniform float uDistort;
uniform vec2  uOffset;
uniform sampler2D uGradient;
uniform float uNoiseAmount;
uniform int   uRayCount;
uniform float uLightMode;

float hash21(vec2 p){
    p = floor(p);
    float f = 52.9829189 * fract(dot(p, vec2(0.065, 0.005)));
    return fract(f);
}

mat2 rot30(){ return mat2(0.8, -0.5, 0.5, 0.8); }

float layeredNoise(vec2 fragPx){
    vec2 p = mod(fragPx + vec2(uTime * 30.0, -uTime * 21.0), 1024.0);
    vec2 q = rot30() * p;
    float n = 0.0;
    n += 0.40 * hash21(q);
    n += 0.25 * hash21(q * 2.0 + 17.0);
    n += 0.20 * hash21(q * 4.0 + 47.0);
    n += 0.10 * hash21(q * 8.0 + 113.0);
    n += 0.05 * hash21(q * 16.0 + 191.0);
    return n;
}

vec3 rayDir(vec2 frag, vec2 res, vec2 offset, float dist){
    float focal = res.y * max(dist, 1e-3);
    return normalize(vec3(2.0 * (frag - offset) - res, focal));
}

float edgeFade(vec2 frag, vec2 res, vec2 offset){
    vec2 toC = frag - 0.5 * res - offset;
    float r = length(toC) / (0.5 * min(res.x, res.y));
    float x = clamp(r, 0.0, 1.0);
    float q = x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
    float s = q * 0.5;
    s = pow(s, 1.5);
    float tail = 1.0 - pow(1.0 - s, 2.0);
    s = mix(s, tail, 0.2);
    float dn = (layeredNoise(frag * 0.15) - 0.5) * 0.0015 * s;
    return clamp(s + dn, 0.0, 1.0);
}

mat3 rotX(float a){ float c = cos(a), s = sin(a); return mat3(1.0,0.0,0.0, 0.0,c,-s, 0.0,s,c); }
mat3 rotY(float a){ float c = cos(a), s = sin(a); return mat3(c,0.0,s, 0.0,1.0,0.0, -s,0.0,c); }
mat3 rotZ(float a){ float c = cos(a), s = sin(a); return mat3(c,-s,0.0, s,c,0.0, 0.0,0.0,1.0); }

vec3 sampleGradient(float t){
    t = clamp(t, 0.0, 1.0);
    return texture(uGradient, vec2(t, 0.5)).rgb;
}

vec2 rot2(vec2 v, float a){
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c) * v;
}

float bendAngle(vec3 q, float t){
    float a = 0.8 * sin(q.x * 0.55 + t * 0.6)
            + 0.7 * sin(q.y * 0.50 - t * 0.5)
            + 0.6 * sin(q.z * 0.60 + t * 0.7);
    return a;
}

void main(){
    vec2 frag = gl_FragCoord.xy;
    float t = uTime * uSpeed;
    float jitterAmp = 0.1 * clamp(uNoiseAmount, 0.0, 1.0);
    vec3 dir = rayDir(frag, uResolution, uOffset, 1.0);
    float marchT = 0.0;
    vec3 col = vec3(0.0);
    float n = layeredNoise(frag);
    vec4 c = cos(t * 0.2 + vec4(0.0, 33.0, 11.0, 0.0));
    mat2 M2 = mat2(c.x, c.y, c.z, c.w);
    float amp = clamp(uDistort, 0.0, 50.0) * 0.15;

    mat3 rot3dMat = mat3(1.0);
    if(uAnimType == 1){
      vec3 ang = vec3(t * 0.31, t * 0.21, t * 0.17);
      rot3dMat = rotZ(ang.z) * rotY(ang.y) * rotX(ang.x);
    }
    mat3 hoverMat = mat3(1.0);
    if(uAnimType == 2){
      vec2 m = uMouse * 2.0 - 1.0;
      vec3 ang = vec3(m.y * 0.6, m.x * 0.6, 0.0);
      hoverMat = rotY(ang.y) * rotX(ang.x);
    }

    for (int i = 0; i < 44; ++i) {
        vec3 P = marchT * dir;
        P.z -= 2.0;
        float rad = length(P);
        vec3 Pl = P * (10.0 / max(rad, 1e-6));

        if(uAnimType == 0){
            Pl.xz *= M2;
        } else if(uAnimType == 1){
      Pl = rot3dMat * Pl;
        } else {
      Pl = hoverMat * Pl;
        }

        float stepLen = min(rad - 0.3, n * jitterAmp) + 0.1;

        float grow = smoothstep(0.35, 3.0, marchT);
        float a1 = amp * grow * bendAngle(Pl * 0.6, t);
        float a2 = 0.5 * amp * grow * bendAngle(Pl.zyx * 0.5 + 3.1, t * 0.9);
        vec3 Pb = Pl;
        Pb.xz = rot2(Pb.xz, a1);
        Pb.xy = rot2(Pb.xy, a2);

        float rayPattern = smoothstep(
            0.5, 0.7,
            sin(Pb.x + cos(Pb.y) * cos(Pb.z)) *
            sin(Pb.z + sin(Pb.y) * cos(Pb.x + t))
        );

        if (uRayCount > 0) {
            float ang = atan(Pb.y, Pb.x);
            float comb = 0.5 + 0.5 * cos(float(uRayCount) * ang);
            comb = pow(comb, 3.0);
            rayPattern *= smoothstep(0.15, 0.95, comb);
        }

        vec3 spectralDefault = 1.0 + vec3(
            cos(marchT * 3.0 + 0.0),
            cos(marchT * 3.0 + 1.0),
            cos(marchT * 3.0 + 2.0)
        );

        float saw = fract(marchT * 0.25);
        float tRay = saw * saw * (3.0 - 2.0 * saw);
        vec3 userGradient = 2.0 * sampleGradient(tRay);
        vec3 spectral = (uColorCount > 0) ? userGradient : spectralDefault;
        vec3 base = (0.05 / (0.4 + stepLen))
                  * (1.0 - smoothstep(0.0, 5.0, rad))
                  * spectral;

        col += base * rayPattern;
        marchT += stepLen;
    }

    col *= edgeFade(frag, uResolution, uOffset);
    col *= uIntensity;

    col = clamp(col, 0.0, 1.0);
    if (uLightMode > 0.5) {
        float energy = max(max(col.r, col.g), col.b);
        vec3 hue = col / max(energy, 0.0001);
        float neutral = min(hue.r, min(hue.g, hue.b));
        hue = max(hue - vec3(neutral * 0.68), vec3(0.0));
        hue /= max(max(hue.r, max(hue.g, hue.b)), 0.0001);
        vec3 pigment = mix(hue, hue * hue, 0.24) * 0.64;
        float coverage = smoothstep(0.001, 0.32, energy);
        coverage = pow(coverage, 0.72) * 0.92;
        col = mix(vec3(1.0), pigment, coverage);
    }
    // Keep bright rays below the text-contrast ceiling without flattening the shadows.
    if (uLightMode < 0.5) {
        col = min(col, vec3(0.26)) + 0.12 * (1.0 - exp(-max(col - 0.26, vec3(0.0)) / 0.12));
    }
    fragColor = vec4(col, 1.0);
}`;
  const settings = { uIntensity:1.1, uSpeed:.4, uDistort:1, uNoiseAmount:.8, uLightMode:0 };
  const colors = ['#ff007a', '#4d3dff', '#ffffff'];
  const shaders = [];
  let program, buffer, vertexArray, texture, timeLocation, resolutionLocation;
  let raf=0, previousStamp=0, elapsed=6.5, lost=false, pageAway=false;
  let openDialogs = [...document.querySelectorAll('dialog[open]')];
  const hexToRgb = hex => [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));

  function mount() {
    const target = openDialogs.at(-1) || document.body;
    if (host.parentElement !== target) target.prepend(host);
  }
  // Moving the same field into the native top layer avoids a new black panel,
  // duplicated GPU contexts or a phase reset when a viewer opens and closes.
  const dialogObserver = new MutationObserver(records => {
    for (const {target} of records) {
      openDialogs = openDialogs.filter(dialog => dialog !== target && dialog.open);
      if (target.open) openDialogs.push(target);
    }
    mount();
  });
  document.querySelectorAll('dialog').forEach(dialog=>dialogObserver.observe(dialog,{attributes:true,attributeFilter:['open']}));
  mount();
  if (!gl) {
    host.dataset.state='fallback';
    window.addEventListener('pagehide',event=>{if(!event.persisted)dialogObserver.disconnect()},{once:true});
    return;
  }

  function release() {
    if (buffer) gl.deleteBuffer(buffer);
    if (vertexArray) gl.deleteVertexArray(vertexArray);
    if (texture) gl.deleteTexture(texture);
    if (program) gl.deleteProgram(program);
    for (const shader of shaders.splice(0)) gl.deleteShader(shader);
    buffer=vertexArray=texture=program=null;
  }
  function compile(type, source) {
    const shader=gl.createShader(type);shaders.push(shader);
    gl.shaderSource(shader,source);gl.compileShader(shader);
    if (!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw Error('Prismatic shader unavailable');
    return shader;
  }
  function setup() {
    program=gl.createProgram();
    gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));
    gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program,gl.LINK_STATUS)) throw Error('Prismatic program unavailable');
    gl.useProgram(program);
    vertexArray=gl.createVertexArray();gl.bindVertexArray(vertexArray);
    buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
    const position=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
    for (const [name,value] of Object.entries(settings)) gl.uniform1f(gl.getUniformLocation(program,name),value);
    gl.uniform1i(gl.getUniformLocation(program,'uAnimType'),1);
    gl.uniform1i(gl.getUniformLocation(program,'uRayCount'),24);
    gl.uniform1i(gl.getUniformLocation(program,'uColorCount'),colors.length);
    gl.uniform2f(gl.getUniformLocation(program,'uMouse'),.5,.5);
    gl.uniform2f(gl.getUniformLocation(program,'uOffset'),0,0);
    texture=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);
    const gradient=new Uint8Array(colors.flatMap(color=>[...hexToRgb(color),255]));
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,colors.length,1,0,gl.RGBA,gl.UNSIGNED_BYTE,gradient);
    for(const filter of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,filter,gl.LINEAR);
    for(const wrap of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,wrap,gl.CLAMP_TO_EDGE);
    gl.uniform1i(gl.getUniformLocation(program,'uGradient'),0);
    timeLocation=gl.getUniformLocation(program,'uTime');resolutionLocation=gl.getUniformLocation(program,'uResolution');
    gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.disable(gl.BLEND);
  }
  function draw() {
    if(lost||!program)return;
    gl.viewport(0,0,canvas.width,canvas.height);
    gl.uniform2f(resolutionLocation,canvas.width,canvas.height);gl.uniform1f(timeLocation,elapsed);
    gl.drawArrays(gl.TRIANGLES,0,3);
  }
  function resize() {
    const {width,height}=host.getBoundingClientRect();
    const budget=matchMedia('(pointer:fine)').matches?320000:180000;
    const dpr=Math.min(devicePixelRatio||1,1.5,Math.sqrt(budget/Math.max(1,width*height)));
    const w=Math.max(1,Math.floor(width*dpr)),h=Math.max(1,Math.floor(height*dpr));
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}
    draw();
  }
  function stop(){if(raf)cancelAnimationFrame(raf);raf=previousStamp=0}
  function canAnimate(){return !lost&&!pageAway&&!document.hidden&&!motion.matches}
  function frame(stamp){
    raf=0;if(!canAnimate())return;
    if(!previousStamp||stamp-previousStamp>=1000/24){
      if(previousStamp)elapsed+=Math.min((stamp-previousStamp)/1000,.2);
      previousStamp=stamp;draw();
    }
    raf=requestAnimationFrame(frame);
  }
  function sync(){
    stop();if(lost||!program)return;
    draw();host.dataset.state=motion.matches?'still':canAnimate()?'animating':'paused';
    if(canAnimate())raf=requestAnimationFrame(frame);
  }
  try{setup();resize()}catch{release();host.dataset.state='fallback';return}
  host.append(canvas);
  const observer=new ResizeObserver(resize);observer.observe(host);
  motion.addEventListener('change',sync,{signal:listeners.signal});
  document.addEventListener('visibilitychange',sync,{signal:listeners.signal});
  canvas.addEventListener('webglcontextlost',event=>{
    event.preventDefault();lost=true;stop();canvas.hidden=true;host.dataset.state='fallback';
    // The lost context has already discarded its GPU objects.
    buffer=vertexArray=texture=program=null;shaders.length=0;
  },{signal:listeners.signal});
  canvas.addEventListener('webglcontextrestored',()=>{
    lost=false;try{setup();resize();canvas.hidden=false;sync()}catch{release();lost=true;host.dataset.state='fallback'}
  },{signal:listeners.signal});
  window.addEventListener('pagehide',event=>{
    pageAway=true;stop();
    if(!event.persisted){observer.disconnect();dialogObserver.disconnect();listeners.abort();release()}
  },{signal:listeners.signal});
  window.addEventListener('pageshow',()=>{pageAway=false;sync()},{signal:listeners.signal});
  sync();
})();
