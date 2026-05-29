import './globals.css';
import { AuthProvider } from '../context/AuthContext';

export const metadata = {
  title:       'P&B — Private & Bold',
  description: 'End-to-end encrypted private messaging and calling',
  manifest:    '/manifest.json',
  icons: {
    icon:      [{ url: '/favicon-16x16.png', sizes: '16x16' }, { url: '/favicon-32x32.png', sizes: '32x32' }],
    apple:     [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
    shortcut:  '/favicon.ico',
  },
  openGraph: {
    title:       'P&B — Private & Bold',
    description: 'End-to-end encrypted messaging',
    type:        'website',
  },
  themeColor: '#3B82F6',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@stream-io/video-react-sdk@1.7.0/dist/css/styles.css" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="bg-bg0 text-textP font-sans antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
