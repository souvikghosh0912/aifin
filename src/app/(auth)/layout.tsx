import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container flex h-16 items-center">
          <Link href="/" className="flex items-center gap-2 font-bold">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
              ₹
            </div>
            <span>finai</span>
          </Link>
        </div>
      </header>
      <main className="container flex min-h-[calc(100vh-4rem)] items-center justify-center py-12">
        {children}
      </main>
    </div>
  );
}
