;(function(){
  const $ = (s, r = document) => r.querySelector(s)
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s))

  // Navigation handling
  const navLinks = $$('.nav-link[data-section]')
  const contentSections = $$('.content-section')
  const pageTitle = $('#page-title')

  function showSection(sectionId) {
    // Update navigation
    navLinks.forEach(link => {
      link.classList.toggle('active', link.dataset.section === sectionId)
    })

    // Update content
    contentSections.forEach(section => {
      section.classList.toggle('active', section.id === `${sectionId}-section`)
    })

    // Update page title
    const titles = {
      'dashboard': 'Dashboard',
      'manage-students': 'Manage Students',
      'take-attendance': 'Take Attendance',
      'attendance-reports': 'Attendance Reports'
    }
    pageTitle.textContent = titles[sectionId] || 'Dashboard'

    // Initialize section-specific functionality
    if (sectionId === 'dashboard') {
      loadDashboardStats()
    } else if (sectionId === 'manage-students') {
      loadStudents()
    } else if (sectionId === 'take-attendance') {
      initializeAttendance()
    } else if (sectionId === 'attendance-reports') {
      loadReports()
    }
  }

  // Navigation event listeners
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault()
      showSection(link.dataset.section)
    })
  })

  // Quick action buttons
  $$('[data-section]').forEach(btn => {
    if (btn.classList.contains('btn')) {
      btn.addEventListener('click', () => {
        showSection(btn.dataset.section)
      })
    }
  })

  // Dashboard functionality
  function loadDashboardStats() {
    // Dashboard stats removed - only quick actions and recent activity remain
  }

  // Manage Students functionality
  const studentForm = $('#add-student-form')
  const photoUploadArea = $('#photo-upload-area')
  const photoPreview = $('#photo-preview')
  const studentPhotosInput = $('#student-photos')
  const studentsTableBody = $('#students-table-body')
  const studentSearch = $('#student-search')
  const filterDepartment = $('#filter-department')
  const filterYear = $('#filter-year')
  const filterDivision = $('#filter-division')
  const applyFilters = $('#apply-filters')

  // Camera capture functionality
  const studentCamera = $('#student-camera')
  const cameraPlaceholder = $('#camera-placeholder')
  const startCameraBtn = $('#start-camera')
  const capturePhotoBtn = $('#capture-photo')
  const stopCameraBtn = $('#stop-camera')
  const studentFaceOutline = $('#student-face-outline')

  let cameraStream = null
  let capturedImages = []

  // Start camera
  startCameraBtn.addEventListener('click', async () => {
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' } 
      })
      studentCamera.srcObject = cameraStream
      studentCamera.style.display = 'block'
      cameraPlaceholder.style.display = 'none'
      studentFaceOutline.classList.add('glow')
      
      startCameraBtn.style.display = 'none'
      capturePhotoBtn.style.display = 'inline-block'
      stopCameraBtn.style.display = 'inline-block'
    } catch (err) {
      toast('Camera access denied', 'danger')
    }
  })

  // Capture photo
  capturePhotoBtn.addEventListener('click', () => {
    if (capturedImages.length >= 2) {
      toast('Maximum 2 photos allowed', 'warning')
      return
    }
    
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    canvas.width = studentCamera.videoWidth
    canvas.height = studentCamera.videoHeight
    ctx.drawImage(studentCamera, 0, 0)
    
    const imageData = canvas.toDataURL('image/jpeg', 0.8)
    capturedImages.push(imageData)
    
    // Update photo slot
    const slotNumber = capturedImages.length
    const photoSlot = $(`#photo-slot-${slotNumber}`)
    const placeholder = photoSlot.querySelector('.photo-placeholder')
    const removeBtn = photoSlot.querySelector('.remove-photo')
    
    placeholder.style.display = 'none'
    photoSlot.innerHTML = `
      <img src="${imageData}" alt="Captured Photo ${slotNumber}" />
      <button class="btn-icon remove-photo" onclick="removePhoto(${slotNumber})">❌</button>
    `
    
    toast(`Photo ${slotNumber} captured!`, 'success')
    
    if (capturedImages.length >= 2) {
      capturePhotoBtn.style.display = 'none'
      toast('All photos captured! You can now save the student.', 'info')
    }
  })

  // Stop camera
  stopCameraBtn.addEventListener('click', () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop())
      cameraStream = null
    }
    
    studentCamera.style.display = 'none'
    cameraPlaceholder.style.display = 'flex'
    studentFaceOutline.classList.remove('glow')
    
    startCameraBtn.style.display = 'inline-block'
    capturePhotoBtn.style.display = 'none'
    stopCameraBtn.style.display = 'none'
  })

  // Remove photo function
  window.removePhoto = function(slotNumber) {
    if (slotNumber <= capturedImages.length) {
      capturedImages.splice(slotNumber - 1, 1)
      
      // Reset photo slots
      for (let i = 1; i <= 2; i++) {
        const photoSlot = $(`#photo-slot-${i}`)
        if (i <= capturedImages.length) {
          const imageData = capturedImages[i - 1]
          photoSlot.innerHTML = `
            <img src="${imageData}" alt="Captured Photo ${i}" />
            <button class="btn-icon remove-photo" onclick="removePhoto(${i})">❌</button>
          `
        } else {
          photoSlot.innerHTML = `
            <div class="photo-placeholder">Photo ${i}</div>
            <button class="btn-icon remove-photo" onclick="removePhoto(${i})" style="display: none;">❌</button>
          `
        }
      }
      
      // Show capture button if less than 2 photos
      if (capturedImages.length < 2 && cameraStream) {
        capturePhotoBtn.style.display = 'inline-block'
      }
    }
  }

  // Student form submission
  studentForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    
    // Validate required fields
    const name = $('#student-name').value.trim()
    const studentId = $('#student-id').value.trim()
    const department = $('#student-department').value
    const year = $('#student-year').value
    const division = $('#student-division').value
    
    if (!name || !studentId || !department || !year || !division) {
      toast('Please fill all required fields', 'danger')
      return
    }
    
    if (capturedImages.length === 0) {
      toast('Please capture at least one photo', 'danger')
      return
    }
    
    // Check for duplicate student ID before submitting
    try {
      const existingStudents = await fetch('api/students.php').then(r => r.json())
      if (Array.isArray(existingStudents)) {
        const duplicate = existingStudents.find(s => (s.roll_no || '').toLowerCase() === studentId.toLowerCase())
        if (duplicate) {
          toast('Student ID already exists. Please use a different ID.', 'danger')
          $('#student-id').focus()
          return
        }
      }
    } catch (error) {
      console.error('Error checking for duplicates:', error)
    }
    
    const formData = new FormData()
    formData.append('name', name)
    formData.append('roll_no', studentId)
    formData.append('class', department)
    formData.append('year', year)
    formData.append('division', division)
    
    // Add optional fields if provided
    const email = $('#student-email')?.value?.trim() || ''
    const phone = $('#student-phone')?.value?.trim() || ''
    
    if (email) formData.append('email', email)
    if (phone) formData.append('phone', phone)
    formData.append('department', department)
    
    // Add captured images as files
    capturedImages.forEach((imageData, index) => {
      const blob = dataURLtoBlob(imageData)
      formData.append('photos[]', blob, `photo${index + 1}.jpg`)
    })

    try {
      const response = await fetch('api/students.php', {
        method: 'POST',
        body: formData
      })
      const result = await response.json()
      
      if (result.success) {
        toast(`Student added successfully! Photos saved: ${result.photos_saved || 0}`, 'success')
        studentForm.reset()
        capturedImages = []
        
        // Reset photo slots
        for (let i = 1; i <= 2; i++) {
          const photoSlot = $(`#photo-slot-${i}`)
          photoSlot.innerHTML = `
            <div class="photo-placeholder">Photo ${i}</div>
            <button class="btn-icon remove-photo" onclick="removePhoto(${i})" style="display: none;">❌</button>
          `
        }
        
        // Stop camera if running
        if (cameraStream) {
          cameraStream.getTracks().forEach(track => track.stop())
          cameraStream = null
          studentCamera.style.display = 'none'
          cameraPlaceholder.style.display = 'flex'
          studentFaceOutline.classList.remove('glow')
          startCameraBtn.style.display = 'inline-block'
          capturePhotoBtn.style.display = 'none'
          stopCameraBtn.style.display = 'none'
        }
        
        // Immediately refresh the student list to show the new student
        await loadStudents()
      } else {
        toast(result.error || 'Failed to add student', 'danger')
      }
    } catch (error) {
      console.error('Error adding student:', error)
      toast('Failed to add student', 'danger')
    }
  })

  // Helper function to convert data URL to blob
  function dataURLtoBlob(dataURL) {
    const arr = dataURL.split(',')
    const mime = arr[0].match(/:(.*?);/)[1]
    const bstr = atob(arr[1])
    let n = bstr.length
    const u8arr = new Uint8Array(n)
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n)
    }
    return new Blob([u8arr], { type: mime })
  }

  // Load students from database
  async function loadStudents() {
    try {
      // Show loading state
      studentsTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: var(--muted);">Loading students...</td></tr>'
      
      const response = await fetch('api/students.php')
      const students = await response.json()
      
      if (!Array.isArray(students)) {
        console.error('Invalid response from API:', students)
        studentsTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: var(--danger);">Failed to load students</td></tr>'
        return
      }

      let filteredStudents = students

      // Apply filters
      const searchTerm = studentSearch.value.toLowerCase()
      const departmentFilter = filterDepartment.value
      const yearFilter = filterYear.value
      const divisionFilter = filterDivision.value

      if (searchTerm) {
        filteredStudents = filteredStudents.filter(s => 
          (s.name || '').toLowerCase().includes(searchTerm) || 
          (s.roll_no || '').toLowerCase().includes(searchTerm)
        )
      }

      if (departmentFilter) {
        filteredStudents = filteredStudents.filter(s => (s.department || s.class || s.class_name || '') === departmentFilter)
      }

      if (yearFilter) {
        filteredStudents = filteredStudents.filter(s => (s.year || '') === yearFilter)
      }

      if (divisionFilter) {
        filteredStudents = filteredStudents.filter(s => (s.division || '') === divisionFilter)
      }

      // Render table
      studentsTableBody.innerHTML = ''
      
      if (filteredStudents.length === 0) {
        studentsTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: var(--muted);">No students found</td></tr>'
        return
      }
      
      filteredStudents.forEach(student => {
        const row = document.createElement('tr')
        const photoPath = student.photo_folder_path ? `uploads/students/${student.id}/img1.jpg` : null
        row.innerHTML = `
          <td>
            <div class="student-photo">
              ${photoPath ? `<img src="${photoPath}" alt="${student.name}" onerror="this.parentElement.innerHTML='👤'" />` : '👤'}
            </div>
          </td>
          <td>${student.name || ''}</td>
          <td>${student.roll_no || ''}</td>
          <td>${student.department || student.class || student.class_name || ''}</td>
          <td>${student.year || ''}</td>
          <td>${student.division || ''}</td>
          <td>
            <button class="btn-icon" onclick="editStudent(${student.id})" title="Edit">✏️</button>
            <button class="btn-icon" onclick="deleteStudent(${student.id})" title="Delete">🗑️</button>
          </td>
        `
        studentsTableBody.appendChild(row)
      })
    } catch (error) {
      console.error('Error loading students:', error)
      studentsTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: var(--danger);">Failed to load students</td></tr>'
      toast('Failed to load students', 'danger')
    }
  }

  // Filter event listeners
  studentSearch.addEventListener('input', loadStudents)
  filterDepartment.addEventListener('change', loadStudents)
  filterYear.addEventListener('change', loadStudents)
  filterDivision.addEventListener('change', loadStudents)
  applyFilters.addEventListener('click', loadStudents)

  // Take Attendance functionality
  const attendanceContainer = $('#attendance-container')
  const startAttendanceBtn = $('#start-attendance')
  const stopAttendanceBtn = $('#stop-attendance')
  const attendanceVideo = $('#attendance-video')
  const attendanceLog = $('#attendance-log')
  const recognitionOverlay = $('#recognition-overlay')

  function initializeAttendance() {
    // Initialize camera if not already done
    if (!attendanceVideo.srcObject) {
      initCamera()
    }
  }

  async function initCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' } 
      })
      attendanceVideo.srcObject = stream
    } catch (err) {
      toast('Camera access denied', 'danger')
    }
  }

  startAttendanceBtn.addEventListener('click', () => {
    const classVal = $('#lecture-class').value
    const yearVal = $('#lecture-year').value
    const divisionVal = $('#lecture-division').value
    const subjectVal = $('#lecture-subject').value
    const timeSlotVal = $('#lecture-time-slot').value

    if (!classVal || !yearVal || !divisionVal || !subjectVal || !timeSlotVal) {
      toast('Please fill all lecture details', 'danger')
      return
    }

    attendanceContainer.style.display = 'flex'
    addLogEntry(`Started attendance for ${classVal} ${yearVal} ${divisionVal} - ${subjectVal} (${timeSlotVal})`)
    
    // Simulate face recognition
    simulateFaceRecognition()
  })

  stopAttendanceBtn.addEventListener('click', () => {
    attendanceContainer.style.display = 'none'
    addLogEntry('Attendance session ended')
  })

  function addLogEntry(text) {
    const now = new Date()
    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    
    const logItem = document.createElement('div')
    logItem.className = 'log-item'
    logItem.innerHTML = `
      <span class="log-time">${time}</span>
      <span class="log-text">${text}</span>
    `
    
    attendanceLog.insertBefore(logItem, attendanceLog.firstChild)
    
    // Keep only last 10 entries
    const items = $$('.log-item', attendanceLog)
    if (items.length > 10) {
      items[items.length - 1].remove()
    }
  }

  function simulateFaceRecognition() {
    const students = ['John Doe (CS001)', 'Jane Smith (CS002)', 'Mike Johnson (IT001)', 'Sarah Wilson (CS003)']
    
    setInterval(() => {
      if (attendanceContainer.style.display === 'none') return
      
      const randomStudent = students[Math.floor(Math.random() * students.length)]
      const recognized = Math.random() > 0.3
      
      if (recognized) {
        addLogEntry(`${randomStudent} - Present`)
        
        // Show recognition overlay
        recognitionOverlay.innerHTML = `
          <div class="recognition-box">
            <div class="recognition-name">${randomStudent}</div>
            <div class="recognition-status">✅ Present</div>
          </div>
        `
        
        setTimeout(() => {
          recognitionOverlay.innerHTML = ''
        }, 2000)
      }
    }, 3000)
  }

  // Attendance Reports functionality
  const reportTableBody = $('#reports-table-body')
  const generateReportBtn = $('#generate-report')
  const downloadReportBtn = $('#download-report')

  function loadReports() {
    // Simulate report data
    const reports = [
      { date: '2024-01-15', name: 'John Doe', class: 'Computer', year: 'FY', division: 'A', subject: 'Mathematics', timeSlot: '9:00-10:00', status: 'Present', timestamp: '09:05 AM' },
      { date: '2024-01-15', name: 'Jane Smith', class: 'Computer', year: 'FY', division: 'A', subject: 'Mathematics', timeSlot: '9:00-10:00', status: 'Present', timestamp: '09:07 AM' },
      { date: '2024-01-15', name: 'Mike Johnson', class: 'IT', year: 'SY', division: 'B', subject: 'Programming', timeSlot: '10:00-11:00', status: 'Absent', timestamp: '-' },
      { date: '2024-01-15', name: 'Sarah Wilson', class: 'Computer', year: 'TY', division: 'A', subject: 'Database', timeSlot: '11:00-12:00', status: 'Present', timestamp: '11:02 AM' }
    ]

    // Update summary
    const present = reports.filter(r => r.status === 'Present').length
    const absent = reports.filter(r => r.status === 'Absent').length
    const total = reports.length
    const percentage = total > 0 ? Math.round((present / total) * 100) : 0

    $('#total-present').textContent = present
    $('#total-absent').textContent = absent
    $('#attendance-percentage').textContent = `${percentage}%`

    // Render table
    reportTableBody.innerHTML = ''
    reports.forEach(report => {
      const row = document.createElement('tr')
      row.innerHTML = `
        <td>${report.date}</td>
        <td>${report.name}</td>
        <td>${report.class}</td>
        <td>${report.year}</td>
        <td>${report.division}</td>
        <td>${report.subject}</td>
        <td>${report.timeSlot}</td>
        <td><span class="badge ${report.status === 'Present' ? 'success' : 'danger'}">${report.status}</span></td>
        <td>${report.timestamp}</td>
      `
      reportTableBody.appendChild(row)
    })
  }

  generateReportBtn.addEventListener('click', loadReports)
  downloadReportBtn.addEventListener('click', () => {
    toast('Report downloaded successfully', 'success')
  })

  // Global functions for student actions
  window.editStudent = function(id) {
    toast(`Edit student ${id}`, 'info')
    // TODO: Implement edit functionality
  }

  window.deleteStudent = async function(id) {
    if (confirm('Are you sure you want to delete this student?')) {
      try {
        const response = await fetch(`api/students.php?id=${id}`, {
          method: 'DELETE'
        })
        const result = await response.json()
        
        if (result.success) {
          toast('Student deleted successfully', 'success')
          loadStudents()
        } else {
          toast('Failed to delete student', 'danger')
        }
      } catch (error) {
        console.error('Error deleting student:', error)
        toast('Failed to delete student', 'danger')
      }
    }
  }

  // Initialize dashboard on load
  loadDashboardStats()
  loadStudents()
})()
