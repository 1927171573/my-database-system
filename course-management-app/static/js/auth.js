// static/js/auth.js
const loginForm = document.getElementById('login-form');
const errorMessage = document.getElementById('error-message');
const userTypeSelect = document.getElementById('user-type');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');

// --- 根据用户类型选择动态更新输入框占位符的函数 ---
function updateUsernamePlaceholder() {
    const userType = userTypeSelect.value;
    if (userType === 'student') {
        usernameInput.placeholder = "输入学号";
    } else if (userType === 'teacher') {
        usernameInput.placeholder = "输入教师号";
    } else if (userType === 'admin') {
        usernameInput.placeholder = "输入管理员ID";
    }
}

// --- 处理登录表单提交 ---
loginForm.addEventListener('submit', async (event) => {
    event.preventDefault(); // 阻止表单的默认提交行为
    errorMessage.textContent = ''; // 清空之前的错误信息

    const userType = userTypeSelect.value; // 获取用户选择的类型
    const username = usernameInput.value.trim(); // 获取用户名并去除首尾空格
    const password = passwordInput.value; // 获取密码

    // 基本的前端校验
    if (!username || !password) {
        errorMessage.textContent = '账号和密码不能为空';
        return;
    }

    let loginUrl = ''; // 后端登录 API 的 URL
    let idField = ''; // 后端 API 期望接收的 ID 字段名

    // 根据用户类型确定 API 端点和 ID 字段名
    switch (userType) {
        case 'student':
            loginUrl = '/api/auth/login/student';
            idField = 'student_id'; // 学生用 student_id
            break;
        case 'teacher':
            loginUrl = '/api/auth/login/teacher';
            idField = 'teacher_id'; // 教师用 teacher_id
            break;
        case 'admin':
            loginUrl = '/api/auth/login/admin';
            idField = 'admin_id';   // 管理员用 admin_id
            break;
        default:
            errorMessage.textContent = '无效的用户类型';
            return;
    }

    try {
        // 使用 fetch API 发送 POST 请求到后端
        const response = await fetch(loginUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json', // 告诉后端发送的是 JSON 数据
            },
            // 将数据转换为 JSON 字符串，并动态设置 ID 字段名
            body: JSON.stringify({ [idField]: username, password: password }),
        });

        // 解析后端返回的 JSON 响应体 (即使是错误响应也可能包含 JSON 消息)
        const data = await response.json();

        if (!response.ok) {
            // 如果 HTTP 状态码表示错误 (例如 400, 401, 500)
            // 显示后端返回的错误消息，或者一个默认的错误提示
            errorMessage.textContent = data.message || `登录失败 (${response.status})`;
        } else {
            // 登录成功 (HTTP 状态码 2xx)
            console.log('登录成功:', data); // 在控制台打印成功信息和返回的数据

            // 1. 存储 JWT Token
            localStorage.setItem('authToken', data.token);

            // 2. 存储基本用户信息
            localStorage.setItem('userInfo', JSON.stringify(data.user));

            // 3. 重定向到主应用页面或仪表盘
            alert('登录成功!'); // 给用户一个简单的反馈
            window.location.href = '/'; // 跳转到根路径，Flask 会提供 index.html
        }
    } catch (error) {
        // 网络错误或其他 fetch 调用本身的问题
        console.error('登录请求失败:', error);
        errorMessage.textContent = '登录请求失败，请检查网络连接或联系管理员。';
    }
});

// --- 监听用户类型选择的变化，更新占位符 ---
userTypeSelect.addEventListener('change', updateUsernamePlaceholder);

// --- 页面加载完成后，设置初始占位符 ---
document.addEventListener('DOMContentLoaded', updateUsernamePlaceholder);