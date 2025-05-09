import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, User, Menu, Bot, FileText } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface HeaderProps {
  toggleSidebar: () => void;
}

const Header: React.FC<HeaderProps> = ({ toggleSidebar }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showDeployGuide, setShowDeployGuide] = React.useState(false);

  const getPageTitle = () => {
    const path = location.pathname;
    if (path.startsWith('/bots/keyword-replies')) return '关键词回复';
    if (path.startsWith('/bots/plugins')) return '插件中心';
    if (path.startsWith('/bots/ai-model')) return 'AI大模型';
    if (path.startsWith('/bots/friends')) return '好友管理';
    if (path.startsWith('/bots/moments')) return '朋友圈管理';
    if (path.startsWith('/bots')) return '机器人管理';
    if (path === '/dashboard') return '控制面板';
    if (path === '/auth-keys') return '授权密钥';
    if (path === '/monitoring') return '监控状态';
    if (path === '/settings') return '系统设置';
    return '';
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      <header className="bg-gradient-to-r from-blue-900 to-gray-900 text-white p-4 shadow-md flex justify-between items-center fixed top-0 left-0 right-0 z-20">
        <div className="flex items-center">
          <button 
            onClick={toggleSidebar} 
            className="mr-4 p-1 rounded hover:bg-blue-800 transition-colors md:hidden"
          >
            <Menu size={24} />
          </button>
          <Link to="/dashboard" className="text-xl font-bold flex items-center">
            <Bot size={24} className="text-blue-300 mr-2" />
            <span className="text-blue-300">bot</span>
            <span className="ml-1">机器人管理平台</span>
          </Link>
          {getPageTitle() && (
            <>
              <span className="mx-4 text-gray-400">/</span>
              <h1 className="text-lg font-medium">{getPageTitle()}</h1>
            </>
          )}
        </div>
        
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setShowDeployGuide(true)}
            className="p-2 rounded hover:bg-blue-800 transition-colors flex items-center"
            title="部署指南"
          >
            <FileText size={18} />
          </button>
          
          {user && (
            <div className="flex items-center">
              <div className="hidden md:flex items-center mr-4">
                <User size={18} className="mr-2 text-blue-300" />
                <span>{user.email}</span>
              </div>
              <button 
                onClick={handleLogout}
                className="p-2 rounded hover:bg-blue-800 transition-colors flex items-center"
              >
                <LogOut size={18} />
                <span className="ml-1 hidden md:inline">退出</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {showDeployGuide && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-medium">Linux 部署指南</h3>
              <button
                onClick={() => setShowDeployGuide(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                &times;
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <div className="prose max-w-none">
                <h4>1. 系统要求</h4>
                <ul>
                  <li>Linux 服务器 (推荐 Ubuntu 20.04 LTS)</li>
                  <li>Node.js 18+ (推荐使用 nvm 安装)</li>
                  <li>PM2 进程管理器</li>
                  <li>Nginx 网页服务器</li>
                </ul>

                <h4>2. 安装依赖</h4>
                <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto">
{`# 安装 Node.js
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18

# 安装 PM2
npm install -g pm2

# 安装 Nginx
sudo apt update
sudo apt install nginx`}
                </pre>

                <h4>3. 项目部署</h4>
                <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto">
{`# 克隆项目
git clone <your-repo-url>
cd your-project

# 安装依赖
npm install

# 构建项目
npm run build

# 使用 PM2 启动服务
pm2 start npm --name "wechat-bot" -- start`}
                </pre>

                <h4>4. Nginx 配置</h4>
                <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto">
{`# 创建 Nginx 配置文件
sudo nano /etc/nginx/sites-available/wechat-bot

# 添加以下配置
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# 创建符号链接
sudo ln -s /etc/nginx/sites-available/wechat-bot /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx`}
                </pre>

                <h4>5. SSL 配置 (推荐)</h4>
                <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto">
{`# 安装 Certbot
sudo apt install certbot python3-certbot-nginx

# 获取 SSL 证书
sudo certbot --nginx -d your-domain.com

# 证书会自动续期，也可以手动测试续期
sudo certbot renew --dry-run`}
                </pre>

                <h4>6. 常用维护命令</h4>
                <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto">
{`# 查看应用状态
pm2 status

# 查看日志
pm2 logs wechat-bot

# 重启应用
pm2 restart wechat-bot

# 停止应用
pm2 stop wechat-bot

# 设置开机自启
pm2 startup
pm2 save`}
                </pre>

                <h4>7. 注意事项</h4>
                <ul>
                  <li>确保服务器防火墙开放了 80 和 443 端口</li>
                  <li>定期备份数据和配置文件</li>
                  <li>设置日志轮转避免占用过多磁盘空间</li>
                  <li>配置服务器监控和告警机制</li>
                  <li>定期更新系统和依赖包以修复安全漏洞</li>
                </ul>
              </div>
            </div>
            
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
              <button
                onClick={() => setShowDeployGuide(false)}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Header;