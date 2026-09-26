import './globals.css';

export const metadata = {
  title: 'PropOps AI — Live Sandbox',
  description: 'Personal sandbox for testing PropOps AI live integrations.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  );
}
