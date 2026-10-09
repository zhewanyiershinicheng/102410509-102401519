#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
校园失物招领 · 后端服务（Python 标准库实现，零第三方依赖）

功能：
  1. 提供 REST API，供前端进行数据读写（增删改查 + 筛选搜索）。
  2. 使用 SQLite 持久化数据（文件 lostfound.db），可实际部署、多用户共享。
  3. 托管前端静态资源（HTML / CSS / JS / 图片），访问根路径即可打开小程序。

运行：
  python server.py                 # 默认端口 8765
  python server.py 8000            # 指定端口
  PORT=8000 python server.py       # 或用环境变量指定

接口一览：
  GET    /api/items                查询列表（支持 type / category / kw / device_id 过滤）
  POST   /api/items                发布一条信息
  GET    /api/items/<id>           查询单条
  PUT    /api/items/<id>           更新（部分字段）
  DELETE /api/items/<id>           删除
"""

import json
import os
import sqlite3
import sys
import time
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs, unquote

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'lostfound.db')
DEFAULT_PORT = 8765

# 允许前端更新的字段（id、deviceId、createdAt 为不可变字段）
EDITABLE_FIELDS = ('type', 'name', 'category', 'time', 'location',
                   'description', 'image', 'contact', 'nickname', 'status')

MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon',
}


# ---------------------------------------------------------------------------
# 数据库
# ---------------------------------------------------------------------------

def get_conn():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    return conn


def row_to_item(row):
    return {
        'id': row['id'],
        'type': row['type'],
        'name': row['name'],
        'category': row['category'],
        'time': row['time'],
        'location': row['location'],
        'description': row['description'],
        'image': row['image'],
        'contact': row['contact'],
        'nickname': row['nickname'],
        'status': row['status'],
        'deviceId': row['device_id'],
        'createdAt': row['created_at'],
    }


def _seed_rows():
    """首次启动时写入的示例数据（device_id 为 demo，不会出现在“我的发布”中）。"""
    now = datetime.now(timezone.utc)

    def ago(**kwargs):
        return (now - timedelta(**kwargs)).strftime('%Y-%m-%dT%H:%M:%S.000Z')

    def created(**kwargs):
        return int((now - timedelta(**kwargs)).timestamp() * 1000)

    return [
        ('demo-1', 'found', '校园卡（李同学）', '校园卡', ago(hours=2), '图书馆 二楼自习区',
         '在图书馆二楼自习区靠窗座位旁捡到一张校园卡，卡面姓名“李同学”，请失主看到后联系我认领。',
         '', '13800001234', '拾金不昧的小王', 'open', 'demo', created(hours=2)),
        ('demo-2', 'lost', '蓝色折叠雨伞', '雨伞', ago(hours=5), '第三教学楼 301 教室',
         '今天上午在 301 教室上课后忘记拿走，蓝色格纹折叠伞，伞把上有一个黄色挂绳，捡到的同学麻烦联系我，谢谢！',
         '', 'wxid_lan_yu', '丢了伞的小张', 'open', 'demo', created(hours=5)),
        ('demo-3', 'found', '白色 AirPods 耳机', '耳机', ago(days=1), '运动场 跑道旁',
         '晚上跑步时在跑道旁捡到一只白色无线耳机，已放在运动场值班室，请失主带购买凭证前往认领。',
         '', '15600001111', '夜跑的同学', 'resolved', 'demo', created(days=1)),
        ('demo-4', 'lost', '《高等数学》教材', '书籍', ago(days=2), '第一食堂 一楼',
         '封面写着“计科 2203 班”，书里夹着几页课堂笔记，对我很重要，麻烦捡到的同学联系我，非常感谢！',
         '', 'QQ: 123456789', '爱学习的小李', 'open', 'demo', created(days=2)),
        ('demo-5', 'found', '一串钥匙', '钥匙', ago(days=3), '宿舍区 3 号楼门口',
         '宿舍区 3 号楼门口捡到一串钥匙，共有三把，钥匙扣是一个小熊造型，请失主联系认领。',
         '', '13866667777', '热心宿管阿姨', 'closed', 'demo', created(days=3)),
        ('demo-6', 'lost', '黑色保温水杯', '水杯', ago(days=4), '篮球场 东侧看台',
         '黑色磨砂保温杯，杯身有轻微划痕，看台观赛时落下，捡到的同学请联系我，谢谢！',
         '', '13855556666', '打球的小赵', 'resolved', 'demo', created(days=4)),
        ('demo-7', 'found', '红米手机', '电子设备', ago(days=5), '图书馆 一楼大厅',
         '在图书馆一楼大厅座椅上捡到一部红米手机，已交到图书馆服务台，请失主前往服务台认领。',
         '', '图书馆服务台', '图书馆管理员', 'open', 'demo', created(days=5)),
        ('demo-8', 'lost', '学生卡套（含门禁卡）', '其他', ago(days=6), '第二食堂 二楼',
         '深蓝色卡套，里面有门禁卡和一张公交卡，对我日常出行很重要，捡到的同学麻烦尽快联系我，必有感谢！',
         '', '13844445555', '着急的小陈', 'open', 'demo', created(days=6)),
    ]


def init_db():
    with get_conn() as conn:
        conn.execute('''CREATE TABLE IF NOT EXISTS items (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            time TEXT NOT NULL,
            location TEXT NOT NULL,
            description TEXT DEFAULT '',
            image TEXT DEFAULT '',
            contact TEXT NOT NULL,
            nickname TEXT DEFAULT '匿名同学',
            status TEXT DEFAULT 'open',
            device_id TEXT DEFAULT '',
            created_at INTEGER DEFAULT 0
        )''')
        count = conn.execute('SELECT COUNT(*) AS c FROM items').fetchone()['c']
        if count == 0:
            conn.executemany(
                'INSERT INTO items (id, type, name, category, time, location, description, '
                'image, contact, nickname, status, device_id, created_at) '
                'VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
                _seed_rows()
            )
            conn.commit()


# ---------------------------------------------------------------------------
# 数据操作
# ---------------------------------------------------------------------------

def list_items(query):
    sql = 'SELECT * FROM items'
    where = []
    params = []

    if query.get('type') in ('lost', 'found'):
        where.append('type = ?')
        params.append(query['type'])
    if query.get('category'):
        where.append('category = ?')
        params.append(query['category'])
    if query.get('device_id'):
        where.append('device_id = ?')
        params.append(query['device_id'])
    if query.get('kw'):
        kw = '%' + query['kw'] + '%'
        where.append('(name LIKE ? OR description LIKE ? OR location LIKE ? OR category LIKE ?)')
        params += [kw, kw, kw, kw]

    if where:
        sql += ' WHERE ' + ' AND '.join(where)
    sql += ' ORDER BY time DESC'

    with get_conn() as conn:
        rows = conn.execute(sql, params).fetchall()
    return [row_to_item(r) for r in rows]


def get_item_by_id(item_id):
    with get_conn() as conn:
        row = conn.execute('SELECT * FROM items WHERE id = ?', (item_id,)).fetchone()
    return row_to_item(row) if row else None


def create_item(data):
    required = ('id', 'type', 'name', 'category', 'time', 'location', 'contact')
    missing = [k for k in required if not data.get(k)]
    if missing:
        raise ValueError('缺少必填字段: ' + ', '.join(missing))
    if data.get('type') not in ('lost', 'found'):
        raise ValueError('type 必须是 lost 或 found')

    with get_conn() as conn:
        conn.execute(
            'INSERT INTO items (id, type, name, category, time, location, description, '
            'image, contact, nickname, status, device_id, created_at) '
            'VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
            (
                data['id'], data['type'], data['name'], data['category'], data['time'],
                data['location'], data.get('description', ''), data.get('image', ''),
                data['contact'], data.get('nickname', '匿名同学'),
                data.get('status', 'open'), data.get('deviceId', ''), data.get('createdAt', 0)
            )
        )
        conn.commit()
    return get_item_by_id(data['id'])


def update_item(item_id, data):
    fields = {k: v for k, v in data.items() if k in EDITABLE_FIELDS}
    if not fields:
        raise ValueError('没有可更新的字段')

    assignments = ', '.join('{} = ?'.format(f) for f in fields)
    values = [fields[f] for f in fields] + [item_id]

    with get_conn() as conn:
        cur = conn.execute('UPDATE items SET {} WHERE id = ?'.format(assignments), values)
        conn.commit()
        if cur.rowcount == 0:
            return None
    return get_item_by_id(item_id)


def delete_item(item_id):
    with get_conn() as conn:
        cur = conn.execute('DELETE FROM items WHERE id = ?', (item_id,))
        conn.commit()
        return cur.rowcount > 0


# ---------------------------------------------------------------------------
# HTTP 处理
# ---------------------------------------------------------------------------

class Handler(BaseHTTPRequestHandler):
    server_version = 'LostFoundServer/1.0'

    def log_message(self, fmt, *args):
        print('[%s] %s' % (self.log_date_time_string(), fmt % args))

    # ---------- 响应工具 ----------
    def _send_json(self, obj, status=200):
        payload = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(payload)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(payload)

    def _send_error_json(self, status, message):
        self._send_json({'error': message}, status)

    def _read_json(self):
        length = int(self.headers.get('Content-Length', 0) or 0)
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        try:
            return json.loads(raw.decode('utf-8'))
        except Exception:
            raise ValueError('请求体不是合法的 JSON')

    # ---------- 静态资源 ----------
    def _serve_static(self, path):
        rel = unquote(path.lstrip('/'))
        if rel in ('', '/') or rel.endswith('/'):
            rel += 'index.html'
        full = os.path.normpath(os.path.join(BASE_DIR, rel))
        if not (full == BASE_DIR or full.startswith(BASE_DIR + os.sep)):
            self.send_error(404, 'Not Found')
            return
        if not os.path.isfile(full):
            self.send_error(404, 'Not Found')
            return

        ext = os.path.splitext(full)[1].lower()
        ctype = MIME_TYPES.get(ext, 'application/octet-stream')
        try:
            with open(full, 'rb') as f:
                body = f.read()
        except OSError:
            self.send_error(404, 'Not Found')
            return

        self.send_response(200)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    # ---------- 路由 ----------
    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == '/api/items':
            self._send_json(list_items(parse_qs(parsed.query)))
        elif path.startswith('/api/items/'):
            item = get_item_by_id(unquote(path[len('/api/items/'):]))
            if item:
                self._send_json(item)
            else:
                self._send_error_json(404, '信息不存在')
        else:
            self._serve_static(path)

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path != '/api/items':
            self._send_error_json(404, '接口不存在')
            return
        try:
            data = self._read_json()
            item = create_item(data)
            self._send_json(item, 201)
        except ValueError as e:
            self._send_error_json(400, str(e))

    def do_PUT(self):
        parsed = urlparse(self.path)
        if not parsed.path.startswith('/api/items/'):
            self._send_error_json(404, '接口不存在')
            return
        item_id = unquote(parsed.path[len('/api/items/'):])
        try:
            data = self._read_json()
            item = update_item(item_id, data)
            if item:
                self._send_json(item)
            else:
                self._send_error_json(404, '信息不存在')
        except ValueError as e:
            self._send_error_json(400, str(e))

    def do_DELETE(self):
        parsed = urlparse(self.path)
        if not parsed.path.startswith('/api/items/'):
            self._send_error_json(404, '接口不存在')
            return
        item_id = unquote(parsed.path[len('/api/items/'):])
        if delete_item(item_id):
            self._send_json({'ok': True})
        else:
            self._send_error_json(404, '信息不存在')


def main():
    port = DEFAULT_PORT
    if len(sys.argv) > 1 and sys.argv[1].isdigit():
        port = int(sys.argv[1])
    port = int(os.environ.get('PORT', port))

    init_db()
    server = ThreadingHTTPServer(('0.0.0.0', port), Handler)
    print('校园失物招领后端已启动:')
    print('  本机访问   http://127.0.0.1:%d/' % port)
    print('  局域网访问 http://<本机IP>:%d/' % port)
    print('  API 示例   http://127.0.0.1:%d/api/items' % port)
    print('  按 Ctrl+C 停止服务')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n服务已停止')
        server.server_close()


if __name__ == '__main__':
    main()
