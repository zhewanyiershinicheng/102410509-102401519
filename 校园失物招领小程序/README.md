# 校园失物招领小程序

一个面向校园场景的失物招领 Web 应用。它把分散在班级群、宿舍群和朋友圈里的寻物 / 招领信息集中到一处，支持浏览、搜索、发布、联系与自助管理。

## 功能

- 首页按「全部 / 寻物 / 招领」浏览最新信息
- 按名称、地点、描述和类别实时搜索，支持组合筛选
- 发布寻物或招领信息，可上传最多 6 张压缩后的物品图片，详情页支持横向滚动和点击放大
- 查看详情、复制联系方式，识别手机号时可直接拨号
- 发布者可编辑信息，并独立切换「是否找到/归还」和「是否关闭」
- 「我的发布」集中管理本人信息并统计处理进度
- SQLite 持久化，服务重启后数据不丢失
- 发布者令牌保护管理操作，数据库文件与源代码不会通过 Web 访问

## 技术栈

- 前端：原生 HTML、CSS、JavaScript，移动端风格单页应用，无构建步骤
- 后端：Python 标准库 `http.server` + SQLite，无第三方依赖
- 部署：单进程服务，可配合 Nginx、Caddy 或其他反向代理提供 HTTPS

## 快速开始

环境要求：Python 3.10 或更高版本。

启动命令（**请在本目录执行**）：
```bash
python server.py
```

默认访问地址：`http://127.0.0.1:8765/`


服务首次启动会自动创建 `lostfound.db`。

## 配置

程序直接读取项目根目录下的 `.env` 配置文件，不读取或覆盖进程环境变量。修改配置后需重启应用。

| 配置项 | 默认值 | 说明 |
| --- | --- | --- |
| `host` | `127.0.0.1` | 监听地址；仅局域网使用时可设为 `0.0.0.0` |
| `port` | `8765` | 监听端口 |
| `database` | `lostfound.db` | SQLite 数据库文件路径，相对路径基于应用目录解析 |
| `max_request_bytes` | `2097152` | 单次 API 请求体上限（默认 2 MiB） |

## API

所有接口均为同源 JSON API。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/health` | 服务健康检查 |
| `GET` | `/api/items` | 获取信息，支持 `type`、`category`、`kw`、`from`、`to`、`mine` 查询参数；`from`/`to` 为 ISO 8601 时间范围，支持日期或完整时间 |
| `POST` | `/api/items` | 发布信息 |
| `GET` | `/api/items/<id>` | 获取单条信息 |
| `PUT` | `/api/items/<id>` | 修改本人信息 |
| `DELETE` | `/api/items/<id>` | 删除本人信息 |

发布、修改和删除请求必须携带 `X-Owner-Token`。令牌由浏览器生成并保存在 `localStorage`，服务端仅保存 SHA-256 摘要。清理浏览器站点数据前，请先完成需要保留的信息管理操作。

发布示例：

```bash
curl -X POST http://127.0.0.1:8765/api/items \
  -H 'Content-Type: application/json' \
  -H 'X-Owner-Token: 0123456789abcdef0123456789abcdef' \
  -d '{
    "id": "item-20261009-001",
    "type": "found",
    "name": "蓝色校园卡",
    "category": "校园卡",
    "time": "2026-10-09T12:30:00.000Z",
    "location": "图书馆二楼服务台",
    "description": "卡面有轻微划痕。",
    "images": [],
    "contact": "13800000000",
    "nickname": "值班同学",
    "found": false,
    "closed": false
  }'
```

## 数据与安全

- API 对字段类型、长度、类别、状态和时间进行服务端校验
- 每条信息最多上传 6 张图片；请求体大小由 `.env` 控制，图片仅接受 PNG、JPEG、WebP 的 Base64 data URL
- 静态资源采用白名单托管，数据库、源码和文档无法从 Web 下载
- 响应启用 CSP、禁止 iframe、禁用 MIME 嗅探，并限制浏览器权限
- 「是否找到/归还」与「是否关闭」相互独立，关闭后仍可切换处理状态
- 已关闭的信息不会出现在公开列表中，但发布者仍可在「我的发布」中管理
- SQLite 默认启用 WAL；备份时建议使用 SQLite 的在线备份命令：

  ```bash
  sqlite3 /var/lib/lostfound/lostfound.db ".backup '/backup/lostfound-$(date +%F).db'"
  ```

当前发布者令牌适合无需注册的匿名发布场景。若后续需要跨设备管理、找回权限、内容审核或校内身份认证，应接入学校统一登录并增加服务端账户体系。

## 目录结构

```text
校园失物招领小程序/
├── server.py              # REST API、SQLite 与静态资源服务
├── index.html             # 前端入口
├── css/                   # 基础、组件和页面样式
├── js/                    # 数据层、UI 组件、路由和页面视图
├── images/                # Logo、空状态和分类占位图
├── .env                   # 默认配置
└── README.md              # 项目文档
```
