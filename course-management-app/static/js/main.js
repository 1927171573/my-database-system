// static/js/main.js

// 假设 fetchApi 函数定义在 api.js 或此文件上方
async function fetchApi(endpoint, method = 'GET', body = null) {
    const API_BASE_URL = ''; // 通常为空字符串
    const url = `${API_BASE_URL}${endpoint}`;
    const token = localStorage.getItem('authToken');
    const headers = {
        'Content-Type': 'application/json',
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
        method: method.toUpperCase(),
        headers: headers,
    };

    if (body && (config.method === 'POST' || config.method === 'PUT')) {
        config.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(url, config);
        let data;
        try {
            const text = await response.text();
            data = text ? JSON.parse(text) : {};
        } catch (e) {
             data = { message: `无法解析服务器响应 (状态码: ${response.status})` };
        }

        if (!response.ok) {
            const errorMessage = data?.message || `请求失败，状态码: ${response.status}`;
            console.error(`API Error (${method} ${endpoint}):`, errorMessage, data);
            throw new Error(errorMessage); // 抛出包含后端消息的错误
        }
        return data;
    } catch (error) {
        console.error(`Fetch API Error (${method} ${endpoint}):`, error);
        throw error; // 继续向上抛出
    }
}


document.addEventListener('DOMContentLoaded', () => {
    const userInfoDiv = document.getElementById('user-info');
    const mainNav = document.getElementById('main-nav')?.querySelector('ul');
    const mainContent = document.getElementById('main-content');

    const token = localStorage.getItem('authToken');
    const userInfo = JSON.parse(localStorage.getItem('userInfo'));

    if (!token || !userInfo) {
        if (!window.location.pathname.includes('/login.html') && !window.location.pathname.includes('/register.html')) {
             window.location.href = '/login.html';
        }
        return;
    }

    if (userInfoDiv && userInfo) {
        userInfoDiv.innerHTML = `
            <span>欢迎您, ${escapeHtml(userInfo.name) || userInfo.id} (角色: ${userInfo.role})!</span>
            <button id="logout-button">登出</button>
        `;
        const logoutButton = document.getElementById('logout-button');
        if (logoutButton) {
            logoutButton.addEventListener('click', logout);
            logoutButton.style.display = 'inline-block';
        }
    } else if (userInfoDiv) {
         userInfoDiv.innerHTML = `<span>请先 <a href="/login.html">登录</a></span>`;
    }

    if (mainNav) {
        buildNavigation(userInfo.role, mainNav);
    }

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();
});

function buildNavigation(role, navElement) {
    if (!navElement) return;
    navElement.innerHTML = '<li><a href="#home">首页</a></li>';

    if (role === 'student') {
        navElement.innerHTML += '<li><a href="#view-courses">查看可选课程</a></li>';
        navElement.innerHTML += '<li><a href="#my-selections">我的选课</a></li>';
        navElement.innerHTML += '<li><a href="#messages">留言板</a></li>'; // 修改/添加
    } else if (role === 'teacher') {
        navElement.innerHTML += '<li><a href="#my-courses">我的课程</a></li>';
        navElement.innerHTML += '<li><a href="#upload-course">上传课程</a></li>';
        navElement.innerHTML += '<li><a href="#view-courses">查看已批准课程</a></li>';
    } else if (role === 'admin') {
        navElement.innerHTML += '<li><a href="#approve-courses">审批课程</a></li>';
        navElement.innerHTML += '<li><a href="#approve-messages">审批留言</a></li>'; // 新增
        navElement.innerHTML += '<li><a href="#manage-users">用户管理</a></li>';
        navElement.innerHTML += '<li><a href="#announcements">发布公告</a></li>';
        navElement.innerHTML += '<li><a href="#view-courses">查看已批准课程</a></li>';
    }
    navElement.innerHTML += '<li><a href="#profile">个人信息</a></li>';
}

function handleHashChange() {
    const mainContent = document.getElementById('main-content');
    const userInfo = JSON.parse(localStorage.getItem('userInfo'));
    if (!mainContent || !userInfo) { return; }

    const hash = window.location.hash || '#home';
    mainContent.innerHTML = `<h2>正在加载 ${hash.substring(1)} ...</h2>`;

    switch (hash) {
        case '#home':
            mainContent.innerHTML = '<h2>欢迎</h2><p>请通过上方导航访问系统功能。</p>';
            break;
        case '#upload-course':
            if (userInfo.role === 'teacher') renderUploadCourseForm(mainContent);
            else renderPermissionDenied(mainContent);
            break;
        case '#my-courses':
            if (userInfo.role === 'teacher') loadMyCourses(mainContent);
            else renderPermissionDenied(mainContent);
            break;
         case '#view-courses':
             if (['student', 'teacher', 'admin'].includes(userInfo.role)) loadAllApprovedCourses(mainContent);
             else renderPermissionDenied(mainContent);
             break;
         case '#approve-courses':
             if (userInfo.role === 'admin') loadPendingCourses(mainContent);
             else renderPermissionDenied(mainContent);
             break;
        case '#my-selections':
            if (userInfo.role === 'student') loadMySelections(mainContent);
            else renderPermissionDenied(mainContent);
            break;
        case '#messages': // 学生留言板
            if (userInfo.role === 'student') loadStudentMessagesView(mainContent);
            else renderPermissionDenied(mainContent);
            break;
        case '#approve-messages': // 管理员审批留言
            if (userInfo.role === 'admin') loadPendingMessages(mainContent);
            else renderPermissionDenied(mainContent);
            break;
        case '#profile':
             mainContent.innerHTML = `<h2>功能开发中: 个人信息</h2>`;
             break;
        case '#manage-users':
             mainContent.innerHTML = `<h2>功能开发中: 用户管理</h2>`;
             break;
        case '#announcements':
             mainContent.innerHTML = `<h2>功能开发中: 发布公告</h2>`;
             break;
        default:
            mainContent.innerHTML = '<h2>页面未找到</h2><p>您请求的页面不存在。</p>';
    }
}

function renderPermissionDenied(parentElement) {
     parentElement.innerHTML = '<h2 style="color:red;">访问受限</h2><p>您没有访问此功能的权限。</p>';
}

// --- 上传课程表单渲染 ---
function renderUploadCourseForm(parentElement) {
     parentElement.innerHTML = `
        <h2>上传新课程</h2><form id="upload-course-form">
            <div><label for="course-id">课程号:</label><input type="text" id="course-id" name="course_id" required pattern="[a-zA-Z0-9]+" title="只能包含字母和数字"></div>
            <div><label for="course-name">课程名:</label><input type="text" id="course-name" name="course_name" required maxlength="255"></div>
            <div><label for="course-hours">学时:</label><input type="number" id="course-hours" name="hours" min="0" placeholder="可选"></div>
            <div><label for="course-credits">学分:</label><input type="number" step="0.1" id="course-credits" name="credits" min="0" placeholder="可选"></div>
            <button type="submit">提交审批</button>
            <p id="upload-message" class="message" style="min-height: 1.2em; margin-top: 10px; text-align: center;"></p>
        </form>`;
    const form = document.getElementById('upload-course-form');
    if (form) form.addEventListener('submit', handleUploadCourseSubmit);
}

// --- 处理上传课程表单提交 ---
async function handleUploadCourseSubmit(event) {
    event.preventDefault();
    const messageElement = document.getElementById('upload-message'); if (!messageElement) return; messageElement.textContent = '正在提交...'; messageElement.className = 'message';
    const formData = new FormData(event.target); const courseData = {};
    for (const [key, value] of formData.entries()) {
         if (key === 'hours' || key === 'credits') {
             const num = value.trim() === '' ? null : Number(value);
             courseData[key] = (num !== null && !isNaN(num)) ? num : null;
         } else { courseData[key] = value.trim(); }
     }
    if (!courseData.course_id || !courseData.course_name) { messageElement.textContent = '课程号和课程名不能为空'; messageElement.className = 'message error-message'; return; }
    if ((courseData.hours !== null && courseData.hours < 0) || (courseData.credits !== null && courseData.credits < 0)) { messageElement.textContent = '学时和学分不能为负数'; messageElement.className = 'message error-message'; return; }
    try {
        const result = await fetchApi('/api/courses', 'POST', courseData);
        messageElement.textContent = result.message || '上传成功，等待审批！'; messageElement.className = 'message success-message'; event.target.reset();
     } catch (error) {
        console.error("上传课程失败:", error); messageElement.textContent = `上传失败: ${error.message}`; messageElement.className = 'message error-message';
     }
}

// --- 加载教师课程列表 ---
async function loadMyCourses(parentElement) {
    parentElement.innerHTML = '<h2>我的课程</h2><div id="my-course-list-container">正在加载...</div>';
    const courseListContainer = document.getElementById('my-course-list-container'); if (!courseListContainer) return;
    try {
        const myCourses = await fetchApi('/api/courses/my');
        if (myCourses && myCourses.length > 0) {
             let tableHtml = `<table><thead><tr><th>课程号</th><th>课程名</th><th>学时</th><th>学分</th><th>状态</th><th>上传时间</th><th>审批时间</th></tr></thead><tbody>`;
             myCourses.forEach(course => {
                 let statusText = ''; let statusClass = '';
                 switch (course.approval_status) {
                     case 'pending': statusText = '待审批'; statusClass = 'status-pending'; break;
                     case 'approved': statusText = '已批准'; statusClass = 'status-approved'; break;
                     case 'rejected': statusText = '已拒绝'; statusClass = 'status-rejected'; break;
                     default: statusText = course.approval_status || '未知'; statusClass = '';
                 }
                 const hours = course.hours ?? 'N/A'; const credits = course.credits ?? 'N/A'; const createdAt = course.created_at ?? 'N/A'; const approvalTime = course.approval_timestamp ?? 'N/A';
                 tableHtml += `<tr><td>${escapeHtml(course.course_id)}</td><td>${escapeHtml(course.course_name)}</td><td>${hours}</td><td>${credits}</td><td class="${statusClass}">${statusText}</td><td>${createdAt}</td><td>${approvalTime}</td></tr>`;
             });
             tableHtml += '</tbody></table>'; courseListContainer.innerHTML = tableHtml;
             attachTableStyles(courseListContainer); // 统一调用样式函数
         } else { courseListContainer.innerHTML = '<p>您还没有上传任何课程。</p>'; }
    } catch (error) {
        console.error("加载我的课程失败:", error); courseListContainer.innerHTML = `<p style="color:red;">加载我的课程列表失败: ${error.message}</p>`;
    }
}

// --- 加载所有已批准课程 (含选课按钮) ---
async function loadAllApprovedCourses(parentElement) {
    parentElement.innerHTML = '<h2>课程列表 (已批准)</h2><div id="all-course-list-container">正在加载...</div>';
    const courseListContainer = document.getElementById('all-course-list-container'); if (!courseListContainer) return;
    const userInfo = JSON.parse(localStorage.getItem('userInfo'));
    let selectedCourseIds = new Set();
    try {
        if (userInfo && userInfo.role === 'student') {
            const mySelections = await fetchApi('/api/selections/my');
            mySelections.forEach(sel => selectedCourseIds.add(sel.course_id));
        }
        const courses = await fetchApi('/api/courses');
        if (courses && courses.length > 0) {
            let tableHtml = `<table><thead><tr><th>课程号</th><th>课程名</th><th>教师</th><th>学时</th><th>学分</th>${userInfo && userInfo.role === 'student' ? '<th>操作</th>' : ''}</tr></thead><tbody>`;
            courses.forEach(course => {
                const hours = course.hours ?? 'N/A'; const credits = course.credits ?? 'N/A'; let actionButtonHtml = '';
                if (userInfo && userInfo.role === 'student') {
                    if (selectedCourseIds.has(course.course_id)) { actionButtonHtml = '<td><button disabled>已选</button></td>'; }
                    else { actionButtonHtml = `<td><button class="select-course-button" data-course-id="${course.course_id}">选课</button></td>`; }
                } else { actionButtonHtml = ''; }
                tableHtml += `<tr><td>${escapeHtml(course.course_id)}</td><td>${escapeHtml(course.course_name)}</td><td>${escapeHtml(course.teacher_name) ?? 'N/A'}</td><td>${hours}</td><td>${credits}</td>${actionButtonHtml}</tr>`;
            });
            tableHtml += '</tbody></table>'; courseListContainer.innerHTML = tableHtml;
            if (userInfo && userInfo.role === 'student') {
                courseListContainer.querySelectorAll('.select-course-button').forEach(button => button.addEventListener('click', handleSelectCourse));
            }
            attachTableStyles(courseListContainer); // 统一调用样式函数
        } else { courseListContainer.innerHTML = '<p>当前没有已批准的课程。</p>'; }
    } catch (error) {
        console.error("加载课程列表失败:", error); courseListContainer.innerHTML = `<p style="color:red;">加载课程列表失败: ${error.message}</p>`;
    }
}

// --- 处理选课按钮点击 ---
async function handleSelectCourse(event) {
    const button = event.target; const courseId = button.dataset.courseId; if (!courseId) return;
    button.disabled = true; button.textContent = '处理中...';
    try {
        const result = await fetchApi(`/api/courses/${courseId}/select`, 'POST');
        alert(result.message || '选课成功！'); button.textContent = '已选';
    } catch (error) {
        console.error("选课失败:", error); alert(`选课失败: ${error.message}`); button.disabled = false; button.textContent = '选课';
    }
}

// --- 加载待审批课程 (管理员) ---
async function loadPendingCourses(parentElement) {
    parentElement.innerHTML = '<h2>待审批课程</h2><div id="pending-course-list-container">正在加载...</div>';
    const container = document.getElementById('pending-course-list-container'); if (!container) return;
    try {
        const pendingCourses = await fetchApi('/api/courses/pending');
        if (pendingCourses && pendingCourses.length > 0) {
            let tableHtml = `<p>共 ${pendingCourses.length} 门课程待审批。</p><table><thead><tr><th>课程号</th><th>课程名</th><th>教师</th><th>学时</th><th>学分</th><th>上传时间</th><th>操作</th></tr></thead><tbody>`;
            pendingCourses.forEach(course => {
                const hours = course.hours ?? 'N/A'; const credits = course.credits ?? 'N/A'; const createdAt = course.created_at ?? 'N/A'; const teacherName = course.teacher_name ?? 'N/A';
                tableHtml += `<tr id="pending-course-${course.course_id}"><td>${escapeHtml(course.course_id)}</td><td>${escapeHtml(course.course_name)}</td><td>${escapeHtml(teacherName)} (${escapeHtml(course.teacher_id)})</td><td>${hours}</td><td>${credits}</td><td>${createdAt}</td><td><button class="approve-button" data-course-id="${course.course_id}">批准</button><button class="reject-button" data-course-id="${course.course_id}">拒绝</button></td></tr>`;
            });
            tableHtml += '</tbody></table>'; container.innerHTML = tableHtml;
            container.querySelectorAll('.approve-button').forEach(button => button.addEventListener('click', handleApproveCourse));
            container.querySelectorAll('.reject-button').forEach(button => button.addEventListener('click', handleRejectCourse));
            attachTableStyles(container); // 统一调用样式函数
        } else { container.innerHTML = '<p>当前没有待审批的课程。</p>'; }
    } catch (error) {
        console.error("加载待审批课程失败:", error); container.innerHTML = `<p style="color:red;">加载待审批课程列表失败: ${error.message}</p>`;
    }
}

// --- 处理批准课程 (管理员) ---
async function handleApproveCourse(event) {
    const button = event.target; const courseId = button.dataset.courseId; if (!courseId || !confirm(`确定要批准课程 ${courseId} 吗？`)) return;
    button.disabled = true; const rejectButton = button.nextElementSibling; if (rejectButton) rejectButton.disabled = true; button.textContent = '处理中...';
    try {
        const result = await fetchApi(`/api/courses/${courseId}/approve`, 'PUT'); alert(result.message || '课程已批准！');
        const rowToRemove = document.getElementById(`pending-course-${courseId}`); if (rowToRemove) rowToRemove.remove();
        updatePendingCount('pending-course-list-container', '门课程待审批'); // 更新统计
    } catch (error) {
        console.error("批准课程失败:", error); alert(`批准课程失败: ${error.message}`); button.disabled = false; if (rejectButton) rejectButton.disabled = false; button.textContent = '批准';
    }
}

// --- 处理拒绝课程 (管理员) ---
async function handleRejectCourse(event) {
    const button = event.target; const courseId = button.dataset.courseId; if (!courseId || !confirm(`确定要拒绝课程 ${courseId} 吗？`)) return;
    button.disabled = true; const approveButton = button.previousElementSibling; if (approveButton) approveButton.disabled = true; button.textContent = '处理中...';
    try {
        const result = await fetchApi(`/api/courses/${courseId}/reject`, 'PUT'); alert(result.message || '课程已拒绝！');
        const rowToRemove = document.getElementById(`pending-course-${courseId}`); if (rowToRemove) rowToRemove.remove();
        updatePendingCount('pending-course-list-container', '门课程待审批'); // 更新统计
    } catch (error) {
        console.error("拒绝课程失败:", error); alert(`拒绝课程失败: ${error.message}`); button.disabled = false; if (approveButton) approveButton.disabled = false; button.textContent = '拒绝';
    }
}

// --- 加载学生选课列表 ---
async function loadMySelections(parentElement) {
    parentElement.innerHTML = '<h2>我的选课</h2><div id="my-selections-container">正在加载...</div>';
    const container = document.getElementById('my-selections-container'); if (!container) return;
    try {
        const selections = await fetchApi('/api/selections/my');
        if (selections && selections.length > 0) {
            let tableHtml = `<p>您已选择 ${selections.length} 门课程。</p><table><thead><tr><th>课程号</th><th>课程名</th><th>教师</th><th>学时</th><th>学分</th><th>选课时间</th><th>成绩</th><th>操作</th></tr></thead><tbody>`;
            selections.forEach(sel => {
                const hours = sel.hours ?? 'N/A'; const credits = sel.credits ?? 'N/A'; const grade = sel.grade ?? 'N/A'; const teacherName = sel.teacher_name ?? 'N/A'; const selectionTime = sel.selection_time ?? 'N/A';
                tableHtml += `<tr id="selection-row-${sel.course_id}"><td>${escapeHtml(sel.course_id)}</td><td>${escapeHtml(sel.course_name)}</td><td>${escapeHtml(teacherName)}</td><td>${hours}</td><td>${credits}</td><td>${selectionTime}</td><td>${grade}</td><td><button class="deselect-course-button" data-course-id="${sel.course_id}">退选</button></td></tr>`;
            });
            tableHtml += '</tbody></table>'; container.innerHTML = tableHtml;
            container.querySelectorAll('.deselect-course-button').forEach(button => button.addEventListener('click', handleDeselectCourse));
            attachTableStyles(container); // 统一调用样式函数
        } else { container.innerHTML = '<p>您还没有选择任何课程。</p>'; }
    } catch (error) {
        console.error("加载我的选课列表失败:", error); container.innerHTML = `<p style="color:red;">加载我的选课列表失败: ${error.message}</p>`;
    }
}

// --- 处理退选按钮点击 ---
async function handleDeselectCourse(event) {
    const button = event.target; const courseId = button.dataset.courseId; if (!courseId || !confirm(`确定要退选课程 ${courseId} 吗？`)) return;
    button.disabled = true; button.textContent = '处理中...';
    try {
        const result = await fetchApi(`/api/selections/${courseId}`, 'DELETE'); alert(result.message || '退选成功！');
        const rowToRemove = document.getElementById(`selection-row-${courseId}`); if (rowToRemove) rowToRemove.remove();
        updatePendingCount('my-selections-container', '门课程'); // 更新统计
    } catch (error) {
        console.error("退选失败:", error); alert(`退选失败: ${error.message}`); button.disabled = false; button.textContent = '退选';
    }
}

// === 留言功能相关函数 ===

// --- 加载学生留言界面 (提交表单 + 历史记录) ---
async function loadStudentMessagesView(parentElement) {
    parentElement.innerHTML = `<h2>留言板</h2><div id="submit-message-section"><h3>发表新留言</h3><form id="submit-message-form"><div><label for="message-content">留言内容:</label><textarea id="message-content" name="content" rows="4" required style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;"></textarea></div><button type="submit" style="margin-top: 10px;">提交留言</button><p id="submit-message-feedback" class="message" style="min-height: 1.2em; margin-top: 10px; text-align: center;"></p></form></div><hr style="margin: 20px 0;"><div id="my-messages-section"><h3>我的留言记录</h3><div id="my-messages-list">正在加载...</div></div>`;
    const form = document.getElementById('submit-message-form'); if (form) form.addEventListener('submit', handleSubmitMessage);
    const messageListContainer = document.getElementById('my-messages-list'); if (!messageListContainer) return;
    try {
        const myMessages = await fetchApi('/api/messages/my');
        if (myMessages && myMessages.length > 0) {
            let listHtml = '<ul>';
            myMessages.forEach(msg => {
                let statusText = ''; let statusClass = '';
                switch (msg.approval_status) {
                    case 'pending': statusText = '待审批'; statusClass = 'status-pending'; break;
                    case 'approved': statusText = '已批准'; statusClass = 'status-approved'; break;
                    case 'rejected': statusText = '已拒绝'; statusClass = 'status-rejected'; break;
                    default: statusText = msg.approval_status;
                }
                listHtml += `<li style="border-bottom: 1px solid #eee; padding: 10px 0;"><p><strong>内容:</strong> ${escapeHtml(msg.content)}</p><p style="font-size: 0.9em; color: #555;">提交时间: ${msg.post_date} | 状态: <span class="${statusClass}">${statusText}</span> ${msg.approval_status !== 'pending' ? `| 处理时间: ${msg.approval_timestamp}` : ''}</p></li>`;
            });
            listHtml += '</ul>'; messageListContainer.innerHTML = listHtml;
             const style = document.createElement('style'); style.textContent = `.status-pending { color: orange; font-weight: bold; } .status-approved { color: green; font-weight: bold; } .status-rejected { color: red; font-weight: bold; } ul { list-style: none; padding: 0; } li p { margin: 5px 0; }`; parentElement.appendChild(style);
        } else { messageListContainer.innerHTML = '<p>您还没有提交过任何留言。</p>'; }
    } catch (error) {
        console.error("加载我的留言失败:", error); messageListContainer.innerHTML = `<p style="color:red;">加载我的留言记录失败: ${error.message}</p>`;
    }
}

// --- 处理学生提交留言表单 ---
async function handleSubmitMessage(event) {
    event.preventDefault();
    const feedbackElement = document.getElementById('submit-message-feedback'); const contentTextArea = document.getElementById('message-content'); if (!feedbackElement || !contentTextArea) return;
    const content = contentTextArea.value.trim(); if (!content) { feedbackElement.textContent = '留言内容不能为空'; feedbackElement.className = 'message error-message'; return; }
    feedbackElement.textContent = '正在提交...'; feedbackElement.className = 'message'; const submitButton = event.target.querySelector('button[type="submit"]'); if(submitButton) submitButton.disabled = true;
    try {
        const result = await fetchApi('/api/messages', 'POST', { content: content });
        feedbackElement.textContent = result.message || '提交成功！'; feedbackElement.className = 'message success-message'; contentTextArea.value = '';
        // 延迟一小段时间再重新加载，确保后端处理完毕
        setTimeout(() => loadStudentMessagesView(document.getElementById('main-content')), 500);
    } catch (error) {
        console.error("提交留言失败:", error); feedbackElement.textContent = `提交失败: ${error.message}`; feedbackElement.className = 'message error-message';
    } finally { if(submitButton) submitButton.disabled = false; }
}

// --- 加载待审批留言列表 (管理员) ---
async function loadPendingMessages(parentElement) {
    parentElement.innerHTML = '<h2>待审批留言</h2><div id="pending-messages-container">正在加载...</div>';
    const container = document.getElementById('pending-messages-container'); if (!container) return;
    try {
        const messages = await fetchApi('/api/messages/pending');
        if (messages && messages.length > 0) {
            let tableHtml = `<p>共 ${messages.length} 条留言待审批。</p><table><thead><tr><th>留言内容</th><th>学生</th><th>提交时间</th><th>操作</th></tr></thead><tbody>`;
            messages.forEach(msg => {
                tableHtml += `<tr id="message-row-${msg.message_id}"><td style="white-space: pre-wrap; word-wrap: break-word;">${escapeHtml(msg.content)}</td><td>${escapeHtml(msg.student_name || '未知姓名')} (${escapeHtml(msg.student_id)})</td><td>${msg.post_date}</td><td><button class="approve-message-button" data-message-id="${msg.message_id}">批准</button><button class="reject-message-button" data-message-id="${msg.message_id}">拒绝</button></td></tr>`;
            });
            tableHtml += '</tbody></table>'; container.innerHTML = tableHtml;
            container.querySelectorAll('.approve-message-button').forEach(button => button.addEventListener('click', handleApproveMessage));
            container.querySelectorAll('.reject-message-button').forEach(button => button.addEventListener('click', handleRejectMessage));
            attachTableStyles(container); // 统一调用样式函数
        } else { container.innerHTML = '<p>当前没有待审批的留言。</p>'; }
    } catch (error) {
        console.error("加载待审批留言失败:", error); container.innerHTML = `<p style="color:red;">加载待审批留言列表失败: ${error.message}</p>`;
    }
}

// --- 处理批准留言按钮点击 ---
async function handleApproveMessage(event) {
    const button = event.target; const messageId = button.dataset.messageId; if (!messageId || !confirm(`确定要批准这条留言吗？`)) return;
    button.disabled = true; const rejectButton = button.nextElementSibling; if(rejectButton) rejectButton.disabled = true; button.textContent = '处理中...';
    try {
        const result = await fetchApi(`/api/messages/${messageId}/approve`, 'PUT'); alert(result.message || '留言已批准！');
        const rowToRemove = document.getElementById(`message-row-${messageId}`); if(rowToRemove) rowToRemove.remove();
        updatePendingCount('pending-messages-container', '条留言待审批'); // 更新统计
    } catch (error) {
        console.error("批准留言失败:", error); alert(`批准留言失败: ${error.message}`); button.disabled = false; if(rejectButton) rejectButton.disabled = false; button.textContent = '批准';
    }
}

// --- 处理拒绝留言按钮点击 ---
async function handleRejectMessage(event) {
    const button = event.target; const messageId = button.dataset.messageId; if (!messageId || !confirm(`确定要拒绝这条留言吗？`)) return;
    button.disabled = true; const approveButton = button.previousElementSibling; if(approveButton) approveButton.disabled = true; button.textContent = '处理中...';
    try {
        const result = await fetchApi(`/api/messages/${messageId}/reject`, 'PUT'); alert(result.message || '留言已拒绝！');
        const rowToRemove = document.getElementById(`message-row-${messageId}`); if(rowToRemove) rowToRemove.remove();
        updatePendingCount('pending-messages-container', '条留言待审批'); // 更新统计
    } catch (error) {
        console.error("拒绝留言失败:", error); alert(`拒绝留言失败: ${error.message}`); button.disabled = false; if(approveButton) approveButton.disabled = false; button.textContent = '拒绝';
    }
}


// --- 辅助函数：统一添加表格样式 ---
function attachTableStyles(containerElement) {
    if (!containerElement || document.getElementById('main-table-styles')) return; // 如果样式已存在则不重复添加
    const style = document.createElement('style');
    style.id = 'main-table-styles';
    style.textContent = `
        table { width: 100%; border-collapse: collapse; margin-top: 15px; table-layout: fixed; /* 更稳定的布局 */ }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; word-wrap: break-word; /* 允许长单词换行 */ }
        th { background-color: #f2f2f2; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        /* 按钮通用样式 */
        button { padding: 5px 10px; cursor: pointer; border-radius: 3px; border: 1px solid #ccc; margin: 2px; vertical-align: middle; }
        button:disabled { cursor: not-allowed; background-color: #eee; color: #999; border-color: #ddd;}
        /* 特定按钮样式 */
        .approve-button, .approve-message-button { background-color: #5cb85c; color: white; border: none;}
        .reject-button, .reject-message-button { background-color: #d9534f; color: white; border: none;}
        .approve-button:hover:not(:disabled), .approve-message-button:hover:not(:disabled) { background-color: #4cae4c; }
        .reject-button:hover:not(:disabled), .reject-message-button:hover:not(:disabled) { background-color: #c9302c; }
        .select-course-button { background-color: #5cb85c; color: white; border-color: #4cae4c; }
        .select-course-button:hover:not(:disabled) { background-color: #4cae4c; }
        .deselect-course-button { background-color: #d9534f; color: white; border-color: #d43f3a;}
        .deselect-course-button:hover:not(:disabled) { background-color: #c9302c; }
        /* 状态文字样式 */
        .status-pending { color: orange; font-weight: bold; }
        .status-approved { color: green; font-weight: bold; }
        .status-rejected { color: red; font-weight: bold; }
        /* 留言列表样式 */
        ul { list-style: none; padding: 0; }
        li p { margin: 5px 0; }
    `;
    containerElement.appendChild(style);
}

// --- 辅助函数：更新待处理项计数 ---
function updatePendingCount(containerId, itemText) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const rowCount = container.querySelectorAll('tbody tr').length;
    const pElement = container.querySelector('p'); // 通常是第一个 p 元素
    if (rowCount === 0) {
        container.innerHTML = `<p>所有${itemText.replace('待审批','')}均已处理完毕。</p>`; // 更新提示信息
    } else if (pElement) {
        pElement.textContent = `共 ${rowCount} ${itemText}`;
    }
}

// --- 辅助函数：简单的 HTML 转义 ---
// --- 辅助函数：简单的 HTML 转义 ---
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') {
        return unsafe; // 如果不是字符串，直接返回
    }
    // 正确的转义实体字符
    return unsafe
         .replace(/&/g, "&")  // & 应该替换为 &
         .replace(/</g, "<")   // < 应该替换为 <
         .replace(/>/g, ">")   // > 应该替换为 >
         .replace(/"/g, """)   
         .replace(/'/g, "'"); // ' 应该替换为 ' (或 '，但 ' 更通用)
}


// --- 登出函数 ---
function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userInfo');
    alert('您已成功登出！');
    window.location.href = '/login.html';
}