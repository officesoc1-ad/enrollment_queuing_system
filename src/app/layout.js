import './globals.css';
import Navbar from '@/components/Navbar';

export const metadata = {
  title: 'HAU Enrollment Queuing System',
  description: 'Digital enrollment queuing system for Holy Angel University — School of Computing',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        {children}
      </body>
    </html>
  );
}
