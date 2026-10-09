#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""校园失物招领后端服务。

只依赖 Python 标准库，负责 REST API、SQLite 持久化和前端静态资源托管。
生产环境建议通过反向代理提供 HTTPS，并将 host 绑定到内网地址。
配置由项目根目录的 .env 文件直接读取，不读取进程环境变量。
"""

import hashlib
import json
import os
import re
import sqlite3
import time
from contextlib import closing
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, unquote, urlparse


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(BASE_DIR, '.env')
CONFIG_KEYS = {'host', 'port', 'database', 'max_request_bytes'}


def load_config(path):
    if not os.path.isfile(path):
        raise SystemExit('配置文件不存在: %s' % path)

    values = {}
    with open(path, 'r', encoding='utf-8') as handle:
        for line_number, raw_line in enumerate(handle, 1):
            line = raw_line.strip()
            if not line or line.startswith('#'):
                continue
            if '=' not in line:
                raise SystemExit('.env 第 %d 行格式不正确' % line_number)
            key, value = line.split('=', 1)
            key = key.strip().lower()
            value = value.strip()
            if key not in CONFIG_KEYS:
                raise SystemExit('.env 第 %d 行包含未知配置项: %s' % (line_number, key))
            if key in values:
                raise SystemExit('.env 中配置项重复: %s' % key)
            if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
                value = value[1:-1]
            if not value:
                raise SystemExit('.env 配置项不能为空: %s' % key)
            values[key] = value

    missing = CONFIG_KEYS.difference(values)
    if missing:
        raise SystemExit('.env 缺少配置项: %s' % ', '.join(sorted(missing)))

    try:
        port = int(values['port'])
        max_request_bytes = int(values['max_request_bytes'])
    except ValueError as exc:
        raise SystemExit('.env 中的 port 和 max_request_bytes 必须是整数') from exc
    if not 1 <= port <= 65535:
        raise SystemExit('.env 中的 port 必须在 1 到 65535 之间')
    if not 1024 <= max_request_bytes <= 50 * 1024 * 1024:
        raise SystemExit('.env 中的 max_request_bytes 必须在 1024 到 52428800 之间')

    return {
        'host': values['host'],
        'port': port,
        'database': values['database'],
        'max_request_bytes': max_request_bytes,
    }


CONFIG = load_config(CONFIG_PATH)
database_path = os.path.expanduser(CONFIG['database'])
if not os.path.isabs(database_path):
    database_path = os.path.join(BASE_DIR, database_path)
DB_PATH = os.path.abspath(database_path)
LISTEN_HOST = CONFIG['host']
LISTEN_PORT = CONFIG['port']
MAX_BODY_BYTES = CONFIG['max_request_bytes']

ITEM_TYPES = {'lost', 'found'}
ITEM_CATEGORIES = {'校园卡', '钥匙', '水杯', '雨伞', '耳机', '书籍', '电子设备', '其他'}
EDITABLE_FIELDS = (
    'type', 'name', 'category', 'time', 'location', 'description',
    'images', 'contact', 'nickname', 'found', 'closed',
)
MAX_IMAGES = 6
ID_RE = re.compile(r'^[A-Za-z0-9_-]{8,64}$')
OWNER_TOKEN_RE = re.compile(r'^[A-Za-z0-9_-]{32,128}$')
IMAGE_RE = re.compile(r'^data:image/(?:png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=\s]+$')

MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon',
}
STATIC_ROOTS = {'css', 'js', 'images'}


class RequestError(Exception):
    """可返回给客户端的请求错误。"""

    def __init__(self, status, message):
        super().__init__(message)
        self.status = status
        self.message = message


def _owner_hash(token):
    return hashlib.sha256(token.encode('utf-8')).hexdigest()


def _owner_token(headers):
    token = (headers.get('X-Owner-Token') or '').strip()
    if not OWNER_TOKEN_RE.fullmatch(token):
        raise RequestError(401, '缺少有效的发布者令牌')
    return token


def _text(data, key, limit, required=False, default=''):
    value = data.get(key, default)
    if value is None:
        value = default
    if not isinstance(value, str):
        raise RequestError(400, '%s 必须是文本' % key)
    value = value.strip()
    if required and not value:
        raise RequestError(400, '缺少必填字段: %s' % key)
    if len(value) > limit:
        raise RequestError(400, '%s 不能超过 %d 个字符' % (key, limit))
    return value


def _validate_time(value):
    value = _text({'time': value}, 'time', 40, required=True)
    try:
        parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    except ValueError as exc:
        raise RequestError(400, 'time 必须是合法的 ISO 8601 时间') from exc
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    if parsed.timestamp() > time.time() + 24 * 60 * 60:
        raise RequestError(400, 'time 不能晚于当前时间超过一天')
    return parsed.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')


def _query_time(value, key, end=False):
    value = value.strip()
    if len(value) == 10:
        value += 'T23:59:59.999999' if end else 'T00:00:00'
    try:
        parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    except ValueError as exc:
        raise RequestError(400, '%s 必须是合法的 ISO 8601 时间' % key) from exc
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _validate_images(value):
    if value is None:
        return '[]'
    if not isinstance(value, list):
        raise RequestError(400, 'images 必须是数组')
    if len(value) > MAX_IMAGES:
        raise RequestError(400, 'images 最多包含 %d 张图片' % MAX_IMAGES)

    images = []
    for index, image in enumerate(value, 1):
        if not isinstance(image, str) or not image:
            raise RequestError(400, 'images 第 %d 项必须是非空文本' % index)
        if len(image) > MAX_BODY_BYTES or not IMAGE_RE.fullmatch(image):
            raise RequestError(400, 'images 第 %d 项必须是受支持的图片 data URL' % index)
        images.append(image)
    return json.dumps(images, ensure_ascii=False, separators=(',', ':'))


def _boolean(data, key, default=False):
    value = data.get(key, default)
    if not isinstance(value, bool):
        raise RequestError(400, '%s 必须是布尔值' % key)
    return value


def _validate_item(data, partial=False):
    if not isinstance(data, dict):
        raise RequestError(400, '请求体必须是 JSON 对象')
    result = {}
    fields = EDITABLE_FIELDS if partial else ('id',) + EDITABLE_FIELDS

    for field in fields:
        if field not in data:
            if partial or field in ('description', 'images', 'nickname', 'found', 'closed'):
                continue
            raise RequestError(400, '缺少必填字段: %s' % field)

    if not partial:
        item_id = _text(data, 'id', 64, required=True)
        if not ID_RE.fullmatch(item_id):
            raise RequestError(400, 'id 格式不正确')
        result['id'] = item_id

    if 'type' in data or not partial:
        result['type'] = _text(data, 'type', 16, required=True)
        if result['type'] not in ITEM_TYPES:
            raise RequestError(400, 'type 必须是 lost 或 found')
    if 'name' in data or not partial:
        result['name'] = _text(data, 'name', 80, required=True)
    if 'category' in data or not partial:
        result['category'] = _text(data, 'category', 24, required=True)
        if result['category'] not in ITEM_CATEGORIES:
            raise RequestError(400, 'category 不受支持')
    if 'time' in data or not partial:
        result['time'] = _validate_time(data.get('time'))
    if 'location' in data or not partial:
        result['location'] = _text(data, 'location', 120, required=True)
    if 'description' in data or not partial:
        result['description'] = _text(data, 'description', 2000)
    if 'images' in data or not partial:
        result['images'] = _validate_images(data.get('images'))
    if 'contact' in data or not partial:
        result['contact'] = _text(data, 'contact', 120, required=True)
    if 'nickname' in data or not partial:
        result['nickname'] = _text(data, 'nickname', 40) or '匿名同学'
    if 'found' in data or not partial:
        result['found'] = _boolean(data, 'found')
    if 'closed' in data or not partial:
        result['closed'] = _boolean(data, 'closed')
    return result


CREATE_ITEMS_SQL = '''CREATE TABLE items (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    time TEXT NOT NULL,
    location TEXT NOT NULL,
    description TEXT DEFAULT '',
    images TEXT NOT NULL DEFAULT '[]',
    contact TEXT NOT NULL,
    nickname TEXT DEFAULT '匿名同学',
    found INTEGER NOT NULL DEFAULT 0 CHECK (found IN (0, 1)),
    closed INTEGER NOT NULL DEFAULT 0 CHECK (closed IN (0, 1)),
    owner_hash TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL DEFAULT 0
)'''


def get_conn():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA foreign_keys = ON')
    return closing(conn)


def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with get_conn() as conn:
        conn.execute('PRAGMA journal_mode = WAL')
        columns = {row['name'] for row in conn.execute('PRAGMA table_info(items)')}
        if not columns:
            conn.execute(CREATE_ITEMS_SQL)
            columns = {row['name'] for row in conn.execute('PRAGMA table_info(items)')}

        if 'owner_hash' not in columns:
            conn.execute('ALTER TABLE items ADD COLUMN owner_hash TEXT NOT NULL DEFAULT ""')
            columns.add('owner_hash')

        needs_rebuild = (
            'images' in columns and 'image' in columns
        ) or not {'found', 'closed'}.issubset(columns) or 'images' not in columns
        if needs_rebuild:
            if not {'found', 'closed'}.issubset(columns) and 'status' not in columns:
                raise RuntimeError('items 表缺少可迁移的状态字段')
            if 'images' in columns:
                images_sql = "COALESCE(images, '[]')"
            elif 'image' in columns:
                images_sql = '''CASE WHEN image IS NULL OR image = '' THEN '[]'
                    ELSE '["' || image || '"]' END'''
            else:
                images_sql = "'[]'"
            found_sql = (
                "CASE WHEN status = 'resolved' THEN 1 ELSE 0 END"
                if 'found' not in columns else 'found'
            )
            closed_sql = (
                "CASE WHEN status = 'closed' THEN 1 ELSE 0 END"
                if 'closed' not in columns else 'closed'
            )
            conn.execute('ALTER TABLE items RENAME TO items_legacy')
            conn.execute(CREATE_ITEMS_SQL)
            conn.execute('''INSERT INTO items (
                id, type, name, category, time, location, description, images,
                contact, nickname, found, closed, owner_hash, created_at
            )
            SELECT id, type, name, category, time, location, description, %s,
                contact, nickname, %s, %s, owner_hash, created_at
            FROM items_legacy''' % (images_sql, found_sql, closed_sql))
            conn.execute('DROP TABLE items_legacy')
            columns = {row['name'] for row in conn.execute('PRAGMA table_info(items)')}

        conn.execute('CREATE INDEX IF NOT EXISTS idx_items_time ON items(time DESC)')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_items_owner ON items(owner_hash)')
        conn.commit()


def images_from_db(value):
    try:
        images = json.loads(value or '[]')
    except (TypeError, ValueError):
        return []
    if not isinstance(images, list):
        return []
    return [image for image in images[:MAX_IMAGES] if isinstance(image, str) and image]


def row_to_item(row, owner_hash=None):
    return {
        'id': row['id'],
        'type': row['type'],
        'name': row['name'],
        'category': row['category'],
        'time': row['time'],
        'location': row['location'],
        'description': row['description'],
        'images': images_from_db(row['images']),
        'contact': row['contact'],
        'nickname': row['nickname'],
        'found': bool(row['found']),
        'closed': bool(row['closed']),
        'createdAt': row['created_at'],
        'isMine': bool(owner_hash and row['owner_hash'] == owner_hash),
    }


def list_items(query, owner_hash=None):
    where = []
    params = []
    item_type = query.get('type')
    if item_type:
        if item_type not in ITEM_TYPES:
            raise RequestError(400, 'type 必须是 lost 或 found')
        where.append('type = ?')
        params.append(item_type)
    category = query.get('category')
    if category:
        if category not in ITEM_CATEGORIES:
            raise RequestError(400, 'category 不受支持')
        where.append('category = ?')
        params.append(category)
    if query.get('mine') == '1':
        if not owner_hash:
            raise RequestError(401, '缺少有效的发布者令牌')
        where.append('owner_hash = ?')
        params.append(owner_hash)
    else:
        where.append('closed = 0')
    keyword = query.get('kw', '').strip()
    if len(keyword) > 80:
        raise RequestError(400, 'kw 不能超过 80 个字符')
    if keyword:
        pattern = '%' + keyword + '%'
        where.append('(name LIKE ? OR description LIKE ? OR location LIKE ? OR category LIKE ?)')
        params.extend([pattern, pattern, pattern, pattern])

    time_from = _query_time(query.get('from', ''), 'from') if query.get('from') else None
    time_to = _query_time(query.get('to', ''), 'to', end=True) if query.get('to') else None
    if time_from and time_to and time_from > time_to:
        raise RequestError(400, 'from 不能晚于 to')
    if time_from:
        where.append('julianday(time) >= julianday(?)')
        params.append(time_from.isoformat().replace('+00:00', 'Z'))
    if time_to:
        where.append('julianday(time) <= julianday(?)')
        params.append(time_to.isoformat().replace('+00:00', 'Z'))

    sql = 'SELECT * FROM items'
    if where:
        sql += ' WHERE ' + ' AND '.join(where)
    sql += ' ORDER BY time DESC LIMIT 500'
    with get_conn() as conn:
        rows = conn.execute(sql, params).fetchall()
    return [row_to_item(row, owner_hash) for row in rows]


def get_item_by_id(item_id, owner_hash=None):
    with get_conn() as conn:
        row = conn.execute('SELECT * FROM items WHERE id = ?', (item_id,)).fetchone()
    if row and bool(row['closed']) and row['owner_hash'] != owner_hash:
        return None
    return row_to_item(row, owner_hash) if row else None


def create_item(data, owner_hash):
    item = _validate_item(data, partial=False)
    item['createdAt'] = int(time.time() * 1000)
    with get_conn() as conn:
        try:
            conn.execute(
                'INSERT INTO items (id, type, name, category, time, location, description, '
                'images, contact, nickname, found, closed, owner_hash, created_at) '
                'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                (
                    item['id'], item['type'], item['name'], item['category'], item['time'],
                    item['location'], item['description'], item['images'], item['contact'],
                    item['nickname'], item['found'], item['closed'], owner_hash, item['createdAt'],
                )
            )
            conn.commit()
        except sqlite3.IntegrityError as exc:
            raise RequestError(409, '该信息已存在') from exc
    return get_item_by_id(item['id'], owner_hash)


def update_item(item_id, data, owner_hash):
    fields = _validate_item(data, partial=True)
    if not fields:
        raise RequestError(400, '没有可更新的字段')
    assignments = ', '.join('%s = ?' % field for field in fields)
    values = list(fields.values()) + [item_id, owner_hash]
    with get_conn() as conn:
        row = conn.execute('SELECT owner_hash FROM items WHERE id = ?', (item_id,)).fetchone()
        if not row:
            return None
        if row['owner_hash'] != owner_hash:
            raise RequestError(403, '没有权限修改这条信息')
        conn.execute('UPDATE items SET %s WHERE id = ? AND owner_hash = ?' % assignments, values)
        conn.commit()
    return get_item_by_id(item_id, owner_hash)


def delete_item(item_id, owner_hash):
    with get_conn() as conn:
        row = conn.execute('SELECT owner_hash FROM items WHERE id = ?', (item_id,)).fetchone()
        if not row:
            return False
        if row['owner_hash'] != owner_hash:
            raise RequestError(403, '没有权限删除这条信息')
        conn.execute('DELETE FROM items WHERE id = ? AND owner_hash = ?', (item_id, owner_hash))
        conn.commit()
        return True


class Server(ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True


class Handler(BaseHTTPRequestHandler):
    server_version = 'LostFoundServer/2.0'

    def log_message(self, fmt, *args):
        print('[%s] %s' % (self.log_date_time_string(), fmt % args))

    def _headers(self, content_type, length, cache='no-store'):
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(length))
        self.send_header('Cache-Control', cache)
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
        self.send_header(
            'Content-Security-Policy',
            "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; "
            "script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; "
            "frame-ancestors 'none'"
        )

    def _send_json(self, obj, status=200):
        payload = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self._headers('application/json; charset=utf-8', len(payload))
        self.end_headers()
        self.wfile.write(payload)

    def _send_error_json(self, status, message):
        self._send_json({'error': message}, status)

    def _read_json(self):
        raw_length = self.headers.get('Content-Length', '0')
        try:
            length = int(raw_length or 0)
        except ValueError as exc:
            raise RequestError(400, 'Content-Length 不合法') from exc
        if length <= 0:
            raise RequestError(400, '请求体不能为空')
        if length > MAX_BODY_BYTES:
            raise RequestError(413, '请求体过大')
        if 'application/json' not in (self.headers.get('Content-Type') or ''):
            raise RequestError(415, 'Content-Type 必须是 application/json')
        raw = self.rfile.read(length)
        try:
            data = json.loads(raw.decode('utf-8'))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise RequestError(400, '请求体不是合法的 JSON') from exc
        if not isinstance(data, dict):
            raise RequestError(400, '请求体必须是 JSON 对象')
        return data

    def _query(self, parsed):
        return {key: values[-1] for key, values in parse_qs(parsed.query).items()}

    def _serve_static(self, path):
        rel = unquote(path.lstrip('/'))
        if rel in ('', '/'):
            rel = 'index.html'
        if '\x00' in rel:
            self.send_error(404, 'Not Found')
            return
        rel = os.path.normpath(rel).replace('\\', '/')
        parts = rel.split('/')
        allowed = rel == 'index.html' or (
            len(parts) == 2 and parts[0] in STATIC_ROOTS and not parts[1].startswith('.')
        ) or (
            len(parts) == 3
            and ((parts[0] == 'js' and parts[1] == 'views')
                 or (parts[0] == 'css' and parts[1] == 'vendor'))
            and not parts[2].startswith('.')
        )
        full = os.path.join(BASE_DIR, rel)
        if not allowed or not os.path.isfile(full):
            self.send_error(404, 'Not Found')
            return
        ext = os.path.splitext(full)[1].lower()
        ctype = MIME_TYPES.get(ext)
        if not ctype:
            self.send_error(404, 'Not Found')
            return
        try:
            with open(full, 'rb') as handle:
                body = handle.read()
        except OSError:
            self.send_error(404, 'Not Found')
            return
        self.send_response(200)
        self._headers(ctype, len(body), 'public, max-age=300')
        self.end_headers()
        self.wfile.write(body)

    def _owner(self, required=False):
        token = (self.headers.get('X-Owner-Token') or '').strip()
        if not token and not required:
            return None
        return _owner_hash(_owner_token(self.headers))

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == '/api/health':
            self._send_json({'ok': True, 'service': 'lost-found', 'version': '2.0'})
            return
        if parsed.path == '/api/items':
            try:
                self._send_json(list_items(self._query(parsed), self._owner()))
            except RequestError as exc:
                self._send_error_json(exc.status, exc.message)
            return
        if parsed.path.startswith('/api/items/'):
            try:
                item_id = unquote(parsed.path[len('/api/items/'):])
                item = get_item_by_id(item_id, self._owner())
                if item:
                    self._send_json(item)
                else:
                    self._send_error_json(404, '信息不存在')
            except RequestError as exc:
                self._send_error_json(exc.status, exc.message)
            return
        self._serve_static(parsed.path)

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path != '/api/items':
            self._send_error_json(404, '接口不存在')
            return
        try:
            self._send_json(create_item(self._read_json(), self._owner(required=True)), 201)
        except RequestError as exc:
            self._send_error_json(exc.status, exc.message)

    def do_PUT(self):
        parsed = urlparse(self.path)
        if not parsed.path.startswith('/api/items/'):
            self._send_error_json(404, '接口不存在')
            return
        try:
            item_id = unquote(parsed.path[len('/api/items/'):])
            item = update_item(item_id, self._read_json(), self._owner(required=True))
            if item:
                self._send_json(item)
            else:
                self._send_error_json(404, '信息不存在')
        except RequestError as exc:
            self._send_error_json(exc.status, exc.message)

    def do_DELETE(self):
        parsed = urlparse(self.path)
        if not parsed.path.startswith('/api/items/'):
            self._send_error_json(404, '接口不存在')
            return
        try:
            item_id = unquote(parsed.path[len('/api/items/'):])
            if delete_item(item_id, self._owner(required=True)):
                self._send_json({'ok': True})
            else:
                self._send_error_json(404, '信息不存在')
        except RequestError as exc:
            self._send_error_json(exc.status, exc.message)


def main():
    init_db()
    server = Server((LISTEN_HOST, LISTEN_PORT), Handler)
    print('校园失物招领：')
    print('  访问地址   http://%s:%d/' % (LISTEN_HOST, LISTEN_PORT))
    print('  健康检查   http://%s:%d/api/health' % (LISTEN_HOST, LISTEN_PORT))
    print('  按 Ctrl+C 停止服务')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n服务已停止')
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
