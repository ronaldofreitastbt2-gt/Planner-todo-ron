export function PageHeader({
  title,
  subtitle,
}: {
  title: string
  subtitle?: string
}) {
  return (
    <div className="px-5 pt-safe pb-2">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {subtitle && (
        <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
      )}
    </div>
  )
}
