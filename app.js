// ==================== SUPABASE CONFIGURATION ====================
const SUPABASE_URL = 'https://biojkrvccatxvqgujmbg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_6qAOMcKq6qG4e6qVGlPEDQ_ykuaMo8n';

if (!window.dbInstance) {
  window.dbInstance = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
var db = window.dbInstance;
var supabase = window.dbInstance;

let allCustomers = [];
let currentFeedbackCategory = 'instore';
let currentAdminQCategory = 'instore';

window.addEventListener('DOMContentLoaded', async () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js');
  }
  await loadAppSettings();
});

async function loadAppSettings() {
  try {
    const { data } = await db.from('settings').select('*').limit(1).single();
    if (data) {
      applyTheme(data.primary_color, data.body_color, data.logo_url);
    }
  } catch (err) {}
}

function applyTheme(primary, bodyBg, logoUrl) {
  document.documentElement.style.setProperty('--primary-color', primary || '#4f46e5');
  document.documentElement.style.setProperty('--button-color', primary || '#4f46e5');
  document.documentElement.style.setProperty('--body-bg', bodyBg || '#f3f4f6');

  if (logoUrl) {
    const logos = ['splash-logo', 'form-logo', 'admin-logo', 'dashboard-logo'];
    logos.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.src = logoUrl;
    });
  }
}

// ==================== AUTHENTICATION ====================
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('login-user').value.trim();
  const pass = document.getElementById('login-pass').value.trim();

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

  const user = data[0];

  if (user.status === 'deactive') {
    alert('Your account has been deactivated by admin.');
    return;
  }

  if (user.role === 'admin') {
    switchScreen('admin-screen');
    loadAdminDashboard();
  } else {
    switchScreen('user-dashboard-screen');
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

  const modal = document.getElementById('popup-modal');
  modal.style.display = 'flex';
  setTimeout(() => {
    modal.style.display = 'none';
  }, 3000);

  document.getElementById('customer-form').reset();
});

// ==================== FEEDBACK CATEGORY MODAL ====================
function openCategoryModal() {
  document.getElementById('category-modal').style.display = 'flex';
}

function closeCategoryModal() {
  document.getElementById('category-modal').style.display = 'none';
}

function selectFeedbackCategory(category) {
  currentFeedbackCategory = category;
  closeCategoryModal();
  openFeedbackForm();
}

// ==================== STEP-BY-STEP FEEDBACK FLOW ====================
let activeQuestions = [];
let currentQIndex = 0;
let feedbackAnswers = {};

async function openFeedbackForm() {
  switchScreen('feedback-form-screen');
  document.getElementById('feedback-screen-title').innerText = `Customer Feedback (${currentFeedbackCategory.toUpperCase()})`;
  
  const { data, error } = await db.from('feedback_questions')
    .select('*')
    .eq('category', currentFeedbackCategory)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  const container = document.getElementById('dynamic-questions-container');
  const submitSection = document.getElementById('feedback-submit-section');
  
  if (!container) return;
  container.innerHTML = '';
  if (submitSection) submitSection.style.display = 'none';

  if (error || !data || data.length === 0) {
    container.innerHTML = `<p style="color: #ef4444; text-align:center;">No active feedback questions available for ${currentFeedbackCategory}.</p>`;
    return;
  }

  activeQuestions = data;
  currentQIndex = 0;
  feedbackAnswers = {};
  renderCurrentQuestion();
}

function renderCurrentQuestion() {
  const container = document.getElementById('dynamic-questions-container');
  const submitSection = document.getElementById('feedback-submit-section');

  if (currentQIndex < activeQuestions.length) {
    const q = activeQuestions[currentQIndex];
    let optionsHtml = '';
    if (q.options) {
      const optList = q.options.split(',').map(o => o.trim());
      optList.forEach(opt => {
        optionsHtml += `
          <label style="display: block; margin: 10px 0; font-weight: normal; cursor: pointer; padding: 12px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px;">
            <input type="radio" name="answer_${q.id}" value="${opt}" onclick="handleAnswerSelect('${q.question_text.replace(/'/g, "\\'")}', '${opt.replace(/'/g, "\\'")}')" style="width: auto; margin-right: 10px;"> ${opt}
          </label>
        `;
      });
    }

    container.innerHTML = `
      <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="font-size: 0.85rem; color: #4f46e5; font-weight: 600; margin-bottom: 5px;">Question ${currentQIndex + 1} of ${activeQuestions.length}</div>
        <label style="font-weight: 600; display:block; margin-bottom: 12px; font-size: 1.05rem;">${q.question_text}</label>
        <div>${optionsHtml}</div>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div style="background: #ecfdf5; color: #065f46; padding: 15px; border-radius: 8px; text-align: center; font-weight: 600; margin-bottom: 15px;">
        <i class="fa-solid fa-circle-check" style="font-size: 1.5rem; margin-bottom: 5px; display: block;"></i>
        All questions answered! Add comments below and submit.
      </div>
    `;
    if (submitSection) submitSection.style.display = 'block';
  }
}

function handleAnswerSelect(qText, answerVal) {
  feedbackAnswers[qText] = answerVal;
  setTimeout(() => {
    currentQIndex++;
    renderCurrentQuestion();
  }, 350);
}

document.getElementById('submit-feedback-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('fb-cust-name').value.trim();
  const mobile = document.getElementById('fb-cust-mobile').value.trim();
  const globalCommentInput = document.getElementById('global-feedback-comment');
  const globalComment = globalCommentInput ? globalCommentInput.value.trim() : '';
  
  if (Object.keys(feedbackAnswers).length === 0) {
    alert('Please answer the questions first.');
    return;
  }

  let sentiment = 'Good';
  const negativeKeywords = ['bad', 'poor', 'worst', 'average', 'disappointing'];
  for (let val of Object.values(feedbackAnswers)) {
    if (negativeKeywords.some(kw => val.toLowerCase().includes(kw))) {
      sentiment = 'Bad';
      break;
    }
  }

  const { error } = await db.from('customer_feedbacks').insert([{
    customer_name: name,
    customer_mobile: mobile,
    category: currentFeedbackCategory,
    feedback_data: feedbackAnswers,
    comment: globalComment,
    status: 'Pending',
    response_type: sentiment
  }]);

  if (error) {
    alert('Error saving feedback: ' + error.message);
    return;
  }

  const modal = document.getElementById('popup-modal');
  modal.style.display = 'flex';
  setTimeout(() => {
    modal.style.display = 'none';
  }, 3000);

  document.getElementById('submit-feedback-form').reset();
  openFeedbackForm(); 
});

// ==================== ADMIN DASHBOARD & TABS ====================
function switchTab(index) {
  const btns = document.querySelectorAll('.tab-btn');
  const contents = document.querySelectorAll('.tab-content');

  btns.forEach((b, i) => b.classList.toggle('active', i === index));
  contents.forEach((c, i) => c.classList.toggle('active', i === index));

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

// ==================== ADMIN: QUESTIONS MANAGEMENT ====================
function switchQCategory(category) {
  currentAdminQCategory = category;
  
  const catDropdown = document.getElementById('new-question-category');
  if (catDropdown) catDropdown.value = category;

  const qBtns = document.querySelectorAll('.q-tab-btn');
  qBtns.forEach(b => {
    if (b.innerText.toLowerCase().includes(category)) {
      b.style.backgroundColor = '#4f46e5';
    } else {
      b.style.backgroundColor = '#6b7280';
    }
  });
  loadQuestionsList();
}

document.getElementById('add-question-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const editId = document.getElementById('edit-question-id').value;
  const text = document.getElementById('new-question-text').value.trim();
  const options = document.getElementById('new-question-options').value.trim();
  const sortOrder = parseInt(document.getElementById('new-question-sort').value) || 0;
  const selectedCategory = document.getElementById('new-question-category').value;

  if (editId) {
    const { error } = await db.from('feedback_questions').update({
      question_text: text,
      options: options,
      sort_order: sortOrder,
      category: selectedCategory
    }).eq('id', editId);

    if (error) alert('Error: ' + error.message);
    else {
      alert('Question updated successfully!');
      resetQuestionForm();
      loadQuestionsList();
    }
  } else {
    const { error } = await db.from('feedback_questions').insert([{
      question_text: text,
      options: options,
      sort_order: sortOrder,
      category: selectedCategory,
      is_active: true
    }]);

    if (error) alert('Error: ' + error.message);
    else {
      alert('Question added successfully!');
      resetQuestionForm();
      loadQuestionsList();
    }
  }
});

async function loadQuestionsList() {
  const { data } = await db.from('feedback_questions')
    .select('*')
    .eq('category', currentAdminQCategory)
    .order('sort_order', { ascending: true });

  const container = document.getElementById('questions-list-container');
  if (!container) return;
  
  if (!data || data.length === 0) {
    container.innerHTML = `<p>No questions added for ${currentAdminQCategory} yet.</p>`;
    return;
  }

  let html = `<table><thead><tr><th>Order</th><th>Question & Options</th><th>Status</th><th>Actions</th></tr></thead><tbody>`;
  data.forEach(q => {
    const statusColor = q.is_active ? '#10b981' : '#ef4444';
    const statusText = q.is_active ? 'Active' : 'Inactive';
    
    html += `
      <tr>
        <td style="text-align: center; font-weight: bold;">${q.sort_order}</td>
        <td>
          <strong>${q.question_text}</strong><br>
          <small style="color: #6b7280;">Options: ${q.options || '-'}</small>
        </td>
        <td><span style="color: ${statusColor}; font-weight: 600;">${statusText}</span></td>
        <td>
          <div style="display: flex; gap: 5px; flex-wrap: wrap;">
            <button onclick="editQuestion('${q.id}', '${q.question_text.replace(/'/g, "\\'")}', '${q.options.replace(/'/g, "\\'")}', ${q.sort_order}, '${q.category}')" style="background: #3b82f6; padding: 4px 8px; font-size: 0.8rem; width: auto; margin:0;">Edit</button>
            <button onclick="toggleQuestionStatus('${q.id}', ${q.is_active})" style="background: #f59e0b; padding: 4px 8px; font-size: 0.8rem; width: auto; margin:0;">${q.is_active ? 'Deactivate' : 'Activate'}</button>
            <button onclick="deleteQuestion('${q.id}')" style="background: #ef4444; padding: 4px 8px; font-size: 0.8rem; width: auto; margin:0;">Delete</button>
          </div>
        </td>
      </tr>
    `;
  });
  html += `</tbody></table>`;
  container.innerHTML = html;
}

function editQuestion(id, text, options, sortOrder, category) {
  document.getElementById('edit-question-id').value = id;
  document.getElementById('new-question-text').value = text;
  document.getElementById('new-question-options').value = options;
  document.getElementById('new-question-sort').value = sortOrder;
  
  const catDropdown = document.getElementById('new-question-category');
  if (catDropdown && category) catDropdown.value = category;
  
  document.getElementById('form-mode-label').innerText = 'Edit Question';
  document.getElementById('save-q-btn').innerText = 'Update Question';
  document.getElementById('cancel-edit-btn').style.display = 'inline-block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetQuestionForm() {
  document.getElementById('add-question-form').reset();
  document.getElementById('edit-question-id').value = '';
  document.getElementById('form-mode-label').innerText = 'Add New Question';
  document.getElementById('save-q-btn').innerText = 'Save Question';
  document.getElementById('cancel-edit-btn').style.display = 'none';
  document.getElementById('new-question-sort').value = '0';
  
  const catDropdown = document.getElementById('new-question-category');
  if (catDropdown) catDropdown.value = currentAdminQCategory;
}

async function toggleQuestionStatus(id, currentStatus) {
  await db.from('feedback_questions').update({ is_active: !currentStatus }).eq('id', id);
  loadQuestionsList();
}

async function deleteQuestion(id) {
  if (confirm('Are you sure you want to delete this question?')) {
    await db.from('feedback_questions').delete().eq('id', id);
    loadQuestionsList();
  }
}

// ==================== FEEDBACK REPORTS & FILTERS ====================
async function loadFeedbacksReport() {
  const channelFilter = document.getElementById('filter-channel').value;
  const sentimentFilter = document.getElementById('filter-sentiment').value;
  const statusFilter = document.getElementById('filter-status').value;

  let query = db.from('customer_feedbacks').select('*').order('created_at', { ascending: false });

  if (channelFilter !== 'all') query = query.eq('category', channelFilter);
  if (sentimentFilter !== 'all') query = query.eq('response_type', sentimentFilter);
  if (statusFilter !== 'all') query = query.eq('status', statusFilter);

  const { data, error } = await query;
  const container = document.getElementById('feedbacks-table-container');
  if (!container) return;

  if (error || !data || data.length === 0) {
    container.innerHTML = `<p>No feedbacks found matching filters.</p>`;
    return;
  }

  let html = `<table><thead><tr><th>Channel</th><th>Customer Name</th><th>Mobile</th><th>Responses (Q & A)</th><th>Comment</th><th>Sentiment</th><th>Status</th><th>Date</th></tr></thead><tbody>`;
  
  data.forEach(f => {
    let qaString = '';
    if (f.feedback_data) {
      qaString = Object.entries(f.feedback_data)
        .map(([q, a]) => `<b>${q}:</b> ${a}`)
        .join(' | ');
    }

    const sentimentColor = f.response_type === 'Good' ? '#10b981' : '#ef4444';
    const statusColor = f.status === 'Resolved' ? '#10b981' : '#f59e0b';

    html += `
      <tr>
        <td style="text-transform: uppercase; font-weight: bold;">${f.category}</td>
        <td>${f.customer_name}</td>
        <td>${f.customer_mobile}</td>
        <td>${qaString}</td>
        <td>${f.comment || '-'}</td>
        <td><span style="color: ${sentimentColor}; font-weight: bold;">${f.response_type}</span></td>
        <td>
          <select onchange="updateFeedbackStatus('${f.id}', this.value)" style="padding: 4px; font-size: 0.85rem; color: ${statusColor}; font-weight: bold;">
            <option value="Pending" ${f.status === 'Pending' ? 'selected' : ''}>Pending</option>
            <option value="Resolved" ${f.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
          </select>
        </td>
        <td>${new Date(f.created_at).toLocaleString()}</td>
      </tr>
    `;
  });
  html += `</tbody></table>`;
  container.innerHTML = html;
}

async function updateFeedbackStatus(id, newStatus) {
  const { error } = await db.from('customer_feedbacks').update({ status: newStatus }).eq('id', id);
  if (error) {
    alert('Error updating status: ' + error.message);
  } else {
    loadFeedbacksReport();
  }
}

async function exportFeedbackExcel() {
  const channelFilter = document.getElementById('filter-channel').value;
  const sentimentFilter = document.getElementById('filter-sentiment').value;
  const statusFilter = document.getElementById('filter-status').value;

  let query = db.from('customer_feedbacks').select('*');

  if (channelFilter !== 'all') query = query.eq('category', channelFilter);
  if (sentimentFilter !== 'all') query = query.eq('response_type', sentimentFilter);
  if (statusFilter !== 'all') query = query.eq('status', statusFilter);

  const { data, error } = await query;
  if (error || !data || data.length === 0) {
    alert('No feedback data found for selected filters.');
    return;
  }

  const excelData = data.map(item => {
    let rowObj = {
      'Channel': item.category.toUpperCase(),
      'Customer Name': item.customer_name,
      'Mobile Number': item.customer_mobile
    };

    if (item.feedback_data) {
      for (let [q, a] of Object.entries(item.feedback_data)) {
        rowObj[q] = a;
      }
    }

    rowObj['Comment'] = item.comment || '';
    rowObj['Sentiment'] = item.response_type;
    rowObj['Status'] = item.status;
    rowObj['Date Submitted'] = new Date(item.created_at).toLocaleString();
    return rowObj;
  });

  const worksheet = XLSX.utils.json_to_sheet(excelData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Filtered Feedbacks");
  XLSX.writeFile(workbook, `Customer_Feedbacks_${channelFilter}.xlsx`);
}

// ==================== EXCEL EXPORT (Customers) ====================
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
  const { data } = await db.from('profiles').select('*');
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