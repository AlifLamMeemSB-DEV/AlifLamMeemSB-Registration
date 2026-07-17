// ============================================================
// CONFIGURATION
// ============================================================
const CONFIG = {
  GOOGLE_CLIENT_ID: '465804771564-9190vuj90oai3j5bdftt5fjvb79ajum7.apps.googleusercontent.com',
  JSONBIN_API_KEY: '$2a$10$tD7V0jOkd5x7PGodxlAQq.ZoppKxGGvTsj34m3e5bcjOGdMXbWOVO',
  JSONBIN_BIN_ID: '6a597caff5f4af5e299a3a82',
};

// ============================================================
// API SERVICE (JSONBin)
// ============================================================
function createEmptyBin() {
  return {
    users: [],
    applications: [],
    settings: {}
  };
}

function normalizeBinData(bin = {}) {
  return {
    users: Array.isArray(bin?.users) ? bin.users : [],
    applications: Array.isArray(bin?.applications) ? bin.applications : [],
    settings: bin?.settings && typeof bin.settings === 'object' ? bin.settings : {}
  };
}

const JsonBinService = {
  async getBin() {
    try {
      const res = await fetch(`https://api.jsonbin.io/v3/b/${CONFIG.JSONBIN_BIN_ID}`, {
        headers: { 'X-Master-Key': CONFIG.JSONBIN_API_KEY }
      });

      if (!res.ok) {
        if (res.status === 404) {
          const createdBin = await this.updateBin(createEmptyBin());
          return createdBin?.record || createdBin || createEmptyBin();
        }
        throw new Error('Failed to fetch bin');
      }

      const data = await res.json();
      return data.record || createEmptyBin();
    } catch (e) {
      console.error('API Error:', e);
      throw e;
    }
  },

  async updateBin(data) {
    try {
      const safeData = {
        ...createEmptyBin(),
        ...(data || {})
      };
      safeData.users = Array.isArray(data?.users) ? data.users : [];
      safeData.applications = Array.isArray(data?.applications) ? data.applications : [];
      safeData.settings = data?.settings && typeof data.settings === 'object' ? data.settings : {};

      const res = await fetch(`https://api.jsonbin.io/v3/b/${CONFIG.JSONBIN_BIN_ID}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': CONFIG.JSONBIN_API_KEY
        },
        body: JSON.stringify(safeData)
      });
      if (!res.ok) throw new Error('Failed to update bin');
      const response = await res.json();
      return response.record || response;
    } catch (e) {
      console.error('Update Error:', e);
      throw e;
    }
  }
};

// ============================================================
// STATE
// ============================================================
let appState = {
  currentUser: null,
  applications: [],
  users: [],
  settings: {},
  initialized: false
};

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================
function showToast(message, icon = 'fa-check-circle') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<i class="fas ${icon}"></i><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// ============================================================
// AUTH (Google Identity Services)
// ============================================================
function initGoogleAuth() {
  if (typeof google === 'undefined') {
    setTimeout(initGoogleAuth, 1000);
    return;
  }

  try {
    google.accounts.id.initialize({
      client_id: CONFIG.GOOGLE_CLIENT_ID,
      callback: handleGoogleCredential,
      cancel_on_tap_outside: false,
      use_fedcm_for_button: true,
    });

    renderGoogleButton();
    console.log('Google Auth initialized');
  } catch (e) {
    console.error('Google Auth init error:', e);
  }
}

function renderGoogleButton(container = null) {
  if (typeof google === 'undefined') return;
  
  const target = container || document.getElementById('authSection');
  if (!target) return;
  
  if (appState.currentUser) return;
  
  target.innerHTML = '';
  google.accounts.id.renderButton(target, {
    theme: 'outline',
    size: 'medium',
    text: 'signin_with',
    type: 'standard',
    shape: 'pill',
    logo_alignment: 'left'
  });
}

async function handleGoogleCredential(response) {
  try {
    const payload = parseJwt(response.credential);

    // 1. جلب البيانات من JSONBin
    const bin = await JsonBinService.getBin();
    const safeBin = normalizeBinData(bin);
    let users = safeBin.users;

    // 2. البحث عن المستخدم
    let user = users.find(u => u.googleId === payload.sub);

    if (!user) {
      // 3. إنشاء مستخدم جديد
      const isOwner = (payload.email || '').toLowerCase() === 'aliflammeemsb@gmail.com';
      user = {
        id: 'user_' + Date.now(),
        googleId: payload.sub,
        name: payload.name,
        email: payload.email,
        picture: payload.picture,
        role: isOwner ? 'admin' : 'student',
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString()
      };
      users.push(user);

      // 4. حفظ المستخدم الجديد في JSONBin
      safeBin.users = users;
      await JsonBinService.updateBin(safeBin);
      showToast('تم إنشاء الحساب بنجاح!', 'fa-user-plus');
    } else {
      // 5. تحديث وقت آخر تسجيل دخول
      const isOwner = (payload.email || '').toLowerCase() === 'aliflammeemsb@gmail.com';
      user.lastLogin = new Date().toISOString();
      user.role = isOwner ? 'admin' : (user.role || 'student');
      const idx = users.findIndex(u => u.googleId === payload.sub);
      if (idx !== -1) users[idx] = user;
      safeBin.users = users;
      await JsonBinService.updateBin(safeBin);
      showToast(`مرحباً بعودتك ${user.name}`, 'fa-smile');
    }

    // 6. تحديث الحالة المحلية
    appState.currentUser = user;
    appState.users = users;
    appState.applications = safeBin.applications;
    appState.settings = safeBin.settings;

    // 7. حفظ الجلسة محلياً
    localStorage.setItem('alif_user', JSON.stringify({
      googleId: user.googleId,
      name: user.name,
      email: user.email,
      picture: user.picture,
      role: user.role
    }));

    // 8. تحديث واجهة المستخدم
    updateAuthUI();

    // 9. التوجيه حسب الدور
    if (user.role === 'admin') {
      window.location.href = 'assets/dashboard.html';
    } else {
      navigateTo('status');
      // عرض حالة الطلب من البيانات المحلية
      const userApp = safeBin.applications.find(a => a.userId === user.googleId);
      renderStatus(userApp);
    }
  } catch (e) {
    showToast('خطأ في تسجيل الدخول: ' + e.message, 'fa-exclamation-triangle');
    console.error('Login error:', e);
  }
}

function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c =>
      '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    ).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('JWT parse error:', e);
    throw new Error('Invalid token');
  }
}

function updateAuthUI() {
  const section = document.getElementById('authSection');
  if (!section) return;

  if (appState.currentUser) {
    const user = appState.currentUser;
    section.innerHTML = `
      <img src="${user.picture}" style="width:32px; height:32px; border-radius:50%; border:2px solid var(--gold);" alt="avatar">
      <span style="font-weight:500; font-size:0.9rem;">${user.name.split(' ')[0]}</span>
      <button class="nav-btn nav-btn-outline" style="padding:6px 16px; font-size:0.8rem;" id="logoutBtn">
        <i class="fas fa-sign-out-alt"></i> خروج
      </button>
    `;
    document.getElementById('logoutBtn')?.addEventListener('click', logout);
  } else {
    renderGoogleButton(section);
  }
}

async function logout() {
  try {
    // 1. حذف الجلسة المحلية
    localStorage.removeItem('alif_user');
    appState.currentUser = null;
    
    // 2. تعطيل التحديد التلقائي من Google
    if (typeof google !== 'undefined') {
      google.accounts.id.disableAutoSelect();
    }
    
    // 3. تحديث واجهة المستخدم
    updateAuthUI();
    showToast('تم تسجيل الخروج بنجاح', 'fa-sign-out-alt');
    navigateTo('home');
  } catch (e) {
    console.error('Logout error:', e);
  }
}

async function checkExistingSession() {
  try {
    // 1. التحقق من الجلسة المحلية
    const savedUser = localStorage.getItem('alif_user');
    if (!savedUser) return false;

    const userData = JSON.parse(savedUser);

    // 2. جلب البيانات من JSONBin
    const bin = await JsonBinService.getBin();
    const safeBin = normalizeBinData(bin);
    const users = safeBin.users;
    const foundUser = users.find(u => u.googleId === userData.googleId);

    if (foundUser) {
      // 3. تحديث الحالة المحلية
      appState.currentUser = foundUser;
      appState.users = users;
      appState.applications = safeBin.applications;
      appState.settings = safeBin.settings;
      updateAuthUI();
      return true;
    } else {
      // 4. المستخدم غير موجود في JSONBin
      localStorage.removeItem('alif_user');
      return false;
    }
  } catch (e) {
    console.error('Session check failed:', e);
    return false;
  }
}

// ============================================================
// STATUS PAGE
// ============================================================
function renderStatus(app = null) {
  const container = document.getElementById('statusDisplay');
  if (!container) return;

  const user = appState.currentUser;

  if (!user) {
    container.innerHTML = `
      <div class="text-center" style="padding: 40px 0;">
        <i class="fas fa-google" style="font-size: 2rem; color: var(--gold);"></i>
        <p style="margin-top: 16px;">يرجى تسجيل الدخول لعرض حالة طلبك</p>
        <div id="statusGoogleBtn" style="margin-top: 16px;"></div>
      </div>
    `;
    const btnContainer = document.getElementById('statusGoogleBtn');
    if (btnContainer && typeof google !== 'undefined') {
      google.accounts.id.renderButton(btnContainer, {
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        type: 'standard',
        shape: 'pill'
      });
    }
    return;
  }

  // البحث عن طلب المستخدم
  const myApp = app || appState.applications.find(a => a.userId === user.googleId);

  if (!myApp) {
    container.innerHTML = `
      <div class="text-center" style="padding: 40px 0;">
        <i class="fas fa-file-alt" style="font-size: 2rem; color: var(--gold);"></i>
        <p style="margin-top: 16px;">لم يتم العثور على طلب. يمكنك التقديم الآن!</p>
        <button class="hero-btn hero-btn-primary" onclick="navigateTo('register')" style="margin-top: 16px;">
          <i class="fas fa-pen-fancy"></i>
          تقديم طلب
        </button>
      </div>
    `;
    return;
  }

  const statusMap = {
    pending: 'status-pending',
    accepted: 'status-accepted',
    rejected: 'status-rejected'
  };

  const statusLabels = {
    pending: '⏳ قيد المراجعة',
    accepted: '✅ مقبول',
    rejected: '❌ مرفوض'
  };

  container.innerHTML = `
    <div style="padding: 20px 0;">
      <div style="display: grid; gap: 16px;">
        <div style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(0,0,0,0.05);">
          <span style="font-weight: 600;">الاسم الكامل</span>
          <span>${myApp.fullName}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(0,0,0,0.05);">
          <span style="font-weight: 600;">البريد الإلكتروني</span>
          <span>${myApp.email}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(0,0,0,0.05);">
          <span style="font-weight: 600;">الحالة</span>
          <span class="status-badge ${statusMap[myApp.status] || 'status-pending'}">${statusLabels[myApp.status] || myApp.status}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(0,0,0,0.05);">
          <span style="font-weight: 600;">تاريخ التقديم</span>
          <span>${new Date(myApp.createdAt).toLocaleDateString('ar-EG')}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(0,0,0,0.05);">
          <span style="font-weight: 600;">مستوى الحفظ</span>
          <span>${myApp.memorization || 'غير محدد'}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 12px 0;">
          <span style="font-weight: 600;">خبرة التجويد</span>
          <span>${myApp.tajweed || 'غير محدد'}</span>
        </div>
      </div>
      <button class="hero-btn hero-btn-secondary" onclick="refreshStatus()" style="width:100%; justify-content:center; margin-top: 20px;">
        <i class="fas fa-sync"></i>
        تحديث من الخادم
      </button>
    </div>
  `;
}

async function refreshStatus() {
  try {
    showToast('جاري تحديث البيانات...', 'fa-spinner');

    // جلب أحدث البيانات من JSONBin
    const bin = await JsonBinService.getBin();
    const safeBin = normalizeBinData(bin);
    appState.applications = safeBin.applications;
    appState.users = safeBin.users;
    appState.settings = safeBin.settings;

    // تحديث واجهة المستخدم
    const userApp = appState.applications.find(a => a.userId === appState.currentUser?.googleId);
    renderStatus(userApp);
    showToast('تم تحديث البيانات بنجاح', 'fa-check');
  } catch (e) {
    showToast('خطأ في التحديث: ' + e.message, 'fa-exclamation-triangle');
  }
}

// ============================================================
// REGISTRATION FORM
// ============================================================
document.getElementById('studentRegisterForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const fullName = document.getElementById('fullName').value.trim();
  const age = document.getElementById('age').value;
  const country = document.getElementById('country').value.trim();
  const city = document.getElementById('city').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const whatsapp = document.getElementById('whatsapp').value.trim();
  const gender = document.getElementById('gender').value;
  const email = document.getElementById('email').value.trim();
  const memorization = document.getElementById('memorization').value.trim();
  const tajweed = document.getElementById('tajweed').value.trim();
  const language = document.getElementById('language').value;
  const notes = document.getElementById('notes').value.trim();
  const agreement = document.getElementById('agreement').checked;

  if (!fullName || !email || !agreement) {
    showToast('الرجاء ملء جميع الحقول المطلوبة', 'fa-exclamation-circle');
    return;
  }

  const user = appState.currentUser;
  if (!user) {
    showToast('الرجاء تسجيل الدخول أولاً', 'fa-google');
    return;
  }

  try {
    // 1. جلب البيانات الحالية من JSONBin
    const bin = await JsonBinService.getBin();
    const safeBin = normalizeBinData(bin);
    const apps = safeBin.applications;

    // 2. التحقق من وجود طلب سابق
    if (apps.some(a => a.userId === user.googleId)) {
      showToast('لديك طلب مقدم بالفعل', 'fa-info-circle');
      return;
    }

    // 3. إنشاء طلب جديد
    const newApp = {
      id: 'app_' + Date.now(),
      userId: user.googleId,
      fullName,
      age: age || 'غير محدد',
      country: country || 'غير محدد',
      city: city || 'غير محدد',
      phone: phone || 'غير محدد',
      whatsapp: whatsapp || 'غير محدد',
      gender: gender || 'غير محدد',
      email,
      memorization: memorization || 'غير محدد',
      tajweed: tajweed || 'غير محدد',
      language: language || 'العربية',
      notes: notes || 'لا يوجد',
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    // 4. إضافة الطلب إلى القائمة
    apps.push(newApp);
    safeBin.applications = apps;

    // 5. حفظ في JSONBin
    await JsonBinService.updateBin(safeBin);

    // 6. تحديث الحالة المحلية
    appState.applications = apps;

    showToast('تم إرسال الطلب بنجاح!', 'fa-check-circle');
    e.target.reset();

    // 7. التوجيه إلى صفحة الحالة
    navigateTo('status');
    renderStatus(newApp);
  } catch (err) {
    showToast('خطأ في الإرسال: ' + err.message, 'fa-exclamation-triangle');
  }
});

// ============================================================
// ADMIN FUNCTIONS (للوحة التحكم)
// ============================================================
async function updateApplicationStatus(appId, newStatus) {
  try {
    // 1. جلب البيانات من JSONBin
    const bin = await JsonBinService.getBin();
    const safeBin = normalizeBinData(bin);
    const apps = safeBin.applications;

    // 2. البحث عن الطلب
    const app = apps.find(a => a.id === appId);
    if (!app) {
      showToast('الطلب غير موجود', 'fa-exclamation-circle');
      return;
    }

    // 3. تحديث الحالة
    app.status = newStatus;
    safeBin.applications = apps;

    // 4. حفظ في JSONBin
    await JsonBinService.updateBin(safeBin);

    // 5. تحديث الحالة المحلية
    appState.applications = apps;

    showToast(`تم تحديث حالة الطلب إلى: ${newStatus}`, 'fa-check');
    
    // 6. تحديث واجهة المستخدم إذا كانت صفحة الحالة مفتوحة
    if (document.getElementById('page-status').classList.contains('active')) {
      const userApp = apps.find(a => a.userId === appState.currentUser?.googleId);
      renderStatus(userApp);
    }
  } catch (e) {
    showToast('خطأ في التحديث: ' + e.message, 'fa-exclamation-triangle');
  }
}

async function deleteApplication(appId) {
  if (!confirm('هل أنت متأكد من حذف هذا الطلب؟')) return;

  try {
    // 1. جلب البيانات من JSONBin
    const bin = await JsonBinService.getBin();
    const safeBin = normalizeBinData(bin);
    const apps = safeBin.applications;

    // 2. حذف الطلب
    const filteredApps = apps.filter(a => a.id !== appId);
    safeBin.applications = filteredApps;

    // 3. حفظ في JSONBin
    await JsonBinService.updateBin(safeBin);

    // 4. تحديث الحالة المحلية
    appState.applications = filteredApps;

    showToast('تم حذف الطلب بنجاح', 'fa-trash');
  } catch (e) {
    showToast('خطأ في الحذف: ' + e.message, 'fa-exclamation-triangle');
  }
}

// ============================================================
// NAVIGATION
// ============================================================
function navigateTo(page) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  
  // Show selected page
  const targetPage = document.getElementById(`page-${page}`);
  if (targetPage) {
    targetPage.classList.add('active');
  }
  
  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
  
  // Update URL
  history.pushState(null, '', `#${page}`);
}

function handleHash() {
  const hash = window.location.hash.replace('#', '') || 'home';
  if (['home', 'register', 'status', 'dashboard'].includes(hash)) {
    navigateTo(hash);
    if (hash === 'status') {
      renderStatus();
    }
  }
}

// ============================================================
// NAVIGATION EVENTS
// ============================================================
document.getElementById('navLogo')?.addEventListener('click', () => navigateTo('home'));
document.getElementById('registerBtn')?.addEventListener('click', () => {
  if (!appState.currentUser) {
    showToast('الرجاء تسجيل الدخول أولاً', 'fa-google');
    return;
  }
  navigateTo('register');
});
document.getElementById('statusBtn')?.addEventListener('click', () => {
  if (!appState.currentUser) {
    showToast('الرجاء تسجيل الدخول أولاً', 'fa-google');
    return;
  }
  navigateTo('status');
  renderStatus();
});
document.getElementById('heroRegisterBtn')?.addEventListener('click', () => {
  if (!appState.currentUser) {
    showToast('الرجاء تسجيل الدخول أولاً', 'fa-google');
    return;
  }
  navigateTo('register');
});
document.getElementById('heroStatusBtn')?.addEventListener('click', () => {
  if (!appState.currentUser) {
    showToast('الرجاء تسجيل الدخول أولاً', 'fa-google');
    return;
  }
  navigateTo('status');
  renderStatus();
});
document.getElementById('backFromRegister')?.addEventListener('click', () => navigateTo('home'));
document.getElementById('backFromStatus')?.addEventListener('click', () => navigateTo('home'));

document.getElementById('navToggle')?.addEventListener('click', () => {
  const actions = document.getElementById('navActions');
  const toggle = document.getElementById('navToggle');
  if (!actions || !toggle) return;
  const isOpen = actions.classList.toggle('open');
  toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
});

// ============================================================
// LANGUAGE MANAGER
// ============================================================
let currentLang = 'ar';

function switchLanguage(lang) {
  currentLang = lang;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.body.className = lang === 'ar' ? 'lang-ar' : 'lang-en';

  document.querySelectorAll('[data-ar][data-en]').forEach(el => {
    el.textContent = el.getAttribute(`data-${lang}`);
  });

  document.querySelectorAll('#langAr, #langEn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });

  localStorage.setItem('alif_lang', lang);
}

// ============================================================
// INIT
// ============================================================
(async function init() {
  // Load language preference
  const savedLang = localStorage.getItem('alif_lang') || 'ar';
  switchLanguage(savedLang);

  // Load data from JSONBin
  try {
    const bin = await JsonBinService.getBin();
    const safeBin = normalizeBinData(bin);
    appState.users = safeBin.users;
    appState.applications = safeBin.applications;
    appState.settings = safeBin.settings;
    console.log('Data loaded from JSONBin:', {
      users: appState.users.length,
      applications: appState.applications.length
    });
  } catch (e) {
    console.warn('Initial load failed, using empty state', e);
    appState.users = [];
    appState.applications = [];
    appState.settings = {};
  }

  // Initialize Google Auth
  initGoogleAuth();

  // Check session
  await checkExistingSession();

  // Update UI
  updateAuthUI();

  // Handle hash navigation
  window.addEventListener('hashchange', handleHash);
  handleHash();

  // Language switcher
  document.getElementById('langAr')?.addEventListener('click', () => switchLanguage('ar'));
  document.getElementById('langEn')?.addEventListener('click', () => switchLanguage('en'));

  // Navbar scroll effect
  window.addEventListener('scroll', function() {
    const navbar = document.getElementById('navbar');
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });

  console.log('AlifLamMeemSB · Quran Academy SPA');
})();

// ============================================================
// EXPOSE FUNCTIONS FOR ADMIN
// ============================================================
window.updateApplicationStatus = updateApplicationStatus;
window.deleteApplication = deleteApplication;
window.refreshStatus = refreshStatus;
window.navigateTo = navigateTo;