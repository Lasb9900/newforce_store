import Link from "next/link";

export default function CancelPage() {
  return <div><h1 className="text-2xl font-bold">Pago cancelado</h1><Link href="/cart" className="underline">Volver al carrito</Link></div>;
}
