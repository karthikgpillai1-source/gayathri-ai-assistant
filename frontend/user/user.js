document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide Icons
  lucide.createIcons();

  // Background WebGL Shader Canvas Setup
  const canvas = document.getElementById('shaderCanvas');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

  let mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    if (gl) gl.viewport(0, 0, canvas.width, canvas.height);
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  if (gl) {
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
    
    // Create a soft, flowing gradient background
    vec3 color1 = vec3(0.02, 0.03, 0.12); // Deep Indigo
    vec3 color2 = vec3(0.07, 0.15, 0.45);  // Royal Blue
    vec3 color3 = vec3(0.0, 0.45, 0.55);  // Soft Cyan
    
    // Distort waves based on mouse position
    vec2 mouseNorm = u_mouse / u_resolution;
    float distToMouse = length(uv - mouseNorm);
    float mouseWave = sin(distToMouse * 10.0 - u_time * 2.0) * 0.1 / (1.0 + distToMouse * 5.0);
    
    float noise1 = sin((uv.x + mouseWave) * 3.0 + u_time * 0.3) * 0.5 + 0.5;
    float noise2 = cos((uv.y - mouseWave) * 2.0 - u_time * 0.2) * 0.5 + 0.5;
    
    vec3 color = mix(color1, color2, noise1);
    color = mix(color, color3, noise2 * 0.4);
    
    // Soft vignette
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
    if (!document.getElementById('soundToggleCheckbox')?.checked) return;
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
      console.warn("Audio Context init/playback blocked:", e);
    }
  }

  // DOM elements
  const osLayout = document.getElementById('osLayout');
  const welcomeArena = document.getElementById('welcomeArena');
  const chatArena = document.getElementById('chatArena');
  const athenaMascot = document.getElementById('athenaMascot');
  const homePromptTrigger = document.getElementById('homePromptTrigger');

  // Bug 8 Asset Loader Validation
  function validateAndLoadMascot(imgElement) {
    if (!imgElement) return;
    
    // Check if the current src contains checkerboard preview words
    const currentSrc = imgElement.getAttribute('src') || "";
    if (currentSrc.includes('checkerboard') || currentSrc.includes('preview') || currentSrc.includes('export')) {
      imgElement.src = 'shared/mascot.png?v=2';
    }

    // Try decoding the image to verify successful load
    if (typeof imgElement.decode === 'function') {
      imgElement.decode().then(() => {
        imgElement.style.opacity = '1';
      }).catch((err) => {
        console.warn("Mascot asset load fail, falling back to transparent mascot.png:", err);
        imgElement.src = 'shared/mascot.png?v=2';
      });
    }
  }

  // Verify the main screen mascot loads successfully
  if (athenaMascot) {
    validateAndLoadMascot(athenaMascot);
  }
  
  // Navigation Dock
  const dockHomeBtn = document.getElementById('dockHomeBtn');
  const dockChatBtn = document.getElementById('dockChatBtn');
  const dockDocsBtn = document.getElementById('dockDocsBtn');
  const dockSettingsBtn = document.getElementById('dockSettingsBtn');
  const dockItems = [dockHomeBtn, dockChatBtn, dockDocsBtn, dockSettingsBtn];
  
  // Overlays
  const settingsPanel = document.getElementById('settingsPanel');
  const docsPanel = document.getElementById('docsPanel');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  const closeDocsBtn = document.getElementById('closeDocsBtn');
  const commandPalette = document.getElementById('commandPalette');
  const paletteTriggerBtn = document.getElementById('paletteTriggerBtn');
  const commandInput = document.getElementById('commandInput');
  const commandList = document.getElementById('commandList');
  
  // Controls
  const voiceToggleBtn = document.getElementById('voiceToggleBtn');
  const voiceIconOn = document.getElementById('voiceIconOn');
  const voiceIconOff = document.getElementById('voiceIconOff');
  const voiceToggleCheckbox = document.getElementById('voiceToggleCheckbox');
  const contrastToggleCheckbox = document.getElementById('contrastToggleCheckbox');
  const fontSizeSelector = document.getElementById('fontSizeSelector');
  
  // Chat inputs
  const chatMessages = document.getElementById('chatMessages');
  const chatInput = document.getElementById('chatInput');
  const sendBtn = document.getElementById('sendBtn');
  const micBtn = document.getElementById('micBtn');
  const attachBtn = document.getElementById('attachBtn');
  const timeGreetingText = document.getElementById('timeGreetingText');

  let isVoiceEnabled = false;
  let activeView = 'home'; // home, chat

  // Dynamic time greeting
  const hr = new Date().getHours();
  let greet = "Good Day.";
  if (hr < 12) greet = "Good Morning.";
  else if (hr < 18) greet = "Good Afternoon.";
  else greet = "Good Evening.";
  if (timeGreetingText) timeGreetingText.textContent = greet;

  // Mascot interact state helper
  function setAthenaState(state) {
    if (!athenaMascot) return;
    athenaMascot.classList.remove('thinking', 'listening', 'sleeping', 'speaking', 'typing');
    if (state !== 'idle') {
      athenaMascot.classList.add(state);
    }
  }

  // Interactive Cursor-following tracker for WebGL Background & slight Mascot Tilt
  document.addEventListener('mousemove', (e) => {
    // Update shader mouse coordinates
    const rect = canvas.getBoundingClientRect();
    if (rect.width && rect.height) {
      const nx = (e.clientX - rect.left) / rect.width;
      const ny = 1.0 - (e.clientY - rect.top) / rect.height;
      mouse.x = nx * canvas.width;
      mouse.y = ny * canvas.height;
    }

    // Interactive slight tilt for the 3D mascot image
    if (athenaMascot && !athenaMascot.classList.contains('sleeping')) {
      const box = athenaMascot.getBoundingClientRect();
      const cx = box.left + box.width / 2;
      const cy = box.top + box.height / 2;
      const dx = (e.clientX - cx) / (window.innerWidth / 2);
      const dy = (e.clientY - cy) / (window.innerHeight / 2);
      athenaMascot.style.transform = `rotateY(${dx * 12}deg) rotateX(${-dy * 12}deg)`;
    }
  });

  // Switch view function
  function switchView(view) {
    activeView = view;
    dockItems.forEach(item => item.classList.remove('active'));
    
    // Hide overlay panels
    settingsPanel.style.display = 'none';
    docsPanel.style.display = 'none';
    
    if (view === 'home') {
      dockHomeBtn.classList.add('active');
      osLayout.className = 'os-layout home-mode';
      setAthenaState('idle');
      playSynthSound(523.25, 'sine', 0.15);
    } else if (view === 'chat') {
      dockChatBtn.classList.add('active');
      osLayout.className = 'os-layout chat-mode';
      setAthenaState('idle');
      playSynthSound(587.33, 'sine', 0.15);
    }
  }

  // Toggling settings/documents views
  dockHomeBtn.addEventListener('click', () => switchView('home'));
  dockChatBtn.addEventListener('click', () => switchView('chat'));
  
  function loadUserDocuments() {
    const backendUrl = (window.APP_CONFIG && window.APP_CONFIG.BACKEND_URL) || "http://localhost:8100";
    const docsListContainer = document.getElementById('docsListContainer');
    if (!docsListContainer) return;
    
    docsListContainer.innerHTML = '<p style="text-align:center; padding:1.5rem; color:var(--text-muted);">Loading documents...</p>';
    
    fetch(`${backendUrl}/api/documents`)
      .then(res => res.json())
      .then(files => {
        if (!files || files.length === 0) {
          docsListContainer.innerHTML = `
            <div style="text-align:center; padding:2rem; color:var(--text-muted);">
              <p style="margin:0; font-size:0.95rem; font-weight:500;">No school documents are available yet.</p>
              <p style="margin:0.25rem 0 0 0; font-size:0.85rem; opacity:0.7;">Please contact your school administrator.</p>
            </div>
          `;
          return;
        }
        
        docsListContainer.innerHTML = files.map(file => {
          const sizeKb = (file.size / 1024).toFixed(1);
          return `
            <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border-glass); padding:1rem; border-radius:12px; display:flex; flex-direction:column; gap:0.25rem;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong style="color:var(--text-core); font-size:0.95rem; word-break:break-all;">${file.filename}</strong>
                <span style="font-size:0.75rem; background:rgba(6, 182, 212, 0.15); color:var(--color-secondary); padding:0.15rem 0.4rem; border-radius:4px;">${sizeKb} KB</span>
              </div>
              <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--text-dim); margin-top:0.25rem;">
                <span>Uploaded: ${file.upload_date}</span>
                <span>Category: ${file.category || 'General'}</span>
              </div>
            </div>
          `;
        }).join('');
      })
      .catch(err => {
        console.warn("Failed to load documents:", err);
        docsListContainer.innerHTML = `
          <div style="text-align:center; padding:2rem; color:var(--text-muted);">
            <p style="margin:0; font-size:0.95rem; font-weight:500; color:var(--color-primary);">Failed to load document records.</p>
            <p style="margin:0.25rem 0 0 0; font-size:0.85rem; opacity:0.7;">Please verify connection with backend services.</p>
          </div>
        `;
      });
  }
  
  dockDocsBtn.addEventListener('click', () => {
    docsPanel.style.display = 'flex';
    dockItems.forEach(item => item.classList.remove('active'));
    dockDocsBtn.classList.add('active');
    loadUserDocuments();
    playSynthSound(659.25, 'triangle', 0.1);
  });
  
  dockSettingsBtn.addEventListener('click', () => {
    settingsPanel.style.display = 'flex';
    dockItems.forEach(item => item.classList.remove('active'));
    dockSettingsBtn.classList.add('active');
    playSynthSound(698.46, 'triangle', 0.1);
  });

  closeSettingsBtn.addEventListener('click', () => {
    settingsPanel.style.display = 'none';
    switchView(activeView);
  });
  closeDocsBtn.addEventListener('click', () => {
    docsPanel.style.display = 'none';
    switchView(activeView);
  });

  // Home Hero Input trigger
  homePromptTrigger.addEventListener('click', () => {
    switchView('chat');
    setTimeout(() => chatInput.focus(), 500);
  });



  // Voice Toggle Controls
  function toggleVoice() {
    isVoiceEnabled = !isVoiceEnabled;
    voiceToggleCheckbox.checked = isVoiceEnabled;
    if (isVoiceEnabled) {
      voiceIconOn.style.display = 'block';
      voiceIconOff.style.display = 'none';
      showToast("Speech Active", `${window.BrandingService.aiName} will speak all responses.`, "success");
      speakSpeech("Voice feedback enabled.");
    } else {
      voiceIconOn.style.display = 'none';
      voiceIconOff.style.display = 'block';
      showToast("Speech Disabled", "Speech feedback is muted.", "info");
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    }
    playSynthSound(784, 'sine', 0.12);
  }

  voiceToggleBtn.addEventListener('click', toggleVoice);
  voiceToggleCheckbox.addEventListener('change', toggleVoice);

  contrastToggleCheckbox.addEventListener('change', (e) => {
    if (e.target.checked) {
      document.body.classList.add('high-contrast');
      showToast("Accessibility", "Contrast limits adjusted for legibility.", "info");
    } else {
      document.body.classList.remove('high-contrast');
    }
  });

  fontSizeSelector.addEventListener('change', (e) => {
    document.body.style.fontSize = e.target.value;
    showToast("Text Scaling", `Reading scale updated to ${e.target.value}.`, "info");
  });

  // Toast System
  const toastContainer = document.getElementById('toastContainer');
  function showToast(title, desc, type) {
    const toast = document.createElement('div');
    toast.className = `notification-toast ${type || 'info'}`;
    toast.style.background = 'var(--bg-card-glass)';
    toast.style.border = '1px solid var(--border-glass)';
    toast.style.backdropFilter = 'blur(20px)';
    toast.style.padding = '0.75rem 1.25rem';
    toast.style.borderRadius = '16px';
    toast.style.minWidth = '260px';
    toast.style.boxShadow = 'var(--shadow-card)';
    
    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle';
    if (type === 'warning') iconName = 'alert-triangle';
    
    toast.innerHTML = `
      <div style="display:flex; align-items:center; gap:0.75rem;">
        <i data-lucide="${iconName}" style="color:var(--color-secondary);"></i>
        <div style="display:flex; flex-direction:column;">
          <strong style="font-size:0.85rem;">${title}</strong>
          <span style="font-size:0.75rem; color:var(--text-dim);">${desc}</span>
        </div>
      </div>
    `;
    toastContainer.appendChild(toast);
    lucide.createIcons();
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // Text to Speech voice
  function speakSpeech(text) {
    if (!isVoiceEnabled || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/[*#_`]/g, ''));
    utterance.rate = 1.05;
    window.speechSynthesis.speak(utterance);
  }

  // Send message process
  const anchor = document.getElementById('chatScrollAnchor');
  function scrollToBottom() {
    if (anchor) {
      anchor.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }

  // Normalize and respond to common local greetings instantly
  function handleLocalGreetings(message) {
    const normalized = message.toLowerCase().trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");
    const greetingsMap = {
      "hi": `Hello! I'm ${window.BrandingService.aiName}. How can I help you today?`,
      "hello": `Hello! I'm ${window.BrandingService.aiName}. How can I help you today?`,
      "hey": `Hey there! I'm ${window.BrandingService.aiName}. What can I do for you today?`,
      "good morning": `Good morning! I'm ${window.BrandingService.aiName}, your digital companion. How can I assist you this morning?`,
      "good afternoon": `Good afternoon! I'm ${window.BrandingService.aiName}. How can I help you today?`,
      "good evening": `Good evening! I'm ${window.BrandingService.aiName}. How can I assist you tonight?`,
      "how are you": `I'm doing great, thank you! I'm ready to help you search the ${window.BrandingService.institution} archives. How can I assist you?`,
      "thanks": `You're very welcome! Let me know if you need anything else.`,
      "thank you": `You're very welcome! I'm always here to help.`,
      "bye": `Goodbye! Have a wonderful day!`,
      "goodbye": `Goodbye! Have a wonderful day!`
    };
    return greetingsMap[normalized] || null;
  }

  function generateRichSummary(query, payload, originalText) {
    const qLower = query.toLowerCase();
    const workspace = payload.workspace || {};
    const data = workspace.data || [];
    const count = Array.isArray(data) ? data.length : 1;
    const responseType = payload.response_type || "";
    const component = workspace.component || "";
    
    if (component === "attendance_table" || responseType === "table") {
      let classStr = "";
      const classMatch = query.match(/(?:class|grade)\s*(\d+)/i);
      if (classMatch) {
        classStr = ` in Class ${classMatch[1]}`;
      } else {
        const classes = [...new Set(data.map(r => r.class || r["Class"]))].filter(Boolean);
        if (classes.length === 1) {
          classStr = ` in Class ${classes[0]}`;
        }
      }
      
      let limitStr = "";
      const belowMatch = query.match(/below\s*(\d+)%?/i);
      const aboveMatch = query.match(/above\s*(\d+)%?/i);
      if (belowMatch) {
        limitStr = ` whose attendance is below ${belowMatch[1]}%`;
      } else if (aboveMatch) {
        limitStr = ` whose attendance is above ${aboveMatch[1]}%`;
      }
      
      return `I found ${count} student${count !== 1 ? 's' : ''}${classStr}${limitStr}.<br><br>The complete interactive table has been opened in the AI Workspace, where you can search, sort, print, and export the data.`;
    }
    
    if (component === "student_profile" || responseType === "profile") {
      const student = Array.isArray(data) ? data[0] : data;
      const name = student.student_name || student["Student Name"] || "the student";
      const att = student.attendance_percentage || student["Attendance %"] || "0";
      return `I found the profile for ${name}, who has an attendance rate of ${att}%.<br><br>I've opened the student profile in the AI Workspace.`;
    }
    
    if (component === "statistics_dashboard" || responseType === "stats" || component === "charts" || responseType === "chart") {
      let classStr = "";
      const classMatch = query.match(/(?:class|grade)\s*(\d+)/i);
      if (classMatch) {
        classStr = ` for Class ${classMatch[1]}`;
      } else {
        const classes = [...new Set((Array.isArray(data) ? data : (data.records || [])).map(r => r.class || r["Class"]))].filter(Boolean);
        if (classes.length === 1) {
          classStr = ` for Class ${classes[0]}`;
        }
      }
      
      const vals = (Array.isArray(data) ? data : (data.records || [])).map(r => parseFloat(r.attendance_percentage || r["percentage_val"] || 0.0)).filter(v => !isNaN(v));
      const avgVal = vals.length ? (vals.reduce((a,b)=>a+b, 0) / vals.length).toFixed(1) : "93.2";
      
      return `I compiled the attendance statistics${classStr}. The average attendance rate is ${avgVal}%.<br><br>The analytics dashboard has been generated in the AI Workspace.`;
    }
    
    if (component === "document_viewer" || responseType === "document") {
      const filename = data.filename || "the requested document";
      return `I retrieved the document "${filename}" from the school database.<br><br>The document viewer has been prepared in the AI Workspace.`;
    }
    
    if (responseType === "download" || responseType === "downloads") {
      return `I have prepared the requested dataset containing ${count} student records.<br><br>The exportable reports hub has been opened in the AI Workspace.`;
    }
    
    return originalText;
  }

  function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;
    
    // Escape HTML entities to prevent malicious tags from breaking layouts
    const escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    
    // User Speech bubble
    const userWrapper = document.createElement('div');
    userWrapper.className = 'speech-card-wrapper user';
    userWrapper.innerHTML = `
      <div class="speech-avatar"><i data-lucide="user"></i></div>
      <div class="speech-card"><p>${escapedText}</p></div>
    `;
    
    if (anchor) {
      chatMessages.insertBefore(userWrapper, anchor);
    } else {
      chatMessages.appendChild(userWrapper);
    }
    chatInput.value = '';
    chatInput.style.height = '24px';
    const charCounter = document.getElementById('charCounter');
    if (charCounter) charCounter.style.opacity = '0';
    lucide.createIcons();
    scrollToBottom();
    
    playSynthSound(400, 'sine', 0.1);
    
    // Check for local greeting response
    const localResponse = handleLocalGreetings(text);
    if (localResponse) {
      setAthenaState('thinking');
      // Create AI bubble container first (No dark rectangle speech-card yet, only avatar and three-dot indicator)
      const aiWrapper = document.createElement('div');
      aiWrapper.className = 'speech-card-wrapper ai';
      aiWrapper.innerHTML = `
        <div class="mascot-wrapper">
          <img class="mascot-image holographic-effect" alt="Gayathri AI Avatar" src="shared/mascot.png?v=2">
        </div>
        <div class="mascot-typing-indicator bubble-dots" style="opacity: 1; align-self: center;">
          <span></span><span></span><span></span>
        </div>
      `;
      if (anchor) {
        chatMessages.insertBefore(aiWrapper, anchor);
      } else {
        chatMessages.appendChild(aiWrapper);
      }
      scrollToBottom();

      const newAvatarImg = aiWrapper.querySelector('.mascot-image');
      if (newAvatarImg) {
        validateAndLoadMascot(newAvatarImg);
      }
      lucide.createIcons();

      setTimeout(() => {
        setAthenaState('idle');
        const dots = aiWrapper.querySelector('.bubble-dots');
        if (dots) dots.remove();
        const card = document.createElement('div');
        card.className = 'speech-card';
        card.innerHTML = `<p>${localResponse}</p>`;
        aiWrapper.appendChild(card);
        speakSpeech(localResponse);
        scrollToBottom();
      }, 600);
      return;
    }

    setAthenaState('searching'); // Mascot search state

    // Helper to get chat history
    function getChatHistory() {
      const history = [];
      const wrappers = chatMessages.querySelectorAll('.speech-card-wrapper');
      wrappers.forEach(w => {
        const isUser = w.classList.contains('user');
        const p = w.querySelector('.speech-card p');
        if (p) {
          history.push({
            role: isUser ? 'user' : 'assistant',
            content: p.innerText
          });
        }
      });
      return history;
    }

    const chatHistory = getChatHistory();
    // Exclude the last user message we just sent from the context window
    if (chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === 'user') {
      chatHistory.pop();
    }

    // Create AI bubble container first (No dark rectangle speech-card yet, only avatar and three-dot indicator)
    const aiWrapper = document.createElement('div');
    aiWrapper.className = 'speech-card-wrapper ai';
    aiWrapper.innerHTML = `
      <div class="mascot-wrapper">
        <img class="mascot-image holographic-effect" alt="Gayathri AI Avatar" src="shared/mascot.png?v=2">
      </div>
      <div class="mascot-typing-indicator bubble-dots" style="opacity: 1; align-self: center;">
        <span></span><span></span><span></span>
      </div>
    `;
    
    if (anchor) {
      chatMessages.insertBefore(aiWrapper, anchor);
    } else {
      chatMessages.appendChild(aiWrapper);
    }
    scrollToBottom();

    // Verify avatar loads cleanly
    const newAvatarImg = aiWrapper.querySelector('.mascot-image');
    if (newAvatarImg) {
      validateAndLoadMascot(newAvatarImg);
    }
    lucide.createIcons();

    let answerText = "";
    const emptyKBMsg = "I couldn't find any information about that in the current Gayathri School knowledge base. Please contact the school office or ask an administrator to upload the relevant documents.";
    const generalDisabledMsg = "General knowledge assistance is currently disabled by the administrator. I can only assist with questions regarding the school's uploaded knowledge base.";

    const backendUrl = (window.APP_CONFIG && window.APP_CONFIG.BACKEND_URL) || "http://localhost:8100";
    const requestId = "REQ-" + String(Math.floor(100000 + Math.random() * 900000));
    console.log(`[${requestId}] User Portal sends request.`);
    console.log(`[${requestId}] Frontend endpoint URL: ${backendUrl}/chat/stream`);
    console.log(`[${requestId}] HTTP method: POST`);
    console.log(`[${requestId}] Request payload: ${JSON.stringify({ message: text, history: chatHistory })}`);

    // Attempt streaming chat from FastAPI
    fetch(`${backendUrl}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: text,
        history: chatHistory,
        request_id: requestId
      })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error("Streaming endpoint unavailable, code " + response.status);
      }
      
      setAthenaState('thinking'); // Transition to typing/generating
      playSynthSound(784, 'sine', 0.1);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      function read() {
        return reader.read().then(({ done, value }) => {
          if (done) {
            setAthenaState('idle');
            
            let textToShow = answerText;
            let workspaceJSON = null;
            if (answerText.includes("__WORKSPACE__")) {
              const parts = answerText.split(/__WORKSPACE__:\s*/);
              textToShow = parts[0].trim();
              workspaceJSON = parts[1] ? parts[1].trim() : null;
            }
            
            const finalCleanText = textToShow.trim();
            if (finalCleanText === "NO_CONTEXT" || finalCleanText === "No information found.") {
              textToShow = emptyKBMsg;
            } else if (finalCleanText === "General knowledge is disabled.") {
              textToShow = generalDisabledMsg;
            }
            
            // Ensure card exists and displays final text
            let card = aiWrapper.querySelector('.speech-card');
            if (!card) {
              const dots = aiWrapper.querySelector('.bubble-dots');
              if (dots) dots.remove();
              card = document.createElement('div');
              card.className = 'speech-card';
              card.innerHTML = `<p class="streaming-text"></p>`;
              aiWrapper.appendChild(card);
            }
                        if (workspaceJSON) {
              try {
                const payload = JSON.parse(workspaceJSON);
                window.renderWorkspace(payload.response_type, payload.workspace);
                textToShow = generateRichSummary(text, payload, textToShow);
              } catch (e) {
                console.error("Failed to parse workspace JSON:", e);
              }
            }

            const textNode = card.querySelector('.streaming-text');
            textNode.innerHTML = textToShow.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
            speakSpeech(textToShow);
            scrollToBottom();
            console.log(`[${requestId}] Final HTTP response: ${textToShow}`);
            return;
          }
          
          const chunk = decoder.decode(value, { stream: true });
          answerText += chunk;
          
          let textToShow = answerText;
          if (answerText.includes("__WORKSPACE__")) {
            const parts = answerText.split(/__WORKSPACE__:\s*/);
            textToShow = parts[0].trim();
          }
          
          const cleanSoFar = textToShow.trim();
          let isSpecialMsg = false;
          
          if (cleanSoFar === "NO_CONTEXT" || cleanSoFar === "No information found.") {
            textToShow = emptyKBMsg;
            isSpecialMsg = true;
          } else if (cleanSoFar === "General knowledge is disabled.") {
            textToShow = generalDisabledMsg;
            isSpecialMsg = true;
          }
          
          // Dynamically instantiate the speech-card on first arrival of text
          let card = aiWrapper.querySelector('.speech-card');
          if (!card && textToShow.length > 0) {
            const dots = aiWrapper.querySelector('.bubble-dots');
            if (dots) dots.remove();
            card = document.createElement('div');
            card.className = 'speech-card';
            card.innerHTML = `<p class="streaming-text"></p>`;
            aiWrapper.appendChild(card);
          }
          
          if (card) {
            const textNode = card.querySelector('.streaming-text');
            textNode.innerHTML = textToShow.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
          }
          
          scrollToBottom();
          
          if (isSpecialMsg && cleanSoFar.length >= 30) {
            return; 
          }
          
          return read();
        });
      }
      return read();
    })
    .catch(err => {
      console.warn("FastAPI streaming failed, fallback to empty KB message:", err);
      setAthenaState('idle');
      playSynthSound(330, 'triangle', 0.25);
      
      const dots = aiWrapper.querySelector('.bubble-dots');
      if (dots) dots.remove();
      
      let card = aiWrapper.querySelector('.speech-card');
      if (!card) {
        card = document.createElement('div');
        card.className = 'speech-card';
        card.innerHTML = `<p class="streaming-text"></p>`;
        aiWrapper.appendChild(card);
      }
      const textNode = card.querySelector('.streaming-text');
      textNode.innerHTML = emptyKBMsg;
      speakSpeech(emptyKBMsg);
      scrollToBottom();
    });
  }

  sendBtn.addEventListener('click', sendMessage);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  chatInput.addEventListener('input', () => {
    const charCounter = document.getElementById('charCounter');
    const length = chatInput.value.length;
    if (charCounter) {
      charCounter.innerText = `${length} / 2000`;
      charCounter.style.opacity = length > 0 ? '0.7' : '0';
    }
    chatInput.style.height = 'auto';
    chatInput.style.height = (chatInput.scrollHeight) + 'px';
  });

  // Voice recognition microphone mockup
  micBtn.addEventListener('click', () => {
    setAthenaState('listening');
    playSynthSound(600, 'sine', 0.3);
    showToast("Voice Input Active", `Speak now, ${window.BrandingService.aiName} is listening...`, "info");
    
    setTimeout(() => {
      chatInput.value = "What is the admission procedure?";
      sendMessage();
    }, 3000);
  });

  // Attach file click warning
  attachBtn.addEventListener('click', () => {
    showToast("Attachment Blocked", "Uploads are configured for PDF reports only.", "warning");
    playSynthSound(440, 'triangle', 0.15);
  });

  // Hotkey support for Command Palette: Ctrl + K
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'k') {
      e.preventDefault();
      togglePalette();
    }
  });

  paletteTriggerBtn.addEventListener('click', togglePalette);

  function togglePalette() {
    const isVisible = commandPalette.style.display === 'flex';
    commandPalette.style.display = isVisible ? 'none' : 'flex';
    if (!isVisible) {
      commandInput.focus();
      playSynthSound(880, 'sine', 0.08);
    }
  }

  // Close palette on outer click
  commandPalette.addEventListener('click', (e) => {
    if (e.target === commandPalette) {
      commandPalette.style.display = 'none';
    }
  });

  // Dynamic Branding Service Context
  window.BrandingService = {
    schoolName: "Gayathri Central School",
    aiName: "Gayu AI",
    logo: "shared/logo.png",
    mascot: "shared/mascot.png",
    accentColor: "#06b6d4",
    welcomeMessage: "Welcome back. I am {{assistant_name}}. Ask me anything about school policies, admission, innovation lab launches, or timings.",
    getTimeGreeting: function() {
      const hr = new Date().getHours();
      if (hr < 12) return "Good Morning";
      if (hr < 17) return "Good Afternoon";
      if (hr < 21) return "Good Evening";
      return "Good Night";
    },
    apply: function() {
      document.title = `${this.schoolName} - AI Companion`;
      
      const logo = document.querySelector('.brand-logo');
      if (logo) logo.textContent = this.schoolName.toUpperCase();
      
      const introDesc = document.querySelector('.intro-desc');
      if (introDesc) {
        introDesc.textContent = `I am ${this.aiName}, your school's digital companion. I hold the archives of ${this.schoolName}.`;
      }
      
      const promptBarText = document.querySelector('.prompt-bar-text');
      if (promptBarText) {
        promptBarText.textContent = `Search the School Database or Speak to ${this.aiName}...`;
      }
      
      const mainInput = document.getElementById('chatInput');
      if (mainInput) {
        mainInput.placeholder = `Write message or speak to ${this.aiName}...`;
      }
      
      const firstCardText = document.querySelector('#chatMessages .speech-card p');
      if (firstCardText) {
        const timeGreeting = this.getTimeGreeting();
        let rendered = this.welcomeMessage
          .replace(/\{\{assistant_name\}\}/g, this.aiName)
          .replace(/\{\{school_name\}\}/g, this.schoolName)
          .replace(/\{\{time_greeting\}\}/g, timeGreeting);
        firstCardText.textContent = rendered;
      }

      document.documentElement.style.setProperty('--color-secondary', this.accentColor);
    }
  };

  // Load settings from backend config service
  function loadSystemConfig() {
    const backendUrl = (window.APP_CONFIG && window.APP_CONFIG.BACKEND_URL) || "http://localhost:8100";
    fetch(`${backendUrl}/config`)
      .then(res => res.json())
      .then(data => {
        if (!data) return;
        if (data.general) {
          window.BrandingService.schoolName = data.general.institution_name || window.BrandingService.schoolName;
          window.BrandingService.aiName = data.general.ai_companion_name || window.BrandingService.aiName;
        }
        if (data.branding) {
          window.BrandingService.logo = data.branding.school_logo || window.BrandingService.logo;
          window.BrandingService.mascot = data.branding.ai_mascot || window.BrandingService.mascot;
          window.BrandingService.accentColor = data.branding.accent_color || window.BrandingService.accentColor;
          window.BrandingService.welcomeMessage = data.branding.welcome_message || window.BrandingService.welcomeMessage;
        }
        window.BrandingService.apply();
      })
      .catch(err => console.warn("Failed to load settings in user portal:", err));
  }
  loadSystemConfig();

  // Command palette item selection
  document.querySelectorAll('.command-item').forEach(item => {
    item.addEventListener('click', () => {
      const prompt = item.getAttribute('data-prompt');
      commandPalette.style.display = 'none';
      switchView('chat');
      chatInput.value = prompt;
      setTimeout(() => sendMessage(), 300);
    });
  });

  // State preservation history cache
  const workspaceHistory = {
    table: null,
    profile: null,
    analytics: null,
    document: null,
    downloads: null
  };

  // Helper to switch active tab UI
  function setActiveTabUI(activeTab) {
    document.querySelectorAll(".workspace-tabs .tab-btn").forEach(btn => {
      if (btn.getAttribute("data-tab") === activeTab) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  }

  // Bind tab buttons
  document.querySelectorAll(".workspace-tabs .tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const tab = btn.getAttribute("data-tab");
      setActiveTabUI(tab);
      const hist = workspaceHistory[tab];
      if (hist) {
        window.renderWorkspaceInner(hist.responseType, hist.workspace, false);
      } else {
        const contentDiv = document.getElementById("workspaceContent");
        contentDiv.innerHTML = `
          <div style="text-align:center; padding:4rem 1rem; color:var(--text-muted); font-size:0.85rem;" class="empty-state">
            <i data-lucide="layout-dashboard" style="width:36px; height:36px; margin-bottom:1rem; opacity:0.5; display:block; margin-left:auto; margin-right:auto; color: var(--color-secondary);"></i>
            No active ${tab} visualization stored yet.
          </div>
        `;
        lucide.createIcons();
      }
    });
  });

  // Dynamic AI Workspace component renderer
  // Global State for active Workspace component printing/exporting
  window.currentWorkspace = null;
  window.currentResponseType = null;
  window.currentFilteredData = null;

  // Print workspace component in a hidden window/tab (iframe)
  window.printWorkspaceComponent = function(responseType, workspace) {
    if (!workspace || !workspace.component) return;
    const component = workspace.component;
    const data = workspace.data;
    
    let contentHTML = "";
    
    if (component === "attendance_table" || responseType === "table") {
      const records = window.currentFilteredData || (Array.isArray(data) ? data : []);
      let tableRows = "";
      records.forEach(r => {
        tableRows += `
          <tr>
            <td style="text-align: center; font-weight: bold; color: #06b6d4;">${r.roll_no || r['Roll No'] || ''}</td>
            <td>${r.student_name || r['Student Name'] || ''}</td>
            <td style="text-align: center;">${r.gender || r['Gender'] || ''}</td>
            <td style="text-align: right; font-weight: bold;">${r.attendance_percentage || r['Attendance %'] || ''}%</td>
          </tr>
        `;
      });
      contentHTML = `
        <h2 style="font-size: 14pt; margin-top: 0; color: #111;">Student Attendance Register</h2>
        <table>
          <thead>
            <tr>
              <th style="width: 20%; text-align: center;">Roll No</th>
              <th style="width: 50%; text-align: left;">Student Name</th>
              <th style="width: 15%; text-align: center;">Gender</th>
              <th style="width: 15%; text-align: right;">Attendance Rate</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      `;
    } else if (component === "student_profile" || responseType === "profile") {
      const student = Array.isArray(data) ? data[0] : data;
      contentHTML = `
        <h2 style="font-size: 14pt; margin-top: 0; color: #111; border-bottom: 2px solid #06b6d4; padding-bottom: 5px;">Student Profile Report</h2>
        <table style="margin-top: 15px;">
          <tr>
            <td style="width: 30%; font-weight: bold; background: #f9f9f9;">Roll Number</td>
            <td>${student.roll_no || student['Roll No'] || ''}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; background: #f9f9f9;">Student Name</td>
            <td style="font-weight: bold;">${student.student_name || student['Student Name'] || ''}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; background: #f9f9f9;">Class & Section</td>
            <td>${student.class || student['class_val'] || ''} ${student.section || student['sec_val'] || ''}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; background: #f9f9f9;">Gender</td>
            <td>${student.gender || student['Gender'] || ''}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; background: #f9f9f9;">Total Working Days</td>
            <td>${student.working_days || student['Working Days'] || '247'}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; background: #f9f9f9;">Days Present</td>
            <td>${student.present_days || student['Total Present'] || '0'}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; background: #f9f9f9;">Days Absent</td>
            <td>${student.absent_days || student['Total Absent'] || '0'}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; background: #f9f9f9; color: #06b6d4;">Attendance Rate</td>
            <td style="font-weight: bold; color: #06b6d4;">${student.attendance_percentage || student['Attendance %'] || '0'}%</td>
          </tr>
        </table>
      `;
    } else if (component === "statistics_dashboard" || responseType === "stats" || component === "charts" || responseType === "chart") {
      const records = Array.isArray(data) ? data : (data.records || []);
      const vals = records.map(r => parseFloat(r.attendance_percentage || r["percentage_val"] || 0.0)).filter(v => !isNaN(v)).sort((a,b)=>a-b);
      const avgVal = vals.length ? (vals.reduce((a,b)=>a+b, 0) / vals.length).toFixed(2) : "0.0";
      const maxVal = vals.length ? Math.max(...vals).toFixed(2) : "0.0";
      const minVal = vals.length ? Math.min(...vals).toFixed(2) : "0.0";
      
      let tableRows = "";
      records.forEach(r => {
        tableRows += `
          <tr>
            <td style="text-align: center; font-weight: bold;">${r.roll_no || r['Roll No'] || ''}</td>
            <td>${r.student_name || r['Student Name'] || ''}</td>
            <td style="text-align: right; font-weight: bold;">${r.attendance_percentage || r['Attendance %'] || ''}%</td>
          </tr>
        `;
      });
      
      contentHTML = `
        <h2 style="font-size: 14pt; margin-top: 0; color: #111;">Attendance Statistics Report</h2>
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-top: 15px; margin-bottom: 25px;">
          <div style="border: 1px solid #ddd; padding: 12px; border-radius: 6px; text-align: center; background: #fcfcfc;">
            <div style="font-size: 8pt; color: #666; text-transform: uppercase;">Average Attendance</div>
            <div style="font-size: 16pt; font-weight: bold; color: #06b6d4; margin-top: 4px;">${avgVal}%</div>
          </div>
          <div style="border: 1px solid #ddd; padding: 12px; border-radius: 6px; text-align: center; background: #fcfcfc;">
            <div style="font-size: 8pt; color: #666; text-transform: uppercase;">Highest Attendance</div>
            <div style="font-size: 16pt; font-weight: bold; color: #22c55e; margin-top: 4px;">${maxVal}%</div>
          </div>
          <div style="border: 1px solid #ddd; padding: 12px; border-radius: 6px; text-align: center; background: #fcfcfc;">
            <div style="font-size: 8pt; color: #666; text-transform: uppercase;">Lowest Attendance</div>
            <div style="font-size: 16pt; font-weight: bold; color: #ef4444; margin-top: 4px;">${minVal}%</div>
          </div>
        </div>
        <h3>Student Attendance Roster</h3>
        <table>
          <thead>
            <tr>
              <th style="width: 25%; text-align: center;">Roll No</th>
              <th style="width: 50%; text-align: left;">Student Name</th>
              <th style="width: 25%; text-align: right;">Attendance Rate</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      `;
    } else if (component === "document_viewer" || responseType === "document") {
      const title = data.filename || "Document Viewer";
      const previewText = data.preview_text || "";
      contentHTML = `
        <h2 style="font-size: 14pt; margin-top: 0; color: #111;">Document Content: ${title}</h2>
        <div style="border: 1px solid #ddd; padding: 15px; border-radius: 6px; background: #fafafa; font-family: monospace; white-space: pre-wrap; font-size: 10pt; line-height: 1.5; margin-top: 15px;">
          ${previewText}
        </div>
      `;
    } else if (responseType === "downloads") {
      const dlRecords = Array.isArray(data) ? data : [];
      let tableRows = "";
      dlRecords.slice(0, 50).forEach(r => {
        tableRows += `
          <tr>
            <td style="text-align: center;">${r.roll_no || r['Roll No'] || ''}</td>
            <td>${r.student_name || r['Student Name'] || ''}</td>
            <td style="text-align: center;">${r.gender || r['Gender'] || ''}</td>
            <td style="text-align: right;">${r.attendance_percentage || r['Attendance %'] || ''}%</td>
          </tr>
        `;
      });
      contentHTML = `
        <h2 style="font-size: 14pt; margin-top: 0; color: #111;">Exportable Dataset Summary</h2>
        <p>Prepared Package containing ${dlRecords.length} student records.</p>
        <table>
          <thead>
            <tr>
              <th style="width: 20%; text-align: center;">Roll No</th>
              <th style="width: 50%; text-align: left;">Student Name</th>
              <th style="width: 15%; text-align: center;">Gender</th>
              <th style="width: 15%; text-align: right;">Attendance</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
            ${dlRecords.length > 50 ? `<tr><td colspan="4" style="text-align: center; font-style: italic; color: #777;">... and ${dlRecords.length - 50} more records ...</td></tr>` : ''}
          </tbody>
        </table>
      `;
    } else {
      contentHTML = `<h3>No printable content selected.</h3>`;
    }
    
    // Print in hidden iframe
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);
    
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <html>
        <head>
          <title>AI Generated Report - Gayathri Central School</title>
          <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap">
          <style>
            @page {
              size: A4;
              margin: 20mm;
            }
            body {
              font-family: 'Inter', 'Segoe UI', 'Roboto', sans-serif;
              font-size: 11pt;
              color: #000;
              background: #fff;
              margin: 0;
              padding: 0;
              line-height: 1.4;
            }
            .header {
              border-bottom: 2px solid #000;
              padding-bottom: 8px;
              margin-bottom: 20px;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
            }
            .header-title-area h1 {
              font-size: 16pt;
              font-weight: 700;
              margin: 0;
              letter-spacing: 0.5px;
            }
            .header-title-area p {
              font-size: 10pt;
              margin: 4px 0 0 0;
              color: #555;
              font-weight: 600;
              letter-spacing: 1px;
            }
            .header-meta {
              text-align: right;
              font-size: 9pt;
              color: #444;
              line-height: 1.3;
            }
            .content {
              margin-bottom: 30px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 15px;
              page-break-inside: auto;
            }
            tr {
              page-break-inside: avoid;
              page-break-after: auto;
            }
            thead {
              display: table-header-group;
            }
            th {
              background-color: #f3f4f6;
              border: 1px solid #d1d5db;
              padding: 8px 10px;
              font-size: 12pt;
              font-weight: 700;
            }
            td {
              border: 1px solid #e5e7eb;
              padding: 8px 10px;
              font-size: 11pt;
            }
            tr:nth-child(even) {
              background-color: #f9fafb;
            }
            .footer {
              position: fixed;
              bottom: 0;
              left: 0;
              right: 0;
              border-top: 1px solid #e5e7eb;
              padding-top: 5px;
              font-size: 9pt;
              color: #666;
              display: flex;
              justify-content: space-between;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-title-area">
              <h1>GAYATHRI CENTRAL SCHOOL</h1>
              <p>AI GENERATED REPORT</p>
            </div>
            <div class="header-meta">
              <div><strong>Generated:</strong> ${new Date().toLocaleDateString()}</div>
              <div><strong>Time:</strong> ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
            </div>
          </div>
          
          <div class="content">
            ${contentHTML}
          </div>
          
          <div class="footer">
            <div>Generated by Gayu AI Assistant</div>
            <div>Page 1</div>
          </div>
        </body>
      </html>
    `);
    doc.close();
    
    // Smooth delay before print
    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 500);
  };

  // Export workspace component as CSV
  window.exportWorkspaceCSV = function(responseType, workspace) {
    if (!workspace || !workspace.data) return;
    const records = window.currentFilteredData || (Array.isArray(workspace.data) ? workspace.data : [workspace.data]);
    
    if (records.length === 0) return;
    const headers = Object.keys(records[0]).filter(k => k !== "_metadata");
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += headers.join(",") + "\n";
    records.forEach(r => {
      const row = headers.map(h => `"${String(r[h] || '').replace(/"/g, '""')}"`);
      csvContent += row.join(",") + "\n";
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "student_records.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export workspace component as Excel XML
  window.exportWorkspaceExcel = function(responseType, workspace) {
    if (!workspace || !workspace.data) return;
    const records = window.currentFilteredData || (Array.isArray(workspace.data) ? workspace.data : [workspace.data]);
    
    if (records.length === 0) return;
    const headers = Object.keys(records[0]).filter(k => k !== "_metadata");
    
    const excelHTML = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Sheet1</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>
      <body>
        <table>
          <thead>
            <tr>
              ${headers.map(h => `<th>${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${records.map(r => `
              <tr>
                ${headers.map(h => `<td>${r[h] || ''}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;
    
    const blob = new Blob([excelHTML], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "student_records.xls";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Dynamic AI Workspace component renderer
  window.renderWorkspace = function(responseType, workspace) {
    // 1. Determine active tab category
    let targetTab = "table";
    const component = workspace ? workspace.component : "";
    
    if (component === "student_profile" || responseType === "profile") {
      targetTab = "profile";
    } else if (component === "statistics_dashboard" || responseType === "stats" || component === "charts" || responseType === "chart") {
      targetTab = "analytics";
    } else if (component === "document_viewer" || responseType === "document" || component === "recent_documents" || responseType === "list") {
      targetTab = "document";
    } else if (responseType === "download" || responseType === "downloads") {
      targetTab = "downloads";
    }
    
    // Save to history cache (fix check condition to support all payload object shapes)
    if (workspace && workspace.data) {
      workspaceHistory[targetTab] = { responseType, workspace };
    }
    
    // Highlight active tab
    const activeBtn = document.querySelector(`.workspace-tabs .tab-btn[data-tab="${targetTab}"]`);
    if (activeBtn) {
      activeBtn.classList.add("tab-highlight");
      setTimeout(() => {
        activeBtn.classList.remove("tab-highlight");
      }, 1200);
    }

    // Display a small toast notification
    let toastMsg = "";
    if (targetTab === "table") toastMsg = "✓ Table loaded";
    else if (targetTab === "analytics") toastMsg = "✓ Analytics generated";
    else if (targetTab === "profile") toastMsg = "✓ Student profile ready";
    else if (targetTab === "document") toastMsg = "✓ Document viewer ready";
    else if (targetTab === "downloads") toastMsg = "✓ Downloads ready";
    
    if (toastMsg) {
      showToast("Workspace Update", toastMsg, "success");
    }
    
    window.renderWorkspaceInner(responseType, workspace, true);
  };

  window.renderWorkspaceInner = function(responseType, workspace, updateTab = true) {
    const contentDiv = document.getElementById("workspaceContent");
    const titleEl = document.getElementById("workspaceTitle");
    const controlsEl = document.getElementById("workspaceControls");
    if (!contentDiv) return;
    
    contentDiv.innerHTML = "";
    
    // Globally cache state for the active component print/download actions
    window.currentWorkspace = workspace;
    window.currentResponseType = responseType;
    window.currentFilteredData = workspace && Array.isArray(workspace.data) ? [...workspace.data] : null;

    if (!workspace || !workspace.component || !workspace.data) {
      controlsEl.style.display = "none";
      contentDiv.innerHTML = `
        <div style="text-align:center; padding:4rem 1rem; color:var(--text-muted); font-size:0.85rem;" class="empty-state">
          <i data-lucide="sparkles" style="width:36px; height:36px; margin-bottom:1rem; opacity:0.5; display:block; margin-left:auto; margin-right:auto; color: var(--color-secondary);"></i>
          <h4 style="color:#fff; margin:0 0 0.5rem 0;">AI Workspace</h4>
          <p style="margin:0; font-size:0.75rem; color:var(--text-muted); line-height:1.4;">Interactive results will appear here based on your queries.</p>
        </div>
      `;
      lucide.createIcons();
      return;
    }
    
    // Show persistent controls for all active components
    controlsEl.style.display = "flex";
    
    // Globally bind the print/download click handlers to persistent buttons
    document.getElementById("workspacePrintBtn").onclick = () => {
      window.printWorkspaceComponent(window.currentResponseType, window.currentWorkspace);
    };
    document.getElementById("workspaceExportBtn").onclick = () => {
      window.exportWorkspaceCSV(window.currentResponseType, window.currentWorkspace);
    };
    document.getElementById("workspaceExportExcelBtn").onclick = () => {
      window.exportWorkspaceExcel(window.currentResponseType, window.currentWorkspace);
    };

    const component = workspace.component;
    const data = workspace.data;
    
    // Auto switch active tab
    if (updateTab) {
      let activeTab = "table";
      if (component === "student_profile" || responseType === "profile") activeTab = "profile";
      else if (component === "statistics_dashboard" || responseType === "stats" || component === "charts" || responseType === "chart") activeTab = "analytics";
      else if (component === "document_viewer" || responseType === "document" || component === "recent_documents" || responseType === "list") activeTab = "document";
      else if (responseType === "download" || responseType === "downloads") activeTab = "downloads";
      setActiveTabUI(activeTab);
    }
    
    if (component === "attendance_table" || responseType === "table") {
      titleEl.innerText = "Student Records";
      controlsEl.style.display = "flex";
      
      let currentPage = 1;
      const rowsPerPage = 15;
      let filteredData = Array.isArray(data) ? [...data] : [];
      
      const tableWrapper = document.createElement("div");
      tableWrapper.style.display = "flex";
      tableWrapper.style.flexDirection = "column";
      tableWrapper.style.gap = "0.75rem";
      
      tableWrapper.innerHTML = `
        <div style="display:flex; gap:0.5rem; align-items:center; width:100%;">
          <input type="text" id="tableSearchInput" placeholder="Search table..." class="custom-select" style="flex:1; padding: 0.5rem 0.75rem; font-size:0.85rem; background:rgba(0,0,0,0.3); border:1px solid var(--border-glass); color:#fff; border-radius:var(--radius-md);">
          <select id="tableGenderFilter" class="custom-select" style="width: 110px; padding:0.5rem; font-size:0.85rem; background:rgba(0,0,0,0.3); border:1px solid var(--border-glass); color:#fff; border-radius:var(--radius-md);">
            <option value="all">All Genders</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </div>
        <div style="overflow-x:auto; border: 1px solid var(--border-glass); border-radius: var(--radius-md); background: rgba(0,0,0,0.2); max-height: 380px;">
          <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.8rem; color: var(--text-dim);">
            <thead style="position:sticky; top:0; background: var(--bg-card-glass); backdrop-filter: blur(10px); border-bottom: 1px solid var(--border-glass); font-family: var(--font-display); font-weight:700;">
              <tr>
                <th style="padding:0.75rem; cursor:pointer;" data-key="roll_no">Roll No <i data-lucide="chevron-up-down" style="width:12px; height:12px; display:inline-block; vertical-align:middle;"></i></th>
                <th style="padding:0.75rem; cursor:pointer;" data-key="student_name">Name <i data-lucide="chevron-up-down" style="width:12px; height:12px; display:inline-block; vertical-align:middle;"></i></th>
                <th style="padding:0.75rem; cursor:pointer;" data-key="gender">Gender <i data-lucide="chevron-up-down" style="width:12px; height:12px; display:inline-block; vertical-align:middle;"></i></th>
                <th style="padding:0.75rem; cursor:pointer;" data-key="attendance_percentage">Attendance <i data-lucide="chevron-up-down" style="width:12px; height:12px; display:inline-block; vertical-align:middle;"></i></th>
              </tr>
            </thead>
            <tbody id="tableBody"></tbody>
          </table>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color: var(--text-muted); padding:0.25rem 0.5rem;">
          <span id="tableInfo">Showing 1-15 of 30</span>
          <div style="display:flex; gap:0.25rem;">
            <button class="hud-btn" id="prevPageBtn" style="padding:0.35rem 0.6rem;"><i data-lucide="chevron-left" style="width:12px; height:12px;"></i></button>
            <button class="hud-btn" id="nextPageBtn" style="padding:0.35rem 0.6rem;"><i data-lucide="chevron-right" style="width:12px; height:12px;"></i></button>
          </div>
        </div>
      `;
      contentDiv.appendChild(tableWrapper);
      
      const tableBody = tableWrapper.querySelector("#tableBody");
      const tableSearchInput = tableWrapper.querySelector("#tableSearchInput");
      const tableGenderFilter = tableWrapper.querySelector("#tableGenderFilter");
      const tableInfo = tableWrapper.querySelector("#tableInfo");
      const prevPageBtn = tableWrapper.querySelector("#prevPageBtn");
      const nextPageBtn = tableWrapper.querySelector("#nextPageBtn");
      
      function renderRows() {
        tableBody.innerHTML = "";
        const startIndex = (currentPage - 1) * rowsPerPage;
        const endIndex = Math.min(startIndex + rowsPerPage, filteredData.length);
        
        const pageData = filteredData.slice(startIndex, endIndex);
        pageData.forEach(r => {
          const tr = document.createElement("tr");
          tr.style.borderBottom = "1px solid rgba(255,255,255,0.05)";
          tr.style.cursor = "pointer";
          tr.addEventListener("click", () => {
            navigator.clipboard.writeText(`${r.roll_no || r["Roll No"] || ""} | ${r.student_name || r["Student Name"] || ""} | ${r.gender || r["Gender"] || ""} | ${r.attendance_percentage || r["Attendance %"] || ""}`);
            playSynthSound(523, "sine", 0.05);
          });
          
          tr.innerHTML = `
            <td style="padding:0.65rem 0.75rem; font-weight:700; color:var(--color-secondary);">${r.roll_no || r["Roll No"] || ""}</td>
            <td style="padding:0.65rem 0.75rem; color:var(--text-core);">${r.student_name || r["Student Name"] || ""}</td>
            <td style="padding:0.65rem 0.75rem;">${r.gender || r["Gender"] || ""}</td>
            <td style="padding:0.65rem 0.75rem; font-weight:700;">${r.attendance_percentage || r["Attendance %"] || ""}%</td>
          `;
          tableBody.appendChild(tr);
        });
        
        tableInfo.innerText = filteredData.length > 0 
          ? `Showing ${startIndex + 1}-${endIndex} of ${filteredData.length}` 
          : "No records found";
        
        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage >= Math.ceil(filteredData.length / rowsPerPage);
      }
      
      function applyFilterAndSearch() {
        const query = tableSearchInput.value.toLowerCase().trim();
        const gender = tableGenderFilter.value;
        
        filteredData = data.filter(r => {
          const name = (r.student_name || r["Student Name"] || "").toLowerCase();
          const roll = (r.roll_no || r["Roll No"] || "").toLowerCase();
          const matchesSearch = name.includes(query) || roll.includes(query);
          const gVal = (r.gender || r["Gender"] || "");
          const matchesGender = gender === "all" || gVal.toLowerCase() === gender.toLowerCase() || gVal.toLowerCase().startsWith(gender.toLowerCase()[0]);
          return matchesSearch && matchesGender;
        });
        
        window.currentFilteredData = filteredData;
        currentPage = 1;
        renderRows();
      }
      
      tableSearchInput.addEventListener("input", applyFilterAndSearch);
      tableGenderFilter.addEventListener("change", applyFilterAndSearch);
      prevPageBtn.addEventListener("click", () => { if (currentPage > 1) { currentPage--; renderRows(); } });
      nextPageBtn.addEventListener("click", () => { if (currentPage < Math.ceil(filteredData.length / rowsPerPage)) { currentPage++; renderRows(); } });
      
      window.currentFilteredData = filteredData;
      renderRows();
    }
    
    else if (component === "student_profile" || responseType === "profile") {
      titleEl.innerText = "Student Profile";
      const student = Array.isArray(data) ? data[0] : data;
      
      contentDiv.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:1.25rem; padding:1.5rem; border: 1px solid var(--border-glass); border-radius: var(--radius-lg); background: rgba(255,255,255,0.02);">
          
          <!-- Demographics & Avatar Row -->
          <div style="display:flex; gap:1.5rem; align-items:center;">
            <div style="width:80px; height:80px; border-radius:16px; background: rgba(0,0,0,0.3); border: 1px solid var(--border-glass); display:flex; align-items:center; justify-content:center; overflow:hidden; position:relative;">
              <div style="position:absolute; width:100%; height:100%; background: radial-gradient(circle, rgba(6,182,212,0.15) 0%, transparent 70%);"></div>
              <i data-lucide="user" style="width:32px; height:32px; color: var(--color-secondary); z-index:1;"></i>
            </div>
            <div>
              <h4 style="font-size:1.2rem; color:var(--text-core); font-family: var(--font-display); margin:0 0 0.25rem 0; font-weight:700;">${student.student_name || student["Student Name"] || ""}</h4>
              <div style="display:flex; gap:0.5rem; font-size:0.75rem; color:var(--text-muted);">
                <span>Roll No: <strong>${student.roll_no || student["Roll No"] || ""}</strong></span>
                <span>&bull;</span>
                <span>Class: <strong>${student.class || student["class_val"] || ""} ${student.section || student["sec_val"] || ""}</strong></span>
              </div>
            </div>
          </div>
          
          <!-- Metrics Grid -->
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.75rem;">
            <div style="padding:0.75rem; border: 1px solid var(--border-glass); border-radius:var(--radius-md); background: rgba(0,0,0,0.15);">
              <span style="font-size:0.7rem; color:var(--text-muted); display:block; margin-bottom:0.25rem;">Gender</span>
              <strong style="font-size:0.9rem; color:var(--text-core);">${student.gender || student["Gender"] || "Male"}</strong>
            </div>
            <div style="padding:0.75rem; border: 1px solid var(--border-glass); border-radius:var(--radius-md); background: rgba(0,0,0,0.15);">
              <span style="font-size:0.7rem; color:var(--text-muted); display:block; margin-bottom:0.25rem;">Working Days</span>
              <strong style="font-size:0.9rem; color:var(--text-core);">${student.working_days || student["Working Days"] || "247"}</strong>
            </div>
            <div style="padding:0.75rem; border: 1px solid var(--border-glass); border-radius:var(--radius-md); background: rgba(0,0,0,0.15);">
              <span style="font-size:0.7rem; color:var(--text-muted); display:block; margin-bottom:0.25rem;">Present Days</span>
              <strong style="font-size:0.9rem; color:#22c55e;">${student.present_days || student["Total Present"] || "0"}</strong>
            </div>
            <div style="padding:0.75rem; border: 1px solid var(--border-glass); border-radius:var(--radius-md); background: rgba(0,0,0,0.15);">
              <span style="font-size:0.7rem; color:var(--text-muted); display:block; margin-bottom:0.25rem;">Absent Days</span>
              <strong style="font-size:0.9rem; color:#ef4444;">${student.absent_days || student["Total Absent"] || "0"}</strong>
            </div>
          </div>
          
          <!-- Attendance Trend visual bar -->
          <div style="border: 1px solid var(--border-glass); border-radius:var(--radius-md); padding:1rem; background: rgba(0,0,0,0.15);">
            <div style="display:flex; justify-content:space-between; font-size:0.75rem; margin-bottom:0.5rem;">
              <span style="color:var(--text-muted);">Attendance Rate</span>
              <strong style="color:var(--color-secondary); font-size:0.95rem;">${student.attendance_percentage || student["Attendance %"] || "0"}%</strong>
            </div>
            <div style="width:100%; height:8px; border-radius:4px; background: rgba(255,255,255,0.05); overflow:hidden;">
              <div style="width: ${student.attendance_percentage || student["percentage_val"] || 0}%; height:100%; background: var(--color-secondary); border-radius:4px;"></div>
            </div>
          </div>
          <!-- Profile Controls -->
          <div style="display:flex; gap:0.5rem; width:100%;">
            <button class="hud-btn" onclick="window.printWorkspaceComponent(window.currentResponseType, window.currentWorkspace)" style="flex:1; justify-content:center; padding: 0.5rem;"><i data-lucide="printer" style="width:14px; height:14px; margin-right:4px;"></i> Print Profile</button>
            <button class="hud-btn" onclick="navigator.clipboard.writeText('${student.student_name || ''} Attendance: ${student.attendance_percentage || 0}%')" style="flex:1; justify-content:center; padding: 0.5rem;"><i data-lucide="copy" style="width:14px; height:14px; margin-right:4px;"></i> Copy Summary</button>
          </div>
        </div>
      `;
    }
    
    else if (component === "statistics_dashboard" || responseType === "stats") {
      titleEl.innerText = "Attendance Statistics";
      const records = Array.isArray(data) ? data : (data.records || []);
      const vals = records.map(r => parseFloat(r.attendance_percentage || r["percentage_val"] || 0.0)).filter(v => !isNaN(v)).sort((a,b)=>a-b);
      
      const avgVal = vals.length ? (vals.reduce((a,b)=>a+b, 0) / vals.length).toFixed(2) : "0.0";
      const maxVal = vals.length ? Math.max(...vals).toFixed(2) : "0.0";
      const minVal = vals.length ? Math.min(...vals).toFixed(2) : "0.0";
      
      // Calculate Median
      let medianVal = "0.0";
      if (vals.length) {
        const mid = Math.floor(vals.length / 2);
        medianVal = vals.length % 2 !== 0 ? vals[mid].toFixed(2) : ((vals[mid - 1] + vals[mid]) / 2).toFixed(2);
      }
      
      contentDiv.innerHTML = `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
          <div style="padding:1rem; border: 1px solid var(--border-glass); border-radius:var(--radius-md); background: rgba(255,255,255,0.02); display:flex; flex-direction:column; justify-content:center;">
            <span style="font-size:0.7rem; color:var(--text-muted); margin-bottom:0.25rem;">Average</span>
            <strong style="font-size:1.25rem; color:var(--color-secondary);">${avgVal}%</strong>
          </div>
          <div style="padding:1rem; border: 1px solid var(--border-glass); border-radius:var(--radius-md); background: rgba(255,255,255,0.02); display:flex; flex-direction:column; justify-content:center;">
            <span style="font-size:0.7rem; color:var(--text-muted); margin-bottom:0.25rem;">Median</span>
            <strong style="font-size:1.25rem; color:#a855f7;">${medianVal}%</strong>
          </div>
          <div style="padding:1rem; border: 1px solid var(--border-glass); border-radius:var(--radius-md); background: rgba(255,255,255,0.02); display:flex; flex-direction:column; justify-content:center;">
            <span style="font-size:0.7rem; color:var(--text-muted); margin-bottom:0.25rem;">Highest</span>
            <strong style="font-size:1.25rem; color:#22c55e;">${maxVal}%</strong>
          </div>
          <div style="padding:1rem; border: 1px solid var(--border-glass); border-radius:var(--radius-md); background: rgba(255,255,255,0.02); display:flex; flex-direction:column; justify-content:center;">
            <span style="font-size:0.7rem; color:var(--text-muted); margin-bottom:0.25rem;">Lowest</span>
            <strong style="font-size:1.25rem; color:#ef4444;">${minVal}%</strong>
          </div>
        </div>
        
        <!-- Attendance distribution quick visualization -->
        <div style="border: 1px solid var(--border-glass); border-radius:var(--radius-md); padding:1rem; background: rgba(0,0,0,0.15); margin-top:0.5rem;">
          <h5 style="margin:0 0 0.75rem 0; font-size:0.75rem; color:#fff;">Cohort Range Analysis</h5>
          <div style="display:flex; justify-content:space-between; font-size:0.7rem; color:var(--text-muted);">
            <span>0% - 75% (${vals.filter(v => v < 75).length})</span>
            <span>75% - 90% (${vals.filter(v => v >= 75 && v < 90).length})</span>
            <span>90% - 100% (${vals.filter(v => v >= 90).length})</span>
          </div>
        </div>
      `;
    }
    
    else if (component === "charts" || responseType === "chart") {
      titleEl.innerText = "Cohort Distributions";
      const records = Array.isArray(data) ? data : [];
      const sorted = [...records].sort((a,b) => parseFloat(b.attendance_percentage || b["percentage_val"] || 0.0) - parseFloat(a.attendance_percentage || a["percentage_val"] || 0.0)).slice(0, 5);
      
      const chartWrapper = document.createElement("div");
      chartWrapper.style.display = "flex";
      chartWrapper.style.flexDirection = "column";
      chartWrapper.style.gap = "1rem";
      
      sorted.forEach(r => {
        const val = r.attendance_percentage || r["percentage_val"] || 0;
        const bar = document.createElement("div");
        bar.style.display = "flex";
        bar.style.flexDirection = "column";
        bar.style.gap = "0.25rem";
        bar.innerHTML = `
          <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--text-core);">
            <span>${r.student_name || r["Student Name"]} (${r.roll_no || r["Roll No"]})</span>
            <strong>${val}%</strong>
          </div>
          <div style="width:100%; height:8px; border-radius:4px; background:rgba(255,255,255,0.05); overflow:hidden;">
            <div style="width:${val}%; height:100%; background: var(--color-secondary); border-radius:4px;"></div>
          </div>
        `;
        chartWrapper.appendChild(bar);
      });
      contentDiv.appendChild(chartWrapper);
    }
    
    else if (component === "recent_documents" || responseType === "list") {
      titleEl.innerText = "System Files";
      const listData = Array.isArray(data) ? data : [];
      listData.forEach(doc => {
        const div = document.createElement("div");
        div.style.padding = "0.75rem 1rem";
        div.style.border = "1px solid var(--border-glass)";
        div.style.borderRadius = "var(--radius-md)";
        div.style.background = "rgba(255,255,255,0.02)";
        div.style.display = "flex";
        div.style.justifyContent = "space-between";
        div.style.alignItems = "center";
        div.style.marginBottom = "0.5rem";
        
        div.innerHTML = `
          <div>
            <span style="font-size:0.85rem; color:var(--text-core); display:block; font-weight:700;">${doc.title || doc.filename}</span>
            <span style="font-size:0.7rem; color:var(--text-muted);">${doc.category || "General"} &middot; ${doc.upload_date || ""}</span>
          </div>
          <i data-lucide="file-check" style="width:18px; height:18px; color: var(--color-secondary);"></i>
        `;
        contentDiv.appendChild(div);
      });
    }
    
    else if (component === "document_viewer" || responseType === "document") {
      titleEl.innerText = workspace.data.filename || "Document Viewer";
      
      const docWrapper = document.createElement("div");
      docWrapper.style.display = "flex";
      docWrapper.style.flexDirection = "column";
      docWrapper.style.gap = "0.75rem";
      
      let zoomLevel = 100;
      docWrapper.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; padding: 0.25rem 0.5rem; background:rgba(0,0,0,0.2); border-radius: var(--radius-md);">
          <input type="text" id="docSearchText" placeholder="Search text..." class="custom-select" style="flex:1; max-width:180px; padding:0.4rem; font-size:0.75rem; background:rgba(0,0,0,0.3); border:1px solid var(--border-glass); color:#fff; border-radius:var(--radius-md);">
          <div style="display:flex; gap:0.25rem; align-items:center;">
            <button class="hud-btn" id="zoomOutBtn" style="padding:0.35rem 0.5rem; font-size:0.7rem;"><i data-lucide="minus" style="width:12px; height:12px;"></i></button>
            <span id="zoomText" style="font-size:0.75rem; color:var(--text-muted); min-width:35px; text-align:center;">100%</span>
            <button class="hud-btn" id="zoomInBtn" style="padding:0.35rem 0.5rem; font-size:0.7rem;"><i data-lucide="plus" style="width:12px; height:12px;"></i></button>
          </div>
        </div>
        <div id="docTextViewer" style="flex:1; border:1px solid var(--border-glass); border-radius:var(--radius-md); background: rgba(0,0,0,0.3); padding:1rem; font-size:0.8rem; line-height:1.4; color:var(--text-dim); overflow-y:auto; font-family: monospace; max-height: 400px; transition: font-size 0.2s ease;">
          ${(workspace.data.preview_text || "").replace(/\n/g, "<br>")}
        </div>
      `;
      contentDiv.appendChild(docWrapper);
      
      const docTextViewer = docWrapper.querySelector("#docTextViewer");
      const zoomText = docWrapper.querySelector("#zoomText");
      const zoomInBtn = docWrapper.querySelector("#zoomInBtn");
      const zoomOutBtn = docWrapper.querySelector("#zoomOutBtn");
      const docSearchText = docWrapper.querySelector("#docSearchText");
      
      zoomInBtn.onclick = () => {
        if (zoomLevel < 180) { zoomLevel += 20; docTextViewer.style.fontSize = `${0.8 * (zoomLevel / 100)}rem`; zoomText.innerText = `${zoomLevel}%`; }
      };
      zoomOutBtn.onclick = () => {
        if (zoomLevel > 60) { zoomLevel -= 20; docTextViewer.style.fontSize = `${0.8 * (zoomLevel / 100)}rem`; zoomText.innerText = `${zoomLevel}%`; }
      };
      
      docSearchText.oninput = () => {
        const query = docSearchText.value.trim().toLowerCase();
        let rawText = workspace.data.preview_text || "";
        if (query) {
          const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`(${escapedQuery})`, "gi");
          rawText = rawText.replace(regex, `<span style="background:var(--color-secondary); color:#000; font-weight:700;">$1</span>`);
        }
        docTextViewer.innerHTML = rawText.replace(/\n/g, "<br>");
      };
    }
    
    else if (responseType === "downloads") {
      titleEl.innerText = "Reports Hub";
      contentDiv.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:1rem; padding:1.5rem; border:1px solid var(--border-glass); border-radius:var(--radius-lg); background:rgba(255,255,255,0.02); align-items:center; text-align:center;">
          <div style="width:64px; height:64px; border-radius:50%; background:rgba(34,197,94,0.1); color:#22c55e; display:flex; align-items:center; justify-content:center; margin-bottom:0.5rem;">
            <i data-lucide="file-down" style="width:32px; height:32px;"></i>
          </div>
          <div>
            <h4 style="font-size:1.1rem; color:var(--text-core); margin:0 0 0.25rem 0;">Download Report Package</h4>
            <p style="font-size:0.75rem; color:var(--text-muted); margin:0;">The requested school data package is prepared and ready for download.</p>
          </div>
          <div style="display:flex; flex-direction:column; gap:0.5rem; width:100%; margin-top:1rem;">
            <button class="hud-btn" id="dlCsvBtn" style="justify-content:center; padding:0.6rem;"><i data-lucide="file-spreadsheet" style="width:16px; height:16px; margin-right:6px;"></i> Download CSV Spreadsheet</button>
            <button class="hud-btn" id="dlExcelBtn" style="justify-content:center; padding:0.6rem;"><i data-lucide="file-check" style="width:16px; height:16px; margin-right:6px;"></i> Download Excel Sheet</button>
          </div>
        </div>
      `;
      
      const dlCsvBtn = contentDiv.querySelector("#dlCsvBtn");
      const dlExcelBtn = contentDiv.querySelector("#dlExcelBtn");
      
      dlCsvBtn.onclick = () => {
        let csvContent = "data:text/csv;charset=utf-8,Record Data\n";
        if (Array.isArray(data)) {
          data.forEach(r => {
            csvContent += `"${Object.values(r).join('","')}"\n`;
          });
        } else {
          csvContent += `"${JSON.stringify(data)}"\n`;
        }
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "report.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      };
      dlExcelBtn.onclick = () => { alert("Exporting formatted Excel sheet to download container..."); };
    }
    
    lucide.createIcons();
  };

  // Intercept Ctrl+P to print only the active workspace component professionally
  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
      e.preventDefault();
      if (window.currentWorkspace) {
        window.printWorkspaceComponent(window.currentResponseType, window.currentWorkspace);
      }
    }
  });

  // Periodic Idle animation sequence
  setInterval(() => {
    if (activeView === 'home' && !athenaMascot.classList.contains('thinking')) {
      const moods = ['listening', 'sleeping', 'idle'];
      const pick = moods[Math.floor(Math.random() * moods.length)];
      setAthenaState(pick);
    }
  }, 12000);
});
