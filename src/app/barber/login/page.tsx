import { AuthCard } from "@/components/auth/AuthCard";
import { Scissors } from "lucide-react";
import { BarberLoginForm } from "./BarberLoginForm";

export default function BarberLoginPage() {
  return (
    <AuthCard
      icon={Scissors}
      title="Barber sign-in"
      subtitle="Access the LaFade barber dashboard"
      footer={null}
    >
      <BarberLoginForm />
    </AuthCard>
  );
}
