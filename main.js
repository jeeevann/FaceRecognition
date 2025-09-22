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

  // Attendance page interactions - integrated with Flask recognition
  const video = $('#video')
  const statusBox = $('#status')
  const statusText = statusBox ? statusBox.querySelector('.status-text') : null
  const statusIcon = statusBox ? statusBox.querySelector('.status-icon') : null
  const btnDetect = $('#btn-detect')
  const btnReset = $('#btn-reset')

  const FLASK_BASE = 'http://127.0.0.1:5001'
  let streaming = false
  let streamTimer = null

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

  function getAttendanceMeta(){
    const sel = (()=>{ try{ return JSON.parse(localStorage.getItem('sa.attendance.selection')||'null') }catch{ return null } })() || {}
    return {
      teacher_id: 1,
      department: sel.dept || 'Computer',
      year: sel.year || 'FY',
      division: sel.division || 'A',
      time_slot: sel.slot || '9:00 - 10:00'
    }
  }

  async function captureAndSendFrame(){
    if(!video || !streaming) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.7)
    try{
      const res = await fetch(`${FLASK_BASE}/recognize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_data: dataUrl, meta: getAttendanceMeta() })
      })
      const json = await res.json()
      if(!statusBox || !statusText || !statusIcon) return
      if(json.success){
        const decision = json.decision
        if(decision === 'present'){
          statusBox.classList.remove('danger')
          statusBox.classList.add('success')
          statusText.textContent = `Attendance Marked: ${json.name} (sim ${json.similarity.toFixed(2)})`
          statusIcon.textContent = '✅'
        } else if(decision === 'uncertain'){
          statusBox.classList.remove('success')
          statusBox.classList.add('danger')
          statusText.textContent = `Uncertain: ${json.name} (sim ${json.similarity.toFixed(2)})`
          statusIcon.textContent = '❓'
        } else {
          statusBox.classList.remove('success')
          statusBox.classList.add('danger')
          statusText.textContent = 'Face Not Recognized'
          statusIcon.textContent = '❌'
        }
      } else {
        statusBox.classList.remove('success')
        statusBox.classList.add('danger')
        statusText.textContent = 'Recognition error'
        statusIcon.textContent = '⚠️'
      }
    }catch(err){
      if(statusBox && statusText && statusIcon){
        statusBox.classList.remove('success')
        statusBox.classList.add('danger')
        statusText.textContent = 'Connection to recognition server failed'
        statusIcon.textContent = '⚠️'
      }
    }
  }

  btnDetect && btnDetect.addEventListener('click', () => {
    if(!statusBox || !statusText || !statusIcon) return
    if(!streaming){
      streaming = true
      statusText.textContent = 'Recognizing...'
      statusIcon.textContent = '🔍'
      streamTimer = setInterval(captureAndSendFrame, 1200)
    } else {
      streaming = false
      if(streamTimer){ clearInterval(streamTimer); streamTimer = null }
      statusText.textContent = 'Stopped'
      statusIcon.textContent = '⏹️'
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

  // Home schedule + filters (unchanged)
  const scheduleGrid = document.getElementById('schedule-grid')
  const scheduleCaption = document.getElementById('schedule-caption')
  const applyFilterBtn = document.getElementById('apply-filter')
  const goAttendanceBtn = document.getElementById('go-attendance')
  const deptSel = document.getElementById('f-dept')
  const yearSel = document.getElementById('f-year')
  const divSel = document.getElementById('f-division')
  const slotSel = document.getElementById('f-slot')
  const FILTER_KEY = 'sa.home.filters'
  function loadFilters(){ try{ return JSON.parse(localStorage.getItem(FILTER_KEY) || 'null') }catch{ return null } }
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
        const fmt = (x) => { const ampm = x < 12 ? 'AM' : 'PM'; const hour = ((x+11)%12)+1; return `${hour}:00 ${ampm}` }
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
  ;(function initHomeFilters(){
    const saved = loadFilters()
    if(saved){ if(deptSel) deptSel.value = saved.dept || ''; if(yearSel) yearSel.value = saved.year || ''; if(divSel) divSel.value = saved.division || ''; if(slotSel) slotSel.value = saved.slot || '' }
    applyFiltersUI()
    renderSchedule()
  })()
  applyFilterBtn && applyFilterBtn.addEventListener('click', () => {
    const current = { dept: deptSel.value, year: yearSel.value, division: divSel.value, slot: slotSel?.value || '' }
    if(!current.dept || !current.year || !current.division || !current.slot){ toast('Please select Department, Year, Division and Time Slot', 'danger'); return }
    localStorage.setItem('sa.attendance.selection', JSON.stringify({ dept: current.dept, year: current.year, division: current.division, slot: current.slot }))
    applyFiltersUI()
    if(goAttendanceBtn) goAttendanceBtn.style.display = 'inline-block'
    toast('Selection saved. You can now mark attendance.', 'success')
  })

  // Student management (unchanged)
  const studentsBody = document.getElementById('students-body')
  const studentForm = document.getElementById('student-form')
  const studentPreview = document.getElementById('student-preview')
  const studentPhotosInput = document.getElementById('s-photos')
  async function renderStudents(){
    if(!studentsBody) return
    studentsBody.innerHTML = ''
    try{
      const list = await studentsAPI.getAll()
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
        const imgCell = ''
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


