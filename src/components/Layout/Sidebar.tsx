import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Home, 
  Bot, 
  Key, 
  Activity, 
  Settings,
  MessageSquare,
  Puzzle,
  Brain,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
}

interface NavItem {
  path: string;
  icon: React.ReactNode;
  text: string;
  children?: {
    path: string;
    text: string;
  }[];
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen }) => {
  const [expandedItems, setExpandedItems] = React.useState<string[]>([]);

  const toggleExpand = (path: string) => {
    setExpandedItems(prev => 
      prev.includes(path) 
        ? prev.filter(p => p !== path)
        : [...prev, path]
    );
  };

  const navItems: NavItem[] = [
    { path: '/dashboard', icon: <Home size={20} />, text: '控制面板' },
    { 
      path: '/bots', 
      icon: <Bot size={20} />, 
      text: '机器人管理',
      children: [
        { path: '/bots/keyword-replies', text: '关键词回复' },
        { path: '/bots/plugins', text: '插件中心' },
        { path: '/bots/ai-model', text: 'AI大模型' },
        { path: '/bots/friends', text: '好友管理' },
        { path: '/bots/moments', text: '朋友圈管理' },
      ]
    },
    { path: '/auth-keys', icon: <Key size={20} />, text: '授权密钥' },
    { path: '/monitoring', icon: <Activity size={20} />, text: '监控状态' },
    { path: '/settings', icon: <Settings size={20} />, text: '系统设置' },
  ];

  const renderNavItem = (item: NavItem) => {
    const isExpanded = expandedItems.includes(item.path);
    const hasChildren = item.children && item.children.length > 0;

    return (
      <li key={item.path} className="mb-1">
        <div className="flex flex-col">
          <div 
            className={`flex items-center p-3 ${isOpen ? 'pl-4' : 'md:justify-center'} rounded-lg 
              text-gray-300 hover:bg-gray-800 transition-colors cursor-pointer`}
            onClick={() => hasChildren ? toggleExpand(item.path) : null}
          >
            <NavLink
              to={item.path}
              className={({ isActive }) => 
                `flex items-center flex-grow ${
                  isActive ? 'text-blue-400' : 'text-gray-300'
                }`
              }
            >
              <span className="text-blue-400">{item.icon}</span>
              <span className={`ml-3 ${!isOpen && 'md:hidden'}`}>
                {item.text}
              </span>
            </NavLink>
            {hasChildren && isOpen && (
              <span className="ml-auto">
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </span>
            )}
          </div>

          {hasChildren && isExpanded && isOpen && item.children && (
            <div className="ml-8 mt-1">
              {item.children.map(child => (
                <NavLink
                  key={child.path}
                  to={child.path}
                  className={({ isActive }) => 
                    `flex items-center p-2 rounded-lg text-sm
                    ${isActive ? 'text-blue-400 bg-gray-800' : 'text-gray-400 hover:bg-gray-800'} 
                    transition-colors`
                  }
                >
                  {child.text}
                </NavLink>
              ))}
            </div>
          )}
        </div>
      </li>
    );
  };

  return (
    <aside className={`bg-gray-900 text-white h-screen fixed top-0 left-0 pt-16 transition-all duration-300 z-10 ${
      isOpen ? 'w-64' : 'w-0 md:w-16'
    }`}>
      <div className="py-4 overflow-y-auto h-full">
        <nav className={`${!isOpen && 'md:flex md:flex-col md:items-center'}`}>
          <ul>
            {navItems.map(renderNavItem)}
          </ul>
        </nav>
      </div>
    </aside>
  );
};

export default Sidebar;