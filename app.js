// ==================== SUPABASE CONFIGURATION ====================
const SUPABASE_URL = 'https://biojkrvccatxvqgujmbg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_6qAOMcKq6qG4e6qVGlPEDQ_ykuaMo8n';

// Safe initialization using window to prevent redeclaration errors
if (!window.dbInstance) {
  window.dbInstance = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
// Both variables mapped safely so neither db nor supabase throws undefined error
var db = window.dbInstance;
var supabase = window.dbInstance;

// Global State
let allCustomers = [];

// ==================== INITIALIZATION & SETTINGS ====================
window.addEventListener('DOMContentLoaded', async () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js');
  }
  await loadAppSettings();
});

async function loadAppSettings() {
  try {
    const { data, error } = await db.from('settings').select('*').limit(1).single();
    if (data) {
      applyTheme(data.primary_color, data.body_color, data.logo_url);
    }
  } catch (err) {
    // Fallback if settings table is empty
  }
}

function applyTheme(primary, bodyBg, logoUrl) {
  document.documentElement.style.setProperty('--primary-color', primary || '#4f46e5');
  document.documentElement.style.setProperty('--button-color', primary || '#4f46e5');
  document.documentElement.style.setProperty('--body-bg', bodyBg || '#f3f4f6');

  if (logoUrl) {
    const splashLogo = document.getElementById('splash-logo');
    const formLogo = document.getElementById('form-logo');
    const adminLogo = document.getElementById('admin-logo');
    const dashLogo = document.getElementById('dashboard-logo');
    if (splashLogo) splashLogo.src = logoUrl;
    if (formLogo) formLogo.src = logoUrl;
    if (adminLogo) adminLogo.src = logoUrl;
    if (dashLogo) dashLogo.src = logoUrl;
  }
}

// ==================== AUTHENTICATION ====================
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('login-user').value.trim();
  const pass = document.getElementById('login-pass').value.trim();

  // Query Supabase profiles table using limit(1) to prevent 406 errors
  const { data, error } = await db
    .from('profiles')
    .select('*')
    .eq('username', username)
    .eq('password', pass)
    .limit(1);

  if (error || !data || data.length === 0) {
    alert('Invalid User ID or Password!');
    return;
  }

  // Defined 'user' variable safely
  const user = data[0];

  if (user.status === 'deactive') {
    alert('Your account has been deactivated by admin.');
    return;
  }

  // Redirect based on role
  if (user.role === 'admin') {
    switchScreen('admin-screen');
    loadAdminDashboard();
  } else {
    switchScreen('user-dashboard-screen'); // 2 buttons user dashboard
  }
});

function logout() {
  switchScreen('splash-screen');
  document.getElementById('login-form').reset();
}

function switchScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
}

// ==================== USER FORM & POPUP ====================
document.getElementById('customer-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('cust-name').value.trim();
  const mobile = document.getElementById('cust-mobile').value.trim();

  const { error } = await db.from('customers').insert([{ name, mobile }]);

  if (error) {
    alert('Error saving record: ' + error.message);
    return;
  }

  // Show Success Popup Modal for 3 seconds
  const modal = document.getElementById('popup-modal');
  modal.style.display = 'flex';

  setTimeout(() => {
    modal.style.display = 'none';
  }, 3000);

  // Clear form automatically
  document.getElementById('customer-form').reset();
});

// ==================== FEEDBACK FORM LOGIC ====================
async function openFeedbackForm() {
  switchScreen('feedback-form-screen');
  const { data, error } = await db.from('feedback_questions').select('*').eq('is_active', true);
  const container = document.getElementById('dynamic-questions-container');
  container.innerHTML = '';

  if (data && data.length > 0) {
    data.forEach((q, index) => {
      container.innerHTML += `
        <div style="margin-bottom: 15px;">
          <label style="font-weight: 600; display:block; margin-bottom:5px;">${index + 1}. ${q.question_text}</label>
          <input type="text" name="answer_${q.id}" placeholder="Enter answer..." required style="margin: 0;">
        </div>
      `;
    });
  } else {
    container.innerHTML = `<p style="color: #ef4444; text-align:center;">No feedback questions available. Ask admin to add questions.</p>`;
  }
}

document.getElementById('submit-feedback-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('fb-cust-name').value.trim();
  const mobile = document.getElementById('fb-cust-mobile').value.trim();
  
  const { data: questions } = await db.from('feedback_questions').select('id').eq('is_active', true);
  
  if (!questions || questions.length === 0) {
    alert('No active questions found.');
    return;
  }

  for (let q of questions) {
    const inputField = document.querySelector(`input[name="answer_${q.id}"]`);
    if (inputField) {
      const inputVal = inputField.value.trim();
      await db.from('customer_feedbacks').insert([{
        customer_name: name,
        customer_mobile: mobile,
        question_id: q.id,
        answer: inputVal
      }]);
    }
  }

  alert('Feedback submitted successfully!');
  document.getElementById('submit-feedback-form').reset();
  switchScreen('user-dashboard-screen');
});

// ==================== ADMIN DASHBOARD & TABS ====================
function switchTab(index) {
  const btns = document.querySelectorAll('.tab-btn');
  const contents = document.querySelectorAll('.tab-content');

  btns.forEach((b, i) => {
    b.classList.toggle('active', i === index);
  });
  contents.forEach((c, i) => {
    c.classList.toggle('active', i === index);
  });

  if (index === 0 || index === 1) loadCustomers();
  if (index === 2) loadUsersList();
  if (index === 4) loadQuestionsList();
  if (index === 5) loadFeedbacksReport();
}

async function loadAdminDashboard() {
  await loadCustomers();
}

async function loadCustomers() {
  const { data, error } = await db.from('customers').select('*').order('created_at', { ascending: false });
  if (!error && data) {
    allCustomers = data;
    renderCustomerTable(allCustomers);
  }
}

function renderCustomerTable(customers) {
  const tbody = document.getElementById('customer-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (customers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;">No records found</td></tr>`;
    return;
  }

  customers.forEach(cust => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${cust.name}</td>
      <td>${cust.mobile}</td>
      <td>
        <div class="action-icons">
          <a href="tel:${cust.mobile}" class="icon-btn" title="Call"><i class="fa-solid fa-phone" style="color: #10b981;"></i></a>
          <a href="https://wa.me/${cust.mobile.replace(/[^0-9]/g, '')}" target="_blank" class="icon-btn" title="WhatsApp"><i class="fa-brands fa-whatsapp" style="color: #25d366;"></i></a>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function filterCustomerList() {
  const query = document.getElementById('search-cust').value.toLowerCase();
  const filtered = allCustomers.filter(c => 
    c.name.toLowerCase().includes(query) || c.mobile.toLowerCase().includes(query)
  );
  renderCustomerTable(filtered);
}

// ==================== EXCEL EXPORT WITH FILTERS ====================
async function exportToExcel() {
  const filterType = document.getElementById('report-filter').value;
  let query = db.from('customers').select('*');

  const now = new Date();
  if (filterType === 'day') {
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    query = query.gte('created_at', startOfDay);
  } else if (filterType === 'week') {
    const firstDayOfWeek = new Date(now.setDate(now.getDate() - now.getDay())).toISOString();
    query = query.gte('created_at', firstDayOfWeek);
  } else if (filterType === 'month') {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    query = query.gte('created_at', startOfMonth);
  }

  const { data, error } = await query;
  if (error || !data || data.length === 0) {
    alert('No data found for selected filter.');
    return;
  }

  const excelData = data.map(item => ({
    'Customer Name': item.name,
    'Mobile Number': item.mobile,
    'Date Added': new Date(item.created_at).toLocaleString()
  }));

  const worksheet = XLSX.utils.json_to_sheet(excelData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Customers Report");
  XLSX.writeFile(workbook, `Customer_Report_${filterType}.xlsx`);
}

// ==================== USER MANAGEMENT ====================
document.getElementById('add-user-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('new-username').value.trim();
  const password = document.getElementById('new-password').value.trim();
  const role = document.getElementById('new-role').value;

  const { error } = await db.from('profiles').insert([{ username, password, role, status: 'active' }]);
  if (error) {
    alert('Error adding user: ' + error.message);
  } else {
    alert('User added successfully!');
    document.getElementById('add-user-form').reset();
    loadUsersList();
  }
});

async function loadUsersList() {
  const { data, error } = await db.from('profiles').select('*');
  const container = document.getElementById('users-list-container');
  if (!container) return;
  container.innerHTML = '<h4>Existing Users</h4>';

  if (data && data.length > 0) {
    let html = `<table style="margin-top: 10px;"><thead><tr><th>Username</th><th>Role</th><th>Status</th><th>Action</th></tr></thead><tbody>`;
    data.forEach(u => {
      html += `
        <tr>
          <td>${u.username}</td>
          <td>${u.role}</td>
          <td><span style="color: ${u.status === 'active' ? '#10b981' : '#ef4444'}">${u.status}</span></td>
          <td>
            <button onclick="toggleUserStatus('${u.id}', '${u.status}')" style="padding: 4px 8px; font-size: 0.8rem; width: auto; margin:0;">Toggle Status</button>
            <button onclick="deleteUser('${u.id}')" style="padding: 4px 8px; font-size: 0.8rem; width: auto; background: #ef4444; margin-left: 5px;">Delete</button>
          </td>
        </tr>
      `;
    });
    html += `</tbody></table>`;
    container.innerHTML += html;
  }
}

async function toggleUserStatus(id, currentStatus) {
  const newStatus = currentStatus === 'active' ? 'deactive' : 'active';
  await db.from('profiles').update({ status: newStatus }).eq('id', id);
  loadUsersList();
}

async function deleteUser(id) {
  if (confirm('Are you sure you want to delete this user?')) {
    await db.from('profiles').delete().eq('id', id);
    loadUsersList();
  }
}

// ==================== FEEDBACK QUESTIONS (ADMIN) ====================
document.getElementById('add-question-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = document.getElementById('new-question-text').value.trim();
  const { error } = await db.from('feedback_questions').insert([{ question_text: text }]);
  if (!error) {
    alert('Question added successfully!');
    document.getElementById('new-question-text').value = '';
    loadQuestionsList();
  } else {
    alert('Error: ' + error.message);
  }
});

async function loadQuestionsList() {
  const { data } = await db.from('feedback_questions').select('*');
  const container = document.getElementById('questions-list-container');
  if (!container) return;
  
  if (!data || data.length === 0) {
    container.innerHTML = `<p>No questions added yet.</p>`;
    return;
  }

  let html = `<table><thead><tr><th>Question</th><th>Action</th></tr></thead><tbody>`;
  data.forEach(q => {
    html += `<tr><td>${q.question_text}</td><td><button onclick="deleteQuestion('${q.id}')" style="background:#ef4444; padding:5px; width:auto;">Delete</button></td></tr>`;
  });
  html += `</tbody></table>`;
  container.innerHTML = html;
}

async function deleteQuestion(id) {
  await db.from('feedback_questions').delete().eq('id', id);
  loadQuestionsList();
}

// ==================== FEEDBACK REPORTS & EXPORT ====================
async function loadFeedbacksReport() {
  const { data, error } = await db.from('customer_feedbacks').select(`*, feedback_questions(question_text)`).order('created_at', { ascending: false });
  const container = document.getElementById('feedbacks-table-container');
  if (!container) return;

  if (error || !data || data.length === 0) {
    container.innerHTML = `<p>No feedbacks found.</p>`;
    return;
  }

  let html = `<table><thead><tr><th>Customer Name</th><th>Mobile</th><th>Question</th><th>Answer</th><th>Date</th></tr></thead><tbody>`;
  data.forEach(f => {
    const qText = f.feedback_questions ? f.feedback_questions.question_text : 'N/A';
    html += `
      <tr>
        <td>${f.customer_name}</td>
        <td>${f.customer_mobile}</td>
        <td>${qText}</td>
        <td>${f.answer}</td>
        <td>${new Date(f.created_at).toLocaleString()}</td>
      </tr>
    `;
  });
  html += `</tbody></table>`;
  container.innerHTML = html;
}

async function exportFeedbackExcel() {
  const filterType = document.getElementById('fb-report-filter').value;
  let query = db.from('customer_feedbacks').select(`*, feedback_questions(question_text)`);

  const now = new Date();
  if (filterType === 'day') {
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    query = query.gte('created_at', startOfDay);
  } else if (filterType === 'week') {
    const firstDayOfWeek = new Date(now.setDate(now.getDate() - now.getDay())).toISOString();
    query = query.gte('created_at', firstDayOfWeek);
  } else if (filterType === 'month') {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    query = query.gte('created_at', startOfMonth);
  }

  const { data, error } = await query;
  if (error || !data || data.length === 0) {
    alert('No feedback data found for selected filter.');
    return;
  }

  const excelData = data.map(item => ({
    'Customer Name': item.customer_name,
    'Mobile Number': item.customer_mobile,
    'Question': item.feedback_questions ? item.feedback_questions.question_text : 'N/A',
    'Answer': item.answer,
    'Date Submitted': new Date(item.created_at).toLocaleString()
  }));

  const worksheet = XLSX.utils.json_to_sheet(excelData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Feedbacks Report");
  XLSX.writeFile(workbook, `Customer_Feedbacks_${filterType}.xlsx`);
}

// ==================== SETTINGS & BRANDING ====================
async function saveSettings() {
  const logo_url = document.getElementById('setting-logo-url').value.trim();
  const primary_color = document.getElementById('setting-primary-color').value;
  const body_color = document.getElementById('setting-body-color').value;

  const { error } = await db.from('settings').upsert({ id: 1, logo_url, primary_color, body_color });

  if (error) {
    alert('Error saving settings: ' + error.message);
  } else {
    alert('Settings updated successfully!');
    applyTheme(primary_color, body_color, logo_url);
  }
}