import LoginPageClient from "./LoginPageClient";

type LoginPageProps = {
  searchParams: Promise<{
    next?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = params.next ?? "/account";

  return <LoginPageClient nextPath={next} />;
}