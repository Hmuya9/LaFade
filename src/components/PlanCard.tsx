interface PlanCardProps {
  title: string;
  price: string;
  bullets: string[];
  cta: string;
  accent: "border" | "bg";
}

export function PlanCard({ title, price, bullets, cta, accent }: PlanCardProps) {
  return (
    <div className={`rounded-2xl p-8 ${
      accent === "bg" 
        ? "bg-black text-white" 
        : "border-2 border-gray-200 hover:border-gray-300"
    }`}>
      <h4 className="text-2xl font-semibold mb-2">{title}</h4>
      <div className="text-4xl font-bold mb-6">{price}</div>
      <ul className="space-y-3 mb-8">
        {bullets.map((bullet, index) => (
          <li key={index} className="flex items-start">
            <span className="text-green-500 mr-3">✓</span>
            <span className="text-sm">{bullet}</span>
          </li>
        ))}
      </ul>
      <a 
        href={cta} 
        className={`inline-block rounded-xl px-6 py-3 font-semibold transition-colors w-full text-center ${
          accent === "bg" 
            ? "bg-white text-black hover:bg-gray-100" 
            : "bg-black text-white hover:bg-gray-800"
        }`}
      >
        Subscribe Now - First Cut Free
      </a>
    </div>
  );
}

