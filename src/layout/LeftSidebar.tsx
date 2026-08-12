import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { LayoutGrid, PieChart, HardDrive, Folder, FileText, Copy, Sparkles, Settings, MessageSquare } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Button } from "../components/ui/Button";
import LogoIcon from "../assets/icon.svg";
import SidebarBg from "../assets/sidebar_bg.jpg";

interface LeftSidebarProps {
  onDashboard: () => void;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({ onDashboard }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  const sidebarItems = [
    { label: "Overview", icon: LayoutGrid, path: "/" },
    { label: "Disk Analyzer", icon: PieChart, path: "/analyzer" },
    { label: "Volumes", icon: HardDrive, path: "/volumes" },
    { label: "Folders", icon: Folder, path: "/folders" },
    { label: "Large Files", icon: FileText, path: "/large-files" },
    { label: "Duplicates", icon: Copy, path: "/duplicates" },
    { label: "Cleanup", icon: Sparkles, path: "/cleanup" },
  ];

  const bottomSidebarItems = [
    { label: "Settings", icon: Settings, path: "/settings" },
  ];

  return (
    <aside className='w-64 border-r border-surface-border bg-slate-950/25 backdrop-blur-md flex flex-col justify-between p-4 shrink-0 select-none relative overflow-hidden'>
      {/* Background Mountain Image from Mockup */}
      <div 
        className="absolute inset-0 w-full h-full bg-cover bg-bottom bg-no-repeat opacity-[0.25] pointer-events-none z-0" 
        style={{ backgroundImage: `url(${SidebarBg})` }} 
      />

      <div className='space-y-6 relative z-10'>
        {/* Logo area */}
        <button
          onClick={() => {
            navigate("/");
            onDashboard();
          }}
          className='flex items-center gap-2.5 px-2 py-1.5 hover:opacity-95 text-left w-full cursor-pointer bg-transparent border-none focus:outline-none'
        >
          <img src={LogoIcon} className='w-9 h-9 shrink-0' alt='HyperDisk Logo' />
          <h1 className='font-bold text-base text-slate-100 tracking-tight'>HyperDisk</h1>
        </button>

        {/* Navigation Menu */}
        <nav className='space-y-1.5'>
          {sidebarItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = item.path === "/" ? currentPath === "/" : currentPath.startsWith(item.path);

            return (
              <Button
                key={item.label}
                onClick={() => {
                  navigate(item.path);
                  if (item.path === "/") {
                    onDashboard();
                  }
                }}
                variant={isActive ? "primary" : "ghost"}
                size='md'
                leftIcon={<IconComponent className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-500"}`} />}
                className='w-full justify-start gap-3 px-3.5 font-semibold text-xs h-9 rounded-lg border-none'
              >
                {item.label}
              </Button>
            );
          })}
        </nav>
      </div>

      <div className='space-y-4 relative z-10'>
        {/* Bottom Navigation Menu */}
        <nav className='space-y-1.5'>
          {bottomSidebarItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = currentPath.startsWith(item.path);

            return (
              <Button
                key={item.label}
                onClick={() => navigate(item.path)}
                variant={isActive ? "primary" : "ghost"}
                size='md'
                leftIcon={<IconComponent className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-500"}`} />}
                className='w-full justify-start gap-3 px-3.5 font-semibold text-xs h-9 rounded-lg border-none'
              >
                {item.label}
              </Button>
            );
          })}
          <Button
            onClick={() => openUrl("https://github.com/sadid56/HyperDisk/issues")}
            variant='ghost'
            size='md'
            leftIcon={<MessageSquare className='w-4 h-4 text-slate-500' />}
            className='w-full justify-start gap-3 px-3.5 font-semibold text-xs h-9 rounded-lg border-none'
          >
            Feedback
          </Button>
        </nav>
      </div>
    </aside>
  );
};
