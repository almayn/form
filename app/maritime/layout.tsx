import Navbar from "@/components/Navbar";
import AuthGuard from "@/components/AuthGuard";

export default function MaritimeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div dir="rtl" className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}