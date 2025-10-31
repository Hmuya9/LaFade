import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface PricingCardProps {
  title: string;
  price: string;
  bullets: ReadonlyArray<string>;
  onClick?: () => void;
  accent?: boolean;
  buttonText?: string;
}

export function PricingCard({
  title, price, bullets, onClick, accent = false, buttonText = "Get Started"
}: PricingCardProps) {
  return (
    <Card className={`rounded-2xl p-8 ${accent ? "bg-zinc-900 text-white" : "bg-white border border-zinc-200"}`}>
      <h3 className="text-2xl font-semibold tracking-tight">{title}</h3>
      <div className="text-4xl font-bold mt-2">{price}</div>
      <ul className="space-y-2 mt-6 text-sm">
        {bullets.map((b, i) => (
          <li key={i} className="flex gap-2">
            <span className={`mt-1 ${accent ? "text-amber-400" : "text-amber-600"}`}>✓</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
      <Button className={`w-full mt-8 ${accent ? "bg-white text-zinc-900 hover:bg-zinc-100" : "bg-zinc-900 text-white hover:bg-zinc-800"}`} onClick={onClick}>
        {buttonText}
      </Button>
    </Card>
  );
}
