'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navbar() {
  const pathname = usePathname();

  // Don't show navbar on admin pages (they have their own layout)
  if (pathname?.startsWith('/admin/dashboard')) return null;

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link href="/" className="navbar-brand">
          <img src="/soc2.png" alt="SOC Logo" className="navbar-logo" />
          <span>HAU</span> Enrollment Queue
        </Link>
        <ul className="navbar-links">
          <li>
            <Link href="/register" className={pathname === '/register' ? 'active' : ''}>
              Register
            </Link>
          </li>
          <li>
            <Link href="/queue" className={pathname === '/queue' ? 'active' : ''}>
              Queue Board
            </Link>
          </li>
          <li>
            <Link href="/admin" className={pathname === '/admin' ? 'active' : ''}>
              Admin
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
}
