import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Image from 'next/image';
export default function NotFound() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b py-4 bg-white">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
                        <Image src="/logo.png" alt="Phaigo Logo" width={32} height={32} />

            <h2 className="logo-text text-2xl bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">phaigo</h2>
          </div>
        </div>
      </header>
      
      <main className="flex-1 container mx-auto flex flex-col items-center justify-center py-12 px-4">
        <div className="text-center max-w-md">
          <div className="mb-6">
            <h1 className="text-9xl font-bold text-gray-200">404</h1>
            <div className="w-20 h-20 mx-auto -mt-24 mb-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white text-4xl font-bold">
              ?
            </div>
          </div>
          
          <h2 className="text-3xl font-bold mb-4">Page Not Found</h2>
          <p className="text-gray-600 mb-8">
            We couldn&apos;t find the page you were looking for. The link might be incorrect, or the page may have been moved or deleted.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild>
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Return Home
              </Link>
            </Button>
          </div>
        </div>
      </main>
      
      <footer className="border-t py-6 bg-white">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-2 mb-4 md:mb-0">
            <Image src="/logo.png" alt="Phaigo Logo" width={32} height={32} />

              <span className="logo-text text-gray-800 text-lg">phaigo</span>
            </div>
            
            <p className="text-muted-foreground text-sm">
              &copy; {new Date().getFullYear()} Phaigo - Powered by <a href="https://www.pyusd.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">PYUSD</a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
