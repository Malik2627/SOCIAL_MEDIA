import { Outlet } from 'react-router-dom';
import Navbar from './Navbar.jsx';
import '../styles/layout.css';

export default function Layout() {
  return (
    <div className="app-layout">
      <Navbar />
      <main className="app-layout-main">
        <Outlet />
      </main>
    </div>
  );
}

