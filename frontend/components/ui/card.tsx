import * as React from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
}

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
}

interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  className?: string
}

interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  className?: string
}

interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
}

interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }: CardProps, ref: React.Ref<HTMLDivElement>) => (
    <div
      ref={ref}
      className={cn(
        "rounded-lg border bg-card text-card-foreground shadow-sm",
        className
      )}
      {...props}
    />
  )
)
Card.displayName = "Card"

const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, ...props }: CardHeaderProps, ref: React.Ref<HTMLDivElement>) => (
    <div
      ref={ref}
      className={cn("flex flex-col space-y-1.5 p-6", className)}
      {...props}
    />
  )
)
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, ...props }: CardTitleProps, ref: React.Ref<HTMLHeadingElement>) => (
    <h3
      ref={ref}
      className={cn(
        "text-2xl font-semibold leading-none tracking-tight",
        className
      )}
      {...props}
    />
  )
)
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ className, ...props }: CardDescriptionProps, ref: React.Ref<HTMLParagraphElement>) => (
    <p
      ref={ref}
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
)
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, ...props }: CardContentProps, ref: React.Ref<HTMLDivElement>) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  )
)
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, ...props }: CardFooterProps, ref: React.Ref<HTMLDivElement>) => (
    <div
      ref={ref}
      className={cn("flex items-center p-6 pt-0", className)}
      {...props}
    />
  )
)
CardFooter.displayName = "CardFooter"

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
} 