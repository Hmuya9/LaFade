import * as React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

type AuthCardProps = {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export function AuthCard({
  icon: Icon,
  title,
  subtitle,
  children,
  footer,
}: AuthCardProps) {
  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <div className="flex items-center gap-3">
            {Icon && <Icon className="h-7 w-7 text-zinc-900" />}
            <CardTitle className="text-2xl font-semibold">{title}</CardTitle>
          </div>
          {subtitle && (
            <CardDescription className="text-sm text-zinc-600">
              {subtitle}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>{children}</CardContent>
        {footer && (
          <CardFooter className="flex flex-col items-start gap-2 pt-0">
            {footer}
          </CardFooter>
        )}
      </Card>
    </div>
  );
}


