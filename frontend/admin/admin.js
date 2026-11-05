document.addEventListener('DOMContentLoaded', () => {
  // Dynamic port routing for backToUserPortalBtn
  const backToUserPortalBtn = document.getElementById('backToUserPortalBtn');
  if (backToUserPortalBtn && window.APP_CONFIG && window.APP_CONFIG.USER_PORTAL_URL) {
    backToUserPortalBtn.href = window.APP_CONFIG.USER_PORTAL_URL;
  }
  // Session Authentication Check
  const loginOverlay = document.getElementById('loginOverlay');
  const adminLayout = document.getElementById('adminLayout');
  const loginUser = document.getElementById('loginUser');
  const loginPass = document.getElementById('loginPass');
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');

  // Auto-login if session token is active
  if (sessionStorage.getItem('adminSession') === 'active') {
    loginOverlay.style.display = 'none';
    adminLayout.style.display = 'flex';
  }

  loginBtn.addEventListener('click', authorizeSession);
  loginPass.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') authorizeSession();
  });

  function authorizeSession() {
    const username = loginUser.value.trim();
    const password = loginPass.value.trim();

    if (username === 'admin' && password === 'admin') {
      sessionStorage.setItem('adminSession', 'active');
      playSynthSound(880, 'sine', 0.15);
      
      // Animate transition
      loginOverlay.style.animation = 'slideOut 0.4s ease forwards';
      setTimeout(() => {
        loginOverlay.style.display = 'none';
        adminLayout.style.display = 'flex';
        showToast("Authorization Successful", "Session initialized successfully.", "success");
      }, 400);
    } else {
      playSynthSound(220, 'sawtooth', 0.25);
      showToast("Access Denied", "Invalid username or password.", "error");
    }
  }

  logoutBtn.addEventListener('click', () => {
    sessionStorage.removeItem('adminSession');
    playSynthSound(440, 'triangle', 0.15);
    showToast("Session Terminated", "You have been logged out.", "info");
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  });

  let currentDocCount = -1;
  let currentPendingCount = -1;
  let currentCatCount = -1;
  let currentQueryCount = -1;

  // Sidebar Tab Navigation Controller
  const sidebarItems = document.querySelectorAll('.sidebar-item');
  const panels = document.querySelectorAll('.admin-panel');

  sidebarItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetTab = item.getAttribute('data-tab');
      
      // Update sidebar states
      sidebarItems.forEach(sb => sb.classList.remove('active'));
      item.classList.add('active');

      // Switch workspace panel
      panels.forEach(p => p.classList.remove('active'));
      const activePanel = document.getElementById(`panel-${targetTab}`);
      if (activePanel) {
        activePanel.classList.add('active');
        playSynthSound(660, 'sine', 0.08);
        if (targetTab === 'health') {
          loadHealthDiagnostics();
        } else if (targetTab === 'logs') {
          loadConversationLogs();
        }
      }
    });
  });

  // AI Configuration Input Bindings
  const configTemp = document.getElementById('configTemp');
  const tempVal = document.getElementById('tempVal');
  const saveConfigBtn = document.getElementById('saveConfigBtn');
  const configModelName = document.getElementById('configModelName');
  const configMaxTokens = document.getElementById('configMaxTokens');
  const configStreaming = document.getElementById('configStreaming');
  const configSystemPrompt = document.getElementById('configSystemPrompt');

  if (configTemp && tempVal) {
    configTemp.addEventListener('input', (e) => {
      tempVal.textContent = e.target.value;
    });
  }

  // Tab Switcher for Configurations
  const tabButtons = document.querySelectorAll('.config-tab-btn');
  const tabContents = document.querySelectorAll('.config-tab-content');
  
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // Toggle button highlights
      tabButtons.forEach(b => {
        b.classList.remove('active');
        b.style.color = 'var(--text-muted)';
      });
      btn.classList.add('active');
      btn.style.color = 'var(--color-secondary)';
      
      // Toggle visibility
      const targetId = btn.getAttribute('data-tab');
      tabContents.forEach(content => {
        content.style.display = content.id === targetId ? 'block' : 'none';
      });
      
      // Load specific lists if required
      if (targetId === 'tab-versions') {
        loadVersionHistory();
      } else if (targetId === 'tab-audit') {
        loadAuditLogs();
      }
    });
  });

  // Slider Temperature Value Linker
  const sliderTemp = document.getElementById('cfg-temperature');
  const tempSpan = document.getElementById('tempValNew');
  if (sliderTemp && tempSpan) {
    sliderTemp.addEventListener('input', (e) => {
      tempSpan.textContent = e.target.value;
    });
  }

  // Welcome experience greeting handlers
  const welcomeTextarea = document.getElementById('cfg-welcome_message');
  const charCounter = document.getElementById('charCountWelcome');
  const previewDiv = document.getElementById('welcomePreview');
  const btnReset = document.getElementById('btnResetWelcome');

  function getTimeGreeting() {
    const hr = new Date().getHours();
    if (hr < 12) return "Good Morning";
    if (hr < 17) return "Good Afternoon";
    if (hr < 21) return "Good Evening";
    return "Good Night";
  }

  function updateWelcomePreview() {
    if (!welcomeTextarea) return;
    const rawText = welcomeTextarea.value || "";
    charCounter.innerText = `${rawText.length} / 1000`;
    
    const companionName = document.getElementById('cfg-ai_companion_name').value || "gayu";
    const instName = document.getElementById('cfg-institution_name').value || "Gayathri Central School";
    const timeGreeting = getTimeGreeting();

    let rendered = rawText
      .replace(/\{\{assistant_name\}\}/g, companionName)
      .replace(/\{\{school_name\}\}/g, instName)
      .replace(/\{\{time_greeting\}\}/g, timeGreeting);

    previewDiv.innerText = rendered;
  }

  if (welcomeTextarea) {
    welcomeTextarea.addEventListener('input', updateWelcomePreview);
    document.getElementById('cfg-ai_companion_name').addEventListener('input', updateWelcomePreview);
    document.getElementById('cfg-institution_name').addEventListener('input', updateWelcomePreview);

    btnReset.addEventListener('click', () => {
      welcomeTextarea.value = "Welcome back. I am {{assistant_name}}. Ask me anything about school policies, admission, innovation lab launches, or timings.";
      updateWelcomePreview();
      // Trigger change tracking to activate Save button if page tracks input changes
      welcomeTextarea.dispatchEvent(new Event('input'));
    });
  }

  // Load configuration from central configuration API
  const backendUrl = (window.APP_CONFIG && window.APP_CONFIG.BACKEND_URL) || "http://localhost:8100";
  
  loadCentralConfig();

  function loadCentralConfig() {
    fetch(`${backendUrl}/config`)
      .then(res => res.json())
      .then(data => {
        if (!data) return;
        
        // General settings
        if (data.general) {
          const instName = data.general.institution_name || "";
          document.getElementById('cfg-institution_name').value = instName;
          document.getElementById('cfg-ai_companion_name').value = data.general.ai_companion_name || "";
          document.getElementById('cfg-contact_email').value = data.general.contact_email || "";
          document.getElementById('cfg-contact_phone').value = data.general.contact_phone || "";
          document.getElementById('cfg-office_address').value = data.general.office_address || "";
          
          if (instName) {
            document.title = `${instName} - Administration Portal`;
            const logo = document.querySelector('.brand-logo');
            if (logo) logo.textContent = instName.toUpperCase();
          }
        }
        
        // AI settings
        if (data.ai) {
          document.getElementById('cfg-current_model').value = data.ai.current_model || "";
          document.getElementById('cfg-temperature').value = data.ai.temperature || 0.7;
          if (tempSpan) tempSpan.textContent = data.ai.temperature || 0.7;
          document.getElementById('cfg-max_context').value = data.ai.max_context || 4096;
          document.getElementById('cfg-max_tokens').value = data.ai.max_tokens || 2048;
          document.getElementById('cfg-response_timeout').value = data.ai.response_timeout || 30;
          document.getElementById('cfg-streaming').checked = !!data.ai.streaming;
          document.getElementById('cfg-allow_general_knowledge').checked = !!data.ai.allow_general_knowledge;
        }
        
        // KB settings
        if (data.kb) {
          document.getElementById('cfg-supported_file_types').value = (data.kb.supported_file_types || []).join(', ');
          document.getElementById('cfg-max_upload_size_mb').value = data.kb.max_upload_size_mb || 10;
          document.getElementById('cfg-embedding_model').value = data.kb.embedding_model || "";
          document.getElementById('cfg-chunk_size').value = data.kb.chunk_size || 1000;
          document.getElementById('cfg-chunk_overlap').value = data.kb.chunk_overlap || 200;
          document.getElementById('cfg-auto_reindex').checked = !!data.kb.auto_reindex;
        }
        
        // Security settings
        if (data.security) {
          document.getElementById('cfg-session_timeout_minutes').value = data.security.session_timeout_minutes || 30;
          document.getElementById('cfg-jwt_expiration_hours').value = data.security.jwt_expiration_hours || 24;
          document.getElementById('cfg-password_policy').value = data.security.password_policy || "";
          document.getElementById('cfg-admin_login_attempts').value = data.security.admin_login_attempts || 5;
          document.getElementById('cfg-account_lock_duration_seconds').value = data.security.account_lock_duration_seconds || 900;
        }
        
        // Branding settings
        if (data.branding) {
          document.getElementById('cfg-school_logo').value = data.branding.school_logo || "";
          document.getElementById('cfg-ai_mascot').value = data.branding.ai_mascot || "";
          document.getElementById('cfg-accent_color').value = data.branding.accent_color || "";
          document.getElementById('cfg-school_motto').value = data.branding.school_motto || "";
          document.getElementById('cfg-favicon').value = data.branding.favicon || "";
          if (welcomeTextarea) {
            welcomeTextarea.value = data.branding.welcome_message || "";
            updateWelcomePreview();
          }
        }
      })
      .catch(err => console.warn("Failed to load central settings:", err));
  }

  // Save Settings Workflow
  saveConfigBtn.addEventListener('click', () => {
    // Collect settings
    const typesInput = document.getElementById('cfg-supported_file_types').value;
    const fileTypes = typesInput.split(',').map(s => s.trim()).filter(Boolean);
    
    const payload = {
      general: {
        institution_name: document.getElementById('cfg-institution_name').value,
        ai_companion_name: document.getElementById('cfg-ai_companion_name').value,
        contact_email: document.getElementById('cfg-contact_email').value,
        contact_phone: document.getElementById('cfg-contact_phone').value,
        office_address: document.getElementById('cfg-office_address').value
      },
      ai: {
        current_model: document.getElementById('cfg-current_model').value,
        temperature: parseFloat(document.getElementById('cfg-temperature').value),
        max_context: parseInt(document.getElementById('cfg-max_context').value),
        streaming: document.getElementById('cfg-streaming').checked,
        max_tokens: parseInt(document.getElementById('cfg-max_tokens').value),
        response_timeout: parseInt(document.getElementById('cfg-response_timeout').value),
        allow_general_knowledge: document.getElementById('cfg-allow_general_knowledge').checked
      },
      kb: {
        supported_file_types: fileTypes,
        max_upload_size_mb: parseInt(document.getElementById('cfg-max_upload_size_mb').value),
        auto_reindex: document.getElementById('cfg-auto_reindex').checked,
        chunk_size: parseInt(document.getElementById('cfg-chunk_size').value),
        chunk_overlap: parseInt(document.getElementById('cfg-chunk_overlap').value),
        embedding_model: document.getElementById('cfg-embedding_model').value,
        auto_document_processing: true
      },
      security: {
        session_timeout_minutes: parseInt(document.getElementById('cfg-session_timeout_minutes').value),
        jwt_expiration_hours: parseInt(document.getElementById('cfg-jwt_expiration_hours').value),
        password_policy: document.getElementById('cfg-password_policy').value,
        admin_login_attempts: parseInt(document.getElementById('cfg-admin_login_attempts').value),
        account_lock_duration_seconds: parseInt(document.getElementById('cfg-account_lock_duration_seconds').value),
        role_defaults: "standard"
      },
      branding: {
        school_logo: document.getElementById('cfg-school_logo').value,
        ai_mascot: document.getElementById('cfg-ai_mascot').value,
        accent_color: document.getElementById('cfg-accent_color').value,
        school_motto: document.getElementById('cfg-school_motto').value,
        favicon: document.getElementById('cfg-favicon').value,
        welcome_message: document.getElementById('cfg-welcome_message').value
      }
    };

    fetch(`${backendUrl}/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(res => {
      if (!res.ok) {
        return res.json().then(d => { throw new Error(d.detail.errors.join(', ')); });
      }
      return res.json();
    })
    .then(() => {
      playSynthSound(987, 'sine', 0.2);
      showToast("Configuration Saved", "GSIP configurations updated on backend successfully.", "success");
      loadCentralConfig();
    })
    .catch(err => {
      console.error("Save config failed:", err);
      showToast("Save Failed", err.message || "Failed to update configurations.", "error");
    });
  });

  // Backup & Recovery triggers
  const btnDownloadBackup = document.getElementById('btnDownloadBackup');
  if (btnDownloadBackup) {
    btnDownloadBackup.addEventListener('click', () => {
      window.location.href = `${backendUrl}/config/backup`;
      showToast("Downloading Backup", "Creating encrypted backup package...", "info");
    });
  }

  const btnRestoreBackup = document.getElementById('btnRestoreBackup');
  const restoreFileSelector = document.getElementById('restoreFileSelector');
  if (btnRestoreBackup && restoreFileSelector) {
    btnRestoreBackup.addEventListener('click', () => {
      restoreFileSelector.click();
    });

    restoreFileSelector.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (confirm(`Are you sure you want to restore the system to backup package '${file.name}'? All current settings and uploaded documents will be overwritten.`)) {
        const formData = new FormData();
        formData.append("file", file);

        fetch(`${backendUrl}/config/restore`, {
          method: 'POST',
          body: formData
        })
        .then(res => res.json())
        .then(data => {
          if (data.status === "success" || data.message) {
            showToast("System Restored", "All configurations and assets reloaded.", "success");
            loadCentralConfig();
          } else {
            showToast("Restore Failed", data.detail || "Verification failed.", "error");
          }
        })
        .catch(err => {
          console.error("Restore failed:", err);
          showToast("Restore Failed", "Failed to upload or parse package.", "error");
        });
      }
    });
  }

  // Load Version History
  function loadVersionHistory() {
    const listBody = document.getElementById('configVersionList');
    if (!listBody) return;
    
    fetch(`${backendUrl}/config/history`)
      .then(res => res.json())
      .then(data => {
        listBody.innerHTML = '';
        if (!data || data.length === 0) {
          listBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">No saved versions found.</td></tr>`;
          return;
        }
        
        data.reverse().forEach(v => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>Ver ${v.version}</td>
            <td>${v.saved_by}</td>
            <td>${v.timestamp}</td>
            <td><button class="restore-ver-btn btn" data-ver="${v.version}" style="font-size:0.8rem; padding:0.25rem 0.5rem; background:rgba(0,242,254,0.1); border:1px solid var(--color-secondary); border-radius:4px; color:var(--color-secondary); cursor:pointer;">Restore</button></td>
          `;
          listBody.appendChild(tr);
        });
        
        // Attach restore click handlers
        listBody.querySelectorAll('.restore-ver-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const ver = btn.getAttribute('data-ver');
            if (confirm(`Do you want to rollback configurations to Version ${ver}?`)) {
              fetch(`${backendUrl}/config/history/restore/${ver}`, { method: 'POST' })
                .then(res => res.json())
                .then(() => {
                  showToast("Version Rolled Back", `Configuration restored to Version ${ver}.`, "success");
                  loadCentralConfig();
                  loadVersionHistory();
                });
            }
          });
        });
      })
      .catch(err => console.error("Failed to load versions:", err));
  }

  // Load Audit Logs
  function loadAuditLogs() {
    const listBody = document.getElementById('configAuditLogList');
    if (!listBody) return;
    
    fetch(`${backendUrl}/config/audit`)
      .then(res => res.json())
      .then(data => {
        listBody.innerHTML = '';
        if (!data || data.length === 0) {
          listBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">No audit logs captured yet.</td></tr>`;
          return;
        }
        
        data.reverse().forEach(log => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${log.timestamp}</td>
            <td>${log.administrator}</td>
            <td>${log.module}</td>
            <td>${log.setting}</td>
            <td><code style="color:var(--text-dim);">${log.old_value}</code></td>
            <td><code style="color:var(--color-secondary);">${log.new_value}</code></td>
          `;
          listBody.appendChild(tr);
        });
      })
      .catch(err => console.error("Failed to load audit logs:", err));
  }

  // --- Console System Preferences Settings (MODULE 6) ---
  const settingsInstName = document.getElementById('settings-inst-name');
  const settingsCompanionName = document.getElementById('settings-companion-name');
  const settingsAdminEmail = document.getElementById('settings-admin-email');
  const settingsBtnSave = document.getElementById('settings-btn-save');
  const settingsBtnBackup = document.getElementById('settings-btn-backup');
  const settingsBtnRestore = document.getElementById('settings-btn-restore');
  const settingsFileRestore = document.getElementById('settings-file-restore');

  let originalSettings = {
    institution_name: "",
    virtual_companion_name: "",
    admin_contact_email: ""
  };

  function loadSettingsPanel() {
    if (!settingsInstName) return;
    fetch(`${backendUrl}/api/settings`)
      .then(res => res.json())
      .then(data => {
        originalSettings = {
          institution_name: data.institution_name || "",
          virtual_companion_name: data.virtual_companion_name || "",
          admin_contact_email: data.admin_contact_email || ""
        };
        settingsInstName.value = originalSettings.institution_name;
        settingsCompanionName.value = originalSettings.virtual_companion_name;
        settingsAdminEmail.value = originalSettings.admin_contact_email;
        settingsBtnSave.disabled = true;
      })
      .catch(err => console.error("Failed to load settings panel:", err));
  }

  function checkSettingsModified() {
    if (!settingsInstName) return;
    const modified = 
      settingsInstName.value.trim() !== originalSettings.institution_name ||
      settingsCompanionName.value.trim() !== originalSettings.virtual_companion_name ||
      settingsAdminEmail.value.trim() !== originalSettings.admin_contact_email;
    settingsBtnSave.disabled = !modified;
  }

  if (settingsInstName) {
    [settingsInstName, settingsCompanionName, settingsAdminEmail].forEach(input => {
      input.addEventListener('input', checkSettingsModified);
    });
  }

  if (settingsBtnSave) {
    settingsBtnSave.addEventListener('click', () => {
      const instName = settingsInstName.value.trim();
      const compName = settingsCompanionName.value.trim();
      const email = settingsAdminEmail.value.trim();

      // Validation
      if (!instName) {
        showToast("Validation Error", "Institution Name is required.", "error");
        return;
      }
      if (!compName) {
        showToast("Validation Error", "Virtual Companion Name is required.", "error");
        return;
      }
      if (!email.includes('@') || !email.includes('.')) {
        showToast("Validation Error", "Please provide a valid administrative contact email address.", "error");
        return;
      }

      // Prevent duplicate submissions and show loading state
      settingsBtnSave.disabled = true;
      const originalHtml = settingsBtnSave.innerHTML;
      settingsBtnSave.innerHTML = `<i data-lucide="loader" class="spin" style="animation: spin 1s linear infinite;"></i> Saving...`;
      lucide.createIcons();

      fetch(`${backendUrl}/api/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institution_name: instName,
          virtual_companion_name: compName,
          admin_contact_email: email
        })
      })
      .then(res => {
        if (!res.ok) {
          return res.json().then(data => { throw new Error(data.detail || "Failed to save settings"); });
        }
        return res.json();
      })
      .then(() => {
        playSynthSound(987, 'sine', 0.2);
        showToast("Settings Saved", "✓ Settings saved successfully. Changes applied immediately.", "success");
        originalSettings = {
          institution_name: instName,
          virtual_companion_name: compName,
          admin_contact_email: email
        };
        // Re-enable and reset Save button
        settingsBtnSave.innerHTML = originalHtml;
        settingsBtnSave.disabled = true;
        lucide.createIcons();
        
        // Reload all configuration screens
        loadCentralConfig();
        loadSettingsPanel();
      })
      .catch(err => {
        console.error("Save settings error:", err);
        showToast("Save Failed", err.message || "Could not save settings.", "error");
        settingsBtnSave.innerHTML = originalHtml;
        settingsBtnSave.disabled = false;
        lucide.createIcons();
      });
    });
  }

  // Backup & Recovery hooks
  if (settingsBtnBackup) {
    settingsBtnBackup.addEventListener('click', () => {
      window.location.href = `${backendUrl}/api/settings/backup`;
      showToast("Downloading Backup", "Creating encrypted backup package...", "info");
    });
  }

  if (settingsBtnRestore && settingsFileRestore) {
    settingsBtnRestore.addEventListener('click', () => {
      settingsFileRestore.click();
    });

    settingsFileRestore.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (confirm(`Are you sure you want to restore the system to backup package '${file.name}'? All current settings and uploaded documents will be overwritten.`)) {
        const formData = new FormData();
        formData.append("file", file);

        fetch(`${backendUrl}/api/settings/restore`, {
          method: 'POST',
          body: formData
        })
        .then(res => res.json())
        .then(data => {
          if (data.status === "success" || data.message) {
            showToast("System Restored", "All configurations and assets reloaded.", "success");
            loadCentralConfig();
            loadSettingsPanel();
          } else {
            showToast("Restore Failed", data.detail || "Verification failed.", "error");
          }
        })
        .catch(err => {
          console.error("Restore failed:", err);
          showToast("Restore Failed", "Failed to upload or parse package.", "error");
        });
      }
    });
  }

  loadSettingsPanel();

  // Real Knowledge Base and Categories Manager
  const uploadDocModal = document.getElementById('uploadDocModal');
  const addCategoryModal = document.getElementById('addCategoryModal');
  
  const btnCancelUpload = document.getElementById('btnCancelUpload');
  const btnStartUpload = document.getElementById('btnStartUpload');
  const uploadFileInput = document.getElementById('uploadFileInput');
  const uploadCategorySelect = document.getElementById('uploadCategorySelect');
  const uploadProgressContainer = document.getElementById('uploadProgressContainer');
  const uploadStatusText = document.getElementById('uploadStatusText');
  
  const btnCancelCategory = document.getElementById('btnCancelCategory');
  const btnSaveCategory = document.getElementById('btnSaveCategory');
  const categoryNameInput = document.getElementById('categoryNameInput');
  const categoryDescInput = document.getElementById('categoryDescInput');
  const categoryColorInput = document.getElementById('categoryColorInput');
  
  const documentsTableBody = document.getElementById('documents-table-body');
  const categoriesGrid = document.getElementById('categories-grid');

  if (uploadDocBtn) {
    uploadDocBtn.addEventListener('click', () => {
      uploadDocModal.style.display = 'flex';
      uploadFileInput.value = '';
      uploadProgressContainer.style.display = 'none';
      populateCategoriesDropdown();
      playSynthSound(523.25, 'sine', 0.1);
    });
  }
  
  if (addCategoryBtn) {
    addCategoryBtn.addEventListener('click', () => {
      addCategoryModal.style.display = 'flex';
      categoryNameInput.value = '';
      categoryDescInput.value = '';
      categoryColorInput.value = '#06b6d4';
      playSynthSound(587.33, 'sine', 0.1);
    });
  }
  
  if (btnCancelUpload) {
    btnCancelUpload.addEventListener('click', () => {
      uploadDocModal.style.display = 'none';
    });
  }
  if (btnCancelCategory) {
    btnCancelCategory.addEventListener('click', () => {
      addCategoryModal.style.display = 'none';
    });
  }

  function loadAdminCategories() {
    fetch(`${backendUrl}/api/documents/categories`)
      .then(res => res.json())
      .then(cats => {
        if (!categoriesGrid) return;
        if (!cats || cats.length === 0) {
          categoriesGrid.innerHTML = `
            <div style="text-align:center; padding:1rem; color:var(--text-muted);">
              <i data-lucide="tag" style="width:32px; height:32px; margin-bottom:0.5rem; opacity:0.5; display:block; margin-left:auto; margin-right:auto;"></i>
              No categories created.
            </div>
          `;
          lucide.createIcons();
          return;
        }
        
        categoriesGrid.innerHTML = cats.map(c => `
          <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border-glass); padding:0.5rem 1rem; border-radius:20px; display:flex; align-items:center; gap:0.5rem; border-left: 3px solid ${c.color};">
            <span style="font-weight:600; color:var(--text-core); font-size:0.85rem;">${c.name}</span>
            <button class="delete-cat-btn" data-name="${c.name}" style="background:none; border:none; color:var(--color-primary); cursor:pointer; font-size:1rem; line-height:1; display:flex; align-items:center; padding:0 0 0 0.25rem;">&times;</button>
          </div>
        `).join('');
        
        categoriesGrid.querySelectorAll('.delete-cat-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const name = e.target.getAttribute('data-name');
            if (confirm(`Are you sure you want to delete category "${name}"? Files inside this category will be reset to Uncategorized.`)) {
              deleteCategory(name);
            }
          });
        });
      });
  }

  function deleteCategory(name) {
    fetch(`${backendUrl}/api/documents/categories/${encodeURIComponent(name)}`, {
      method: 'DELETE'
    })
    .then(res => res.json())
    .then(() => {
      showToast("Category Deleted", `Category "${name}" was removed successfully.`, "success");
      loadAdminCategories();
      loadAdminDocuments();
    });
  }

  function populateCategoriesDropdown() {
    fetch(`${backendUrl}/api/documents/categories`)
      .then(res => res.json())
      .then(cats => {
        if (!uploadCategorySelect) return;
        let opts = '<option value="Uncategorized">Uncategorized</option>';
        if (cats && cats.length > 0) {
          opts += cats.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
        }
        uploadCategorySelect.innerHTML = opts;
      });
  }

  if (btnSaveCategory) {
    btnSaveCategory.addEventListener('click', () => {
      const name = categoryNameInput.value.trim();
      const desc = categoryDescInput.value.trim();
      const color = categoryColorInput.value;
      if (!name) {
        showToast("Validation Error", "Category Name is required.", "warning");
        return;
      }
      
      fetch(`${backendUrl}/api/documents/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: desc, color })
      })
      .then(res => {
        if (!res.ok) return res.json().then(e => { throw new Error(e.detail || "Failed"); });
        return res.json();
      })
      .then(() => {
        showToast("Category Created", `Category "${name}" saved successfully.`, "success");
        addCategoryModal.style.display = 'none';
        loadAdminCategories();
      })
      .catch(err => {
        showToast("Creation Failed", err.message, "error");
      });
    });
  }

  function loadAdminDocuments() {
    fetch(`${backendUrl}/api/documents`)
      .then(res => res.json())
      .then(docs => {
        if (!documentsTableBody) return;
        if (!docs || docs.length === 0) {
          documentsTableBody.innerHTML = `
            <tr>
              <td colspan="5" style="text-align:center; padding:3rem; color:var(--text-muted);">
                <i data-lucide="folder-open" style="width:48px; height:48px; margin-bottom:1rem; opacity:0.5; color:var(--text-muted); display:block; margin-left:auto; margin-right:auto;"></i>
                No documents have been uploaded yet.
              </td>
            </tr>
          `;
          lucide.createIcons();
          return;
        }
        
        documentsTableBody.innerHTML = docs.map(d => {
          const sizeKb = (d.size / 1024).toFixed(1);
          let statusBadge = `<span style="background:rgba(6, 182, 212, 0.15); color:var(--color-secondary); padding:0.25rem 0.5rem; border-radius:4px; font-size:0.75rem;">${d.status}</span>`;
          if (d.status === "Ready") {
            statusBadge = `<span style="background:rgba(16, 185, 129, 0.15); color:#10b981; padding:0.25rem 0.5rem; border-radius:4px; font-size:0.75rem;">Ready</span>`;
          } else if (d.status === "Error") {
            statusBadge = `<span style="background:rgba(239, 68, 68, 0.15); color:#ef4444; padding:0.25rem 0.5rem; border-radius:4px; font-size:0.75rem;">Error</span>`;
          }
          
          return `
            <tr>
              <td style="font-weight:600; color:var(--text-core);">${d.filename} (${sizeKb} KB)</td>
              <td><span style="font-size:0.8rem; background:rgba(255,255,255,0.05); padding:0.2rem 0.5rem; border-radius:4px;">${d.category}</span></td>
              <td>${d.upload_date}</td>
              <td>${statusBadge}</td>
              <td>
                <button class="delete-doc-btn action-btn-sm" data-file="${d.filename}" style="background:rgba(239,68,68,0.2); color:#ef4444; border:none; padding:0.3rem 0.6rem; border-radius:4px; cursor:pointer;">
                  Delete
                </button>
              </td>
            </tr>
          `;
        }).join('');
        
        documentsTableBody.querySelectorAll('.delete-doc-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const filename = e.target.getAttribute('data-file');
            if (confirm(`Are you sure you want to delete "${filename}"?`)) {
              deleteDocument(filename);
            }
          });
        });
        
        const inProgress = docs.some(d => ["Uploading", "Extracting", "Indexing"].includes(d.status));
        if (inProgress) {
          setTimeout(loadAdminDocuments, 2000);
        }
      });
  }

  function deleteDocument(filename) {
    fetch(`${backendUrl}/api/documents/${encodeURIComponent(filename)}`, {
      method: 'DELETE'
    })
    .then(res => res.json())
    .then(() => {
      showToast("Document Deleted", `"${filename}" was deleted successfully.`, "success");
      loadAdminDocuments();
    });
  }

  if (btnStartUpload) {
    btnStartUpload.addEventListener('click', () => {
      const files = uploadFileInput.files;
      if (!files || files.length === 0) {
        showToast("Validation Error", "Please select at least one file to upload.", "warning");
        return;
      }
      
      const category = uploadCategorySelect.value;
      const file = files[0];
      
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", category);
      
      uploadProgressContainer.style.display = 'block';
      uploadStatusText.innerText = "Uploading file to server...";
      
      fetch(`${backendUrl}/api/documents/upload`, {
        method: 'POST',
        body: formData
      })
      .then(res => {
        if (!res.ok) return res.json().then(e => { throw new Error(e.detail || "Upload failed"); });
        return res.json();
      })
      .then(data => {
        showToast("Upload Successful", `"${file.name}" has been uploaded and queued for processing.`, "success");
        uploadDocModal.style.display = 'none';
        loadAdminDocuments();
      })
      .catch(err => {
        showToast("Upload Failed", err.message, "error");
        uploadProgressContainer.style.display = 'none';
      });
    });
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function connectStateStream() {
    const sseUrl = `${backendUrl}/api/state/stream`;
    console.log("Connecting state telemetry stream to", sseUrl);
    const eventSource = new EventSource(sseUrl);
    
    eventSource.onmessage = (event) => {
      try {
        const state = JSON.parse(event.data);
        
        // Update telemetry cards
        const mDocs = document.getElementById('metrics-docs');
        const mQueries = document.getElementById('metrics-queries');
        const mCats = document.getElementById('metrics-categories');
        const mStorage = document.getElementById('metrics-storage');
        
        if (mDocs) mDocs.innerText = state.metrics.total_documents;
        if (mQueries) mQueries.innerText = state.metrics.queries_today;
        if (mCats) mCats.innerText = state.metrics.total_categories;
        if (mStorage) mStorage.innerText = formatBytes(state.metrics.storage_used_bytes);
        
        // Update Hybrid metrics
        const elStruct = document.getElementById('met-struct-records');
        const elEntities = document.getElementById('met-entities');
        const elEmbeddings = document.getElementById('met-embeddings');
        const elChunks = document.getElementById('met-chunks');
        const elSuccess = document.getElementById('met-success-rate');
        const elFailed = document.getElementById('met-failed-ret');
        const elBg = document.getElementById('met-bg-jobs');
        const elQueue = document.getElementById('met-queue');
        const elUsers = document.getElementById('met-users');
        const elSync = document.getElementById('met-sync');
        
        if (elStruct) elStruct.innerText = state.metrics.structured_records;
        if (elEntities) elEntities.innerText = state.metrics.total_entities;
        if (elEmbeddings) elEmbeddings.innerText = state.metrics.total_embeddings;
        if (elChunks) elChunks.innerText = state.metrics.total_vector_chunks;
        if (elSuccess) elSuccess.innerText = state.metrics.retrieval_success_rate;
        if (elFailed) elFailed.innerText = state.metrics.failed_retrievals;
        if (elBg) elBg.innerText = state.metrics.background_jobs;
        if (elQueue) elQueue.innerText = state.metrics.queue_size;
        if (elUsers) elUsers.innerText = state.metrics.active_users;
        if (elSync) elSync.innerText = state.metrics.last_synchronization;
        
        // Update Observability Panel
        if (state.last_trace) {
          const obsIntent = document.getElementById('obs-intent');
          const obsEngine = document.getElementById('obs-engine');
          const obsConf = document.getElementById('obs-confidence');
          const obsCache = document.getElementById('obs-cache-hits');
          const obsTime = document.getElementById('obs-time');
          const obsEvidence = document.getElementById('obs-evidence');
          
          if (obsIntent) obsIntent.innerText = state.last_trace.intent;
          if (obsEngine) obsEngine.innerText = state.last_trace.engine;
          if (obsConf) obsConf.innerText = state.last_trace.confidence;
          if (obsCache) obsCache.innerText = state.last_trace.cache_hits;
          if (obsTime) obsTime.innerText = state.last_trace.latency_ms;
          if (obsEvidence) obsEvidence.innerText = state.last_trace.evidence;
        }
        
        if (state.metrics.total_documents !== currentDocCount || state.metrics.pending_documents !== currentPendingCount) {
          loadAdminDocuments();
          currentDocCount = state.metrics.total_documents;
          currentPendingCount = state.metrics.pending_documents;
        }
        
        if (state.metrics.total_categories !== currentCatCount) {
          loadAdminCategories();
          currentCatCount = state.metrics.total_categories;
        }
        
        if (state.metrics.queries_today !== currentQueryCount) {
          loadConversationLogs();
          currentQueryCount = state.metrics.queries_today;
        }
        
        // Health Indicators
        const hOllama = document.getElementById('health-ollama');
        const cardOllama = document.getElementById('card-ollama');
        if (hOllama && cardOllama) {
          hOllama.innerText = state.health.ollama;
          if (state.health.ollama === "ONLINE") {
            cardOllama.className = "health-card green";
          } else {
            cardOllama.className = "health-card red";
          }
        }
        
        const hModel = document.getElementById('health-model');
        if (hModel) hModel.innerText = state.health.llm_loaded;
        
        const hVdb = document.getElementById('health-vectordb');
        const cardVdb = document.getElementById('card-vectordb');
        if (hVdb && cardVdb) {
          hVdb.innerText = state.health.vectordb === "CONNECTED" ? "CONNECTED" : "OFFLINE";
          if (state.health.vectordb === "CONNECTED") {
            cardVdb.className = "health-card green";
          } else {
            cardVdb.className = "health-card red";
          }
        }
        
        const hEmbed = document.getElementById('health-embedding');
        const cardEmbed = document.getElementById('card-embedding');
        if (hEmbed && cardEmbed) {
          hEmbed.innerText = state.health.embedding;
          if (state.health.embedding === "BUSY") {
            cardEmbed.className = "health-card orange";
          } else {
            cardEmbed.className = "health-card";
          }
        }
        
        // Latency
        const lAvg = document.getElementById('latency-avg');
        if (lAvg) lAvg.innerText = `${state.metrics.avg_latency_seconds}s`;
        
        // Resource analytics
        const sysCpu = document.getElementById('sys-cpu');
        const sysCpuBar = document.getElementById('sys-cpu-bar');
        if (sysCpu && sysCpuBar) {
          sysCpu.innerText = `${state.resources.cpu}%`;
          sysCpuBar.style.width = `${state.resources.cpu}%`;
        }
        
        const sysMem = document.getElementById('sys-mem');
        const sysMemBar = document.getElementById('sys-mem-bar');
        if (sysMem && sysMemBar) {
          sysMem.innerText = `${state.resources.memory}%`;
          sysMemBar.style.width = `${state.resources.memory}%`;
        }
        
        const sysDisk = document.getElementById('sys-disk');
        const sysDiskBar = document.getElementById('sys-disk-bar');
        if (sysDisk && sysDiskBar) {
          sysDisk.innerText = `${state.resources.disk}%`;
          sysDiskBar.style.width = `${state.resources.disk}%`;
        }
      } catch (err) {
        console.error("Error processing stream message:", err);
      }
    };
    
    eventSource.onerror = (err) => {
      console.warn("Telemetry stream error, reconnecting in 5s...", err);
      eventSource.close();
      setTimeout(connectStateStream, 5000);
    };
  }

  function loadHealthDiagnostics() {
    fetch(`${backendUrl}/api/state/diagnostics/full`)
      .then(res => res.json())
      .then(diag => {
        const hScore = document.getElementById('health-score');
        if (hScore) hScore.innerText = `${diag.score}%`;
        
        const subsystemList = document.getElementById('subsystem-health-list');
        if (subsystemList) {
          subsystemList.innerHTML = diag.subsystems.map(sub => {
            const isHealthy = sub.status === "Healthy";
            const indicatorColor = isHealthy ? "#10b981" : "#ef4444";
            const badgeBg = isHealthy ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)";
            return `
              <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border-glass); padding:0.75rem 1rem; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <strong style="color:var(--text-core); font-size:0.9rem;">${sub.name}</strong>
                  <div style="font-size:0.75rem; color:var(--text-dim); margin-top:0.15rem;">${sub.details}</div>
                </div>
                <span style="background:${badgeBg}; color:${indicatorColor}; padding:0.25rem 0.5rem; border-radius:4px; font-size:0.75rem; font-weight:600;">${sub.status}</span>
              </div>
            `;
          }).join('');
        }
        
        const repairLogs = document.getElementById('health-repair-logs');
        if (repairLogs) {
          if (!diag.logs || diag.logs.length === 0) {
            repairLogs.innerHTML = `<p style="text-align:center; padding:2rem; color:var(--text-muted); font-size:0.85rem;">No heal operations recorded yet.</p>`;
          } else {
            repairLogs.innerHTML = diag.logs.slice().reverse().map(l => `
              <div style="background:rgba(255,255,255,0.02); border-left:3px solid var(--color-primary); padding:0.75rem; border-radius:6px; font-size:0.8rem; display:flex; flex-direction:column; gap:0.2rem;">
                <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--text-dim);">
                  <span>${l.timestamp} [${l.subsystem}]</span>
                  <span style="color:var(--color-secondary); font-weight:600;">${l.severity}</span>
                </div>
                <div style="color:var(--text-core); font-weight:500;">Cause: ${l.cause}</div>
                <div style="color:var(--text-dim); font-size:0.75rem;">Attempt: ${l.attempt} &rarr; <strong>${l.result}</strong></div>
              </div>
            `).join('');
          }
        }
        
        populateDiagnosticsDocSelect();
      })
      .catch(err => console.warn("Failed to retrieve diagnostics status:", err));
  }

  const btnRunDiag = document.getElementById('btn-run-diag');
  const healthDebuggerDocSelect = document.getElementById('health-debugger-doc-select');
  const healthDebuggerResults = document.getElementById('health-debugger-results');
  
  if (btnRunDiag && healthDebuggerDocSelect) {
    btnRunDiag.addEventListener('click', () => {
      const doc = healthDebuggerDocSelect.value;
      if (!doc) {
        showToast("Validation Error", "Please select a document to trace.", "warning");
        return;
      }
      
      healthDebuggerResults.style.display = 'flex';
      document.getElementById('diag-pages').innerText = 'Scanning...';
      document.getElementById('diag-chars').innerText = 'Scanning...';
      document.getElementById('diag-chunks').innerText = 'Scanning...';
      document.getElementById('diag-verification').innerText = 'Scanning...';
      document.getElementById('diag-text-preview').innerText = 'Reading text cache...';
      
      const traceLog = document.getElementById('diag-trace-log');
      traceLog.innerHTML = '<p style="color:var(--text-dim); font-size:0.85rem;">Running diagnostic trace query...</p>';
      
      fetch(`${backendUrl}/api/state/diagnostics/trace/${encodeURIComponent(doc)}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            document.getElementById('diag-pages').innerText = data.pages;
            document.getElementById('diag-chars').innerText = data.characters;
            document.getElementById('diag-chunks').innerText = data.chunks;
            document.getElementById('diag-verification').innerText = 'Success';
            document.getElementById('diag-text-preview').innerText = data.preview + '\n...';
          } else {
            document.getElementById('diag-verification').innerText = 'Failed';
          }
          
          traceLog.innerHTML = data.stages.map(s => {
            const isPass = s.status === 'PASS';
            const badgeBg = isPass ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)';
            const textCol = isPass ? '#10b981' : '#ef4444';
            return `
              <div style="background:rgba(255,255,255,0.01); border:1px solid var(--border-glass); padding:0.5rem; border-radius:6px; display:flex; justify-content:space-between; align-items:center; font-size:0.8rem;">
                <div>
                  <strong>${s.stage}</strong>
                  <div style="font-size:0.75rem; color:var(--text-dim); margin-top:0.15rem;">${s.details}</div>
                </div>
                <span style="background:${badgeBg}; color:${textCol}; padding:0.15rem 0.4rem; border-radius:4px; font-weight:600;">${s.status}</span>
              </div>
            `;
          }).join('');
        })
        .catch(err => {
          traceLog.innerHTML = `<p style="color:#ef4444; font-size:0.85rem;">Trace failed: ${err.message}</p>`;
        });
    });
  }

  function populateDiagnosticsDocSelect() {
    const docSelect = document.getElementById('health-debugger-doc-select');
    if (!docSelect) return;
    
    fetch(`${backendUrl}/api/documents`)
      .then(res => res.json())
      .then(docs => {
        const val = docSelect.value;
        let opts = '<option value="">Select a document to trace...</option>';
        if (docs && docs.length > 0) {
          opts += docs.map(d => `<option value="${d.filename}">${d.filename}</option>`).join('');
        }
        docSelect.innerHTML = opts;
        docSelect.value = val;
      });
  }

  const btnRunSelfTest = document.getElementById('btn-run-self-test');
  const selfTestResults = document.getElementById('self-test-results');
  const selfTestOverallStatus = document.getElementById('self-test-overall-status');
  const selfTestLogs = document.getElementById('self-test-logs');
  
  if (btnRunSelfTest) {
    btnRunSelfTest.addEventListener('click', () => {
      selfTestResults.style.display = 'flex';
      selfTestOverallStatus.innerText = 'Status: Running Self-Test...';
      selfTestLogs.innerHTML = '<p style="color:var(--text-dim); font-size:0.85rem;">Initializing automated diagnostic checks...</p>';
      
      fetch(`${backendUrl}/api/state/diagnostics/self-test`, {
        method: 'POST'
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          selfTestOverallStatus.innerText = 'Status: PASS';
          selfTestOverallStatus.style.color = '#10b981';
        } else {
          selfTestOverallStatus.innerText = 'Status: FAILED';
          selfTestOverallStatus.style.color = '#ef4444';
        }
        
        selfTestLogs.innerHTML = data.stages.map(s => {
          const isPass = s.status === 'PASS';
          const badgeBg = isPass ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)';
          const textCol = isPass ? '#10b981' : '#ef4444';
          return `
            <div style="background:rgba(255,255,255,0.01); border:1px solid var(--border-glass); padding:0.5rem; border-radius:6px; display:flex; justify-content:space-between; align-items:center; font-size:0.8rem;">
              <div>
                <strong>${s.stage}</strong>
                <div style="font-size:0.75rem; color:var(--text-dim); margin-top:0.1rem;">${s.details}</div>
              </div>
              <span style="background:${badgeBg}; color:${textCol}; padding:0.15rem 0.4rem; border-radius:4px; font-weight:600;">${s.status}</span>
            </div>
          `;
        }).join('');
      })
      .catch(err => {
        selfTestOverallStatus.innerText = 'Status: ERROR';
        selfTestOverallStatus.style.color = '#ef4444';
        selfTestLogs.innerHTML = `<p style="color:#ef4444; font-size:0.85rem;">Self-test script encountered error: ${err.message}</p>`;
      });
    });
  }

  function loadConversationLogs() {
    const listBody = document.getElementById('logs-table-body');
    if (!listBody) return;
    
    fetch(`${backendUrl}/api/state/query_logs`)
      .then(res => res.json())
      .then(data => {
        listBody.innerHTML = '';
        if (!data || data.length === 0) {
          listBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:3rem; color:var(--text-muted);">No conversations recorded.</td></tr>`;
          return;
        }
        
        data.reverse().forEach(log => {
          const tr = document.createElement('tr');
          tr.style.cursor = 'pointer';
          tr.addEventListener('click', () => showLogDetailModal(log));
          tr.innerHTML = `
            <td>${log.timestamp}</td>
            <td><strong>${escapeHtml(log.user_question)}</strong></td>
            <td style="color:var(--text-dim);">${escapeHtml(log.final_answer ? log.final_answer.substring(0, 80) : '')}...</td>
            <td>${log.latency ? log.latency.toFixed(2) : 0.0}s</td>
            <td><span style="background:${log.fallback_reason !== 'None' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)'}; color:${log.fallback_reason !== 'None' ? '#f59e0b' : '#10b981'}; padding:0.15rem 0.4rem; border-radius:4px; font-weight:600;">${log.fallback_reason !== 'None' ? 'Fallback' : 'Direct'}</span></td>
          `;
          listBody.appendChild(tr);
        });
      })
      .catch(err => console.error("Failed to load conversation logs:", err));
  }

  function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
  }

  function showLogDetailModal(log) {
    let modal = document.getElementById('logDetailModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'logDetailModal';
      modal.style.position = 'fixed';
      modal.style.top = '0';
      modal.style.left = '0';
      modal.style.width = '100%';
      modal.style.height = '100%';
      modal.style.background = 'rgba(0,0,0,0.85)';
      modal.style.zIndex = '10000';
      modal.style.display = 'flex';
      modal.style.justifyContent = 'center';
      modal.style.alignItems = 'center';
      document.body.appendChild(modal);
    }
    
    const trace = `==============================
RAG EXECUTION TRACE
==============================
Request ID: ${log.uuid || 'N/A'}
Timestamp: ${log.timestamp}
Question: ${log.user_question}
Normalized Query: ${log.normalized_query || 'N/A'}
Embedding Model: nomic-embed-text
Embedding Generated: ${log.retrieved_chunks ? 'YES' : 'NO'}
Embedding Dimension: 768
Vector Database: CONNECTED
Indexed Documents: ${log.source_documents !== 'None' ? 1 : 0}
Search Performed: YES
Top Matches:
${log.retrieved_chunks ? log.retrieved_chunks.substring(0, 400) + '...' : 'None'}
Similarity score: ${log.similarity_scores ? JSON.stringify(log.similarity_scores) : '[]'}
Source: ${log.source_documents} | Page ${log.source_pages}
Prompt length: ${log.prompt_length || 0}
Response length: ${log.response_length || 0}
Latency: ${log.latency ? log.latency.toFixed(3) : 0}s
Answer Generated: YES
Fallback Triggered: ${log.fallback_reason !== 'None' ? 'YES' : 'NO'}
==============================`;

    modal.innerHTML = `
      <div style="background:#151515; border:1px solid var(--border-glass); padding:2rem; border-radius:12px; width:90%; max-width:650px; display:flex; flex-direction:column; gap:1.5rem; color:#fff; box-shadow:0 12px 30px rgba(0,0,0,0.5);">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h3 style="margin:0; font-size:1.25rem;">RAG Telemetry Trace Inspector</h3>
          <button onclick="document.getElementById('logDetailModal').style.display='none'" style="background:transparent; border:none; color:#fff; font-size:1.5rem; cursor:pointer;">&times;</button>
        </div>
        <pre style="background:#0a0a0a; border:1px solid rgba(255,255,255,0.05); padding:1rem; border-radius:8px; overflow-x:auto; font-family:monospace; font-size:0.85rem; max-height:400px; color:#a3a3a3; white-space:pre-wrap;">${escapeHtml(trace)}</pre>
        <button onclick="document.getElementById('logDetailModal').style.display='none'" style="background:rgba(255,255,255,0.05); border:1px solid var(--border-glass); padding:0.75rem; border-radius:6px; color:#fff; cursor:pointer;">Close Inspector</button>
      </div>
    `;
    modal.style.display = 'flex';
  }

  loadAdminCategories();
  loadAdminDocuments();
  connectStateStream();
  
  // Keep health diagnostics updated periodically
  setInterval(() => {
    const healthPanel = document.getElementById('panel-health');
    if (healthPanel && healthPanel.classList.contains('active')) {
      loadHealthDiagnostics();
    }
  }, 10000);
});
