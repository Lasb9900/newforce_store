import SuccessPageClient from "./SuccessPageClient";

type SuccessPageProps = {
  searchParams: Promise<{
    session_id?: string;
  }>;
};

export default async function SuccessPage({ searchParams }: SuccessPageProps) {
  const params = await searchParams;
  const sessionId = params.session_id ?? null;

  return <SuccessPageClient sessionId={sessionId} />;
}