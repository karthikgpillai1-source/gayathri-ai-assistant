// Initialize Lucide Icons
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) {
    window.lucide.createIcons();
  }
  initShaderCanvas();
});

// Background WebGL Shader Canvas Setup
function initShaderCanvas() {
  const canvas = document.getElementById('shaderCanvas');
  if (!canvas) return;
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) return;

  let mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  const vs = `attribute vec2 a_position;
varying vec2 v_texCoord;
void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;
  
  const fs = `precision highp float;
varying vec2 v_texCoord;
uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;

void main() {
    vec2 uv = v_texCoord;
    vec3 color1 = vec3(0.02, 0.03, 0.12); // Deep Indigo
    vec3 color2 = vec3(0.07, 0.15, 0.45);  // Royal Blue
    vec3 color3 = vec3(0.0, 0.45, 0.55);  // Soft Cyan
    
    vec2 mouseNorm = u_mouse / u_resolution;
    float distToMouse = length(uv - mouseNorm);
    float mouseWave = sin(distToMouse * 10.0 - u_time * 2.0) * 0.1 / (1.0 + distToMouse * 5.0);
    
    float noise1 = sin((uv.x + mouseWave) * 3.0 + u_time * 0.3) * 0.5 + 0.5;
    float noise2 = cos((uv.y - mouseWave) * 2.0 - u_time * 0.2) * 0.5 + 0.5;
    
    vec3 color = mix(color1, color2, noise1);
    color = mix(color, color3, noise2 * 0.4);
    
    float vignette = 1.0 - length(uv - 0.5) * 0.6;
    gl_FragColor = vec4(color * vignette, 1.0);
}`;

  function cs(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, cs(gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, cs(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  const pos = gl.getAttribLocation(prog, 'a_position');
  gl.enableVertexAttribArray(pos);
  gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

  const uTime = gl.getUniformLocation(prog, 'u_time');
  const uRes = gl.getUniformLocation(prog, 'u_resolution');
  const uMouse = gl.getUniformLocation(prog, 'u_mouse');

  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = window.innerHeight - e.clientY;
  });

  function render(t) {
    gl.viewport(0, 0, canvas.width, canvas.height);
    if (uTime) gl.uniform1f(uTime, t * 0.001);
    if (uRes) gl.uniform2f(uRes, canvas.width, canvas.height);
    if (uMouse) gl.uniform2f(uMouse, mouse.x, mouse.y);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(render);
  }
  render(0);
}

// Synthesized Chimes Setup
let audioCtx = null;
function playSynthSound(freq, type, duration) {
  if (document.getElementById('soundToggleCheckbox') && !document.getElementById('soundToggleCheckbox').checked) return;
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {
    console.warn("Audio Context blocked or unsupported:", e);
  }
}

// Speech Synthesizer
let isVoiceEnabled = false;
const synth = window.speechSynthesis;
function speakSpeech(text) {
  if (!isVoiceEnabled || !synth) return;
  synth.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.pitch = 1.05;
  utter.rate = 1.0;
  synth.speak(utter);
}

// Global Toast System
function showToast(title, desc, status) {
  const container = document.getElementById('toastContainer') || createToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast ${status || 'info'}`;
  
  let iconName = "info";
  if (status === 'success') iconName = "check-circle";
  if (status === 'warning') iconName = "alert-triangle";
  if (status === 'error') iconName = "alert-circle";
  
  toast.innerHTML = `
    <i data-lucide="${iconName}"></i>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-desc">${desc}</div>
    </div>
    <button class="toast-close" style="background:none; border:none; color:var(--text-muted); cursor:pointer; padding:0.25rem; margin-top:-0.25rem; margin-right:-0.5rem; display:flex; align-items:center; justify-content:center;"><i data-lucide="x" style="width:16px; height:16px;"></i></button>
  `;
  container.appendChild(toast);
  if (window.lucide) {
    window.lucide.createIcons();
  }

  const closeBtn = toast.querySelector('.toast-close');
  let dismissed = false;

  const dismissToast = () => {
    if (dismissed) return;
    dismissed = true;
    toast.style.animation = 'slideOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  };

  closeBtn.addEventListener('click', dismissToast);
  
  setTimeout(dismissToast, 4000);
}

function createToastContainer() {
  const el = document.createElement('div');
  el.id = 'toastContainer';
  el.className = 'toast-container';
  document.body.appendChild(el);
  return el;
}
