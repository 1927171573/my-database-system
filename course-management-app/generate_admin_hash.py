# generate_admin_hash.py
import bcrypt
import os
from dotenv import load_dotenv

load_dotenv() # 加载 .env 文件

# --- 配置管理员信息 ---
admin_id_to_create = 'admin001' # 你想设置的管理员 ID
admin_name_to_create = '初始管理员' # 管理员姓名
admin_password_to_set = '123456' # <-- *** 在这里替换你的密码 *** (b'' 表示字节串)

# --- 生成哈希 ---
# 确保密码是字节串
if not isinstance(admin_password_to_set, bytes):
    admin_password_to_set = admin_password_to_set.encode('utf-8')

hashed_password = bcrypt.hashpw(admin_password_to_set, bcrypt.gensalt())
hashed_password_str = hashed_password.decode('utf-8')

print("-" * 30)
print(f"准备为管理员 ID '{admin_id_to_create}' 生成密码哈希。")
print(f"生成的哈希值是: {hashed_password_str}")
print("-" * 30)
print("请将以下 SQL 语句复制到你的 MySQL 客户端执行以创建管理员：")
print("-" * 30)
# 使用 %s 作为占位符，避免 SQL 注入风险（尽管这里是手动执行）
sql_statement = f"""
INSERT INTO administrators (admin_id, name, password_hash)
VALUES ('{admin_id_to_create}', '{admin_name_to_create}', '{hashed_password_str}');
"""
print(sql_statement)
print("-" * 30)

# 可选：直接连接数据库并插入 (需要确保 .env 配置正确且虚拟环境激活)
use_direct_insert = False # 改为 True 可以尝试直接插入

if use_direct_insert:
    import mysql.connector
    print("尝试直接插入数据库...")
    conn = None
    cursor = None
    try:
        conn = mysql.connector.connect(
            host=os.getenv('DB_HOST'),
            user=os.getenv('DB_USER'),
            password=os.getenv('DB_PASSWORD'),
            database=os.getenv('DB_NAME'),
            auth_plugin='mysql_native_password'
        )
        cursor = conn.cursor()
        # 检查管理员是否已存在
        cursor.execute("SELECT admin_id FROM administrators WHERE admin_id = %s", (admin_id_to_create,))
        if cursor.fetchone():
            print(f"错误：管理员 ID '{admin_id_to_create}' 已存在，未执行插入。")
        else:
            cursor.execute(
                "INSERT INTO administrators (admin_id, name, password_hash) VALUES (%s, %s, %s)",
                (admin_id_to_create, admin_name_to_create, hashed_password_str)
            )
            conn.commit()
            print("成功将管理员信息插入数据库！")
    except mysql.connector.Error as err:
        if conn: conn.rollback()
        print(f"直接插入数据库时出错: {err}")
    except Exception as e:
        if conn: conn.rollback()
        print(f"直接插入时发生未知错误: {e}")
    finally:
        if cursor: cursor.close()
        if conn and conn.is_connected(): conn.close()