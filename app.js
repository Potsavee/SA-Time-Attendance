const SUPABASE_URL = 'https://xgvbwvetpkeayrnsqlyr.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_YSanIZRA9-io0D2NTD2E8A_pLTYivrf';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.getElementById('current-date').innerText = "วันที่ปัจจุบัน: " + new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });

const DEFAULT_LEAVE_START_TIME = '08:00';
const DEFAULT_LEAVE_RETURN_TIME = '08:30';
const SCHOOL_LOCATION = { latitude: 13.816907, longitude: 100.039916 };
const SCHOOL_GEOFENCE_RADIUS_METERS = 2000;
let checkInCameraStream = null;
let checkInLocationVerified = false;
let checkInCameraReady = false;
let attendanceScanType = 'check_in';
let notificationTimeout = null;

function showNotification(message, type = 'success') {
    const toast = document.getElementById('notification-toast');
    const isError = type === 'error';
    toast.classList.remove('hidden', 'notification-toast-success', 'notification-toast-error');
    toast.classList.add(isError ? 'notification-toast-error' : 'notification-toast-success');
    document.getElementById('notification-toast-title').textContent = isError ? 'เกิดข้อผิดพลาด' : 'สำเร็จ';
    document.getElementById('notification-toast-message').textContent = message;

    clearTimeout(notificationTimeout);
    notificationTimeout = setTimeout(dismissNotification, 6000);
}

function dismissNotification() {
    document.getElementById('notification-toast').classList.add('hidden');
    clearTimeout(notificationTimeout);
    notificationTimeout = null;
}

function initializeLeaveTimePickers() {
    const startSelect = document.getElementById('leave-time-out');
    const returnSelect = document.getElementById('leave-time-return');

    [startSelect, returnSelect].forEach(select => {
        for (let minutes = 0; minutes < 24 * 60; minutes += 30) {
            const hour = String(Math.floor(minutes / 60)).padStart(2, '0');
            const minute = String(minutes % 60).padStart(2, '0');
            const time = `${hour}:${minute}`;
            select.add(new Option(time, time));
        }
    });

    resetLeaveTimePickers();
}

function resetLeaveTimePickers() {
    document.getElementById('leave-time-out').value = DEFAULT_LEAVE_START_TIME;
    document.getElementById('leave-time-return').value = DEFAULT_LEAVE_RETURN_TIME;
}

initializeLeaveTimePickers();

let currentUser = null;

function togglePasswordVisibility() {
    const passwordInput = document.getElementById('user-pass');
    const eyeIcon = document.getElementById('eye-icon');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        eyeIcon.innerHTML = `
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        `;
    } else {
        passwordInput.type = 'password';
        eyeIcon.innerHTML = `
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a10.05 10.05 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
        `;
    }
}

async function handleLogin(event) {
    event.preventDefault();
    const selectedRole = document.getElementById('user-role').value;
    const staffIdInput = document.getElementById('user-id').value.trim();
    const passwordInput = document.getElementById('user-pass').value;
    const errorBox = document.getElementById('login-error');

    try {
        const { data, error } = await supabaseClient
            .from('staff')
            .select('*')
            .eq('staff_id', staffIdInput)
            .eq('password', passwordInput);

        console.log("ผลลัพธ์จาก Supabase:", data, error);

        if (error || !data || data.length === 0) {
            errorBox.classList.remove('hidden');
            return;
        }

        if (data[0].role !== selectedRole) {
            errorBox.classList.remove('hidden');
            return;
        }

        currentUser = data[0];
        errorBox.classList.add('hidden');
        document.getElementById('staff-leave-history').innerHTML = '';

        document.getElementById('login-section').classList.add('hidden');
        document.getElementById('app-section').classList.remove('hidden');
        
        const tabExec = document.getElementById('tab-executive-overview');
        const tabHr = document.getElementById('tab-hr-management');
        const tabCheckin = document.getElementById('tab-checkin');
        const tabLeave = document.getElementById('tab-leave');
        const tabReportBtn = document.getElementById('tab-report');
        let roleText = '';

        if (currentUser.role === 'executive') {
            roleText = 'ผู้บริหารสถานศึกษา';
            tabExec.classList.remove('hidden');
            tabHr.classList.add('hidden');
            tabCheckin.classList.add('hidden');
            tabLeave.classList.add('hidden');
            if (tabReportBtn) tabReportBtn.classList.remove('hidden');
            switchTab('executive-overview');
            loadExecutiveRequests();
            loadExecutiveReport();
        } else if (currentUser.role === 'hr') {
            roleText = 'ฝ่ายบริหารงานบุคคล / ธุรการ';
            tabExec.classList.add('hidden');
            tabHr.classList.remove('hidden');
            tabCheckin.classList.remove('hidden');
            tabLeave.classList.remove('hidden');
            if (tabReportBtn) tabReportBtn.classList.add('hidden');
            switchTab('checkin');
            loadHrAttendanceLogs();
            loadAttendanceHistory();
            loadStaffLeaveHistory();
        } else {
            roleText = 'ครูและบุคลากรทางการศึกษา';
            tabExec.classList.add('hidden');
            tabHr.classList.add('hidden');
            tabCheckin.classList.remove('hidden');
            tabLeave.classList.remove('hidden');
            if (tabReportBtn) tabReportBtn.classList.add('hidden');
            switchTab('checkin');
            loadAttendanceHistory();
            loadStaffLeaveHistory();
        }

        document.getElementById('user-badge').innerText = `ผู้ใช้งาน: ${currentUser.name} (${roleText})`;

    } catch (err) {
        console.error("Login Error:", err);
        errorBox.classList.remove('hidden');
    }
}

function handleLogout() {
    currentUser = null;
    document.getElementById('staff-leave-history').innerHTML = '';
    document.getElementById('app-section').classList.add('hidden');
    document.getElementById('login-section').classList.remove('hidden');
    document.getElementById('user-id').value = '';
    document.getElementById('user-pass').value = '';
}

function switchTab(tabName) {
    const tabs = ['executive-overview', 'hr-management', 'checkin', 'leave', 'report'];
    
    tabs.forEach(t => {
        const contentEl = document.getElementById('content-' + t);
        if (contentEl) contentEl.classList.add('hidden');
        
        const btn = document.getElementById('tab-' + t);
        if (btn && !btn.classList.contains('hidden')) {
            btn.className = "px-5 py-2.5 text-sm font-semibold rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition";
        }
    });
    
    const targetContent = document.getElementById('content-' + tabName);
    if (targetContent) targetContent.classList.remove('hidden');
    
    const activeBtn = document.getElementById('tab-' + tabName);
    if (activeBtn && !activeBtn.classList.contains('hidden')) {
        activeBtn.className = "px-5 py-2.5 text-sm font-semibold rounded-xl text-rose-900 bg-amber-200/70 shadow-sm transition";
    }
}

// 1. ผู้บริหารโหลดคำขอทั้งหมด
async function loadExecutiveRequests() {
    const { data: staffData, error: staffError } = await supabaseClient
        .from('staff')
        .select('staff_id, name');

    const staffMap = {};
    if (staffData) {
        staffData.forEach(staff => {
            staffMap[staff.staff_id] = staff.name;
        });
    }

    // ดึงข้อมูลทั้งหมดโดยไม่ใช้ .order() เพื่อป้องกัน Error เรื่องชื่อคอลัมน์
    const { data, error } = await supabaseClient
        .from('leave_requests')
        .select('*');

    const tbody = document.getElementById('exec-requests-list');
    tbody.innerHTML = '';

    if (error) {
        console.error('Error loading leave requests:', error);
        tbody.innerHTML = `<tr><td colspan="6" class="py-4 px-4 text-center text-rose-600">โหลดรายการคำขอไม่สำเร็จ กรุณาลองใหม่</td></tr>`;
        return;
    }

    let pendingCount = 0;

    if (data && data.length > 0) {
        // กลับด้านข้อมูล (Reverse) ให้รายการที่ถูกเพิ่มเข้ามาล่าสุดอยู่บนสุด
        const reversedData = [...data].reverse();

        reversedData.forEach(row => {
            if(row.status === 'รออนุมัติ') pendingCount++;

            const staffName = staffMap[row.staff_id] || 'ไม่พบชื่อผู้ใช้';
            const substituteText = row.substitute_teacher 
                ? `<span class="text-xs text-slate-700 font-medium">วิชา: ${row.subject || '-'} (${row.period || '-'})<br>ผู้สอนแทน: ${row.substitute_teacher}</span>`
                : `<span class="text-xs text-slate-400">ไม่มีการฝากคาบ</span>`;

            let statusBadge = 'bg-amber-50 text-amber-700';
            if(row.status === 'อนุมัติ') statusBadge = 'bg-emerald-50 text-emerald-700';
            if(row.status === 'ไม่อนุมัติ') statusBadge = 'bg-rose-50 text-rose-700';

            let actionBtns = `-`;
            if (row.status === 'รออนุมัติ') {
                actionBtns = `
                    <div class="flex justify-center gap-2">
                        <button onclick="updateLeaveStatus('${row.id}', 'อนุมัติ')" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs transition">อนุมัติ</button>
                        <button onclick="updateLeaveStatus('${row.id}', 'ไม่อนุมัติ')" class="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg text-xs transition">ไม่อนุมัติ</button>
                    </div>
                `;
            }

            tbody.innerHTML += `
                <tr class="hover:bg-slate-50/50 transition">
                    <td class="py-4 px-4">
                        <div class="font-medium text-slate-800">${staffName}</div>
                        <div class="text-xs text-slate-400">รหัส: ${row.staff_id}</div>
                    </td>
                    <td class="py-4 px-4 text-slate-600">${row.reason}</td>
                    <td class="py-4 px-4 text-slate-600">${row.leave_date}<br><span class="text-xs text-slate-400">${row.time_range}</span></td>
                    <td class="py-4 px-4">${substituteText}</td>
                    <td class="py-4 px-4"><span class="px-2.5 py-1 ${statusBadge} rounded-full text-xs font-medium">${row.status}</span></td>
                    <td class="py-4 px-4 text-center">${actionBtns}</td>
                </tr>
            `;
        });
    } else {
        tbody.innerHTML = `<tr><td colspan="6" class="py-4 px-4 text-center text-slate-400">ยังไม่มีรายการคำขอในระบบ</td></tr>`;
    }

    document.getElementById('exec-pending-count').innerHTML = `${pendingCount} <span class="text-xs font-normal text-rose-600">รายการ</span>`;
    document.getElementById('stat-leave').innerHTML = `${data ? data.length : 0} <span class="text-sm font-normal text-rose-600">รายการ</span>`;
}

// ผู้บริหารอัปเดตสถานะคำขอ
async function updateLeaveStatus(id, newStatus) {
    const { error } = await supabaseClient
        .from('leave_requests')
        .update({ status: newStatus })
        .eq('id', id);

    if (error) {
        showNotification('อัปเดตสถานะไม่สำเร็จ', 'error');
    } else {
        showNotification(`อัปเดตสถานะเป็น "${newStatus}" เรียบร้อยแล้ว ระบบได้ส่งการแจ้งเตือน Real-time ให้บุคลากรทราบ`);
        loadExecutiveRequests();
    }
}

// 2. HR ตรวจสอบการมาปฏิบัติงาน
async function loadHrAttendanceLogs() {
    const { data: staffData, error: staffError } = await supabaseClient
        .from('staff')
        .select('staff_id, name');

    const staffMap = {};
    if (staffData) {
        staffData.forEach(staff => {
            staffMap[staff.staff_id] = staff.name;
        });
    }

    const { data, error } = await supabaseClient
        .from('attendance_logs')
        .select('*')
        .order('check_in', { ascending: false });

    const tbody = document.getElementById('hr-attendance-list');
    tbody.innerHTML = '';

    if (data && data.length > 0) {
        data.forEach(row => {
            const staffName = staffMap[row.staff_id] || 'ไม่พบชื่อ';
            const checkInTime = row.check_in ? new Date(row.check_in).toLocaleString('th-TH') : '-';
            const checkOutTime = row.check_out ? new Date(row.check_out).toLocaleString('th-TH') : '-';
            const badgeClass = row.status === 'มาตรงเวลา' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700';
            const statusText = row.status === 'มาตรงเวลา' ? 'ตรงเวลา' : 'มาสาย';

            tbody.innerHTML += `
                <tr class="hover:bg-slate-50/50 transition align-top">
                    <td class="py-3 px-4">
                        <div class="font-semibold text-slate-800">${staffName}</div>
                        <div class="text-[11px] text-slate-400">${row.staff_id}</div>
                    </td>
                    <td class="py-3 px-4 text-slate-600">${checkInTime}</td>
                    <td class="py-3 px-4 text-slate-600">${checkOutTime}</td>
                    <td class="py-3 px-4"><span class="px-2.5 py-1 ${badgeClass} rounded-full text-xs font-medium">${statusText}</span></td>
                </tr>
            `;
        });
    } else {
        tbody.innerHTML = `<tr><td colspan="4" class="py-4 px-4 text-center text-slate-400">ยังไม่มีข้อมูลการมาปฏิบัติงานในระบบ</td></tr>`;
    }
}

function filterHrTable() {
    const input = document.getElementById('hr-search-input').value.toLowerCase();
    const rows = document.querySelectorAll('#hr-attendance-list tr');
    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(input) ? '' : 'none';
    });
}

// 3. บันทึกเวลาเข้างาน
async function recordCheckIn() {
    await startAttendanceScan('check_in');
}

async function recordCheckOut() {
    await startAttendanceScan('check_out');
}

async function startAttendanceScan(scanType) {
    const modal = document.getElementById('checkin-camera-modal');
    const locationStatus = document.getElementById('checkin-location-status');
    const errorBox = document.getElementById('checkin-camera-error');
    attendanceScanType = scanType;
    modal.classList.remove('hidden');
    errorBox.classList.add('hidden');
    locationStatus.textContent = 'กำลังตรวจสอบตำแหน่งโรงเรียน...';
    document.getElementById('checkin-modal-title').textContent =
        scanType === 'check_in' ? 'ยืนยันการลงเวลาเข้างาน' : 'ยืนยันการลงเวลาออกงาน';
    document.getElementById('checkin-confirm-button').textContent =
        scanType === 'check_in' ? 'ยืนยันและบันทึกเวลาเข้า' : 'ยืนยันและบันทึกเวลาออก';
    checkInLocationVerified = false;
    checkInCameraReady = false;
    document.getElementById('checkin-capture-button').classList.add('hidden');
    document.getElementById('checkin-photo-fallback').classList.add('hidden');
    document.getElementById('checkin-confirm-button').classList.add('hidden');

    // Request camera access while the click still has user activation; some browsers
    // reject getUserMedia if it is only called after awaiting GPS.
    const cameraPromise = startCheckInCamera();

    try {
        if (!SCHOOL_LOCATION) {
            checkInLocationVerified = true;
            locationStatus.textContent = 'ยังไม่ได้กำหนดพิกัดโรงเรียน — ปิดตรวจ GPS ชั่วคราว';
            await cameraPromise;
            if (checkInCameraReady) {
                document.getElementById('checkin-capture-button').classList.remove('hidden');
            } else {
                document.getElementById('checkin-photo-fallback').classList.remove('hidden');
            }
            return;
        }

        if (!navigator.geolocation) {
            stopCheckInCamera();
            showCheckInError('เบราว์เซอร์นี้ไม่รองรับการตรวจสอบตำแหน่ง');
            return;
        }

        const position = await getCurrentPosition();
        const distance = getDistanceInMeters(
            position.coords.latitude,
            position.coords.longitude,
            SCHOOL_LOCATION.latitude,
            SCHOOL_LOCATION.longitude
        );
        const accuracy = position.coords.accuracy;

        if (distance > SCHOOL_GEOFENCE_RADIUS_METERS) {
            locationStatus.textContent = `อยู่นอกเขตโรงเรียน (${Math.round(distance)} เมตรจากจุดที่กำหนด)`;
            showCheckInError('ต้องอยู่ภายในรัศมีโรงเรียนจึงจะลงเวลาได้');
            stopCheckInCamera();
            return;
        }

        if (accuracy > SCHOOL_GEOFENCE_RADIUS_METERS) {
            locationStatus.textContent = `ตำแหน่งคลาดเคลื่อนประมาณ ${Math.round(accuracy)} เมตร`;
            showCheckInError('ความแม่นยำ GPS ยังไม่เพียงพอ กรุณาเปิดตำแหน่งที่แม่นยำแล้วลองอีกครั้ง');
            stopCheckInCamera();
            return;
        }

        if (distance + accuracy > SCHOOL_GEOFENCE_RADIUS_METERS) {
            locationStatus.textContent = `อยู่ใกล้ขอบเขตโรงเรียน ห่างจุดศูนย์กลาง ${Math.round(distance)} เมตร (ความแม่นยำ ±${Math.round(accuracy)} เมตร)`;
            showCheckInError('GPS ยังยืนยันไม่ได้ว่าอยู่ภายในเขตโรงเรียน กรุณาขยับเข้าใกล้อาคารแล้วลองอีกครั้ง');
            stopCheckInCamera();
            return;
        }

        checkInLocationVerified = true;
        locationStatus.textContent = `อยู่ในเขตโรงเรียน ห่างจุดศูนย์กลาง ${Math.round(distance)} เมตร (ความแม่นยำ ±${Math.round(accuracy)} เมตร)`;
        await cameraPromise;
        if (checkInCameraReady) {
            document.getElementById('checkin-capture-button').classList.remove('hidden');
        } else {
            document.getElementById('checkin-photo-fallback').classList.remove('hidden');
        }
    } catch (error) {
        stopCheckInCamera();
        showCheckInError(error.message || 'ตรวจสอบตำแหน่งไม่สำเร็จ กรุณาอนุญาตการเข้าถึงตำแหน่งและลองอีกครั้ง');
    }
}

function getCurrentPosition() {
    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, error => {
            const messages = {
                1: 'ไม่ได้รับอนุญาตใช้ตำแหน่ง กรุณาอนุญาต Location ในการตั้งค่าเบราว์เซอร์',
                2: 'อุปกรณ์ระบุตำแหน่งไม่ได้ กรุณาเปิด GPS/Wi-Fi แล้วลองอีกครั้ง',
                3: 'ใช้เวลาตรวจตำแหน่งนานเกินไป กรุณาลองอีกครั้ง'
            };
            reject(new Error(messages[error.code] || 'ตรวจสอบตำแหน่งไม่สำเร็จ กรุณาลองอีกครั้ง'));
        }, {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
        });
    });
}

function getDistanceInMeters(latitude1, longitude1, latitude2, longitude2) {
    const toRadians = degrees => degrees * Math.PI / 180;
    const latitudeDifference = toRadians(latitude2 - latitude1);
    const longitudeDifference = toRadians(longitude2 - longitude1);
    const haversine = Math.sin(latitudeDifference / 2) ** 2
        + Math.cos(toRadians(latitude1))
        * Math.cos(toRadians(latitude2))
        * Math.sin(longitudeDifference / 2) ** 2;

    return 6371000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

async function startCheckInCamera() {
    const video = document.getElementById('checkin-camera-video');
    const placeholder = document.getElementById('checkin-camera-placeholder');

    if (!navigator.mediaDevices?.getUserMedia) {
        showCheckInError('เปิดกล้องในหน้านี้ไม่ได้ (อาจต้องใช้ HTTPS หรือเบราว์เซอร์ไม่รองรับ) ใช้ปุ่มถ่าย/เลือกรูปจากอุปกรณ์แทนได้');
        return;
    }

    try {
        checkInCameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user' },
            audio: false
        });
        video.srcObject = checkInCameraStream;
        await video.play();
        video.classList.remove('hidden');
        placeholder.classList.add('hidden');
        checkInCameraReady = true;
        if (checkInLocationVerified) {
            document.getElementById('checkin-capture-button').classList.remove('hidden');
        }
    } catch (error) {
        stopCheckInCamera();
        const messages = {
            NotAllowedError: 'เบราว์เซอร์หรือระบบปฏิบัติการไม่อนุญาตใช้กล้อง กรุณาเปิดสิทธิ์ Camera ในการตั้งค่าเว็บไซต์/อุปกรณ์',
            NotFoundError: 'ไม่พบกล้องในอุปกรณ์นี้',
            NotReadableError: 'กล้องกำลังถูกใช้งานโดยแอปอื่น กรุณาปิดแอปนั้นแล้วลองใหม่',
            OverconstrainedError: 'ไม่สามารถเปิดกล้องหน้าตามที่ร้องขอได้ กรุณาใช้ปุ่มถ่าย/เลือกรูปจากอุปกรณ์',
            SecurityError: 'เบราว์เซอร์บล็อกกล้อง กรุณาเปิดเว็บไซต์ผ่าน HTTPS แล้วลองใหม่'
        };
        showCheckInError(messages[error.name] || `เปิดกล้องไม่สำเร็จ (${error.name || 'ข้อผิดพลาดที่ไม่ทราบสาเหตุ'}) ใช้ปุ่มถ่าย/เลือกรูปจากอุปกรณ์แทนได้`);
    }
}

function captureCheckInPhoto() {
    const video = document.getElementById('checkin-camera-video');
    const canvas = document.getElementById('checkin-camera-canvas');
    const photo = document.getElementById('checkin-camera-photo');

    if (!video.videoWidth || !video.videoHeight) {
        showCheckInError('กล้องยังไม่พร้อม กรุณารอสักครู่แล้วลองถ่ายใหม่');
        return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) {
        showCheckInError('เตรียมภาพถ่ายไม่สำเร็จ กรุณาลองอีกครั้ง');
        return;
    }
    context.drawImage(video, 0, 0);
    photo.src = canvas.toDataURL('image/jpeg', 0.8);
    showCheckInPhoto();
}

function useCheckInPhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
        showCheckInError('กรุณาเลือกไฟล์รูปภาพ');
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = () => {
        document.getElementById('checkin-camera-photo').src = reader.result;
        showCheckInPhoto();
        event.target.value = '';
    };
    reader.onerror = () => showCheckInError('อ่านรูปภาพไม่สำเร็จ กรุณาลองเลือกใหม่');
    reader.readAsDataURL(file);
}

function showCheckInPhoto() {
    const photo = document.getElementById('checkin-camera-photo');
    photo.classList.remove('hidden');
    document.getElementById('checkin-camera-video').classList.add('hidden');
    stopCheckInCamera();
    document.getElementById('checkin-capture-button').classList.add('hidden');
    document.getElementById('checkin-photo-fallback').classList.add('hidden');
    document.getElementById('checkin-confirm-button').classList.remove('hidden');
    document.getElementById('checkin-location-status').textContent += ' · ถ่ายภาพแล้ว';
}

async function confirmCheckIn() {
    const now = new Date();
    let error;
    let status;
    let updatedRows;

    if (attendanceScanType === 'check_in') {
        const hours = now.getHours();
        const minutes = now.getMinutes();
        status = (hours > 8 || (hours === 8 && minutes > 0)) ? 'มาสาย' : 'มาตรงเวลา';
        ({ error } = await supabaseClient
            .from('attendance_logs')
            .insert([{ staff_id: currentUser.staff_id, check_in: now.toISOString(), status }]));
    } else {
        ({ data: updatedRows, error } = await supabaseClient
            .from('attendance_logs')
            .update({ check_out: now.toISOString() })
            .eq('staff_id', currentUser.staff_id)
            .is('check_out', null)
            .select('check_in'));
    }

    if (error) {
        showCheckInError('เกิดข้อผิดพลาดในการบันทึกเวลา กรุณาลองอีกครั้ง');
        return;
    }

    if (attendanceScanType === 'check_out' && !updatedRows?.length) {
        showCheckInError('ไม่พบรายการเข้างานที่ยังไม่ได้ลงเวลาออก');
        return;
    }

    closeCheckInModal();
    showNotification(attendanceScanType === 'check_in'
        ? `บันทึกเวลาเข้างานสำเร็จ (${status})`
        : 'บันทึกเวลาออกงานสำเร็จ');
    loadAttendanceHistory();
}

function showCheckInError(message) {
    const errorBox = document.getElementById('checkin-camera-error');
    errorBox.textContent = message;
    errorBox.classList.remove('hidden');
}

function stopCheckInCamera() {
    if (checkInCameraStream) {
        checkInCameraStream.getTracks().forEach(track => track.stop());
        checkInCameraStream = null;
    }
}

function closeCheckInModal() {
    stopCheckInCamera();
    checkInCameraReady = false;
    checkInLocationVerified = false;
    const video = document.getElementById('checkin-camera-video');
    const photo = document.getElementById('checkin-camera-photo');
    const canvas = document.getElementById('checkin-camera-canvas');
    video.srcObject = null;
    video.classList.add('hidden');
    photo.removeAttribute('src');
    photo.classList.add('hidden');
    canvas.width = 0;
    canvas.height = 0;
    document.getElementById('checkin-camera-placeholder').classList.remove('hidden');
    document.getElementById('checkin-capture-button').classList.add('hidden');
    document.getElementById('checkin-photo-fallback').classList.add('hidden');
    document.getElementById('checkin-confirm-button').classList.add('hidden');
    document.getElementById('checkin-camera-error').classList.add('hidden');
    document.getElementById('checkin-photo-input').value = '';
    document.getElementById('checkin-camera-modal').classList.add('hidden');
}

async function loadAttendanceHistory() {
    if (!currentUser || currentUser.role === 'executive') return;

    const { data, error } = await supabaseClient
        .from('attendance_logs')
        .select('*')
        .eq('staff_id', currentUser.staff_id)
        .order('check_in', { ascending: false });

    const tbody = document.getElementById('attendance-history');
    tbody.innerHTML = '';

    let onTimeCount = 0;
    let lateCount = 0;

    if (data && data.length > 0) {
        data.forEach(row => {
            if(row.status === 'มาตรงเวลา') onTimeCount++;
            else lateCount++;

            const checkInDate = row.check_in ? new Date(row.check_in).toLocaleDateString('th-TH', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            }) : '-';
            const checkInTime = row.check_in ? new Date(row.check_in).toLocaleTimeString('th-TH') : '-';
            const checkOutTime = row.check_out ? new Date(row.check_out).toLocaleTimeString('th-TH') : '-';
            const badgeClass = row.status === 'มาตรงเวลา' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700';

            tbody.innerHTML += `
                <tr class="hover:bg-slate-50/50 transition">
                    <td class="py-4 px-4 text-slate-600">${checkInDate}</td>
                    <td class="py-4 px-4 text-slate-600">${checkInTime}</td>
                    <td class="py-4 px-4 text-slate-600">${checkOutTime}</td>
                    <td class="py-4 px-4"><span class="px-2.5 py-1 ${badgeClass} rounded-full text-xs font-medium">${row.status}</span></td>
                </tr>
            `;
        });
    } else {
        tbody.innerHTML = `<tr><td colspan="4" class="py-4 px-4 text-center text-slate-400">ยังไม่มีประวัติการปฏิบัติงาน</td></tr>`;
    }

    document.getElementById('stat-ontime').innerHTML = `${onTimeCount} <span class="text-sm font-normal text-emerald-600">ครั้ง</span>`;
    document.getElementById('stat-late').innerHTML = `${lateCount} <span class="text-sm font-normal text-amber-600">ครั้ง</span>`;
}

function formatLeaveTimeRange(startTime, endTime) {
    if (!startTime || !endTime) return '';
    return `${startTime} - ${endTime} น.`;
}

function validateLeaveTimeRange(startTime, endTime) {
    if (!startTime || !endTime) {
        return { valid: false, message: 'กรุณาเลือกเวลาออกและเวลากลับให้ครบถ้วน' };
    }

    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    if (endMinutes <= startMinutes) {
        return { valid: false, message: 'เวลากลับต้องมากกว่าเวลาออก' };
    }

    if ((endMinutes - startMinutes) > 180) {
        return { valid: false, message: 'ระยะเวลาออกนอกสถานศึกษาห้ามเกิน 3 ชั่วโมง' };
    }

    return { valid: true, message: '' };
}

// 4. ส่งคำขอออกนอกสถานศึกษา
async function submitLeave(event) {
    event.preventDefault();
    const reason = document.getElementById('leave-reason').value;
    const leaveDate = document.getElementById('leave-date').value;
    const startTime = document.getElementById('leave-time-out').value;
    const endTime = document.getElementById('leave-time-return').value;
    const timeRange = formatLeaveTimeRange(startTime, endTime);
    const subject = document.getElementById('leave-subject').value;
    const period = document.getElementById('leave-period').value;
    const substitute = document.getElementById('leave-substitute').value;

    const validation = validateLeaveTimeRange(startTime, endTime);
    if (!validation.valid) {
        showNotification(validation.message, 'error');
        return;
    }

    document.getElementById('leave-timerange').value = timeRange;

    const { error } = await supabaseClient
        .from('leave_requests')
        .insert([{
            staff_id: currentUser.staff_id,
            reason: reason,
            leave_date: leaveDate,
            time_range: timeRange,
            subject: subject,
            period: period,
            substitute_teacher: substitute,
            status: 'รออนุมัติ'
        }]);

    if (error) {
        showNotification('เกิดข้อผิดพลาดในการส่งคำขอ', 'error');
    } else {
        showNotification('ยื่นคำขออนุมัติเรียบร้อยแล้ว');
        document.getElementById('leave-reason').value = '';
        document.getElementById('leave-date').value = '';
        resetLeaveTimePickers();
        document.getElementById('leave-timerange').value = '';
        document.getElementById('leave-subject').value = '';
        document.getElementById('leave-period').value = '';
        document.getElementById('leave-substitute').value = '';
        
        loadStaffLeaveHistory(); // โหลดตารางประวัติคำขอของตนเองซ้ำให้อัปเดตทันที
    }
}

// 5. โหลดประวัติและสถานะการอนุมัติของ Staff แต่ละท่าน
async function loadStaffLeaveHistory() {
    if (!currentUser || !['staff', 'hr'].includes(currentUser.role)) return;
    const staffId = currentUser.staff_id;
    const tbody = document.getElementById('staff-leave-history');
    if (!tbody) return;
    tbody.innerHTML = '';

    const { data, error } = await supabaseClient
        .from('leave_requests')
        .select('*')
        .eq('staff_id', staffId)
        .order('leave_date', { ascending: false });

    if (currentUser?.staff_id !== staffId) return;
    if (error) {
        console.error('Error loading personal leave requests:', error);
        tbody.innerHTML = '<tr><td colspan="4" class="py-4 px-4 text-center text-rose-600">โหลดประวัติคำขอไม่สำเร็จ กรุณาลองใหม่</td></tr>';
        return;
    }

    if (data && data.length > 0) {
        data.forEach(row => {
            let statusBadge = 'bg-amber-50 text-amber-700 border border-amber-200';
            let statusText = '🟡 รอผู้บริหารพิจารณา';

            if (row.status === 'อนุมัติ') {
                statusBadge = 'bg-emerald-50 text-emerald-700 border border-emerald-200';
                statusText = '🟢 อนุมัติแล้ว';
            } else if (row.status === 'ไม่อนุมัติ') {
                statusBadge = 'bg-rose-50 text-rose-700 border border-rose-200';
                statusText = '🔴 ไม่อนุมัติ';
            }

            const subText = row.substitute_teacher ? `${row.substitute_teacher} (${row.subject || '-'})` : '-';

            tbody.innerHTML += `
                <tr class="hover:bg-slate-50/50 transition">
                    <td class="py-4 px-4 font-medium text-slate-700">${row.leave_date}<br><span class="text-xs text-slate-400">${row.time_range}</span></td>
                    <td class="py-4 px-4 text-slate-600">${row.reason}</td>
                    <td class="py-4 px-4 text-slate-600">${subText}</td>
                    <td class="py-4 px-4"><span class="px-3 py-1 ${statusBadge} rounded-full text-xs font-semibold">${statusText}</span></td>
                </tr>
            `;
        });
    } else {
        tbody.innerHTML = `<tr><td colspan="4" class="py-4 px-4 text-center text-slate-400">ยังไม่มีประวัติการยื่นคำขอ</td></tr>`;
    }
}

// โหลดข้อมูลสถิติรายบุคคลสำหรับหน้าสรุปผลประเมิน 6 เดือน
async function loadExecutiveReport() {
    try {
        // 1. ดึงข้อมูลบุคลากรทั้งหมด
        const { data: staffList, error: staffError } = await supabaseClient
            .from('staff')
            .select('staff_id, name, department, role');

        // 2. ดึงข้อมูลประวัติการสแกนเวลาทั้งหมด
        const { data: logsList, error: logsError } = await supabaseClient
            .from('attendance_logs')
            .select('*');

        // 3. ดึงข้อมูลคำขอลาทั้งหมด
        const { data: leaveList, error: leaveError } = await supabaseClient
            .from('leave_requests')
            .select('*');

        const tbody = document.getElementById('individual-report-list');
        if (!tbody) return;
        tbody.innerHTML = '';

        let totalOnTime = 0;
        let totalLate = 0;
        let totalLeave = leaveList ? leaveList.length : 0;
        let reportStaffCount = 0;

        if (staffList && staffList.length > 0) {
            staffList.forEach(person => {
                // กรองสถิติของแต่ละคน
                const personLogs = logsList ? logsList.filter(l => l.staff_id === person.staff_id) : [];
                const personLeaves = leaveList ? leaveList.filter(lv => lv.staff_id === person.staff_id) : [];

                let onTimeCount = personLogs.filter(l => l.status === 'มาตรงเวลา').length;
                let lateCount = personLogs.filter(l => l.status === 'มาสาย').length;

                totalOnTime += onTimeCount;
                totalLate += lateCount;

                if (person.role === 'executive') return;
                reportStaffCount++;

                tbody.innerHTML += `
                    <tr class="hover:bg-slate-50/50 transition">
                        <td class="py-4 px-4">
                            <span class="font-bold text-slate-800">${person.name}</span><br>
                            <span class="text-xs text-slate-400">ID: ${person.staff_id}</span>
                        </td>
                        <td class="py-4 px-4 text-slate-600">${person.department || '-'}</td>
                        <td class="py-4 px-4 text-center font-semibold text-emerald-700">${onTimeCount}</td>
                        <td class="py-4 px-4 text-center font-semibold text-amber-600">${lateCount}</td>
                        <td class="py-4 px-4 text-center font-semibold text-rose-700">${personLeaves.length}</td>
                    </tr>
                `;
            });
        } else {
            tbody.innerHTML = `<tr><td colspan="5" class="py-4 px-4 text-center text-slate-400">ไม่พบข้อมูลบุคลากรในระบบ</td></tr>`;
        }

        if (reportStaffCount === 0 && staffList?.length) {
            tbody.innerHTML = `<tr><td colspan="5" class="py-4 px-4 text-center text-slate-400">ไม่มีข้อมูลบุคลากรที่ไม่ใช่ผู้บริหาร</td></tr>`;
        }

        // อัปเดตตัวเลขรวมการ์ดด้านบน
        document.getElementById('stat-ontime').innerHTML = `${totalOnTime} <span class="text-sm font-normal text-emerald-600">ครั้ง</span>`;
        document.getElementById('stat-late').innerHTML = `${totalLate} <span class="text-sm font-normal text-amber-600">ครั้ง</span>`;
        document.getElementById('stat-leave').innerHTML = `${totalLeave} <span class="text-sm font-normal text-rose-600">รายการ</span>`;

    } catch (err) {
        console.error('Error loading executive report:', err);
    }
}

// ฟังก์ชันกรองตารางรายงาน
function filterReportTable() {
    const input = document.getElementById('report-search-input').value.toLowerCase();
    const rows = document.querySelectorAll('#individual-report-list tr');
    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(input) ? '' : 'none';
    });
}
