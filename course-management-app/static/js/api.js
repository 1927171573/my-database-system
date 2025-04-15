// static/js/api.js

const API_BASE_URL = ''; // 通常是空字符串，因为前端和后端在同一来源

/**
 * 封装 fetch 请求，自动添加认证 Token 并处理常见错误。
 * @param {string} endpoint API 端点路径 (例如 '/api/courses')
 * @param {string} method HTTP 方法 (GET, POST, PUT, DELETE 等)
 * @param {object} [body=null] 请求体数据 (对于 POST/PUT)
 * @returns {Promise<any>} 解析后的 JSON 响应数据
 * @throws {Error} 如果请求失败或响应状态码不表示成功
 */
async function fetchApi(endpoint, method = 'GET', body = null) {
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

        // 尝试解析 JSON，即使响应状态码是错误的 (后端可能在错误响应中也返回了 JSON 消息)
        let data;
        try {
             // 检查响应体是否为空
            const text = await response.text();
            data = text ? JSON.parse(text) : {}; // 如果为空则返回空对象
        } catch (e) {
             // 如果解析 JSON 失败 (例如响应体不是有效的 JSON)
             data = { message: `无法解析服务器响应 (状态码: ${response.status})` };
        }


        if (!response.ok) {
            // 如果 HTTP 状态码表示失败 (4xx, 5xx)
            // 抛出一个包含后端消息或默认消息的错误
            const errorMessage = data?.message || `请求失败，状态码: ${response.status}`;
            console.error(`API Error (${method} ${endpoint}):`, errorMessage, data);
            throw new Error(errorMessage);
        }

        // 如果请求成功 (2xx 状态码)
        return data; // 返回解析后的 JSON 数据

    } catch (error) {
        // 网络错误或其他 fetch 本身的错误，或者上面抛出的错误
        console.error(`Fetch API Error (${method} ${endpoint}):`, error);
        // 将错误继续向上抛出，以便调用者可以处理
        throw error;
    }
}

// 可以添加更具体的 API 调用函数，例如:
// async function getCourses() {
//     return await fetchApi('/api/courses');
// }
// async function loginUser(idField, username, password) {
//     const endpoint = `/api/auth/login/${idField.includes('student') ? 'student' : '...'}`; // 需要完善
//     return await fetchApi(endpoint, 'POST', { [idField]: username, password });
// }