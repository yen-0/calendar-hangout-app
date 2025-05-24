import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-150px)]"> {/* Adjust height based on header/footer */}
      <h1 className="text-4xl font-bold mb-8">Welcome to Calendar & Hangouts!</h1>
      <div className="space-x-4">
        <Link href="/sign-in" className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          Sign In
        </Link>
        <Link href="/sign-up" className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
          Sign Up
        </Link>
      </div>
      {/* We will add a "Continue as Guest" button later */}
    </div>
  );
}