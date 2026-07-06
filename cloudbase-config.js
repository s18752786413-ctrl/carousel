/**
 * 腾讯云 CloudBase（云开发）配置
 *
 * 设置步骤：
 * 1. 打开 https://console.cloud.tencent.com → 云开发 CloudBase → 开通并创建环境
 * 2. 复制「环境 ID」（envId，形如 cloud1-xxxxx）
 * 3. 把 envId 填到下面 ENVID 引号里
 * 4. 数据库创建 images 集合（权限：所有用户可读 / 仅创建者可写）
 * 5. 身份认证开启「匿名登录」+「用户名密码登录」并创建管理员账号
 */
const ENVID = 'picture-d3gqmzg1cc85b373b'; // 你的 CloudBase 环境 ID

// 初始化 CloudBase（全局 app 供 index.html / admin.html 使用）
const app = cloudbase.init({ env: ENVID });
