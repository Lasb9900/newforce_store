export default async function SuccessPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id } = await searchParams;
  return <div><h1 className="text-2xl font-bold">Pago exitoso</h1><p>Session: {session_id}</p></div>;
}
