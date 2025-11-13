import type React from "react"

interface CodeBlockProps {
  children: React.ReactNode
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ children }) => {
  return (
    <pre className="mt-2 p-4 bg-muted rounded text-sm max-h-[500px] overflow-auto">
      <code>{children}</code>
    </pre>
  )
}
