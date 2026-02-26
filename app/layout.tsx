import type {Metadata} from 'next';
import { Outfit, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: '⚡ MFLIX LIVE PRO',
  description: 'Modern link bypass and direct stream extractor engine.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={`${outfit.variable} ${jetbrainsMono.variable}`}>
      <body suppressHydrationWarning className="bg-[#050505] text-white font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
