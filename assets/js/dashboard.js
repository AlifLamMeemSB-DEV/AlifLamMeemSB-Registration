const ADMIN_EMAIL = 'aliflammeemsb@gmail.com';
const ADMIN_ROLE = 'admin';

function getStoredUser() {
  try {
    const raw = localStorage.getItem('alif_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function isAuthorized() {
  const user = getStoredUser();
  return Boolean(user && (user.email || '').toLowerCase() === ADMIN_EMAIL && user.role === ADMIN_ROLE);
}

function redirectToHome() {
  window.location.href = '../index.html';
}

async function loadData() {
  try {
    const res = await fetch('https://api.jsonbin.io/v3/b/6a597caff5f4af5e299a3a82', {
      headers: { 'X-Master-Key': '$2a$10$tD7V0jOkd5x7PGodxlAQq.ZoppKxGGvTsj34m3e5bcjOGdMXbWOVO' }
    });
    if (!res.ok) throw new Error('فشل جلب البيانات');
    const data = await res.json();
    const record = data.record || {};
    localStorage.setItem('dashboard_data', JSON.stringify(record));
    renderDashboard(record);
  } catch (err) {
    document.getElementById('applicationsTable').innerHTML = `<tr><td colspan="5" style="text-align:center;color:#b42318;">${err.message}</td></tr>`;
  }
}

async function saveData(record) {
  const res = await fetch('https://api.jsonbin.io/v3/b/6a597caff5f4af5e299a3a82', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Master-Key': '$2a$10$tD7V0jOkd5x7PGodxlAQq.ZoppKxGGvTsj34m3e5bcjOGdMXbWOVO'
    },
    body: JSON.stringify(record)
  });
  if (!res.ok) throw new Error('فشل حفظ التحديث');
}

function renderDashboard(record) {
  const applications = Array.isArray(record.applications) ? record.applications : [];
  const users = Array.isArray(record.users) ? record.users : [];
  const user = getStoredUser();

  document.getElementById('adminInfo').innerHTML = `
    <strong>${user?.name || 'Admin'}</strong>
    <span>${user?.email || ADMIN_EMAIL}</span>
  `;

  document.getElementById('totalApps').textContent = applications.length;
  document.getElementById('pendingApps').textContent = applications.filter(a => a.status === 'pending').length;
  document.getElementById('acceptedApps').textContent = applications.filter(a => a.status === 'accepted').length;
  document.getElementById('rejectedApps').textContent = applications.filter(a => a.status === 'rejected').length;

  const appsRows = applications.map(app => `
    <tr>
      <td>${app.fullName || '-'}</td>
      <td>${app.email || '-'}</td>
      <td><span class="status-badge status-${app.status || 'pending'}">${getStatusLabel(app.status)}</span></td>
      <td>${app.createdAt ? new Date(app.createdAt).toLocaleDateString('ar-EG') : '-'}</td>
      <td>
        <button class="btn-action btn-user-action" onclick="showDetails('${app.id}')">عرض</button>
        <button class="btn-action btn-pending" onclick="updateStatus('${app.id}', 'pending')">مراجعة</button>
        <button class="btn-action btn-accept" onclick="updateStatus('${app.id}', 'accepted')">قبول</button>
        <button class="btn-action btn-reject" onclick="updateStatus('${app.id}', 'rejected')">رفض</button>
      </td>
    </tr>
  `).join('');

  document.getElementById('applicationsTable').innerHTML = appsRows || '<tr><td colspan="5" style="text-align:center;">لا توجد طلبات بعد</td></tr>';

  const usersRows = users.map(u => `
    <tr>
      <td>${u.name || '-'}</td>
      <td>${u.email || '-'}</td>
      <td>${u.role || 'student'}</td>
      <td>${u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('ar-EG') : '-'}</td>
      <td>
        <button class="btn-action btn-user-action" onclick="changeUserRole('${u.googleId || u.id}', 'admin')">Admin</button>
        <button class="btn-action btn-user-action" onclick="changeUserRole('${u.googleId || u.id}', 'student')">Student</button>
        <button class="btn-action btn-danger" onclick="deleteUser('${u.googleId || u.id}')">حذف</button>
      </td>
    </tr>
  `).join('');
  document.getElementById('usersTable').innerHTML = usersRows || '<tr><td colspan="4" style="text-align:center;">لا توجد مستخدمين</td></tr>';
}

function getStatusLabel(status) {
  switch (status) {
    case 'accepted': return 'مقبول';
    case 'rejected': return 'مرفوض';
    default: return 'قيد المراجعة';
  }
}

window.updateStatus = async function(appId, status) {
  try {
    const res = await fetch('https://api.jsonbin.io/v3/b/6a597caff5f4af5e299a3a82', {
      headers: { 'X-Master-Key': '$2a$10$tD7V0jOkd5x7PGodxlAQq.ZoppKxGGvTsj34m3e5bcjOGdMXbWOVO' }
    });
    const data = await res.json();
    const record = data.record || {};
    const apps = Array.isArray(record.applications) ? record.applications : [];
    const app = apps.find(item => item.id === appId);
    if (app) app.status = status;
    record.applications = apps;
    await saveData(record);
    renderDashboard(record);
    if (window.currentAppId === appId) showDetails(appId);
  } catch (err) {
    alert(err.message);
  }
};

window.showDetails = function(appId) {
  window.currentAppId = appId;
  const detailCard = document.getElementById('detailCard');
  const res = document.querySelector('.nav-btn[data-view="details"]');
  if (res) res.click();
  const raw = localStorage.getItem('dashboard_data');
  let record = null;
  if (raw) {
    try { record = JSON.parse(raw); } catch {}
  }
  if (!record) return;
  const app = (record.applications || []).find(item => item.id === appId);
  if (!app) {
    detailCard.innerHTML = '<p class="empty-state">لم يتم العثور على الطلب</p>';
    return;
  }
  detailCard.innerHTML = `
    <div class="actions-row">
      <button class="btn-action btn-pending" onclick="updateStatus('${app.id}', 'pending')">مراجعة</button>
      <button class="btn-action btn-accept" onclick="updateStatus('${app.id}', 'accepted')">قبول</button>
      <button class="btn-action btn-reject" onclick="updateStatus('${app.id}', 'rejected')">رفض</button>
    </div>
    <div class="detail-grid">
      <div class="detail-item"><strong>الاسم الكامل</strong><span>${app.fullName || '-'}</span></div>
      <div class="detail-item"><strong>البريد الإلكتروني</strong><span>${app.email || '-'}</span></div>
      <div class="detail-item"><strong>العمر</strong><span>${app.age || '-'}</span></div>
      <div class="detail-item"><strong>الجنس</strong><span>${app.gender || '-'}</span></div>
      <div class="detail-item"><strong>الدولة</strong><span>${app.country || '-'}</span></div>
      <div class="detail-item"><strong>المدينة</strong><span>${app.city || '-'}</span></div>
      <div class="detail-item"><strong>الهاتف</strong><span>${app.phone || '-'}</span></div>
      <div class="detail-item"><strong>واتساب</strong><span>${app.whatsapp || '-'}</span></div>
      <div class="detail-item"><strong>مستوى الحفظ</strong><span>${app.memorization || '-'}</span></div>
      <div class="detail-item"><strong>خبرة التجويد</strong><span>${app.tajweed || '-'}</span></div>
      <div class="detail-item"><strong>اللغة</strong><span>${app.language || '-'}</span></div>
      <div class="detail-item"><strong>الحالة</strong><span>${getStatusLabel(app.status)}</span></div>
      <div class="detail-item"><strong>ملاحظات</strong><span>${app.notes || '-'}</span></div>
      <div class="detail-item"><strong>تاريخ التقديم</strong><span>${app.createdAt ? new Date(app.createdAt).toLocaleDateString('ar-EG') : '-'}</span></div>
    </div>
  `;
};

window.changeUserRole = async function(userId, role) {
  try {
    const res = await fetch('https://api.jsonbin.io/v3/b/6a597caff5f4af5e299a3a82', {
      headers: { 'X-Master-Key': '$2a$10$tD7V0jOkd5x7PGodxlAQq.ZoppKxGGvTsj34m3e5bcjOGdMXbWOVO' }
    });
    const data = await res.json();
    const record = data.record || {};
    const users = Array.isArray(record.users) ? record.users : [];
    const user = users.find(item => (item.googleId || item.id) === userId);
    if (user) user.role = role;
    record.users = users;
    await saveData(record);
    renderDashboard(record);
  } catch (err) {
    alert(err.message);
  }
};

window.deleteUser = async function(userId) {
  if (!confirm('هل أنت متأكد من حذف هذا الحساب؟')) return;
  try {
    const res = await fetch('https://api.jsonbin.io/v3/b/6a597caff5f4af5e299a3a82', {
      headers: { 'X-Master-Key': '$2a$10$tD7V0jOkd5x7PGodxlAQq.ZoppKxGGvTsj34m3e5bcjOGdMXbWOVO' }
    });
    const data = await res.json();
    const record = data.record || {};
    const users = Array.isArray(record.users) ? record.users : [];
    record.users = users.filter(item => (item.googleId || item.id) !== userId);
    await saveData(record);
    renderDashboard(record);
  } catch (err) {
    alert(err.message);
  }
};

function setupViews() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const view = btn.dataset.view;
      document.querySelectorAll('.panel-view').forEach(panel => panel.classList.remove('active'));
      if (view === 'users') {
        document.getElementById('usersView').classList.add('active');
        document.getElementById('panelTitle').textContent = 'المستخدمين';
        document.getElementById('panelSubtitle').textContent = 'إدارة الحسابات والأدوار';
      } else if (view === 'details') {
        document.getElementById('detailsView').classList.add('active');
        document.getElementById('panelTitle').textContent = 'تفاصيل الطلب';
        document.getElementById('panelSubtitle').textContent = 'عرض جميع بيانات الطلب مع التحكم';
      } else {
        document.getElementById('applicationsView').classList.add('active');
        document.getElementById('panelTitle').textContent = 'الطلبات';
        document.getElementById('panelSubtitle').textContent = 'عرض جميع الطلبات المقدمة من الطلاب';
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (!isAuthorized()) {
    redirectToHome();
    return;
  }
  setupViews();
  document.getElementById('refreshBtn').addEventListener('click', loadData);
  document.getElementById('logoutAdmin').addEventListener('click', () => {
    localStorage.removeItem('alif_user');
    redirectToHome();
  });
  loadData();
});
