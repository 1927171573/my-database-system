# course-management-app/app.py
import os
import mysql.connector
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from functools import wraps # 用于创建装饰器
import decimal # 导入 decimal 模块

# 加载 .env 文件中的环境变量
load_dotenv()

# --- Flask 应用配置 ---
app = Flask(__name__, static_folder='static', static_url_path='')
app.config['SECRET_KEY'] = os.getenv('JWT_SECRET')
app.config['DEBUG'] = os.getenv('FLASK_DEBUG', '0') == '1'
CORS(app)

# --- 数据库连接 ---
def get_db_connection():
    """建立并返回一个 MySQL 数据库连接"""
    try:
        conn = mysql.connector.connect(
            host=os.getenv('DB_HOST'),
            user=os.getenv('DB_USER'),
            password=os.getenv('DB_PASSWORD'),
            database=os.getenv('DB_NAME'),
            auth_plugin='mysql_native_password'
        )
        return conn
    except mysql.connector.Error as err:
        print(f"数据库连接错误: {err}")
        return None

# --- 身份认证中间件 (装饰器) ---
def require_auth(allowed_roles=[]):
    """装饰器工厂函数，用于验证 JWT Token 并检查用户角色权限。"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            token = None
            auth_header = request.headers.get('Authorization')
            if auth_header and auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]
            if not token:
                return jsonify({"message": "未授权：缺少 Token"}), 401
            try:
                payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
                user_role = payload.get('role')
                if allowed_roles and user_role not in allowed_roles:
                     return jsonify({"message": "禁止访问：用户权限不足"}), 403
                kwargs['current_user'] = payload
                return f(*args, **kwargs)
            except jwt.ExpiredSignatureError:
                return jsonify({"message": "未授权：Token 已过期"}), 401
            except jwt.InvalidTokenError:
                return jsonify({"message": "未授权：无效的 Token"}), 401
            except Exception as e:
                print(f"Token 验证过程中发生未知错误: {e}")
                return jsonify({"message": "服务器内部错误"}), 500
        return decorated_function
    return decorator

# --- API 路由定义 ---

# === 认证相关路由 ===
# (学生注册/登录, 教师注册/登录, 管理员登录 代码保持不变)
# --- 学生注册 ---
@app.route('/api/auth/register/student', methods=['POST'])
def register_student():
    data = request.get_json()
    if not data: return jsonify({"message": "请求体不能为空且必须是 JSON 格式"}), 400
    student_id = data.get('student_id'); name = data.get('name'); password = data.get('password'); gender = data.get('gender'); age = data.get('age')
    if not student_id or not name or not password: return jsonify({"message": "学号、姓名和密码不能为空"}), 400
    conn = get_db_connection()
    if not conn: return jsonify({"message": "数据库服务暂时不可用"}), 503
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT student_id FROM students WHERE student_id = %s", (student_id,))
        if cursor.fetchone(): return jsonify({"message": "学号已被注册"}), 409
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        sql = "INSERT INTO students (student_id, name, gender, age, password_hash) VALUES (%s, %s, %s, %s, %s)"
        val = (student_id, name, gender, age, hashed_password.decode('utf-8'))
        cursor.execute(sql, val)
        conn.commit()
        return jsonify({"message": "学生注册成功"}), 201
    except mysql.connector.Error as err: conn.rollback(); print(f"学生注册数据库操作失败: {err}"); return jsonify({"message": "服务器内部错误，注册失败"}), 500
    except Exception as e: conn.rollback(); print(f"学生注册时发生未知错误: {e}"); return jsonify({"message": "服务器内部错误，注册失败"}), 500
    finally:
        if cursor: cursor.close()
        if conn and conn.is_connected(): conn.close()

# --- 学生登录 ---
@app.route('/api/auth/login/student', methods=['POST'])
def login_student():
    data = request.get_json()
    if not data: return jsonify({"message": "请求体不能为空且必须是 JSON 格式"}), 400
    student_id = data.get('student_id'); password = data.get('password')
    if not student_id or not password: return jsonify({"message": "请输入学号和密码"}), 400
    conn = get_db_connection()
    if not conn: return jsonify({"message": "数据库服务暂时不可用"}), 503
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT student_id, name, password_hash FROM students WHERE student_id = %s", (student_id,))
        user = cursor.fetchone()
        if not user: return jsonify({"message": "学号或密码错误"}), 401
        stored_hash = user['password_hash'].encode('utf-8')
        if bcrypt.checkpw(password.encode('utf-8'), stored_hash):
            payload = { 'id': user['student_id'], 'name': user['name'], 'role': 'student', 'exp': datetime.now(timezone.utc) + timedelta(hours=1) }
            token = jwt.encode(payload, app.config['SECRET_KEY'], algorithm="HS256")
            return jsonify({ "message": "登录成功", "token": token, "user": { "id": user['student_id'], "name": user['name'], "role": 'student' } })
        else: return jsonify({"message": "学号或密码错误"}), 401
    except mysql.connector.Error as err: print(f"学生登录数据库操作失败: {err}"); return jsonify({"message": "服务器内部错误，登录失败"}), 500
    except Exception as e: print(f"学生登录时发生未知错误: {e}"); return jsonify({"message": "服务器内部错误，登录失败"}), 500
    finally:
        if cursor: cursor.close()
        if conn and conn.is_connected(): conn.close()

# --- 教师注册 ---
@app.route('/api/auth/register/teacher', methods=['POST'])
def register_teacher():
    data = request.get_json()
    if not data: return jsonify({"message": "请求体不能为空且必须是 JSON 格式"}), 400
    teacher_id = data.get('teacher_id'); name = data.get('name'); password = data.get('password'); age = data.get('age'); title = data.get('title')
    if not teacher_id or not name or not password: return jsonify({"message": "教师号、姓名和密码不能为空"}), 400
    conn = get_db_connection()
    if not conn: return jsonify({"message": "数据库服务暂时不可用"}), 503
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT teacher_id FROM teachers WHERE teacher_id = %s", (teacher_id,))
        if cursor.fetchone(): return jsonify({"message": "教师号已被注册"}), 409
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        sql = "INSERT INTO teachers (teacher_id, name, age, title, password_hash) VALUES (%s, %s, %s, %s, %s)"
        val = (teacher_id, name, age, title, hashed_password.decode('utf-8'))
        cursor.execute(sql, val)
        conn.commit()
        return jsonify({"message": "教师注册成功"}), 201
    except mysql.connector.Error as err: conn.rollback(); print(f"教师注册数据库操作失败: {err}"); return jsonify({"message": "服务器内部错误，注册失败"}), 500
    except Exception as e: conn.rollback(); print(f"教师注册时发生未知错误: {e}"); return jsonify({"message": "服务器内部错误，注册失败"}), 500
    finally:
        if cursor: cursor.close()
        if conn and conn.is_connected(): conn.close()

# --- 教师登录 ---
@app.route('/api/auth/login/teacher', methods=['POST'])
def login_teacher():
    data = request.get_json()
    if not data: return jsonify({"message": "请求体不能为空且必须是 JSON 格式"}), 400
    teacher_id = data.get('teacher_id'); password = data.get('password')
    if not teacher_id or not password: return jsonify({"message": "请输入教师号和密码"}), 400
    conn = get_db_connection()
    if not conn: return jsonify({"message": "数据库服务暂时不可用"}), 503
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT teacher_id, name, password_hash, title FROM teachers WHERE teacher_id = %s", (teacher_id,))
        user = cursor.fetchone()
        if not user: return jsonify({"message": "教师号或密码错误"}), 401
        stored_hash = user['password_hash'].encode('utf-8')
        if bcrypt.checkpw(password.encode('utf-8'), stored_hash):
            payload = { 'id': user['teacher_id'], 'name': user['name'], 'role': 'teacher', 'exp': datetime.now(timezone.utc) + timedelta(hours=1) }
            token = jwt.encode(payload, app.config['SECRET_KEY'], algorithm="HS256")
            return jsonify({ "message": "登录成功", "token": token, "user": { "id": user['teacher_id'], "name": user['name'], "role": 'teacher', "title": user.get('title') } })
        else: return jsonify({"message": "教师号或密码错误"}), 401
    except mysql.connector.Error as err: print(f"教师登录数据库操作失败: {err}"); return jsonify({"message": "服务器内部错误，登录失败"}), 500
    except Exception as e: print(f"教师登录时发生未知错误: {e}"); return jsonify({"message": "服务器内部错误，登录失败"}), 500
    finally:
        if cursor: cursor.close()
        if conn and conn.is_connected(): conn.close()

# --- 管理员登录 ---
@app.route('/api/auth/login/admin', methods=['POST'])
def login_admin():
    data = request.get_json()
    if not data: return jsonify({"message": "请求体不能为空且必须是 JSON 格式"}), 400
    admin_id = data.get('admin_id'); password = data.get('password')
    if not admin_id or not password: return jsonify({"message": "请输入管理员ID和密码"}), 400
    conn = get_db_connection()
    if not conn: return jsonify({"message": "数据库服务暂时不可用"}), 503
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT admin_id, name, password_hash FROM administrators WHERE admin_id = %s", (admin_id,))
        user = cursor.fetchone()
        if not user: return jsonify({"message": "管理员ID或密码错误"}), 401
        stored_hash = user['password_hash'].encode('utf-8')
        if bcrypt.checkpw(password.encode('utf-8'), stored_hash):
            payload = { 'id': user['admin_id'], 'name': user['name'], 'role': 'admin', 'exp': datetime.now(timezone.utc) + timedelta(hours=1) }
            token = jwt.encode(payload, app.config['SECRET_KEY'], algorithm="HS256")
            return jsonify({ "message": "登录成功", "token": token, "user": { "id": user['admin_id'], "name": user['name'], "role": 'admin' } })
        else: return jsonify({"message": "管理员ID或密码错误"}), 401
    except mysql.connector.Error as err: print(f"管理员登录数据库操作失败: {err}"); return jsonify({"message": "服务器内部错误，登录失败"}), 500
    except Exception as e: print(f"管理员登录时发生未知错误: {e}"); return jsonify({"message": "服务器内部错误，登录失败"}), 500
    finally:
        if cursor: cursor.close()
        if conn and conn.is_connected(): conn.close()

# === 课程相关路由 ===
# (获取已批准课程, 上传课程, 获取教师课程, 获取待审批课程, 批准/拒绝课程 代码保持不变)
# --- 获取所有已批准课程 ---
@app.route('/api/courses', methods=['GET'])
@require_auth(allowed_roles=['student', 'teacher', 'admin'])
def get_approved_courses(current_user):
    print(f"用户 {current_user.get('id')} (角色: {current_user.get('role')}) 请求已批准课程列表")
    conn = get_db_connection()
    if not conn: return jsonify({"message": "数据库服务暂时不可用"}), 503
    cursor = conn.cursor(dictionary=True)
    try:
        query = """
            SELECT c.course_id, c.course_name, c.hours, c.credits, t.name as teacher_name
            FROM courses c
            JOIN teachers t ON c.teacher_id = t.teacher_id
            WHERE c.approval_status = 'approved'
            ORDER BY c.course_id
        """
        cursor.execute(query)
        courses = cursor.fetchall()
        for course in courses:
            if isinstance(course.get('credits'), decimal.Decimal):
                 course['credits'] = float(course['credits'])
        return jsonify(courses)
    except mysql.connector.Error as err: print(f"获取已批准课程列表数据库操作失败: {err}"); return jsonify({"message": "获取课程列表失败"}), 500
    except Exception as e: print(f"获取已批准课程列表时发生未知错误: {e}"); return jsonify({"message": "获取课程列表失败"}), 500
    finally:
        if cursor: cursor.close()
        if conn and conn.is_connected(): conn.close()

# --- 教师上传课程 ---
@app.route('/api/courses', methods=['POST'])
@require_auth(allowed_roles=['teacher'])
def upload_course(current_user):
    data = request.get_json()
    if not data: return jsonify({"message": "请求体不能为空且必须是 JSON 格式"}), 400
    course_id = data.get('course_id'); course_name = data.get('course_name'); hours = data.get('hours'); credits = data.get('credits'); teacher_id = current_user.get('id')
    if not course_id or not course_name or not teacher_id: return jsonify({"message": "课程号、课程名不能为空"}), 400
    try:
        hours_val = int(hours) if hours is not None and str(hours).strip() else None
        credits_val = float(credits) if credits is not None and str(credits).strip() else None
        if (hours_val is not None and hours_val < 0) or (credits_val is not None and credits_val < 0): return jsonify({"message": "学时和学分不能为负数"}), 400
    except (ValueError, TypeError): return jsonify({"message": "学时和学分必须是有效的数字"}), 400
    conn = get_db_connection()
    if not conn: return jsonify({"message": "数据库服务暂时不可用"}), 503
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT course_id FROM courses WHERE course_id = %s", (course_id,))
        if cursor.fetchone(): return jsonify({"message": "课程号已被使用"}), 409
        sql = "INSERT INTO courses (course_id, course_name, hours, credits, teacher_id, approval_status) VALUES (%s, %s, %s, %s, %s, 'pending')"
        val = (course_id, course_name, hours_val, credits_val, teacher_id)
        cursor.execute(sql, val)
        conn.commit()
        return jsonify({"message": "课程上传成功，等待管理员审批"}), 201
    except mysql.connector.Error as err: conn.rollback(); print(f"上传课程数据库操作失败: {err}"); return jsonify({"message": "服务器内部错误，上传失败"}), 500
    except Exception as e: conn.rollback(); print(f"上传课程时发生未知错误: {e}"); return jsonify({"message": "服务器内部错误，上传失败"}), 500
    finally:
        if cursor: cursor.close()
        if conn and conn.is_connected(): conn.close()

# --- 教师查看自己上传的课程 ---
@app.route('/api/courses/my', methods=['GET'])
@require_auth(allowed_roles=['teacher'])
def get_my_courses(current_user):
    teacher_id = current_user.get('id')
    print(f"教师 {teacher_id} 请求自己的课程列表")
    conn = get_db_connection()
    if not conn: return jsonify({"message": "数据库服务暂时不可用"}), 503
    cursor = conn.cursor(dictionary=True)
    try:
        query = "SELECT course_id, course_name, hours, credits, approval_status, created_at, approval_timestamp FROM courses WHERE teacher_id = %s ORDER BY created_at DESC"
        cursor.execute(query, (teacher_id,))
        my_courses = cursor.fetchall()
        for course in my_courses:
            if isinstance(course.get('created_at'), datetime): course['created_at'] = course['created_at'].strftime('%Y-%m-%d %H:%M:%S')
            if isinstance(course.get('approval_timestamp'), datetime): course['approval_timestamp'] = course['approval_timestamp'].strftime('%Y-%m-%d %H:%M:%S')
            if isinstance(course.get('credits'), decimal.Decimal):
                 course['credits'] = float(course['credits'])
        return jsonify(my_courses)
    except mysql.connector.Error as err: print(f"获取教师课程数据库操作失败: {err}"); return jsonify({"message": "获取我的课程列表失败"}), 500
    except Exception as e: print(f"获取教师课程时发生未知错误: {e}"); return jsonify({"message": "获取我的课程列表失败"}), 500
    finally:
        if cursor: cursor.close()
        if conn and conn.is_connected(): conn.close()

# --- 管理员获取待审批课程列表 ---
@app.route('/api/courses/pending', methods=['GET'])
@require_auth(allowed_roles=['admin'])
def get_pending_courses(current_user):
    """获取所有待审批的课程列表"""
    print(f"管理员 {current_user.get('id')} 请求待审批课程列表")
    conn = get_db_connection()
    if not conn: return jsonify({"message": "数据库服务暂时不可用"}), 503
    cursor = conn.cursor(dictionary=True)
    try:
        query = """
            SELECT c.course_id, c.course_name, c.hours, c.credits, c.teacher_id, t.name as teacher_name, c.created_at
            FROM courses c
            JOIN teachers t ON c.teacher_id = t.teacher_id
            WHERE c.approval_status = 'pending'
            ORDER BY c.created_at ASC
        """
        cursor.execute(query)
        pending_courses = cursor.fetchall()
        for course in pending_courses:
            if isinstance(course.get('created_at'), datetime):
                course['created_at'] = course['created_at'].strftime('%Y-%m-%d %H:%M:%S')
            if isinstance(course.get('credits'), decimal.Decimal):
                 course['credits'] = float(course['credits'])
        return jsonify(pending_courses)
    except mysql.connector.Error as err:
        print(f"获取待审批课程数据库操作失败: {err}"); return jsonify({"message": "获取待审批课程列表失败"}), 500
    except Exception as e:
        print(f"获取待审批课程时发生未知错误: {e}"); return jsonify({"message": "获取待审批课程列表失败"}), 500
    finally:
        if cursor: cursor.close()
        if conn and conn.is_connected(): conn.close()

# --- 管理员批准课程 ---
@app.route('/api/courses/<string:course_id>/approve', methods=['PUT'])
@require_auth(allowed_roles=['admin'])
def approve_course(current_user, course_id):
    """管理员批准指定 ID 的课程"""
    admin_id = current_user.get('id')
    print(f"管理员 {admin_id} 正在批准课程 {course_id}")
    conn = get_db_connection()
    if not conn: return jsonify({"message": "数据库服务暂时不可用"}), 503
    cursor = conn.cursor()
    try:
        sql = """
            UPDATE courses
            SET approval_status = 'approved',
                approved_by_admin_id = %s,
                approval_timestamp = CURRENT_TIMESTAMP
            WHERE course_id = %s AND approval_status = 'pending'
        """
        val = (admin_id, course_id)
        cursor.execute(sql, val)
        affected_rows = cursor.rowcount
        conn.commit()
        if affected_rows == 0:
            cursor.execute("SELECT approval_status FROM courses WHERE course_id = %s", (course_id,))
            result = cursor.fetchone()
            if not result: return jsonify({"message": "批准失败：课程未找到"}), 404
            elif result[0] != 'pending': return jsonify({"message": "批准失败：该课程当前状态无法批准"}), 409
            else: return jsonify({"message": "批准操作未影响任何行"}), 500
        else: return jsonify({"message": f"课程 {course_id} 已成功批准"}), 200
    except mysql.connector.Error as err:
        conn.rollback(); print(f"批准课程数据库操作失败: {err}"); return jsonify({"message": "服务器内部错误，批准失败"}), 500
    except Exception as e:
        conn.rollback(); print(f"批准课程时发生未知错误: {e}"); return jsonify({"message": "服务器内部错误，批准失败"}), 500
    finally:
        if cursor: cursor.close()
        if conn and conn.is_connected(): conn.close()

# --- 管理员拒绝课程 ---
@app.route('/api/courses/<string:course_id>/reject', methods=['PUT'])
@require_auth(allowed_roles=['admin'])
def reject_course(current_user, course_id):
    """管理员拒绝指定 ID 的课程"""
    admin_id = current_user.get('id')
    print(f"管理员 {admin_id} 正在拒绝课程 {course_id}")
    conn = get_db_connection()
    if not conn: return jsonify({"message": "数据库服务暂时不可用"}), 503
    cursor = conn.cursor()
    try:
        sql = """
            UPDATE courses
            SET approval_status = 'rejected',
                approved_by_admin_id = %s,
                approval_timestamp = CURRENT_TIMESTAMP
            WHERE course_id = %s AND approval_status = 'pending'
        """
        val = (admin_id, course_id)
        cursor.execute(sql, val)
        affected_rows = cursor.rowcount
        conn.commit()
        if affected_rows == 0:
            cursor.execute("SELECT approval_status FROM courses WHERE course_id = %s", (course_id,))
            result = cursor.fetchone()
            if not result: return jsonify({"message": "拒绝失败：课程未找到"}), 404
            elif result[0] != 'pending': return jsonify({"message": "拒绝失败：该课程当前状态无法拒绝"}), 409
            else: return jsonify({"message": "拒绝操作未影响任何行"}), 500
        else: return jsonify({"message": f"课程 {course_id} 已成功拒绝"}), 200
    except mysql.connector.Error as err:
        conn.rollback(); print(f"拒绝课程数据库操作失败: {err}"); return jsonify({"message": "服务器内部错误，拒绝失败"}), 500
    except Exception as e:
        conn.rollback(); print(f"拒绝课程时发生未知错误: {e}"); return jsonify({"message": "服务器内部错误，拒绝失败"}), 500
    finally:
        if cursor: cursor.close()
        if conn and conn.is_connected(): conn.close()


# === 选课相关路由 ===
# (学生选课, 获取学生选课列表, 学生退选 代码保持不变)
# --- 学生选课 ---
@app.route('/api/courses/<string:course_id>/select', methods=['POST'])
@require_auth(allowed_roles=['student'])
def select_course(current_user, course_id):
    """学生选择一门课程"""
    student_id = current_user.get('id')
    print(f"学生 {student_id} 尝试选择课程 {course_id}")
    conn = get_db_connection()
    if not conn: return jsonify({"message": "数据库服务暂时不可用"}), 503
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT approval_status FROM courses WHERE course_id = %s", (course_id,))
        course = cursor.fetchone()
        if not course: return jsonify({"message": "选课失败：课程不存在"}), 404
        if course['approval_status'] != 'approved': return jsonify({"message": "选课失败：该课程尚未批准或已被拒绝"}), 400
        cursor.execute("SELECT student_id FROM course_selections WHERE student_id = %s AND course_id = %s", (student_id, course_id))
        if cursor.fetchone(): return jsonify({"message": "您已选择此课程"}), 409
        sql = "INSERT INTO course_selections (student_id, course_id) VALUES (%s, %s)"
        val = (student_id, course_id)
        cursor_insert = conn.cursor()
        cursor_insert.execute(sql, val)
        conn.commit()
        cursor_insert.close()
        return jsonify({"message": f"课程 {course_id} 选择成功"}), 201
    except mysql.connector.Error as err:
        conn.rollback()
        print(f"学生 {student_id} 选课 {course_id} 数据库操作失败: {err}")
        if err.errno == 1452: return jsonify({"message": "选课失败：关联的学生或课程信息无效"}), 400
        return jsonify({"message": "服务器内部错误，选课失败"}), 500
    except Exception as e:
        conn.rollback()
        print(f"学生 {student_id} 选课 {course_id} 时发生未知错误: {e}")
        return jsonify({"message": "服务器内部错误，选课失败"}), 500
    finally:
        if cursor: cursor.close()
        # if 'cursor_insert' in locals() and cursor_insert and cursor_insert.is_connected(): cursor_insert.close()
        if conn and conn.is_connected(): conn.close()

# --- 学生查看自己的选课列表 ---
@app.route('/api/selections/my', methods=['GET'])
@require_auth(allowed_roles=['student'])
def get_my_selections(current_user):
    """获取当前登录学生已选的课程列表及相关信息"""
    student_id = current_user.get('id')
    print(f"学生 {student_id} 请求自己的选课列表")
    conn = get_db_connection()
    if not conn: return jsonify({"message": "数据库服务暂时不可用"}), 503
    cursor = conn.cursor(dictionary=True)
    try:
        # 修改: 移除了查询中不存在的 cs.selection_id，并使用别名 AS selection_time
        query = """
            SELECT
                cs.course_id,
                c.course_name,
                c.hours,
                c.credits,
                t.name AS teacher_name,
                cs.selection_timestamp AS selection_time,
                cs.grade
            FROM course_selections cs
            JOIN courses c ON cs.course_id = c.course_id
            LEFT JOIN teachers t ON c.teacher_id = t.teacher_id
            WHERE cs.student_id = %s
            ORDER BY cs.selection_timestamp DESC
        """
        cursor.execute(query, (student_id,))
        selections = cursor.fetchall()
        for selection in selections:
            if isinstance(selection.get('selection_time'), datetime):
                selection['selection_time'] = selection['selection_time'].strftime('%Y-%m-%d %H:%M:%S')
            if isinstance(selection.get('credits'), decimal.Decimal):
                 selection['credits'] = float(selection['credits'])
            if isinstance(selection.get('grade'), decimal.Decimal):
                selection['grade'] = float(selection['grade'])
            elif selection.get('grade') is None:
                 selection['grade'] = 'N/A'
        return jsonify(selections)
    except mysql.connector.Error as err:
        print(f"学生 {student_id} 获取选课列表数据库操作失败: {err}")
        return jsonify({"message": "获取选课列表失败"}), 500
    except Exception as e:
        print(f"学生 {student_id} 获取选课列表时发生未知错误: {e}")
        return jsonify({"message": "获取选课列表失败"}), 500
    finally:
        if cursor: cursor.close()
        if conn and conn.is_connected(): conn.close()

# --- 学生退选 ---
@app.route('/api/selections/<string:course_id>', methods=['DELETE'])
@require_auth(allowed_roles=['student'])
def deselect_course(current_user, course_id):
    """学生退选一门已选课程"""
    student_id = current_user.get('id')
    print(f"学生 {student_id} 尝试退选课程 {course_id}")
    conn = get_db_connection()
    if not conn: return jsonify({"message": "数据库服务暂时不可用"}), 503
    cursor = conn.cursor()
    try:
        sql = "DELETE FROM course_selections WHERE student_id = %s AND course_id = %s"
        val = (student_id, course_id)
        cursor.execute(sql, val)
        affected_rows = cursor.rowcount
        conn.commit()
        if affected_rows == 0:
            cursor.execute("SELECT course_id FROM courses WHERE course_id = %s", (course_id,))
            if not cursor.fetchone(): return jsonify({"message": "退选失败：课程不存在"}), 404
            else: return jsonify({"message": "退选失败：您未选择此课程"}), 404
        else: return jsonify({"message": f"课程 {course_id} 已成功退选"}), 200
    except mysql.connector.Error as err:
        conn.rollback()
        print(f"学生 {student_id} 退选课程 {course_id} 数据库操作失败: {err}")
        return jsonify({"message": "服务器内部错误，退选失败"}), 500
    except Exception as e:
        conn.rollback()
        print(f"学生 {student_id} 退选课程 {course_id} 时发生未知错误: {e}")
        return jsonify({"message": "服务器内部错误，退选失败"}), 500
    finally:
        if cursor: cursor.close()
        if conn and conn.is_connected(): conn.close()

# === 留言相关路由 === (新增)

# --- 学生提交留言 ---
@app.route('/api/messages', methods=['POST'])
@require_auth(allowed_roles=['student'])
def submit_message(current_user):
    """学生提交一条新的留言"""
    student_id = current_user.get('id')
    data = request.get_json()
    if not data or not data.get('content'):
        return jsonify({"message": "留言内容不能为空"}), 400
    content = data['content'].strip()
    if not content: return jsonify({"message": "留言内容不能为空"}), 400
    print(f"学生 {student_id} 正在提交留言")
    conn = get_db_connection()
    if not conn: return jsonify({"message": "数据库服务暂时不可用"}), 503
    cursor = conn.cursor()
    try:
        sql = "INSERT INTO messages (student_id, content, approval_status) VALUES (%s, %s, 'pending')"
        val = (student_id, content)
        cursor.execute(sql, val)
        conn.commit()
        return jsonify({"message": "留言提交成功，等待管理员审批"}), 201
    except mysql.connector.Error as err:
        conn.rollback()
        print(f"学生 {student_id} 提交留言数据库操作失败: {err}")
        if err.errno == 1452: return jsonify({"message": "提交失败：无效的用户信息"}), 400
        return jsonify({"message": "服务器内部错误，提交失败"}), 500
    except Exception as e:
        conn.rollback()
        print(f"学生 {student_id} 提交留言时发生未知错误: {e}")
        return jsonify({"message": "服务器内部错误，提交失败"}), 500
    finally:
        if cursor: cursor.close()
        if conn and conn.is_connected(): conn.close()

# --- 管理员获取待审批留言列表 ---
@app.route('/api/messages/pending', methods=['GET'])
@require_auth(allowed_roles=['admin'])
def get_pending_messages(current_user):
    """获取所有待审批的留言列表"""
    print(f"管理员 {current_user.get('id')} 请求待审批留言列表")
    conn = get_db_connection()
    if not conn: return jsonify({"message": "数据库服务暂时不可用"}), 503
    cursor = conn.cursor(dictionary=True)
    try:
        query = """
            SELECT m.message_id, m.content, m.post_date, m.student_id, s.name AS student_name
            FROM messages m
            JOIN students s ON m.student_id = s.student_id
            WHERE m.approval_status = 'pending'
            ORDER BY m.post_date ASC
        """
        cursor.execute(query)
        pending_messages = cursor.fetchall()
        for msg in pending_messages:
            if isinstance(msg.get('post_date'), datetime):
                msg['post_date'] = msg['post_date'].strftime('%Y-%m-%d %H:%M:%S')
        return jsonify(pending_messages)
    except mysql.connector.Error as err:
        print(f"获取待审批留言数据库操作失败: {err}")
        return jsonify({"message": "获取待审批留言列表失败"}), 500
    except Exception as e:
        print(f"获取待审批留言时发生未知错误: {e}")
        return jsonify({"message": "获取待审批留言列表失败"}), 500
    finally:
        if cursor: cursor.close()
        if conn and conn.is_connected(): conn.close()

# --- 管理员批准留言 ---
@app.route('/api/messages/<int:message_id>/approve', methods=['PUT'])
@require_auth(allowed_roles=['admin'])
def approve_message(current_user, message_id):
    """管理员批准指定 ID 的留言"""
    admin_id = current_user.get('id')
    print(f"管理员 {admin_id} 正在批准留言 {message_id}")
    conn = get_db_connection()
    if not conn: return jsonify({"message": "数据库服务暂时不可用"}), 503
    cursor = conn.cursor()
    try:
        sql = """
            UPDATE messages
            SET approval_status = 'approved', approved_by_admin_id = %s, approval_timestamp = CURRENT_TIMESTAMP
            WHERE message_id = %s AND approval_status = 'pending'
        """
        val = (admin_id, message_id)
        cursor.execute(sql, val)
        affected_rows = cursor.rowcount
        conn.commit()
        if affected_rows == 0:
            cursor.execute("SELECT approval_status FROM messages WHERE message_id = %s", (message_id,))
            result = cursor.fetchone()
            if not result: return jsonify({"message": "批准失败：留言未找到"}), 404
            elif result[0] != 'pending': return jsonify({"message": "批准失败：该留言当前状态无法批准"}), 409
            else: return jsonify({"message": "批准操作未影响任何行"}), 500
        else: return jsonify({"message": f"留言 {message_id} 已成功批准"}), 200
    except mysql.connector.Error as err:
        conn.rollback(); print(f"批准留言数据库操作失败: {err}"); return jsonify({"message": "服务器内部错误，批准失败"}), 500
    except Exception as e:
        conn.rollback(); print(f"批准留言时发生未知错误: {e}"); return jsonify({"message": "服务器内部错误，批准失败"}), 500
    finally:
        if cursor: cursor.close()
        if conn and conn.is_connected(): conn.close()

# --- 管理员拒绝留言 ---
@app.route('/api/messages/<int:message_id>/reject', methods=['PUT'])
@require_auth(allowed_roles=['admin'])
def reject_message(current_user, message_id):
    """管理员拒绝指定 ID 的留言"""
    admin_id = current_user.get('id')
    print(f"管理员 {admin_id} 正在拒绝留言 {message_id}")
    conn = get_db_connection()
    if not conn: return jsonify({"message": "数据库服务暂时不可用"}), 503
    cursor = conn.cursor()
    try:
        sql = """
            UPDATE messages
            SET approval_status = 'rejected', approved_by_admin_id = %s, approval_timestamp = CURRENT_TIMESTAMP
            WHERE message_id = %s AND approval_status = 'pending'
        """
        val = (admin_id, message_id)
        cursor.execute(sql, val)
        affected_rows = cursor.rowcount
        conn.commit()
        if affected_rows == 0:
            cursor.execute("SELECT approval_status FROM messages WHERE message_id = %s", (message_id,))
            result = cursor.fetchone()
            if not result: return jsonify({"message": "拒绝失败：留言未找到"}), 404
            elif result[0] != 'pending': return jsonify({"message": "拒绝失败：该留言当前状态无法拒绝"}), 409
            else: return jsonify({"message": "拒绝操作未影响任何行"}), 500
        else: return jsonify({"message": f"留言 {message_id} 已成功拒绝"}), 200
    except mysql.connector.Error as err:
        conn.rollback(); print(f"拒绝留言数据库操作失败: {err}"); return jsonify({"message": "服务器内部错误，拒绝失败"}), 500
    except Exception as e:
        conn.rollback(); print(f"拒绝留言时发生未知错误: {e}"); return jsonify({"message": "服务器内部错误，拒绝失败"}), 500
    finally:
        if cursor: cursor.close()
        if conn and conn.is_connected(): conn.close()

# --- (可选) 学生查看自己的留言 ---
@app.route('/api/messages/my', methods=['GET'])
@require_auth(allowed_roles=['student'])
def get_my_messages(current_user):
    """获取当前登录学生提交的留言列表及其状态"""
    student_id = current_user.get('id')
    print(f"学生 {student_id} 请求自己的留言列表")
    conn = get_db_connection()
    if not conn: return jsonify({"message": "数据库服务暂时不可用"}), 503
    cursor = conn.cursor(dictionary=True)
    try:
        query = """
            SELECT message_id, content, post_date, approval_status, approval_timestamp
            FROM messages
            WHERE student_id = %s
            ORDER BY post_date DESC
        """
        cursor.execute(query, (student_id,))
        my_messages = cursor.fetchall()
        for msg in my_messages:
            if isinstance(msg.get('post_date'), datetime):
                msg['post_date'] = msg['post_date'].strftime('%Y-%m-%d %H:%M:%S')
            if isinstance(msg.get('approval_timestamp'), datetime):
                msg['approval_timestamp'] = msg['approval_timestamp'].strftime('%Y-%m-%d %H:%M:%S')
            else: # 如果审批时间戳是 None (例如待审批状态)
                 msg['approval_timestamp'] = 'N/A'
        return jsonify(my_messages)
    except mysql.connector.Error as err:
        print(f"获取学生留言数据库操作失败: {err}")
        return jsonify({"message": "获取我的留言列表失败"}), 500
    except Exception as e:
        print(f"获取学生留言时发生未知错误: {e}")
        return jsonify({"message": "获取我的留言列表失败"}), 500
    finally:
        if cursor: cursor.close()
        if conn and conn.is_connected(): conn.close()


# === 提供前端静态文件的路由 ===
@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_static_or_frontend(path):
    file_path = os.path.join(app.static_folder, path)
    if os.path.exists(file_path) and os.path.isfile(file_path):
        return send_from_directory(app.static_folder, path)
    else:
        if '.' not in path and not path.startswith('api/'):
             return send_from_directory(app.static_folder, 'index.html')
        else:
             return jsonify({"message": "资源未找到"}), 404

# === 应用启动入口 ===
if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=app.config['DEBUG'])