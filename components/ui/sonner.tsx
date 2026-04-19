'use client'

import { useTheme } from 'next-themes'
import { Toaster as Sonner, ToasterProps } from 'sonner'

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      style={
        {
          '--normal-bg': 'var(--glass-bg-strong)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--glass-border-strong)',
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            'border-[var(--glass-border-strong)] bg-[var(--glass-bg-strong)] backdrop-blur-2xl shadow-lg',
          title: 'text-foreground font-semibold',
          description: 'text-foreground/70',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
