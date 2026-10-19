import { Suspense } from "react";
import { PedidoStatus } from "@/components/eleitor/pedido-status";

export default function PedidoPage() {
  return (
    <Suspense fallback={null}>
      <PedidoStatus />
    </Suspense>
  );
}
