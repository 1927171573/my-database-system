// static/js/register.js
const registerForm = document.getElementById('register-form');
const userTypeSelect = document.getElementById('register-user-type');
const studentFields = document.getElementById('student-fields'); // 学生特定字段的容器 div
const teacherFields = document.getElementById('teacher-fields'); // 教师特定字段的容器 div
const idInput = document.getElementById('register-id');
const nameInput = document.getElementById('register-name');
const passwordInput = document.getElementById('register-password');
const confirmPasswordInput = document.getElementById('register-confirm-password');
const errorMessage = document.getElementById('register-error-message');
const successMessage = document.getElementById('register-success-message');

// --- 函数：根据用户类型选择显示/隐藏特定字段 ---
function toggleFields() {
    const userType = userTypeSelect.value;
    if (userType === 'student') {
        studentFields.style.display = 'block'; // 显示学生字段
        teacherFields.style.display = 'none';  // 隐藏教师字段
        idInput.placeholder = "输入学号";      // 更新账号输入框的占位符
    } else if (userType === 'teacher') {
        studentFields.style.display = 'none';  // 隐藏学生字段
        teacherFields.style.display = 'block'; // 显示教师字段
        idInput.placeholder = "输入教师号";    // 更新账号输入框的占位符
    } else {
         // 如果有其他类型（例如未来添加管理员注册，或者默认情况）
         studentFields.style.display = 'none';
         teacherFields.style.display = 'none';
         idInput.placeholder = "输入账号"; // 通用占位符
    }
}

// --- 处理注册表单提交 ---
registerForm.addEventListener('submit', async (event) => {
    event.preventDefault(); // 阻止表单默认提交
    errorMessage.textContent = ''; // 清空错误消息
    successMessage.textContent = ''; // 清空成功消息

    // --- 获取并验证输入 ---
    const userType = userTypeSelect.value;
    const id = idInput.value.trim();
    const name = nameInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (!id || !name || !password || !confirmPassword) {
        errorMessage.textContent = '所有必填项不能为空';
        return;
    }
    if (password !== confirmPassword) {
        errorMessage.textContent = '两次输入的密码不一致';
        return;
    }
    // 可以添加更多密码复杂度验证

    // --- 准备要发送到后端的数据 ---
    let registerUrl = ''; // 后端注册 API 的 URL
    let payload = { // 请求体数据
        name: name,
        password: password,
    };

    // 根据用户类型填充特定数据和确定 URL
    if (userType === 'student') {
        registerUrl = '/api/auth/register/student';
        payload.student_id = id; // 学生特定 ID 字段
        payload.gender = document.getElementById('register-gender').value;
        // 获取年龄，确保是数字或 null
        const ageInput = document.getElementById('register-age').value;
        const age = ageInput ? parseInt(ageInput, 10) : null;
        payload.age = !isNaN(age) ? age : null; // 如果解析失败或为空，设为 null
    } else if (userType === 'teacher') {
        registerUrl = '/api/auth/register/teacher'; // 设置教师注册 URL
        payload.teacher_id = id; // 设置教师 ID
        // 获取教师年龄
        const ageInput = document.getElementById('register-teacher-age').value;
        const age = ageInput ? parseInt(ageInput, 10) : null;
        payload.age = !isNaN(age) ? age : null;
        // 获取职称
        payload.title = document.getElementById('register-title').value.trim() || null; // 为空则发送 null
    } else {
        errorMessage.textContent = '无效的用户类型';
        return;
    }

    // --- 发送注册请求 ---
    try {
        const response = await fetch(registerUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload), // 发送 JSON 格式数据
        });

        const data = await response.json(); // 解析响应

        if (!response.ok) {
            // 注册失败
            errorMessage.textContent = data.message || `注册失败 (${response.status})`;
        } else {
            // 注册成功
            successMessage.textContent = data.message + ' 您现在可以登录了。';
            registerForm.reset(); // 清空表单
            toggleFields(); // 重置字段显示状态 (回到默认的学生)
            // 可以选择在几秒后自动跳转到登录页面
            // setTimeout(() => { window.location.href = '/login.html'; }, 2000);
        }
    } catch (error) {
        // 网络错误等
        console.error('注册请求失败:', error);
        errorMessage.textContent = '注册请求失败，请检查网络或联系管理员。';
    }
});

// --- 监听用户类型选择的变化，更新界面 ---
userTypeSelect.addEventListener('change', toggleFields);

// --- 页面加载完成后，根据初始选择设置界面 ---
document.addEventListener('DOMContentLoaded', toggleFields);