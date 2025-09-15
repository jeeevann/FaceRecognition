;(function(){
  const $ = (s, r = document) => r.querySelector(s)
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s))

  // DateTime updater
  const datetimeEl = $('#datetime')
  function updateDateTime(){
    if(!datetimeEl) return
    const now = new Date()
    const formatted = now.toLocaleString([], { weekday:'short', year:'numeric', month:'short', day:'2-digit', hour:'2-digit', minute:'2-digit' })
    datetimeEl.textContent = formatted
  }
  updateDateTime()
  setInterval(updateDateTime, 30_000)

  // Theme toggle
  const themeBtn = $('#toggle-theme')
  const THEME_KEY = 'pref-theme'
  const applyTheme = (mode) => {
    if(mode === 'light'){
      document.documentElement.style.setProperty('--bg', '#f6f7fb')
      document.documentElement.style.setProperty('--panel', '#ffffff')
      document.documentElement.style.setProperty('--panel-2', '#f3f6ff')
      document.documentElement.style.setProperty('--text', '#0b1020')
      document.documentElement.style.setProperty('--muted', '#5b6687')
    } else {
      document.documentElement.style.removeProperty('--bg')
      document.documentElement.style.removeProperty('--panel')
      document.documentElement.style.removeProperty('--panel-2')
      document.documentElement.style.removeProperty('--text')
      document.documentElement.style.removeProperty('--muted')
    }
  }
  const savedTheme = localStorage.getItem(THEME_KEY)
  if(savedTheme) applyTheme(savedTheme)
  themeBtn && themeBtn.addEventListener('click', () => {
    const current = localStorage.getItem(THEME_KEY) === 'light' ? 'dark' : 'light'
    localStorage.setItem(THEME_KEY, current)
    applyTheme(current)
    toast(`Switched to ${current} mode`, 'success')
  })

  // Simple role-based auth
  const AUTH_KEY = 'sa.auth'
  const USERS_KEY = 'sa.users'
  function getAuth(){
    try{ return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null') }catch{ return null }
  }
  function setAuth(data){ localStorage.setItem(AUTH_KEY, JSON.stringify(data)) }
  function clearAuth(){ localStorage.removeItem(AUTH_KEY) }
  function getUsers(){ try{ return JSON.parse(localStorage.getItem(USERS_KEY) || '[]') }catch{ return [] } }
  function setUsers(list){ localStorage.setItem(USERS_KEY, JSON.stringify(list)) }

  // Seed a default admin if none (teachers are stored in DB)
  ;(function seed(){
    const users = getUsers()
    if(!users.find(u => u.email === 'admin@example.com')){
      users.push({ name:'Admin', email:'admin@example.com', password:'admin123', role:'Admin' })
      setUsers(users)
    }
  })()

  // Guard pages using data-role-guard on #app
  const appRoot = document.getElementById('app')
  const requiredRole = appRoot?.getAttribute('data-role-guard')
  if(requiredRole){
    const auth = getAuth()
    if(!auth || auth.role !== requiredRole){
      toast('Please login as '+requiredRole, 'danger')
      setTimeout(()=> location.href = 'login.html', 600)
      return
    }
  }

  // Login form handling
  const loginForm = document.getElementById('login-form')
  if(loginForm){
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault()
      const email = document.getElementById('email').value.trim().toLowerCase()
      const password = document.getElementById('password').value
      const role = document.getElementById('role').value
      try{
        const res = await authAPI.login(email, password, role)
        if(!res?.success){ toast(res?.error || 'Invalid credentials', 'danger'); return }
        const user = res.user
        setAuth({ email: user.email, name: user.name, role: user.role })
        toast('Signed in as '+user.role, 'success')
        setTimeout(()=>{
          if(user.role === 'Admin') location.href = 'admin.html'
          else location.href = 'teacher-dashboard.html'
        }, 500)
      }catch(err){
        toast('Login failed', 'danger')
      }
    })
  }

  // Signup disabled: accounts are created by admin

  // Logout buttons
  $$('#logout').forEach(btn => btn.addEventListener('click', () => {
    clearAuth()
    toast('Logged out', 'success')
    setTimeout(()=> location.href = 'login.html', 400)
  }))

  // Toasts
  const toastContainer = $('#toast-container')
  function toast(message, type = 'success'){
    if(!toastContainer) return
    const el = document.createElement('div')
    el.className = `toast ${type}`
    el.textContent = message
    toastContainer.appendChild(el)
    setTimeout(() => {
      el.style.opacity = '0'
      el.style.transform = 'translateY(12px)'
      setTimeout(() => el.remove(), 250)
    }, 3000)
  }

  // Attendance page interactions (simulated)
  const video = $('#video')
  const statusBox = $('#status')
  const statusText = statusBox ? statusBox.querySelector('.status-text') : null
  const statusIcon = statusBox ? statusBox.querySelector('.status-icon') : null
  const btnDetect = $('#btn-detect')
  const btnReset = $('#btn-reset')
  

  async function initCamera(){
    if(!video) return
    try{
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      video.srcObject = stream
    }catch(err){
      toast('Camera access denied', 'danger')
    }
  }
  initCamera()

  btnDetect && btnDetect.addEventListener('click', () => {
    if(!statusBox || !statusText || !statusIcon) return
    const dept = document.getElementById('a-dept')?.value || ''
    const year = document.getElementById('a-year')?.value || ''
    const division = document.getElementById('a-division')?.value || ''
    const slot = document.getElementById('a-slot')?.value || ''
    if((dept || year || division || slot) && (!dept || !year || !division || !slot)){
      toast('Please select Department, Year, Division and Time Slot', 'danger')
      return
    }
    const recognized = Math.random() > 0.35
    if(recognized){
      statusBox.classList.remove('danger')
      statusBox.classList.add('success')
      statusText.textContent = 'Attendance Marked Successfully'
      statusIcon.textContent = '✅'
      const key = (dept && year && division && slot) ? `sa.attendance.${dept}.${year}.${division}` : null
      if(key){
        const today = new Date().toISOString().slice(0,10)
        const db = (()=>{ try{ return JSON.parse(localStorage.getItem(key)||'{}') }catch{ return {} } })()
        db[today] = db[today] || {}
        db[today][slot] = db[today][slot] || { present: 0, records: [] }
        db[today][slot].present += 1
        db[today][slot].records.push({ ts: Date.now() })
        localStorage.setItem(key, JSON.stringify(db))
      }
      toast('Attendance marked', 'success')
    } else {
      statusBox.classList.remove('success')
      statusBox.classList.add('danger')
      statusText.textContent = 'Face Not Recognized. Try Again'
      statusIcon.textContent = '❌'
      toast('Face not recognized', 'danger')
    }
  })

  btnReset && btnReset.addEventListener('click', () => {
    if(!statusBox || !statusText || !statusIcon) return
    statusBox.classList.remove('success','danger')
    statusText.textContent = 'Waiting for detection...'
    statusIcon.textContent = '⌛'
  })

  // Reports heatmap demo
  const heatmap = $('#heatmap')
  if(heatmap){
    const days = 28 * 5
    for(let i=0;i<days;i++){
      const cell = document.createElement('div')
      cell.className = 'heatmap-cell'
      const v = Math.random()
      cell.style.background = `rgba(108,124,255, ${v * 0.6})`
      heatmap.appendChild(cell)
    }
  }

  // Records page filters and table
  const rDate = document.getElementById('r-date')
  const rClass = document.getElementById('r-class')
  const rYear = document.getElementById('r-year')
  const rDiv = document.getElementById('r-division')
  const rStudent = document.getElementById('r-student')
  const rApply = document.getElementById('r-apply')
  const rBody = document.getElementById('records-body')
  async function renderRecords(){
    if(!rBody) return
    rBody.innerHTML = ''
    const params = {}
    if(rDate?.value) params.date = rDate.value
    if(rClass?.value) params.class = rClass.value
    if(rYear?.value) params.year = rYear.value
    if(rDiv?.value) params.division = rDiv.value
    try{
      const data = await attendanceAPI.getRecords(params)
      let rows = Array.isArray(data) ? data : []
      const q = (rStudent?.value||'').toLowerCase()
      if(q){ rows = rows.filter(x => (x.student_name||'').toLowerCase().includes(q) || String(x.student_id||'').includes(q)) }
      rows.forEach(x => {
        const tr = document.createElement('tr')
        tr.innerHTML = `<td>${x.attendance_date||x.date||''}</td><td>${x.student_name||''}</td><td>${x.class||x.class_name||''}</td><td>${x.year||''}</td><td>${x.division||''}</td><td>${x.subject||''}</td><td>${x.time_slot||''}</td><td>${x.status||'Present'}</td>`
        rBody.appendChild(tr)
      })
    }catch(err){ toast('Failed to load records', 'danger') }
  }
  rApply && rApply.addEventListener('click', renderRecords)
  renderRecords()

  // Home schedule + filters
  const scheduleGrid = document.getElementById('schedule-grid')
  const scheduleCaption = document.getElementById('schedule-caption')
  const applyFilterBtn = document.getElementById('apply-filter')
  const goAttendanceBtn = document.getElementById('go-attendance')
  const deptSel = document.getElementById('f-dept')
  const yearSel = document.getElementById('f-year')
  const divSel = document.getElementById('f-division')
  const slotSel = document.getElementById('f-slot')
  const FILTER_KEY = 'sa.home.filters'
  function loadFilters(){
    try{ return JSON.parse(localStorage.getItem(FILTER_KEY) || 'null') }catch{ return null }
  }
  function saveFilters(obj){ localStorage.setItem(FILTER_KEY, JSON.stringify(obj)) }
  function renderSchedule(){
    if(!scheduleGrid) return
    scheduleGrid.innerHTML = ''
    const slots = [9,10,11,12,'lunch',14,15,16]
    slots.forEach((h) => {
      const div = document.createElement('div')
      div.className = 'slot' + (h==='lunch' ? ' lunch' : '')
      if(h==='lunch'){
        div.innerHTML = `<span class="time">1:00 - 2:00</span><span class="label">Lunch Break</span>`
      } else {
        const start = h
        const end = h+1
        const fmt = (x) => {
          const ampm = x < 12 ? 'AM' : 'PM'
          const hour = ((x+11)%12)+1
          return `${hour}:00 ${ampm}`
        }
        div.innerHTML = `<span class="time">${fmt(start)} - ${fmt(end)}</span><span class="label">1 hour</span>`
      }
      scheduleGrid.appendChild(div)
    })
  }
  function applyFiltersUI(){
    if(!scheduleCaption) return
    const d = deptSel?.value || ''
    const y = yearSel?.value || ''
    const v = divSel?.value || ''
    const parts = []
    if(d) parts.push(d)
    if(y) parts.push(y)
    if(v) parts.push(`Div ${v}`)
    scheduleCaption.textContent = parts.length ? `Schedule for ${parts.join(' • ')}` : 'Select Department, Year and Division'
  }
  // init filters from storage
  ;(function initHomeFilters(){
    const saved = loadFilters()
    if(saved){
      if(deptSel) deptSel.value = saved.dept || ''
      if(yearSel) yearSel.value = saved.year || ''
      if(divSel) divSel.value = saved.division || ''
      if(slotSel) slotSel.value = saved.slot || ''
    }
    applyFiltersUI()
    renderSchedule()
  })()
  applyFilterBtn && applyFilterBtn.addEventListener('click', () => {
    const current = { dept: deptSel.value, year: yearSel.value, division: divSel.value, slot: slotSel?.value || '' }
    if(!current.dept || !current.year || !current.division || !current.slot){ toast('Please select Department, Year, Division and Time Slot', 'danger'); return }
    saveFilters(current)
    applyFiltersUI()
    if(goAttendanceBtn) goAttendanceBtn.style.display = 'inline-block'
    // also prime attendance selection
    try{ localStorage.setItem('sa.attendance.selection', JSON.stringify({ dept: current.dept, year: current.year, division: current.division, slot: current.slot })) }catch{}
    toast('Selection saved. You can now mark attendance.', 'success')
  })

  // Attendance selection context
  const aDept = document.getElementById('a-dept')
  const aYear = document.getElementById('a-year')
  const aDivision = document.getElementById('a-division')
  const aSlot = document.getElementById('a-slot')
  const aApply = document.getElementById('a-apply')
  const aContext = document.getElementById('a-context')
  const A_SEL_KEY = 'sa.attendance.selection'
  function saveAttendanceSelection(sel){ localStorage.setItem(A_SEL_KEY, JSON.stringify(sel)) }
  function loadAttendanceSelection(){ try{ return JSON.parse(localStorage.getItem(A_SEL_KEY)||'null') }catch{ return null } }
  function applyAttendanceContext(){
    if(!aContext) return
    const s = loadAttendanceSelection()
    if(!s || !s.dept || !s.year || !s.division || !s.slot){ aContext.textContent = 'Select Department, Year, Division and Time Slot'; return }
    aContext.textContent = `Selected: ${s.dept} • ${s.year} • Div ${s.division} • ${s.slot}`
  }
  ;(function initAttendanceSelection(){
    const s = loadAttendanceSelection()
    if(s){ if(aDept) aDept.value = s.dept||''; if(aYear) aYear.value = s.year||''; if(aDivision) aDivision.value = s.division||''; if(aSlot) aSlot.value = s.slot||'' }
    // Pre-fill subject if available (from teacher dashboard)
    try{
      const subj = localStorage.getItem('sa.attendance.subject') || ''
      const subjEl = document.getElementById('a-subject')
      if(subj && subjEl){ subjEl.value = subj }
    }catch{}
    applyAttendanceContext()
  })()
  aApply && aApply.addEventListener('click', () => {
    const sel = { dept: aDept.value, year: aYear.value, division: aDivision.value, slot: aSlot.value }
    if(!sel.dept || !sel.year || !sel.division || !sel.slot){ toast('Please fill all selection fields', 'danger'); return }
    saveAttendanceSelection(sel)
    applyAttendanceContext()
    toast('Selection saved', 'success')
  })

  // Manage Teachers via API
  const teachersBody = document.getElementById('teachers-body')
  const teacherForm = document.getElementById('teacher-form')
  async function loadAdminStats(){
    const t = document.getElementById('stat-teachers')
    const s = document.getElementById('stat-students')
    const c = document.getElementById('stat-classes')
    if(!t || !s || !c) return
    try{
      // bust cache
      const stats = await fetch(`${API_BASE}/admin_stats.php?ts=${Date.now()}`).then(r=>r.json())
      if(stats?.success){
        t.textContent = stats.teachers
        s.textContent = stats.students
        c.textContent = stats.classes
      }
      // ensure teacher count reflects current DB list length
      try{
        const list = await teachersAPI.getAll()
        if(Array.isArray(list)) t.textContent = String(list.length)
      }catch{}
    }catch{}
  }
  loadAdminStats()
  async function renderTeachers(){
    if(!teachersBody) return
    teachersBody.innerHTML = ''
    try{
      const list = await teachersAPI.getAll()
      // client-side search/sort/paginate
      const q = (document.getElementById('t-search')?.value || '').toLowerCase()
      const sortVal = (document.getElementById('t-sort')?.value || 'created_at|desc')
      const [sortKey, sortDir] = sortVal.split('|')
      let filtered = list
      if(q){
        filtered = list.filter(t => (
          (t.name||'').toLowerCase().includes(q) ||
          (t.email||'').toLowerCase().includes(q) ||
          (t.department||'').toLowerCase().includes(q)
        ))
      }
      filtered.sort((a,b) => {
        const av = (a[sortKey]||'').toString().toLowerCase()
        const bv = (b[sortKey]||'').toString().toLowerCase()
        if(av < bv) return sortDir==='asc' ? -1 : 1
        if(av > bv) return sortDir==='asc' ? 1 : -1
        return 0
      })
      const PAGE_SIZE = 8
      const pageEl = document.getElementById('t-page')
      const prevEl = document.getElementById('t-prev')
      const nextEl = document.getElementById('t-next')
      const currentPage = Number(pageEl?.dataset.page || '1')
      const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
      const page = Math.min(currentPage, totalPages)
      if(pageEl){ pageEl.textContent = `${page} / ${totalPages}`; pageEl.dataset.page = String(page) }
      const start = (page-1)*PAGE_SIZE
      const rows = filtered.slice(start, start + PAGE_SIZE)
      rows.forEach((t) => {
        const tr = document.createElement('tr')
        const created = t.created_at ? new Date(t.created_at).toLocaleString() : ''
        tr.innerHTML = `<td>${t.name||''}</td><td>${t.email||''}</td><td>${t.department||''}</td><td>${t.phone||''}</td><td>${t.employee_id||''}</td><td>${t.designation||''}</td><td>${created}</td>`
        teachersBody.appendChild(tr)
      })
      // wire pagination controls once
      if(prevEl && !prevEl.dataset.wired){
        prevEl.dataset.wired = '1'
        prevEl.addEventListener('click', () => {
          const p = Math.max(1, (Number(pageEl.dataset.page)||1) - 1)
          pageEl.dataset.page = String(p)
          renderTeachers()
        })
      }
      if(nextEl && !nextEl.dataset.wired){
        nextEl.dataset.wired = '1'
        nextEl.addEventListener('click', () => {
          const p = Math.min(totalPages, (Number(pageEl.dataset.page)||1) + 1)
          pageEl.dataset.page = String(p)
          renderTeachers()
        })
      }
    }catch(err){ toast('Failed to load teachers', 'danger') }
  }
  teacherForm && teacherForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    const name = document.getElementById('t-name').value.trim()
    const email = document.getElementById('t-email').value.trim()
    const password = (document.getElementById('t-password')?.value || '').trim()
    const phone = (document.getElementById('t-phone')?.value || '').trim()
    const department = document.getElementById('t-dept').value.trim()
    const employee_id = (document.getElementById('t-empid')?.value || '').trim()
    const designation = (document.getElementById('t-title')?.value || '').trim()
    // Inline validation
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const invalids = []
    if(!name) invalids.push('t-name')
    if(!email || !emailRe.test(email)) invalids.push('t-email')
    if(!department) invalids.push('t-dept')
    if(!password) invalids.push('t-password')
    ;['t-name','t-email','t-dept','t-password'].forEach(id => {
      const el = document.getElementById(id)
      if(!el) return
      if(invalids.includes(id)) el.style.borderColor = '#e63946'; else el.style.removeProperty('border-color')
    })
    if(invalids.length){
      const first = document.getElementById(invalids[0]); first && first.focus()
      toast('Please correct highlighted fields', 'danger')
      return
    }
    // Frontend duplicate check to provide immediate feedback
    try{
      const existing = await teachersAPI.getAll()
      if(existing.some(t => (t.email||'').toLowerCase() === email.toLowerCase())){
        const emailEl = document.getElementById('t-email'); if(emailEl){ emailEl.style.borderColor = '#e63946'; emailEl.focus() }
        toast('Email already exists', 'danger')
        return
      }
      const phoneN = phone.replace(/\D+/g,'')
      if(phoneN && existing.some(t => (String(t.phone||'').replace(/\D+/g,'') === phoneN))){
        const phoneEl = document.getElementById('t-phone'); if(phoneEl){ phoneEl.style.borderColor = '#e63946'; phoneEl.focus() }
        toast('Mobile number already exists', 'danger')
        return
      }
    }catch(err){ /* ignore precheck failure; server will validate too */ }
    try{
      const res = await teachersAPI.add({ name, email, password, phone, department, employee_id, designation })
      if(!res?.success){
        const msg = (res?.error||'').toLowerCase()
        if(msg.includes('email')){ const el = document.getElementById('t-email'); if(el){ el.style.borderColor='#e63946'; el.focus() } }
        else if(msg.includes('mobile')){ const el = document.getElementById('t-phone'); if(el){ el.style.borderColor='#e63946'; el.focus() } }
        toast(res?.error || 'Failed to save teacher', 'danger');
        return
      }
      teacherForm.reset()
      toast('Teacher saved', 'success')
      // Notify other tabs/pages (e.g., dashboard) to refresh
      try{ localStorage.setItem('sa.teachers.changed', String(Date.now())) }catch{}
      renderTeachers()
      loadAdminStats()
    }catch(err){
      toast('Failed to save teacher', 'danger')
    }
  })
  renderTeachers()
  // Auto-refresh when window/tab regains focus
  if(teachersBody){
    window.addEventListener('focus', () => { renderTeachers(); loadAdminStats() })
    document.addEventListener('visibilitychange', () => { if(!document.hidden){ renderTeachers(); loadAdminStats() } })
    window.addEventListener('storage', (ev) => { if(ev.key === 'sa.teachers.changed'){ renderTeachers(); loadAdminStats() } })
    const searchEl = document.getElementById('t-search')
    const sortEl = document.getElementById('t-sort')
    searchEl && searchEl.addEventListener('input', () => { const p = document.getElementById('t-page'); if(p) p.dataset.page='1'; renderTeachers() })
    sortEl && sortEl.addEventListener('change', () => { const p = document.getElementById('t-page'); if(p) p.dataset.page='1'; renderTeachers() })
  }

  // Manage Students via API (multipart) with image preview
  const studentsBody = document.getElementById('students-body')
  const studentForm = document.getElementById('student-form')
  const studentPreview = document.getElementById('student-preview')
  const studentPhotosInput = document.getElementById('s-photos')
  async function renderStudents(){
    if(!studentsBody) return
    studentsBody.innerHTML = ''
    try{
      const list = await studentsAPI.getAll()
      // Apply teacher filters if present
      const fClass = (document.getElementById('st-filter-class')?.value || '').toLowerCase()
      const fYear = (document.getElementById('st-filter-year')?.value || '').toLowerCase()
      const fDiv = (document.getElementById('st-filter-division')?.value || '').toLowerCase()
      const filtered = list.filter(s => {
        const cls = (s.class || s.class_name || '').toLowerCase()
        const yr = (s.year || '').toLowerCase()
        const dv = (s.division || '').toLowerCase()
        if(fClass && !cls.includes(fClass)) return false
        if(fYear && !yr.includes(fYear)) return false
        if(fDiv && !dv.includes(fDiv)) return false
        return true
      })
      filtered.forEach((s) => {
        const tr = document.createElement('tr')
        const imgCell = '' // could show first photo later
        tr.innerHTML = `<td>${imgCell}</td><td>${s.name||''}</td><td>${s.email||''}</td><td>${s.phone||''}</td><td>${s.roll_no||''}</td><td>${s.class||s.class_name||''}</td><td>${s.section||''}</td><td>${s.department||''}</td><td></td>`
        studentsBody.appendChild(tr)
      })
    }catch(err){ toast('Failed to load students', 'danger') }
  }
  function readFileAsDataUrl(file){
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }
  studentPhotosInput && studentPhotosInput.addEventListener('change', async (e) => {
    const files = e.target.files
    if(!files || !files.length){ studentPreview && (studentPreview.innerHTML = ''); return }
    if(studentPreview){
      studentPreview.innerHTML = ''
      Array.from(files).slice(0,3).forEach(async (f) => {
        const dataUrl = await readFileAsDataUrl(f)
        const img = document.createElement('img')
        img.src = dataUrl
        studentPreview.appendChild(img)
      })
    }
  })
  studentForm && studentForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    const name = document.getElementById('s-name').value.trim()
    const email = document.getElementById('s-email').value.trim()
    const phone = document.getElementById('s-phone').value.trim()
    const roll = document.getElementById('s-roll').value.trim()
    const className = document.getElementById('s-class').value.trim()
    const year = document.getElementById('s-year').value.trim()
    const division = document.getElementById('s-division').value.trim()
    const section = document.getElementById('s-section').value.trim()
    const department = document.getElementById('s-dept').value.trim()
    const files = studentPhotosInput?.files || []
    if(!name || !className || !year || !division){ toast('Fill required fields', 'danger'); return }
    try{
      const res = await studentsAPI.addMultipart({ name, className, year, division, roll, department, email, phone, files })
      if(!res?.success){ toast(res?.error || 'Failed to save student', 'danger'); return }
      studentForm.reset()
      if(studentPreview) studentPreview.innerHTML = ''
      toast('Student saved', 'success')
      renderStudents()
    }catch(err){ toast('Failed to save student', 'danger') }
  })

  // Teacher student filters
  const stApply = document.getElementById('st-apply')
  stApply && stApply.addEventListener('click', () => { renderStudents() })
  renderStudents()
})()


