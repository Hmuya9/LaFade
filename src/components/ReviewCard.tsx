import { Card, CardContent } from "@/components/ui/card"

interface ReviewCardProps {
  name: string
  rating: number
  comment: string
  createdAt: string
}

export function ReviewCard({ name, rating, comment, createdAt }: ReviewCardProps) {
  const renderStars = (rating: number) => {
    return (
      <div
        className="flex"
        role="img"
        aria-label={`${rating} out of 5 stars`}
      >
        {Array.from({ length: 5 }, (_, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={`text-lg ${
              i < rating ? "text-yellow-400" : "text-gray-300"
            }`}
          >
            ★
          </span>
        ))}
      </div>
    )
  }

  return (
    <Card className="h-full">
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex">{renderStars(rating)}</div>
          <span className="text-sm text-zinc-600">
            {new Date(createdAt).toLocaleDateString()}
          </span>
        </div>
        <h4 className="font-semibold text-zinc-900 mb-2">{name}</h4>
        <p className="text-zinc-600 leading-relaxed">{comment}</p>
      </CardContent>
    </Card>
  )
}
