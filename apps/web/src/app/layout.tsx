import './globals.css';
import { AuthProvider } from '@/context/AuthContext';

export const metadata = {
  title: 'BizLedger - Small Business Accounting & Finance',
  description: 'Double-entry accounting, GST invoicing, cheque management and financial reporting.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-blue-600 selection:text-white">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
